"""Exercise the mounted learning app and real clip responses without a browser."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import uuid

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'learning'))
import app
import jobs


class MountedVideoTest(unittest.TestCase):
    def test_wrong_answer_to_real_followup_and_retry(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:  # app holds its db open (Windows lock)
            video=jobs.VideoService(db_path=Path(tmp)/'video.db',preview=True)
            application=app.make_app(str(Path(tmp)/'learning.db'),['*'],['dev'],'t',video_app=video)
            def call(method,path,body=None):
                raw=json.dumps(body).encode();status=[]
                data=b''.join(application({'REQUEST_METHOD':method,'PATH_INFO':path,'CONTENT_LENGTH':str(len(raw)),'wsgi.input':io.BytesIO(raw)},lambda s,h:status.append(s)))
                self.assertTrue(status[0].startswith('200'),data)
                return json.loads(data)
            topics=call('GET','/topics')['topics']
            objective=next(t for t in topics if t['topic_id']=='dna_replication')['objectives'][0]
            # every intro clip in the feed must exist (notes.md); fails until Member 1 renders intro_1 … intro_5
            for request in objective['intro_video_requests']:
                self.assertEqual(call('POST','/video-jobs',request)['status'],'ready')
            state={}
            for question,choice in [('rep-q1','B'),('rep-q2','B'),('rep-r2','B')]:
                result=call('POST','/attempts',{'attempt_id':str(uuid.uuid4()),'objective_id':objective['objective_id'],'question_id':question,'selected_choice_id':choice,'remediation_state':state})
                state=result['remediation_state']
                if result['next_video_request']:
                    clip=call('POST','/video-jobs',result['next_video_request'])
                    self.assertEqual(clip['variant_id'],'primer_followup');self.assertEqual(clip['status'],'ready')
                    self.assertIn('primase',clip['transcript'].lower())
            self.assertEqual(result['action'],'complete')

if __name__=='__main__':unittest.main()
