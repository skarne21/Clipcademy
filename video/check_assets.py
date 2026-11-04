"""Check every committed clip decodes, has audio/video, and matches its fixed script.

Vertical clips (Context/notes.md) must be 720x1280 and 15-30 s. Landscape clips from
the first MVP are reported as LEGACY until they are re-scripted and replaced.
"""
import json
import subprocess
import sys
import jobs

service = jobs.VideoService(preview=True)
failed = 0
for script in service.catalog.values():
    name = f"{script['topic_id']}.{script['variant_id']}"
    if script.get('format') != 'vertical':
        print(f'LEGACY {name}: landscape script, to be replaced by a vertical clip')
        continue
    record = service.asset(script)
    if record is None:
        print(f'FAIL {name}: missing or stale asset (render it with video/render.py)')
        failed += 1
        continue
    path = service.media / record['video_file']
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    assert (video['width'], video['height'], video['codec_name'], video['pix_fmt']) == (720, 1280, 'h264', 'yuv420p'), name
    assert audio['codec_name'] == 'aac', name
    assert 15 <= float(probe['format']['duration']) <= 30.5, name
    assert record['transcript'] == script['scenes'][0]['narration'], name
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
    print(f"PASS {path.name}: {float(probe['format']['duration']):.2f}s, {path.stat().st_size} bytes, 720x1280 H.264 + AAC")
sys.exit(1 if failed else 0)
