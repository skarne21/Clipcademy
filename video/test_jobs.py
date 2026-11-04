import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

import jobs
from media import serve


class JobsTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.service=jobs.VideoService(db_path=self.root/'jobs.db',preview=True)
        self.script=next(s for s in self.service.catalog.values() if s['topic_id']=='dna_replication' and s['variant_id']=='intro_2')  # the one vertical clip so far
        self.request={k:self.script[k] for k in ['topic_id','objective_id','variant_id','teaching_goal','source_refs']}
    def tearDown(self):self.tmp.cleanup()
    def call(self,method,path,body=None,raw=None):
        data=raw if raw is not None else json.dumps(body).encode()
        result={}
        def start(status,headers):result.update(status=int(status[:3]),headers=dict(headers))
        payload=b''.join(self.service({'REQUEST_METHOD':method,'PATH_INFO':path,'CONTENT_LENGTH':str(len(data)),'wsgi.input':io.BytesIO(data)},start))
        return result,json.loads(payload) if payload else None
    def test_ready_cache_and_restart(self):
        status,first=self.call('POST','/video-jobs',self.request)
        self.assertEqual(status['status'],200);self.assertEqual(first['status'],'ready')
        self.assertTrue(first['transcript']);self.assertEqual(first['source'],'prerendered')
        self.service=jobs.VideoService(db_path=self.root/'jobs.db',preview=True)
        _,cached=self.call('POST','/video-jobs',self.request)
        self.assertEqual(cached['job_id'],first['job_id']);self.assertTrue(cached['cache_hit'])
        _,polled=self.call('GET','/video-jobs/'+first['job_id']);self.assertEqual(polled['status'],'ready')
    def test_review_gate(self):
        self.service.preview=False
        status,_=self.call('POST','/video-jobs',self.request);self.assertEqual(status['status'],403)
    def test_bad_requests(self):
        for body in [None,[],{},dict(self.request,variant_id='../initial'),dict(self.request,source_refs=['L22-p1']),dict(self.request,topic_id='dna_repair')]:
            with self.subTest(body=body):self.assertEqual(self.call('POST','/video-jobs',body)[0]['status'],400)
        self.assertEqual(self.call('POST','/video-jobs',raw=b'{')[0]['status'],400)
        self.assertEqual(self.call('POST','/video-jobs',raw=b'x'*16385)[0]['status'],413)
        self.assertEqual(self.call('GET','/video-jobs')[0]['status'],405)
        self.assertEqual(self.call('GET','/video-jobs/unknown')[0]['status'],404)
    def test_missing_asset_failed_and_retry(self):
        self.service.media=self.root
        _,failed=self.call('POST','/video-jobs',self.request)
        self.assertEqual(failed['status'],'failed');self.assertNotIn('video_url',failed)
        self.service.media=jobs.HERE/'media'
        _,ready=self.call('POST','/video-jobs',self.request);self.assertEqual(ready['status'],'ready')
        self.assertNotEqual(failed['job_id'],ready['job_id'])
    def test_live_queued_running_duplicate_and_failure(self):
        entered=threading.Event();release=threading.Event()
        def worker(script):entered.set();release.wait(5);raise RuntimeError('renderer unavailable')
        self.service=jobs.VideoService(db_path=self.root/'live.db',media_dir=self.root,mode='live',preview=True,worker=worker)
        status,queued=self.call('POST','/video-jobs',self.request)
        self.assertEqual(status['status'],202);self.assertEqual(queued['status'],'queued')
        self.assertTrue(entered.wait(3))
        _,running=self.call('GET','/video-jobs/'+queued['job_id']);self.assertEqual(running['status'],'running')
        _,duplicate=self.call('POST','/video-jobs',self.request);self.assertEqual(duplicate['job_id'],queued['job_id'])
        release.set();self.service.pool.shutdown(wait=True)
        _,failed=self.call('GET','/video-jobs/'+queued['job_id']);self.assertEqual(failed['status'],'failed')
    def test_live_success(self):
        self.service=jobs.VideoService(db_path=self.root/'live.db',media_dir=self.root,mode='live',preview=True,worker=lambda s:None)
        record={'video_file':'test.mp4','captions_file':'test.vtt','transcript':'Spoken text','duration_seconds':40}
        with patch.object(self.service,'asset',side_effect=[None,record]):
            _,queued=self.call('POST','/video-jobs',self.request)
            self.service.pool.shutdown(wait=True)
        with patch.object(self.service,'asset',return_value=record):
            _,ready=self.call('GET','/video-jobs/'+queued['job_id']);self.assertEqual(ready['source'],'generated')
    def test_interrupted_job(self):
        base={'job_id':'video-stale','status':'running',**self.request}
        self.service.save(base,jobs.renderer.fingerprint(self.script))
        with self.service.db() as db:db.execute('UPDATE jobs SET updated=0')
        _,failed=self.call('GET','/video-jobs/video-stale');self.assertEqual(failed['status'],'failed')
    def test_all_variants_have_real_assets(self):
        self.assertEqual(len(self.service.catalog),35)  # notes.md: 4-5 intro clips + 4 follow-ups, for 4 topics
        for script in self.service.catalog.values():
            record=self.service.asset(script)
            self.assertIsNotNone(record,script['variant_id'])
            self.assertGreaterEqual(record['duration_seconds'],15);self.assertLessEqual(record['duration_seconds'],30)
            self.assertEqual((record['width'],record['height']),(720,1280))
            self.assertEqual(record['transcript'],'\n\n'.join(s['narration'] for s in script['scenes']))


class MediaTest(unittest.TestCase):
    def test_ranges_and_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp,'test.mp4').write_bytes(b'0123456789')
            def call(path,range_header=None,method='GET'):
                result={};env={'PATH_INFO':path,'REQUEST_METHOD':method}
                if range_header:env['HTTP_RANGE']=range_header
                body=b''.join(serve(env,lambda s,h:result.update(status=s,headers=dict(h)),tmp))
                return result,body
            result,body=call('/media/test.mp4','bytes=2-5');self.assertEqual(body,b'2345');self.assertTrue(result['status'].startswith('206'))
            self.assertEqual(call('/media/test.mp4','bytes=-3')[1],b'789')
            self.assertTrue(call('/media/test.mp4','bytes=99-')[0]['status'].startswith('416'))
            self.assertTrue(call('/media/../test.mp4')[0]['status'].startswith('404'))
            self.assertEqual(call('/media/test.mp4',method='HEAD')[1],b'')

if __name__=='__main__':unittest.main()
