"""Fixed-script renderer for Clipcademy's vertical clips. No LLM, no runtime script generation.

Pipeline (Context/notes.md, Member 1):
1. Narrate the reviewed script with ElevenLabs, which also returns when each word is spoken.
   (``CLIPCADEMY_VOICE=espeak`` makes an offline draft instead; drafts get their own fingerprint.)
2. ``beats.py`` turns the script's beats (spoken cue -> actions) into a timed plan and checks pacing.
3. ``sfx.py`` mixes our own sound effects and the series sting under the narration.
4. Remotion (``video/remotion``) draws every frame of the 720x1280 clip from that plan.
The MP4, captions (.vtt), transcript (.txt) and manifest (.json) land in video/media.
"""
import argparse
import array
import ctypes
import hashlib
import importlib.util
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
REMOTION = HERE / 'remotion'
TEMPLATE = json.loads((HERE / 'template.json').read_text(encoding='utf-8'))
LEAD, TAIL = 0.15, 0.45     # silence before and after the narration
MIN_S, MAX_S = 15, 30       # notes.md: 15-30 s, one idea per clip


def _code_files():
    files = [HERE / n for n in ('render.py', 'beats.py', 'sfx.py', 'tts.py')]
    files += sorted((REMOTION / 'src').rglob('*.ts*')) + [REMOTION / 'package.json']
    return files


def load_script(topic, variant):
    # Select by catalog values, never by a caller-controlled filesystem path.
    for path in sorted((HERE / 'scripts').glob('*.json')):
        script = json.loads(path.read_text(encoding='utf-8'))
        if (script['topic_id'], script['variant_id']) == (topic, variant):
            return script
    raise ValueError('Unknown lesson variant')


def voice_engine():
    return os.environ.get('CLIPCADEMY_VOICE') or TEMPLATE['tts']['engine']


def fingerprint(script, voice=None):
    voice = voice or TEMPLATE['tts']['engine']
    payload = json.dumps([script, TEMPLATE, voice], sort_keys=True, ensure_ascii=False).encode()
    code = b''.join(p.read_bytes() for p in _code_files())
    return hashlib.sha256(code + payload).hexdigest()[:16]


def _module(name):
    # Loaded by path: jobs.py imports this file without putting video/ on sys.path.
    spec = importlib.util.spec_from_file_location(f'clipcademy_{name}', HERE / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Event(ctypes.Structure):
    _fields_ = [('type', ctypes.c_int), ('unique_identifier', ctypes.c_uint), ('text_position', ctypes.c_int),
                ('length', ctypes.c_int), ('audio_position', ctypes.c_int), ('sample', ctypes.c_int),
                ('user_data', ctypes.c_void_p), ('id', ctypes.c_char * 8)]


def narrate(text):
    """Return (pcm bytes, sample rate, [(word, start s, end s)]) using eSpeak retrieval mode."""
    import espeakng_loader
    lib = ctypes.CDLL(espeakng_loader.get_library_path())
    lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    rate = lib.espeak_Initialize(2, 0, str(Path(espeakng_loader.get_data_path()).parent).encode(), 0)
    if rate <= 0:
        raise RuntimeError('Could not initialize narration')
    chunks, marks = [], []
    callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int,
                                     ctypes.POINTER(_Event))

    @callback_type
    def collect(samples, count, events):
        if samples and count:
            chunks.append(ctypes.string_at(samples, count * 2))
        i = 0
        while events and events[i].type != 0:
            if events[i].type == 1:  # word event
                marks.append((events[i].text_position - 1, events[i].sample / rate))
            i += 1
        return 0
    lib.espeak_SetSynthCallback(collect)
    if lib.espeak_SetVoiceByName(b'en-us') != 0:
        raise RuntimeError('Narration voice unavailable')
    lib.espeak_SetParameter(1, 160, 0)
    data = text.encode('utf-8') + b'\0'
    lib.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
                                 ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
    result = lib.espeak_Synth(data, len(data), 0, 1, 0, 1, None, None)
    lib.espeak_Synchronize()
    lib.espeak_Terminate()
    if result or not chunks:
        raise RuntimeError('Narration failed')
    pcm = b''.join(chunks)
    return pcm, rate, word_times(text, marks, len(pcm) / 2 / rate)


def word_times(text, marks, total):
    """Map eSpeak word events (character offset, seconds) onto the script's words."""
    spans = [(m.group(), m.start(), m.end()) for m in re.finditer(r'\S+', text)]
    starts = [None] * len(spans)
    for offset, seconds in marks:
        for i, (_, a, b) in enumerate(spans):
            if a <= offset < b or (offset < a and starts[i] is None):
                if starts[i] is None:
                    starts[i] = seconds
                break
    known = [(i, s) for i, s in enumerate(starts) if s is not None]
    if not known:
        known = [(0, 0.0)]
    for i in range(len(starts)):
        if starts[i] is None:  # interpolate the rare word eSpeak does not report
            before = max((k for k in known if k[0] < i), default=(0, 0.0), key=lambda k: k[0])
            after = min((k for k in known if k[0] > i), default=(len(spans), total), key=lambda k: k[0])
            starts[i] = lerp(before[1], after[1], (i - before[0]) / max(after[0] - before[0], 1))
    for i in range(1, len(starts)):
        starts[i] = max(starts[i], starts[i - 1])
    ends = starts[1:] + [total]
    return [(w, s, e) for (w, _, _), s, e in zip(spans, starts, ends)]


def lerp(a, b, k):
    return a + (b - a) * k


