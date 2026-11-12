"""Render a generated course clip with the stick-figure look (US-27, US-29).

    python3 video/course/render_course.py --course econ101 --all
    python3 video/course/render_course.py --course econ101 --topic supply_and_demand --variant intro_1

It reuses the existing pipeline's voice, sound effects, captions and pacing checks by importing
video/render.py, never by changing it, and draws frames with the separate Remotion entry
video/remotion/course/index.ts. Output goes to video/courses/<course>/media/ with its own fingerprint,
so the existing 35 clips are never touched. CLIPCADEMY_VOICE=espeak renders a free offline draft.
"""
import argparse
import array
import hashlib
import importlib.util
import json
import math
import shutil
import socket
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
REMOTION = VIDEO / 'remotion'
COURSES = VIDEO / 'courses'
ENTRY, COMPOSITION = 'course/index.ts', 'CourseClip'
sys.path.insert(0, str(HERE))

import templates  # noqa: E402


def _load_render():
    spec = importlib.util.spec_from_file_location('clipcademy_render', VIDEO / 'render.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = _load_render()


def free_port():
    """A free local port for Remotion's bundle server (its default, 3000, is often taken by another dev server)."""
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def code_files():
    files = [VIDEO / n for n in ('render.py', 'beats.py', 'sfx.py', 'tts.py')]
    files += [HERE / 'templates.py', HERE / 'render_course.py']
    files += sorted((REMOTION / 'src').rglob('*.ts*')) + sorted((REMOTION / 'course').rglob('*.ts*'))
    return files + [REMOTION / 'package.json']


def sources_line(script):
    return 'Sources: ' + ', '.join(script['source_refs'])


def fingerprint(script, voice=None):
    voice = voice or base.TEMPLATE['tts']['engine']
    payload = json.dumps([script, base.TEMPLATE, voice], sort_keys=True, ensure_ascii=False).encode()
    code = b''.join(p.read_bytes() for p in code_files())
    return hashlib.sha256(code + payload).hexdigest()[:16]


def load_scripts(course, root=COURSES):
    if not templates.COURSE_ID.match(course or ''):
        raise ValueError('Unknown course')
    folder = Path(root) / course / 'scripts'
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('*.json'))]


def render(script, root=COURSES):
    errors = templates.validate(script)
    if errors:
        raise ValueError('Clip fails the checks:\n- ' + '\n- '.join(errors))
    sfx = base._module('sfx')
    voice = base.voice_engine()
    scene = script['scenes'][0]
    if voice == 'elevenlabs':
        pcm, rate, words = base._module('tts').synthesize(scene['narration'], base.TEMPLATE['tts'])
    else:
        pcm, rate, words = base.narrate(scene['narration'])
    fps = base.TEMPLATE['fps']
    frames = math.ceil((base.LEAD + len(pcm) / 2 / rate + base.TAIL) * fps)
    duration = frames / fps
    if not base.MIN_S <= duration <= base.MAX_S:
        raise ValueError(f'Clip is {duration:.2f}s; clips must be {base.MIN_S}-{base.MAX_S}s')
    words = [(w, s + base.LEAD, e + base.LEAD) for w, s, e in words]
    p = templates.plan(scene, words, duration)
    still = templates.longest_still(p, duration)
    if still > templates.beats.MAX_STILL:
        raise ValueError(f'{still:.1f}s with no on-screen change (max {templates.beats.MAX_STILL}s): add a beat')
    total = int(duration * rate)
    narration = array.array('h', (bytes(int(base.LEAD * rate) * 2) + pcm + bytes(total * 2))[:total * 2])
    energy = base.loudness(narration, rate, fps, frames)
    mixed = sfx.mix(array.array('h', narration), rate, templates.sound_cues(p))
    fp = fingerprint(script, voice)
    stem = f'{script["topic_id"]}.{script["variant_id"]}.{fp}'
    output_dir = Path(root) / script['course_id'] / 'media'
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / f'{stem}.mp4'
    job = REMOTION / 'public' / 'job' / f'course-{stem}'
    job.mkdir(parents=True, exist_ok=True)
    try:
        with wave.open(str(job / 'audio.wav'), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(rate)
            out.writeframes(mixed.tobytes())
        props = {'fps': fps, 'durationInFrames': frames, 'audio': f'job/course-{stem}/audio.wav',
                 'title': scene['title'], 'template': scene['template'], 'props': scene['props'],
                 'sources': sources_line(script),
                 'events': p['events'],
                 'words': [{'text': w, 'start': round(s, 3), 'end': round(e, 3)} for w, s, e in words],
                 'energy': [round(v, 3) for v in energy]}
        with tempfile.TemporaryDirectory(prefix='clipcademy-course-render-') as tmp:
            tmp = Path(tmp)
            (tmp / 'props.json').write_text(json.dumps(props), encoding='utf-8')
            npx = shutil.which('npx') or 'npx'
            subprocess.run([npx, 'remotion', 'render', ENTRY, COMPOSITION, str(tmp / 'out.mp4'),
                            f'--props={tmp / "props.json"}', '--codec=h264', '--crf=23', '--audio-codec=aac',
                            '--audio-bitrate=96k', '--pixel-format=yuv420p', f'--port={free_port()}', '--log=error'],
                           cwd=REMOTION, check=True)
            staging = output_dir / f'.{stem}.tmp'
            shutil.copyfile(tmp / 'out.mp4', staging)
            staging.replace(destination)
    finally:
        shutil.rmtree(job, ignore_errors=True)
    cues = [f'{base.stamp(c[0][1])} --> {base.stamp(min(c[-1][2], duration))}\n' + ' '.join(w for w, _, _ in c) + '\n'
            for c in base.vtt_chunks(words)]
    (output_dir / f'{stem}.vtt').write_text('WEBVTT\n\n' + '\n'.join(cues), encoding='utf-8')
    (output_dir / f'{stem}.txt').write_text(scene['narration'] + '\n', encoding='utf-8')
    record = {'course_id': script['course_id'], 'topic_id': script['topic_id'], 'variant_id': script['variant_id'],
              'video_file': destination.name, 'captions_file': f'{stem}.vtt', 'transcript': scene['narration'],
              'source_refs': script['source_refs'], 'duration_seconds': round(duration, 3),
              'width': base.TEMPLATE['width'], 'height': base.TEMPLATE['height'], 'fps': fps, 'fingerprint': fp,
              'narration': base.narration_label(voice),
              'visuals': f'Remotion 4.0.537, Clipcademy stick-figure course template "{scene["template"]}"',
              'longest_still_seconds': round(still, 2), 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    (output_dir / f'{stem}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description='Render generated course clips with the stick-figure look.')
    parser.add_argument('--course', required=True)
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--topic')
    parser.add_argument('--variant')
    args = parser.parse_args(argv)
    scripts = load_scripts(args.course)
    if not args.all:
        scripts = [s for s in scripts if (s['topic_id'], s['variant_id']) == (args.topic, args.variant)]
        if not scripts:
            parser.exit(2, 'error: no such clip in this course\n')
    for script in scripts:
        print(json.dumps(render(script)), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
