"""Offline fixed-script renderer. No network, model, or runtime script generation."""
import argparse
import ctypes
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave
from functools import lru_cache

@lru_cache(maxsize=32)
def cached_font(name, size):
    from PIL import ImageFont
    return ImageFont.truetype(name, size, layout_engine=ImageFont.Layout.BASIC)

HERE = Path(__file__).resolve().parent
TEMPLATE = json.loads((HERE / 'template.json').read_text())


def load_script(topic, variant):
    # Select by catalog values, never by a caller-controlled filesystem path.
    for path in sorted((HERE / 'scripts').glob('*.json')):
        script = json.loads(path.read_text())
        if (script['topic_id'], script['variant_id']) == (topic, variant):
            return script
    raise ValueError('Unknown lesson variant')


def fingerprint(script):
    payload = json.dumps([script, TEMPLATE], sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(Path(__file__).read_bytes() + payload).hexdigest()[:16]


def narrate(text, path):
    """eSpeak retrieval mode writes real PCM narration without an audio device."""
    import espeakng_loader
    lib = ctypes.CDLL(espeakng_loader.get_library_path())
    lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    rate = lib.espeak_Initialize(2, 0, str(Path(espeakng_loader.get_data_path()).parent).encode(), 0)
    if rate <= 0:
        raise RuntimeError('Could not initialize narration')
    chunks = []
    callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
    @callback_type
    def collect(samples, count, _events):
        if samples and count:
            chunks.append(ctypes.string_at(samples, count * 2))
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
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(b''.join(chunks))
    return rate


def frame(script, scene_index, progress, caption):
    from PIL import Image, ImageDraw, ImageFont
    t = TEMPLATE
    im = Image.new('RGB', (t['width'], t['height']), t['background'])
    d = ImageDraw.Draw(im)
    def font(size, bold=False):
        return cached_font(t['font_bold'] if bold else t['font'], size)
    def label(x, y, text, size=24, color=None, bold=False):
        d.text((x,y), text, fill=color or t['ink'], font=font(size,bold))
    def line(points, color=None, width=5):
        d.line(points, fill=color or t['ink'], width=width)
    def arrow(x1,y1,x2,y2,color=None):
        line([(x1,y1),(x2,y2)],color)
        sign=1 if x2>x1 else -1
        d.polygon([(x2,y2),(x2-sign*13,y2-8),(x2-sign*13,y2+8)],fill=color or t['ink'])
    scene = script['scenes'][scene_index]
    label(32,20,'Clipcademy · '+('DNA replication' if script['topic_id']=='dna_replication' else 'DNA repair'),20)
    label(32,58,scene['title'],32,bold=True)
    # One reusable guide, clearly separate from the molecular diagrams.
    d.ellipse((54,159,106,211),outline=t['ink'],width=4)
    line([(80,211),(80,290)])
    line([(80,233),(118,251),(152,223)])
    line([(80,235),(46,267)])
    line([(80,290),(52,340)])
    line([(80,290),(110,340)])
    d.ellipse((68,178,72,182),fill=t['ink']); d.ellipse((88,178,92,182),fill=t['ink'])
    d.arc((69,183,93,199),0,180,fill=t['ink'],width=2)
    kind=scene['diagram']
    if kind in {'antiparallel','growth','primer','bare'}:
        label(235,122,t['labels']['template'],20)
        line([(240,177),(866,177)])
        label(188,158,'3′');label(884,158,'5′')
        for x in range(265,850,40): line([(x,177),(x,193)],width=3)
        if kind!='bare':
            end = 510 if kind=='antiparallel' else int(450+350*progress)
            if kind=='primer': end=450
            line([(240,268),(450,268)],t['primer'],8)
            if end>450: line([(450,268),(end,268)],t['accent'],8)
            for x in range(265,end,40): line([(x,252),(x,268)],t['accent'],3)
            label(188,250,'5′');label(end+15,250,'3′',color=t['accent'],bold=True)
            label(235,302,t['labels']['primer'],20,t['primer'])
            if kind in {'growth','antiparallel'}:
                arrow(470,338,840,338,t['accent']);label(475,355,'New DNA grows 5′ → 3′',23)
            else:
                label(500,300,'Primase makes the start',23)
                label(500,337,'Polymerase extends its 3′ end',21)
        else:
            label(240,248,'DNA polymerase needs an existing start.',24)
            label(240,294,'No complementary strand to extend yet.',23)
    elif kind=='timing':
        arrow(240,232,860,232,t['accent'])
        label(240,166,'During copying',25,bold=True)
        label(600,166,'After replication',25,bold=True)
        label(240,270,'Proofreading',24);label(600,270,'Mismatch repair',24)
        label(240,325,'DNA polymerase',22);label(600,325,'Repair proteins',22)
    else:
        label(235,122,'DNA strands · schematic',20)
        line([(240,184),(866,184)])
        gap=kind=='cut'
        if gap:
            line([(240,264),(490,264)],t['accent']);line([(650,264),(866,264)],t['accent'])
        else: line([(240,264),(866,264)],t['accent'])
        for i,x in enumerate(range(270,850,58)):
            if gap and 490<x<650: continue
            bad = kind in {'proof','mismatch','uv'} and i in ([5,6] if kind=='uv' else [5])
            label(x,199,'T' if kind=='uv' and i in [5,6] else 'A',20)
            label(x,235,'T' if kind=='uv' and i in [5,6] else ('C' if bad else 'T'),20,t['damage'] if bad else t['accent'])
            if bad: d.ellipse((x-7,230,x+26,262),outline=t['damage'],width=2)
        if kind=='uv':
            line([(568,259),(626,259)],t['damage'],4)
            label(240,302,'UV: adjacent bases bond and distort DNA',23)
        elif kind=='cut': label(240,302,'Damaged section removed from one strand',23)
        elif kind=='reseal': label(240,302,'Correct bases replace the gap; backbone resealed',22)
        elif kind=='proof':
            label(240,302,'Wrong base removed from the growing 3′ end',22)
            # Short growing strand ends at the wrong base; do not show it internally.
            d.rectangle((596,228,900,282),fill=t['background'])
            label(604,242,'3′',22,t['accent'])
        else: label(240,302,'After replication: find and replace a mismatch',23)
    # Short timed captions contain exactly the spoken words, in order.
    d.rectangle((0,410,960,505),fill='#E9EEE8')
    words=caption.split(); rows=[]; row=''
    for word in words:
        candidate=(row+' '+word).strip()
        if d.textlength(candidate,font=font(23))>885:
            rows.append(row);row=word
        else:row=candidate
    rows.append(row)
    for i,row in enumerate(rows): label(32,420+i*29,row,23)
    label(32,513,'Sources: '+', '.join(script['source_refs'])+' · Review copy',16)
    label(845,513,f'{scene_index+1} / {len(script["scenes"])}',16)
    return im


def stamp(seconds):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}.{ms:03}'


