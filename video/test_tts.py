"""Issue #21 (US-13): ElevenLabs narration (video/tts.py). Written before the fix (TDD).

No network: the HTTP layer is replaced. Covers key loading edge cases, word timing from the
character alignment, the cache that keeps re-renders from spending credits, and error messages
that never contain the key.
"""
import base64
import importlib.util
import io
import json
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('clipcademy_tts', HERE / 'tts.py')
tts = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tts)
CFG = {'model': 'eleven_multilingual_v2', 'voice_id': 'VOICE', 'stability': 0.45, 'similarity_boost': 0.75,
       'style': 0.25, 'speed': 1.12, 'output_format': 'pcm_24000'}
SECRET = 'sk_test_0123456789abcdef'


def alignment(text, step=0.05):
    return {'characters': list(text), 'character_start_times_seconds': [i * step for i in range(len(text))],
            'character_end_times_seconds': [(i + 1) * step for i in range(len(text))]}


class KeyTest(unittest.TestCase):
    def key_from(self, contents):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {}, clear=True):
            (Path(d) / '.env').write_text(contents, encoding='utf-8', newline='')
            with mock.patch.object(tts, 'HERE', Path(d)):
                return tts.api_key()

    def test_plain_line(self):
        self.assertEqual(self.key_from(f'ELEVENLABS_API_KEY={SECRET}\n'), SECRET)

    def test_quotes_spaces_and_windows_line_endings(self):
        self.assertEqual(self.key_from(f'ELEVENLABS_API_KEY = "{SECRET}"\r\n'), SECRET)
        self.assertEqual(self.key_from(f"ELEVENLABS_API_KEY='{SECRET}'"), SECRET)

    def test_export_prefix(self):
        # Shell-style .env files are common: `export KEY=value`.
        self.assertEqual(self.key_from(f'export ELEVENLABS_API_KEY={SECRET}\n'), SECRET)

    def test_comments(self):
        self.assertEqual(self.key_from(f'# my key\nELEVENLABS_API_KEY={SECRET}  # renderer only\n'), SECRET)
        self.assertEqual(self.key_from(f'# ELEVENLABS_API_KEY=old\nELEVENLABS_API_KEY={SECRET}\n'), SECRET)

    def test_empty_or_missing(self):
        self.assertEqual(self.key_from('ELEVENLABS_API_KEY=\n'), '')
        self.assertEqual(self.key_from('OTHER=1\n'), '')
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {}, clear=True), \
                mock.patch.object(tts, 'HERE', Path(d)):
            self.assertEqual(tts.api_key(), '')  # no .env at all

    def test_environment_wins_over_file(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'from-env'}, clear=True):
            (Path(d) / '.env').write_text(f'ELEVENLABS_API_KEY={SECRET}\n', encoding='utf-8')
            with mock.patch.object(tts, 'HERE', Path(d)):
                self.assertEqual(tts.api_key(), 'from-env')


class WordTimesTest(unittest.TestCase):
    def test_exact_alignment_maps_each_word(self):
        text = 'New DNA grows.'
        words = tts.word_times(text, alignment(text), 1.0)
        self.assertEqual([w[0] for w in words], ['New', 'DNA', 'grows.'])
        self.assertAlmostEqual(words[1][1], 4 * 0.05)          # "DNA" starts at character 4
        self.assertAlmostEqual(words[1][2], 7 * 0.05)          # and ends after character 6

    def test_times_never_go_backwards_and_end_within_audio(self):
        text = 'One two three'
        a = alignment(text)
        a['character_start_times_seconds'][4] = 0.0            # a glitchy alignment point
        words = tts.word_times(text, a, 0.5)
        starts = [w[1] for w in words]
        self.assertEqual(starts, sorted(starts))
        self.assertLessEqual(words[-1][2], 0.5)
        for _, s, e in words:
            self.assertLessEqual(s, e)

    def test_mismatched_alignment_still_gives_every_word(self):
        text = 'Two words'
        words = tts.word_times(text, alignment('Two  words!'), 1.0)  # normalised text differs
        self.assertEqual([w[0] for w in words], ['Two', 'words'])


class SynthesizeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = [mock.patch.object(tts, 'CACHE', Path(self.tmp.name)),
                      mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': SECRET})]
        for p in self.patch:
            p.start()

    def tearDown(self):
        for p in reversed(self.patch):
            p.stop()
        self.tmp.cleanup()

    def response(self, text):
        pcm = b'\x00\x01' * 2400  # 0.1 s at 24 kHz
        body = json.dumps({'audio_base64': base64.b64encode(pcm).decode(), 'alignment': alignment(text)}).encode()
        return mock.MagicMock(__enter__=lambda s: io.BytesIO(body), __exit__=lambda *a: False)

    def test_second_render_uses_the_cache(self):
        with mock.patch.object(tts.urllib.request, 'urlopen', return_value=self.response('Hi there')) as call:
            first = tts.synthesize('Hi there', CFG)
            second = tts.synthesize('Hi there', CFG)
        self.assertEqual(call.call_count, 1, 'the same narration must not be billed twice')
        self.assertEqual(first, second)

    def test_changed_text_or_voice_is_a_new_request(self):
        with mock.patch.object(tts.urllib.request, 'urlopen', side_effect=lambda *a, **k: self.response('Hi there')) as call:
            tts.synthesize('Hi there', CFG)
            tts.synthesize('Hi there', {**CFG, 'voice_id': 'OTHER'})
            tts.synthesize('Hi there', {**CFG, 'speed': 1.0})
        self.assertEqual(call.call_count, 3)

    def test_request_shape(self):
        with mock.patch.object(tts.urllib.request, 'urlopen', return_value=self.response('Hi there')) as call:
            tts.synthesize('Hi there', CFG)
        req = call.call_args[0][0]
        self.assertIn('/text-to-speech/VOICE/with-timestamps?output_format=pcm_24000', req.full_url)
        self.assertEqual(req.headers['Xi-api-key'], SECRET)
        self.assertEqual(json.loads(req.data)['text'], 'Hi there')

    def test_errors_never_contain_the_key(self):
        err = urllib.error.HTTPError('https://api.elevenlabs.io', 401, 'Unauthorized', {}, io.BytesIO(b'{"detail":"invalid api key"}'))
        with mock.patch.object(tts.urllib.request, 'urlopen', side_effect=err):
            with self.assertRaises(RuntimeError) as ctx:
                tts.synthesize('Hi there', CFG)
        self.assertIn('401', str(ctx.exception))
        self.assertNotIn(SECRET, str(ctx.exception))

    def test_missing_key_or_voice_fails_clearly(self):
        with mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': ''}), mock.patch.object(tts, 'HERE', Path(self.tmp.name)):
            with self.assertRaisesRegex(RuntimeError, 'No ElevenLabs API key'):
                tts.synthesize('Hi there', CFG)
        with self.assertRaisesRegex(RuntimeError, 'voice_id'):
            tts.synthesize('Hi there', {**CFG, 'voice_id': ''})


if __name__ == '__main__':
    unittest.main()
