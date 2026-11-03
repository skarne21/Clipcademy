"""Local media serving with byte ranges. Production uses the host's static mapping."""
import mimetypes
from pathlib import Path
import re


def serve(environ, start_response, directory):
    path=environ.get('PATH_INFO','')
    name=path.removeprefix('/media/')
    if not re.fullmatch(r'[a-z0-9_.-]+\.(mp4|vtt|txt)',name):
        start_response('404 Not Found',[]);return [b'']
    target=Path(directory)/name
    if not target.is_file():
        start_response('404 Not Found',[]);return [b'']
    if environ['REQUEST_METHOD'] not in {'GET','HEAD'}:
        start_response('405 Method Not Allowed',[('Allow','GET, HEAD')]);return [b'']
    size=target.stat().st_size;begin=0;end=size-1;status='200 OK'
    headers=[('Content-Type',mimetypes.guess_type(name)[0] or 'application/octet-stream'),('Accept-Ranges','bytes')]
    range_header=environ.get('HTTP_RANGE')
    if range_header:
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',range_header)
        if not match or not any(match.groups()):
            start_response('416 Range Not Satisfiable',[('Content-Range',f'bytes */{size}')]);return [b'']
        left,right=match.groups()
        if left:
            begin=int(left);end=min(int(right),size-1) if right else size-1
        else: begin=max(0,size-int(right))
        if begin>=size or begin>end:
            start_response('416 Range Not Satisfiable',[('Content-Range',f'bytes */{size}')]);return [b'']
        status='206 Partial Content';headers.append(('Content-Range',f'bytes {begin}-{end}/{size}'))
    headers.append(('Content-Length',str(end-begin+1)))
    start_response(status,headers)
    if environ['REQUEST_METHOD']=='HEAD':return [b'']
    with target.open('rb') as f:
        f.seek(begin);return [f.read(end-begin+1)]
