"""Check every committed clip decodes, has audio/video, and matches its fixed script."""
import json
import subprocess
import jobs

service=jobs.VideoService(preview=True)
for script in service.catalog.values():
    record=service.asset(script)
    assert record is not None, (script['topic_id'],script['variant_id'],'missing or stale asset')
    path=service.media/record['video_file']
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    video=next(s for s in probe['streams'] if s['codec_type']=='video')
    audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert (video['width'],video['height'],video['codec_name'],video['pix_fmt'])==(960,540,'h264','yuv420p')
    assert audio['codec_name']=='aac'
    assert 30<=float(probe['format']['duration'])<=60
    assert record['transcript']=='\n\n'.join(s['narration'] for s in script['scenes'])
    subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'],check=True)
    print(f"PASS {path.name}: {probe['format']['duration']}s, {path.stat().st_size} bytes, H.264 + AAC decoded")
