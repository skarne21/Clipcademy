"""A small Gemini client (US-25, US-26): send text or PDF parts, get JSON back. Standard library only.

The key is read from GEMINI_API_KEY in the environment or video/.env (git-ignored), and is sent in the
x-goog-api-key header, never in the URL, so it can't leak into logs. The model is GEMINI_MODEL if set.
"""
import base64
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parent / '.env'
API = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
DEFAULT_MODEL = 'gemini-pro-latest'  # Google's alias for its newest Pro model, so a retirement can't break generation
MAX_INLINE_BYTES = 18 * 1024 * 1024  # inline request data must stay under Gemini's ~20 MB request limit


class MissingKey(RuntimeError):
    pass


def load_key(env=None, env_file=ENV_FILE):
    env = os.environ if env is None else env
    if env.get('GEMINI_API_KEY'):
        return env['GEMINI_API_KEY'].strip()
    if Path(env_file).is_file():
        for line in Path(env_file).read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line.startswith('export '):
                line = line[7:].strip()
            if not line.startswith('GEMINI_API_KEY') or '=' not in line:
                continue
            name, value = (x.strip() for x in line.split('=', 1))
            if name != 'GEMINI_API_KEY':
                continue
            if value[:1] in ('"', "'") and value[-1:] == value[:1]:
                value = value[1:-1]
            else:
                value = value.split(' #', 1)[0].strip()
            if value:
                return value
    raise MissingKey('GEMINI_API_KEY is not set. Add GEMINI_API_KEY=... to video/.env (git-ignored) or the environment. '
                     'Get a key at https://aistudio.google.com/apikey.')


def text_part(text):
    return {'text': text}


def file_part(path):
    """A PDF as inline file data, or a text/markdown file as text."""
    path = Path(path)
    data = path.read_bytes()
    if path.suffix.lower() == '.pdf':
        if len(data) > MAX_INLINE_BYTES:
            raise ValueError(f'{path.name} is {len(data) // 1_000_000} MB; split it into files under 18 MB')
        return {'inline_data': {'mime_type': 'application/pdf', 'data': base64.b64encode(data).decode('ascii')}}
    return {'text': data.decode('utf-8')}


def _urllib_transport(url, headers, body):
    request = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as err:
        detail = err.read().decode('utf-8', 'replace')[:500]
        raise RuntimeError(f'Gemini request failed with HTTP {err.code}: {detail}') from None


def parse_json(text):
    text = text.strip()
    fenced = re.match(r'^```(?:json)?\s*(.*?)\s*```$', text, re.S)
    return json.loads(fenced.group(1) if fenced else text)


class Gemini:
    def __init__(self, key, model=None, transport=None):
        self.key = key
        self.model = model or os.environ.get('GEMINI_MODEL') or DEFAULT_MODEL
        self.transport = transport or _urllib_transport

    def generate_json(self, parts, system=None, temperature=0.4):
        body = {'contents': [{'role': 'user', 'parts': parts}],
                'generationConfig': {'responseMimeType': 'application/json', 'temperature': temperature}}
        if system:
            body['systemInstruction'] = {'parts': [{'text': system}]}
        reply = self.transport(API.format(model=self.model),
                               {'Content-Type': 'application/json', 'x-goog-api-key': self.key},
                               json.dumps(body).encode('utf-8'))
        try:
            text = ''.join(p.get('text', '') for p in reply['candidates'][0]['content']['parts'])
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f'Gemini returned no content: {json.dumps(reply)[:300]}') from None
        return parse_json(text)
