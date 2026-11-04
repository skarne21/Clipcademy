"""WSGI video service mounted by learning/app.py. Hosted mode never renders."""
import csv
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import hashlib
from http import HTTPStatus
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time
import uuid

HERE = Path(__file__).resolve().parent
# Loaded by file path by Member 2; do not depend on the process working directory.
import importlib.util
_spec = importlib.util.spec_from_file_location('clipcademy_renderer', HERE/'render.py')
renderer = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(renderer)
MAX_BODY = 16384


class Error(Exception):
    def __init__(self, status, field, message):
        self.status, self.field, self.message = status, field, message


class VideoService:
    def __init__(self, media_dir=None, db_path=None, mode='prerendered', preview=False, media_url='/media/', worker=None):
        if mode not in {'prerendered', 'live'}:
            raise ValueError('CLIPCADEMY_VIDEO_MODE must be prerendered or live')
        self.media = Path(media_dir or HERE/'media')
        self.db_path = str(db_path or HERE/'.cache/jobs.db')
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.mode, self.preview, self.media_url = mode, preview, media_url.rstrip('/')+'/'
        self.pool = ThreadPoolExecutor(max_workers=1) if mode=='live' else None
        self.worker = worker or self.render
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, cache_key TEXT, status TEXT, payload TEXT, updated REAL)')
        self.catalog = {}
        for path in sorted((HERE/'scripts').glob('*.json')):
            script = json.loads(path.read_text(encoding='utf-8'))
            self.catalog[(script['topic_id'],script['objective_id'],script['variant_id'])] = script

    @contextmanager
    def db(self):
        # sqlite3's own context manager commits but never closes; Windows then can't delete the file.
        conn = sqlite3.connect(self.db_path, timeout=20)
        try:
            with conn: yield conn
        finally: conn.close()

    def approved(self, script):
        packet = json.loads((HERE.parent/'learning/packets'/f'{script["topic_id"]}.{script["objective_id"]}.json').read_text(encoding='utf-8'))
        with (HERE.parent/'Context/content-audit.csv').open(encoding='utf-8', newline='') as f:
            audit = {r['item_id']:r for r in csv.DictReader(f)}
        row = audit.get(f'clip:{script["objective_id"]}:{script["variant_id"]}',{})
        return (packet['review_status']=='reviewed' and row.get('review_status')=='approved'
                and bool(row.get('reviewer','').strip()) and row.get('approved_version')==renderer.fingerprint(script))

    def validate(self, request):
        if not isinstance(request,dict): raise Error(400,'body','must be a JSON object')
        for field in ['topic_id','objective_id','variant_id','teaching_goal']:
            if not isinstance(request.get(field),str) or not request[field].strip():
                raise Error(400,field,'must be a non-empty string')
        key = tuple(request[f] for f in ['topic_id','objective_id','variant_id'])
        script = self.catalog.get(key)
        if script is None: raise Error(400,'variant_id','unknown topic, objective, or variant combination')
        if request.get('source_refs') != script['source_refs']:
            raise Error(400,'source_refs','must match the lesson packet references')
        # teaching_goal is descriptive only. Canonical script selection is by fixed IDs.
        if not self.preview and not self.approved(script):
            raise Error(403,'review_status','Clip pending content review; use local preview mode for team review only')
        return script

    def asset(self, script):
        stem=f'{script["topic_id"]}.{script["variant_id"]}.{renderer.fingerprint(script)}'
        try:
            record=json.loads((self.media/f'{stem}.json').read_text(encoding='utf-8'))
            if record['video_file'] != f'{stem}.mp4' or record['captions_file'] != f'{stem}.vtt': return None
            if not (self.media/record['captions_file']).is_file(): return None
            if hashlib.sha256((self.media/record['video_file']).read_bytes()).hexdigest()!=record['sha256']: return None
            return record
        except (OSError, ValueError, KeyError): return None

    def ready(self, base, record, source):
        return {**base,'status':'ready','source':source,'video_url':self.media_url+record['video_file'],
                'captions_url':self.media_url+record['captions_file'],'transcript':record['transcript'],
                'duration_seconds':record['duration_seconds'],'width':record.get('width'),'height':record.get('height'),
                'review_status':'preview' if self.preview else 'approved'}

    def save(self, job, key):
        with self.db() as db:
            db.execute('INSERT OR REPLACE INTO jobs VALUES (?,?,?,?,?)',(job['job_id'],key,job['status'],json.dumps(job),time.time()))

    def render(self, script):
        subprocess.run([sys.executable,str(HERE/'render.py'),'--topic',script['topic_id'],'--variant',script['variant_id'],'--output',str(self.media)],check=True,timeout=300,capture_output=True)

    def run(self, base, key, script):
        self.save({**base,'status':'running'},key)
        try:
            self.worker(script)
            record=self.asset(script)
            if record is None: raise RuntimeError('No valid rendered asset')
            self.save(self.ready(base,record,'generated'),key)
        except Exception:
            # Do not expose local paths or subprocess output to learners.
            self.save({**base,'status':'failed','error':'Video rendering failed. Retry the request.'},key)

    def start(self, request):
        script=self.validate(request);key=renderer.fingerprint(script)
        base={'job_id':'video-'+uuid.uuid4().hex,'status':'queued','topic_id':script['topic_id'],
              'objective_id':script['objective_id'],'variant_id':script['variant_id'],'source_refs':script['source_refs']}
        # Transaction makes concurrent identical requests select the same queued job.
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute("SELECT payload, updated FROM jobs WHERE cache_key=? AND status IN ('queued','running','ready') ORDER BY updated DESC LIMIT 1",(key,)).fetchone()
            if row:
                previous=json.loads(row[0])
                if previous['status']=='ready' and self.asset(script):
                    return 200,{**previous,'source':'prerendered','cache_hit':True}
                if previous['status'] in {'queued','running'} and time.time()-row[1]<360:
                    return 202,previous
            record=self.asset(script)
            if record:
                base=self.ready(base,record,'prerendered');status=200
            elif self.mode=='prerendered':
                base.update(status='failed',error='Prepared clip is missing or invalid. Restore the asset and retry.');status=200
            else: status=202
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,?)',(base['job_id'],key,base['status'],json.dumps(base),time.time()))
        if base['status']=='queued': self.pool.submit(self.run,base,key,script)
        return status,base

    def get(self, job_id):
        with self.db() as db:
            row=db.execute('SELECT payload,cache_key,updated FROM jobs WHERE id=?',(job_id,)).fetchone()
        if row is None: raise Error(404,'job_id','unknown video job')
        job=json.loads(row[0])
        script=self.catalog.get(tuple(job[f] for f in ['topic_id','objective_id','variant_id']))
        if not self.preview and not self.approved(script): raise Error(403,'review_status','Clip pending content review')
        if (job['status'] in {'queued','running'} and time.time()-row[2]>=360) or (job['status']=='ready' and self.asset(script) is None):
            job={k:v for k,v in job.items() if k not in {'video_url','captions_url','transcript'}}
            job.update(status='failed',error='Video asset unavailable or job interrupted. Retry the request.')
            self.save(job,row[1])
        return 200,job

    def __call__(self, environ, start_response):
        headers=[('Content-Type','application/json; charset=utf-8'),('Cache-Control','no-store')]
        allowed=os.environ.get('CLIPCADEMY_ALLOWED_ORIGINS','*').split(',');origin=environ.get('HTTP_ORIGIN')
        if '*' in allowed: headers.append(('Access-Control-Allow-Origin','*'))
        elif origin in [s.strip() for s in allowed]: headers.extend([('Access-Control-Allow-Origin',origin),('Vary','Origin')])
        method=environ['REQUEST_METHOD'];path=environ.get('PATH_INFO','/')
        try:
            if method=='OPTIONS':
                headers.extend([('Access-Control-Allow-Methods','GET, POST, OPTIONS'),('Access-Control-Allow-Headers','Content-Type')])
                start_response('204 No Content',headers);return [b'']
            if path=='/video-jobs':
                if method!='POST': raise Error(405,'method','use POST for /video-jobs')
                try: length=int(environ.get('CONTENT_LENGTH') or 0)
                except ValueError: raise Error(400,'body','invalid content length')
                if length<0: raise Error(400,'body','invalid content length')
                if length>MAX_BODY: raise Error(413,'body','request is too large')
                try: request=json.loads(environ['wsgi.input'].read(length))
                except (ValueError,UnicodeError): raise Error(400,'body','must be valid JSON')
                status,body=self.start(request)
            elif re.fullmatch(r'/video-jobs/[^/]+',path):
                if method!='GET': raise Error(405,'method','use GET to poll a video job')
                status,body=self.get(path.rsplit('/',1)[1])
            else: raise Error(404,'path','unknown video endpoint')
        except Error as e: status,body=e.status,{'error':{'field':e.field,'message':e.message}}
        payload=json.dumps(body,ensure_ascii=False).encode();headers.append(('Content-Length',str(len(payload))))
        start_response(f'{status} {HTTPStatus(status).phrase}',headers);return [payload]


application=VideoService(mode=os.environ.get('CLIPCADEMY_VIDEO_MODE','prerendered'),
                         preview=os.environ.get('CLIPCADEMY_VIDEO_PREVIEW')=='1',
                         media_dir=os.environ.get('CLIPCADEMY_MEDIA_DIR'),
                         db_path=os.environ.get('CLIPCADEMY_VIDEO_DB'),
                         media_url=os.environ.get('CLIPCADEMY_MEDIA_URL','/media/'))