def loudness(samples, rate, fps, frames):
    """Per-frame mouth openness in [0, 1] from narration RMS, fast attack and slow release."""
    window = rate // fps
    values = []
    for n in range(frames):
        part = samples[n * window:(n + 1) * window]
        values.append(math.sqrt(sum(v * v for v in part[::4]) / max(len(part[::4]), 1)) if part else 0.0)
    ref = sorted(values)[int(len(values) * 0.95)] or 1.0
    out, level = [], 0.0
    for v in values:
        target = min(1.0, v / ref)
        level = target if target > level else level * 0.6 + target * 0.4
        out.append(level if level > 0.08 else 0.0)
    return out


def stamp(seconds):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02}.{ms:03}'


def vtt_chunks(words, size=7):
    """Readable caption cues for the .vtt track: up to ~7 words, split at sentence ends."""
    out, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= size or w[0][-1] in '.?!':
            out.append(cur)
            cur = []
    return out + ([cur] if cur else [])


def narration_label(voice):
    tts = TEMPLATE['tts']
    if voice == 'elevenlabs':
        return f"synthetic: ElevenLabs {tts['model']}, voice {tts.get('voice_name', tts['voice_id'])}"
    return 'synthetic: eSpeak NG en-us (draft)'


def render(script, output_dir):
    beats, sfx = _module('beats'), _module('sfx')
    voice = voice_engine()
    if len(script['scenes']) != 1:
        raise ValueError('Vertical clips are one continuous scene')
    scene = script['scenes'][0]
    if voice == 'elevenlabs':
        pcm, rate, words = _module('tts').synthesize(scene['narration'], TEMPLATE['tts'])
    else:
        pcm, rate, words = narrate(scene['narration'])
    fps = TEMPLATE['fps']
    speech = len(pcm) / 2 / rate
    frames = math.ceil((LEAD + speech + TAIL) * fps)
    duration = frames / fps
    if not MIN_S <= duration <= MAX_S:
        raise ValueError(f'Clip is {duration:.2f}s; vertical clips must be {MIN_S}-{MAX_S}s')
    words = [(w, s + LEAD, e + LEAD) for w, s, e in words]
    p = beats.plan(scene, words, duration)
    still = beats.longest_still(p, duration)
    if still > beats.MAX_STILL:
        raise ValueError(f'{still:.1f}s with no on-screen change (max {beats.MAX_STILL}s): add a beat')
    total = int(duration * rate)
    narration = array.array('h', (bytes(int(LEAD * rate) * 2) + pcm + bytes(total * 2))[:total * 2])
    energy = loudness(narration, rate, fps, frames)
    mixed = sfx.mix(array.array('h', narration), rate, beats.sound_cues(p))
    stem = f'{script["topic_id"]}.{script["variant_id"]}.{fingerprint(script, voice)}'
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / f'{stem}.mp4'
    job = REMOTION / 'public' / 'job' / stem
    job.mkdir(parents=True, exist_ok=True)
    try:
        with wave.open(str(job / 'audio.wav'), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(rate)
            out.writeframes(mixed.tobytes())
        props = {'fps': fps, 'durationInFrames': frames, 'audio': f'job/{stem}/audio.wav',
                 'title': scene['title'], 'diagram': scene['diagram'],
                 'sources': 'Sources: ' + ', '.join(script['source_refs']) + ' · Review copy',
                 'stage': p['stage'], 'events': p['events'], 'pieces': p['pieces'],
                 'words': [{'text': w, 'start': round(s, 3), 'end': round(e, 3)} for w, s, e in words],
                 'energy': [round(v, 3) for v in energy]}
        with tempfile.TemporaryDirectory(prefix='clipcademy-render-') as tmp:
            tmp = Path(tmp)
            (tmp / 'props.json').write_text(json.dumps(props), encoding='utf-8')
            npx = shutil.which('npx') or 'npx'
            subprocess.run([npx, 'remotion', 'render', 'src/index.ts', 'Clip', str(tmp / 'out.mp4'),
                            f'--props={tmp / "props.json"}', '--codec=h264', '--crf=23', '--audio-codec=aac',
                            '--audio-bitrate=96k', '--pixel-format=yuv420p', '--log=error'],
                           cwd=REMOTION, check=True)
            # Copy into the destination filesystem then rename, so publication is atomic.
            staging = output_dir / f'.{stem}.tmp'
            shutil.copyfile(tmp / 'out.mp4', staging)
            staging.replace(destination)
    finally:
        shutil.rmtree(job, ignore_errors=True)
    cues = [f'{stamp(c[0][1])} --> {stamp(min(c[-1][2], duration))}\n' + ' '.join(w for w, _, _ in c) + '\n'
            for c in vtt_chunks(words)]
    (output_dir / f'{stem}.vtt').write_text('WEBVTT\n\n' + '\n'.join(cues), encoding='utf-8')
    transcript = scene['narration']
    (output_dir / f'{stem}.txt').write_text(transcript + '\n', encoding='utf-8')
    record = {'video_file': destination.name, 'captions_file': f'{stem}.vtt', 'transcript': transcript,
              'source_refs': script['source_refs'], 'duration_seconds': round(duration, 3),
              'width': TEMPLATE['width'], 'height': TEMPLATE['height'], 'fps': fps,
              'fingerprint': fingerprint(script, voice), 'review_status': script['review_status'],
              'narration': narration_label(voice), 'visuals': 'Remotion 4.0.537, Clipcademy stick-figure template',
              'longest_still_seconds': round(still, 2),
              'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    (output_dir / f'{stem}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--topic')
    parser.add_argument('--variant')
    parser.add_argument('--output', default=str(HERE / 'media'))
    args = parser.parse_args()
    scripts = ([json.loads(f.read_text(encoding='utf-8')) for f in sorted((HERE / 'scripts').glob('*.json'))]
               if args.all else [load_script(args.topic, args.variant)])
    for script in scripts:
        print(json.dumps(render(script, args.output)), flush=True)
