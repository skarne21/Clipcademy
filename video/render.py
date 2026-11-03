"""Offline fixed-script renderer. No network, model, or runtime script generation.

Pipeline: narrate each scene with eSpeak (recording when each word is spoken),
then draw every frame with ``animation.py`` so on-screen actions, the guide's
mouth and the highlighted caption word follow the narration.
"""
import argparse
import array
import ctypes
import hashlib
import importlib.util
import json
import math
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = json.loads((HERE / 'template.json').read_text())
SOURCES = ('render.py', 'animation.py')
LEAD, TAIL = 0.35, 0.65   # silence before and after each scene's narration


def load_script(topic, variant):
    # Select by catalog values, never by a caller-controlled filesystem path.
    for path in sorted((HERE / 'scripts').glob('*.json')):
        script = json.loads(path.read_text())
        if (script['topic_id'], script['variant_id']) == (topic, variant):
            return script
    raise ValueError('Unknown lesson variant')


def fingerprint(script):
    payload = json.dumps([script, TEMPLATE], sort_keys=True, ensure_ascii=False).encode()
    code = b''.join((HERE / name).read_bytes() for name in SOURCES)
    return hashlib.sha256(code + payload).hexdigest()[:16]


def animation():
    # Loaded by path: jobs.py imports this file without putting video/ on sys.path.
    spec = importlib.util.spec_from_file_location('clipcademy_animation', HERE / 'animation.py')
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
    if lib.espeak_SetVoiceByName(TEMPLATE['voice'].encode()) != 0:
        raise RuntimeError('Narration voice unavailable')
    lib.espeak_SetParameter(1, TEMPLATE['words_per_minute'], 0)
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


def render(script, output_dir):
    art = animation()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = f'{script["topic_id"]}.{script["variant_id"]}.{fingerprint(script)}'
    destination = output_dir / f'{stem}.mp4'
    fps = TEMPLATE['fps']
    # 1. Narrate every scene first so the whole clip's timing is known.
    scenes, pcm, rate = [], bytearray(), None
    for scene in script['scenes']:
        audio, rate, words = narrate(scene['narration'])
        speech = len(audio) / 2 / rate
        frames = math.ceil((LEAD + speech + TAIL) * fps)
        duration = frames / fps
        words = [(w, s + LEAD, e + LEAD) for w, s, e in words]
        silence_before = int(LEAD * rate) * 2
        padded = bytes(silence_before) + audio
        padded += bytes(max(0, int(duration * rate) * 2 - len(padded)))
        padded = padded[:int(duration * rate) * 2]
        samples = array.array('h', padded)
        scenes.append((scene, words, duration, frames, loudness(samples, rate, fps, frames)))
        pcm += padded
    total = sum(s[2] for s in scenes)
    if not 30 <= total <= 60:
        raise ValueError(f'Clip duration {total:.2f}s is outside 30–60s')
    # 2. Captions and transcript use exactly the narrated words, with measured timing.
    cues, offset = [], 0.0
    for scene, words, duration, _, _ in scenes:
        for chunk in art.caption_chunks(words):
            start, end = chunk[0][1], chunk[-1][2]
            cues.append(f'{stamp(offset + start)} --> {stamp(offset + min(end, duration))}\n'
                        + ' '.join(w for w, _, _ in chunk) + '\n')
        offset += duration
    with tempfile.TemporaryDirectory(prefix='clipcademy-render-') as tmp:
        tmp = Path(tmp)
        wav = tmp / 'narration.wav'
        with wave.open(str(wav), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(rate)
            out.writeframes(bytes(pcm))
        assembled = tmp / 'final.mp4'
        args = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s',
                f'{TEMPLATE["width"]}x{TEMPLATE["height"]}', '-r', str(fps), '-i', 'pipe:0', '-i', str(wav),
                '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-tune', 'animation', '-crf', '26',
                '-g', str(fps * 2), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-shortest',
                '-movflags', '+faststart', str(assembled)]
        # 3. Draw every frame and stream it to FFmpeg.
        process = subprocess.Popen(args, stdin=subprocess.PIPE)
        try:
            done = 0
            total_frames = sum(s[3] for s in scenes)
            for index, (scene, words, duration, frames, energy) in enumerate(scenes):
                drawer = art.SceneArt(TEMPLATE, script, index, words, duration)
                for n in range(frames):
                    image = drawer.frame(n / fps, energy[n], (done + n) / total_frames)
                    process.stdin.write(image.tobytes())
                done += frames
        finally:
            process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('FFmpeg failed')
        # Copy into the destination filesystem then rename, so publication is atomic.
        staging = output_dir / f'.{stem}.tmp'
        shutil.copyfile(assembled, staging)
        staging.replace(destination)
    (output_dir / f'{stem}.vtt').write_text('WEBVTT\n\n' + '\n'.join(cues))
    transcript = '\n\n'.join(s['narration'] for s in script['scenes'])
    (output_dir / f'{stem}.txt').write_text(transcript + '\n')
    record = {'video_file': destination.name, 'captions_file': f'{stem}.vtt', 'transcript': transcript,
              'source_refs': script['source_refs'], 'duration_seconds': round(total, 3),
              'fingerprint': fingerprint(script), 'review_status': script['review_status'],
              'narration': 'synthetic: eSpeak NG en-us',
              'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    (output_dir / f'{stem}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    return record


def preview(script, scene_index, seconds, path):
    """Write one still frame (for review) without narration audio; word timing is estimated."""
    art = animation()
    scene = script['scenes'][scene_index]
    words, at = [], LEAD
    for word in scene['narration'].split():
        length = 0.08 + 0.055 * len(word)
        words.append((word, at, at + length))
        at += length + 0.04
    drawer = art.SceneArt(TEMPLATE, script, scene_index, words, at + TAIL)
    drawer.frame(seconds, 0.5, 0.5).save(path)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--all', action='store_true')
    p.add_argument('--topic')
    p.add_argument('--variant')
    p.add_argument('--output', default=str(HERE / 'media'))
    args = p.parse_args()
    scripts = ([json.loads(f.read_text()) for f in sorted((HERE / 'scripts').glob('*.json'))]
               if args.all else [load_script(args.topic, args.variant)])
    for script in scripts:
        print(json.dumps(render(script, args.output)), flush=True)
