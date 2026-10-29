"""ElevenLabs narration with per-character timing, cached so re-renders never re-spend credits.

The API key is read from the ELEVENLABS_API_KEY environment variable or from
``video/.env`` (git-ignored). It is only ever sent to api.elevenlabs.io and is
never printed or written anywhere else.

    python video/tts.py --voices      # list the voices this key can use
"""
import argparse
import base64
import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / '.cache' / 'tts'
API = 'https://api.elevenlabs.io/v1'


def api_key():
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    env = HERE / '.env'
    if not key and env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line.startswith('#'):
                continue
            name, _, value = line.partition('=')
            name = name.strip()
            if name.startswith('export '):  # shell-style: export KEY=value
                name = name[len('export '):].strip()
            if name == 'ELEVENLABS_API_KEY':
                value = value.strip()
                if value[:1] in ('"', "'"):  # quoted: take what's inside the quotes
                    value = value[1:].split(value[0], 1)[0]
                else:  # unquoted: an inline comment starts at " #"
                    value = value.split(' #', 1)[0].strip()
                key = value
    return key


def _request(method, path, body=None, query=''):
    key = api_key()
    if not key:
        raise RuntimeError('No ElevenLabs API key: put ELEVENLABS_API_KEY=... in video/.env')
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'{API}{path}{query}', data=data, method=method,
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json',
                                          'Accept': 'application/json', 'User-Agent': 'clipcademy-renderer'})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as err:
        detail = err.read().decode('utf-8', 'replace')[:400]
        raise RuntimeError(f'ElevenLabs {method} {path} failed ({err.code}): {detail}') from None


def synthesize(text, cfg):
    """Return (16-bit mono PCM bytes, sample rate, [(word, start s, end s)]) for the text."""
    if not cfg.get('voice_id'):
        raise RuntimeError('Set tts.voice_id in video/template.json (python video/tts.py --voices lists them)')
    fmt = cfg.get('output_format', 'pcm_24000')
    rate = int(fmt.split('_')[1])
    body = {'text': text, 'model_id': cfg['model'],
            'voice_settings': {'stability': cfg['stability'], 'similarity_boost': cfg['similarity_boost'],
                               'style': cfg['style'], 'speed': cfg['speed'], 'use_speaker_boost': True}}
    key = hashlib.sha256(json.dumps([body, cfg['voice_id'], fmt], sort_keys=True).encode()).hexdigest()[:24]
    meta, audio = CACHE / f'{key}.json', CACHE / f'{key}.pcm'
    if meta.exists() and audio.exists():
        alignment = json.loads(meta.read_text(encoding='utf-8'))
        pcm = audio.read_bytes()
    else:
        result = _request('POST', f'/text-to-speech/{cfg["voice_id"]}/with-timestamps', body, f'?output_format={fmt}')
        pcm = base64.b64decode(result['audio_base64'])
        alignment = result['alignment']
        CACHE.mkdir(parents=True, exist_ok=True)
        audio.write_bytes(pcm)
        meta.write_text(json.dumps(alignment), encoding='utf-8')
    return pcm, rate, word_times(text, alignment, len(pcm) / 2 / rate)


def word_times(text, alignment, total):
    """Map ElevenLabs character timings onto the script's whitespace-separated words."""
    chars = alignment['characters']
    starts, ends = alignment['character_start_times_seconds'], alignment['character_end_times_seconds']
    if ''.join(chars) != text:
        # Should not happen with the plain alignment; fall back to proportional positions.
        scale = len(chars) / max(len(text), 1)
        index = lambda i: min(len(chars) - 1, int(i * scale))
    else:
        index = lambda i: i
    words = []
    for m in re.finditer(r'\S+', text):
        a, b = index(m.start()), index(m.end() - 1)
        words.append((m.group(), starts[a], max(ends[b], starts[a])))
    for i in range(1, len(words)):
        if words[i][1] < words[i - 1][1]:
            words[i] = (words[i][0], words[i - 1][1], max(words[i][2], words[i - 1][1]))
    if words:
        words[-1] = (words[-1][0], words[-1][1], min(max(words[-1][2], words[-1][1]), total))
    return words


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--voices', action='store_true', help='list voices available to this key')
    args = p.parse_args()
    if args.voices:
        for v in _request('GET', '/voices')['voices']:
            labels = v.get('labels') or {}
            print(f"{v['voice_id']}  {v['name']:<22} {labels.get('gender', ''):<7} {labels.get('accent', ''):<12} "
                  f"{labels.get('age', ''):<12} {labels.get('description') or labels.get('descriptive', '')}")