def render(script, output_dir):
    output_dir=Path(output_dir);output_dir.mkdir(parents=True,exist_ok=True)
    stem=f'{script["topic_id"]}.{script["variant_id"]}.{fingerprint(script)}'
    destination=output_dir/f'{stem}.mp4'
    fps=TEMPLATE['fps']; offset=0; cues=[];segments=[]
    with tempfile.TemporaryDirectory(prefix='clipcademy-render-') as tmp:
        tmp=Path(tmp)
        for idx,scene in enumerate(script['scenes']):
            wav=tmp/f'{idx}.wav';narrate(scene['narration'],wav)
            with wave.open(str(wav)) as audio: duration=audio.getnframes()/audio.getframerate()
            count=math.ceil((duration+.4)*fps);duration=count/fps
            words=scene['narration'].split(); captions=[' '.join(words[i:i+13]) for i in range(0,len(words),13)]
            for j,caption in enumerate(captions):
                cues.append(f'{stamp(offset+j*duration/len(captions))} --> {stamp(offset+(j+1)*duration/len(captions))}\n{caption}\n')
            segment=tmp/f'{idx}.mp4';segments.append(segment)
            args=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','960x540','-r',str(fps),'-i','pipe:0','-i',str(wav),'-af','apad','-t',str(duration),'-c:v','libx264','-threads','2','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k','-movflags','+faststart',str(segment)]
            process=subprocess.Popen(args,stdin=subprocess.PIPE)
            try:
                for n in range(count):
                    progress=n/max(count-1,1)
                    process.stdin.write(frame(script,idx,progress,captions[min(len(captions)-1,int(progress*len(captions)))]).tobytes())
            finally:
                process.stdin.close()
            if process.wait()!=0: raise RuntimeError('FFmpeg failed')
            offset+=duration
        if not 30<=offset<=60: raise ValueError(f'Clip duration {offset:.2f}s is outside 30–60s')
        concat=tmp/'concat.txt';concat.write_text(''.join(f"file '{p}'\n" for p in segments))
        assembled=tmp/'final.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(assembled)],check=True)
        # Copy into the destination filesystem then rename, so publication is atomic.
        import shutil
        staging=output_dir/f'.{stem}.tmp';shutil.copyfile(assembled,staging);staging.replace(destination)
    (output_dir/f'{stem}.vtt').write_text('WEBVTT\n\n'+'\n'.join(cues))
    transcript='\n\n'.join(s['narration'] for s in script['scenes'])
    (output_dir/f'{stem}.txt').write_text(transcript+'\n')
    record={'video_file':destination.name,'captions_file':f'{stem}.vtt','transcript':transcript,
            'source_refs':script['source_refs'],'duration_seconds':round(offset,3),'fingerprint':fingerprint(script),
            'review_status':script['review_status'],'narration':'synthetic: eSpeak NG en-us',
            'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
    (output_dir/f'{stem}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    return record


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--all',action='store_true');p.add_argument('--topic');p.add_argument('--variant');p.add_argument('--output',default=str(HERE/'media'))
    args=p.parse_args()
    scripts=[json.loads(p.read_text()) for p in sorted((HERE/'scripts').glob('*.json'))] if args.all else [load_script(args.topic,args.variant)]
    for script in scripts: print(json.dumps(render(script,args.output)),flush=True)
