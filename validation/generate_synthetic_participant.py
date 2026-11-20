"""Build an explicitly synthetic participant through the real storage/grading API.

Never contacts a server or opens the study database. CSV moderator exports are
materialized separately from records.json using the repository's exact headers.
"""
import csv
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
from unittest.mock import patch
import uuid
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
PROFILE = json.loads(os.environ.get('CLIPCADEMY_SYNTHETIC_PROFILE', '{}'))
PID = PROFILE.get('participant_id', 'SIM_P01')
assert re.fullmatch(r'SIM_P0[1-6]', PID)
OUT = ROOT / 'validation/synthetic' / PID
OUT.mkdir(parents=True, exist_ok=True)
BUILD = 'SYNTHETIC_VALIDATION_EXAMPLE'
os.environ['CLIPCADEMY_DB'] = ':memory:'
os.environ['CLIPCADEMY_VIDEO_DB'] = str(Path(tempfile.mkdtemp()) / 'video.db')
sys.path.insert(0, str(ROOT / 'learning'))
import app  # noqa: E402
import grading  # noqa: E402

db_path = OUT / 'clipcademy.db'
if db_path.exists():
    db_path.unlink()  # Only this fixture's database is replaceable.
service = app.make_app(str(db_path), ['*'], [BUILD], 'synthetic-export-only')
local = ZoneInfo('America/New_York')
def at(value):
    return datetime.fromisoformat('2026-11-04T' + value).replace(tzinfo=local) + timedelta(minutes=PROFILE.get('offset_minutes', 0))
def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
def uid(label):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f'clipcademy:synthetic:{PID}:' + label))
def request(method, path, body=None, now=None):
    raw = json.dumps(body).encode() if body is not None else b''
    env = {'REQUEST_METHOD': method, 'PATH_INFO': path,
           'CONTENT_LENGTH': str(len(raw)), 'wsgi.input': io.BytesIO(raw),
           'HTTP_AUTHORIZATION': 'Bearer synthetic-export-only'}
    result = {}
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return (now or at('08:45:00')).astimezone(tz or timezone.utc)
    with patch.object(app, 'datetime', Clock):
        payload = b''.join(service(env, lambda status, headers: result.update(status=int(status[:3]))))
    assert result['status'] in (200, 201), (path, payload.decode())
    return payload.decode() if path.endswith('.csv') else json.loads(payload)

events, attempts = [], []
session = 'morning'
cursor = at('08:45:00')
def emit(name, **extras):
    events.append({'event_id': uid(f'event-{len(events)}'), 'participant_id': PID,
                   'session_id': uid(session), 'event_name': name,
                   'client_timestamp_utc': iso(cursor), 'build_id': BUILD, **extras})
def play(topic, objective, variant):
    global cursor
    paths = list((ROOT / 'video/media').glob(f'{topic}.{variant}.*.json'))
    assert len(paths) == 1, (topic, variant, paths)
    duration = json.loads(paths[0].read_text())['duration_seconds']
    ids = dict(topic_id=topic, objective_id=objective, variant_id=variant)
    emit('video_started', **ids)
    cursor += timedelta(seconds=duration)
    emit('video_completed', **ids)
    cursor += timedelta(seconds=.6)
    emit('clip_swiped', direction='auto', seconds_watched=duration, **ids)
    cursor += timedelta(seconds=1)

def answer(topic, objective, qid, choice, state):
    global cursor
    cursor += timedelta(seconds=12)
    body = dict(attempt_id=uid(f'attempt-{len(attempts)}'), question_id=qid,
                selected_choice_id=choice, objective_id=objective, remediation_state=state)
    result = request('POST', '/attempts', body)
    attempts.append({'synthetic': True, 'participant_id': PID,
                     'client_timestamp_utc': iso(cursor), 'request': body, 'result': result})
    emit('question_answered', question_id=qid, correct=result['correct'],
         topic_id=topic, objective_id=objective)
    if result['next_video_request']:
        emit('followup_requested', topic_id=topic, objective_id=objective,
             variant_id=result['next_video_request']['variant_id'])
        play(topic, objective, result['next_video_request']['variant_id'])
    if result['action'] == 'complete':
        emit('objective_completed', topic_id=topic, objective_id=objective)
    elif result['action'] == 'needs_review':
        emit('objective_needs_review', topic_id=topic, objective_id=objective)
    return result['remediation_state']

emit('app_opened')
for topic in ['dna_replication', 'dna_repair']:
    cursor += timedelta(seconds=1)
    emit('topic_selected', topic_id=topic)
for topic, objective, count in [('dna_replication', 'synthesis_direction_and_primer', 5),
                                ('dna_repair', 'error_correction', 4)]:
    for n in range(1, count + 1):
        play(topic, objective, f'intro_{n}')
    state = {}
    prefix = 'rep' if topic == 'dna_replication' else 'dr'
    qid = prefix + '-q1'
    for _ in range(8):
        key = grading.KEY[qid]['correct_choice_id']
        wrong = qid in PROFILE.get('wrong_app_questions', ['rep-q2'])
        choice = next(c['choice_id'] for c in grading.QUESTIONS[qid]['choices'] if c['choice_id'] != key) if wrong else key
        state = answer(topic, objective, qid, choice, state)
        if state['objective_status'] in ('complete', 'needs_review'):
            break
        qid = state['expected_question_id']
    assert state['objective_status'] in ('complete', 'needs_review')
morning_end = cursor
assert morning_end < at('09:00:00')
# 30-second visible-time heartbeats, confined to the simulated open interval.
beat = at('08:45:30')
while beat <= morning_end:
    saved = cursor
    cursor = beat
    emit('heartbeat')
    cursor = saved
    beat += timedelta(seconds=30)

return_kind = PROFILE.get('return_kind', 'qualifying')
if return_kind != 'none':
    session = 'voluntary-' + return_kind
    cursor = at('16:00:00' if return_kind == 'last_minute' else '12:30:00')
    emit('app_opened')
    state = {}
    if return_kind != 'open_only':
      for n in range(1, 6):
        emit('clip_swiped', topic_id='dna_replication', objective_id='synthesis_direction_and_primer',
             variant_id=f'intro_{n}', direction='up', seconds_watched=0)
      for qid in ['rep-q1', 'rep-q2']:
        state = answer('dna_replication', 'synthesis_direction_and_primer', qid,
                       grading.KEY[qid]['correct_choice_id'], state)
events.sort(key=lambda e: e['client_timestamp_utc'])
for event in events:
    request('POST', '/events', event, datetime.fromisoformat(event['client_timestamp_utc']) + timedelta(seconds=1))
# Verify actual endpoint idempotency and export rather than inventing a CSV shape.
assert request('POST', '/events', events[0])['duplicate']
(OUT / 'events.csv').write_text(request('GET', '/events.csv'))
(OUT / 'attempts.json').write_text(json.dumps(attempts, indent=2) + '\n')

assessment = (ROOT / 'Context/assessment.md').read_text()
keys = dict(re.findall(r'^\| ([AB]\d+) \| ([A-D]) \|', assessment, re.M))
assert len(keys) == 20
topics = ['rep', 'dr', 'tx', 'tl']
full_topics = ['dna_replication', 'dna_repair', 'transcription', 'translation']
written = {
 'pre': [('At the three-prime end.', '3-prime end; growth 5-prime to 3-prime', 1),
         ('Primase repairs the copied DNA.', 'Polymerase proofreading during copying; mismatch repair after', 0),
         ('It matches the DNA.', 'Complementary pairing to the next template-strand base', 1),
         ('Every tRNA stays in the P site.', 'A receives charged tRNA; P peptide bond; E empty tRNA exits', 0)],
 'post': [('Nucleotides attach only at the three-prime end, so growth runs five-prime to three-prime.', 'Addition at 3-prime end; growth 5-prime to 3-prime', 2),
          ('Proofreading.', 'Polymerase proofreading fixes errors during copying', 1),
          ('AUG.', '5-prime AUG 3-prime; same as coding strand with U for T because it pairs to template', 1),
          ('CCG.', 'CCG anticodon; correct pairing selects the right amino acid', 1)]}
rubric_text = {
 'A': [
  [('At the five-prime end.',0),('At the three-prime end.',1),('At the three-prime end; growth is five-prime to three-prime.',2)],
  [('Primase repairs the copied DNA.',0),('Proofreading fixes errors during copying.',1),('Polymerase proofreads during copying; mismatch repair acts after copying.',2)],
  [('It uses the coding strand directly.',0),('It matches the DNA.',1),('It adds the base complementary to the next template-strand base, using U for A.',2)],
  [('Every tRNA stays in the P site.',0),('Charged tRNA enters A and empty tRNA leaves E.',1),('Charged tRNA enters A; a peptide bond links the chain from P; empty tRNA leaves E.',2)]],
 'B': [
  [('It grows in both directions.',0),('It grows five-prime to three-prime.',1),('Nucleotides attach only at the three-prime end, so growth runs five-prime to three-prime.',2)],
  [('Primase fixes every mismatch.',0),('Proofreading.',1),('DNA polymerase proofreading can still fix errors during copying.',2)],
  [('UAC.',0),('AUG.',1),('Five-prime AUG three-prime; it matches the coding strand with U instead of T because RNA pairs to the template.',2)],
  [('GGC.',0),('CCG.',1),('CCG; matching the codon selects the tRNA carrying the right amino acid.',2)]]}
responses, totals = [], {}
pre_form = PROFILE.get('pre_form', 'A')
for test, form, time, correct_indices in [('pre', pre_form, '08:32:00', set(PROFILE.get('pre_mc', [1,4,7,9]))),
        ('post', 'B' if pre_form == 'A' else 'A', '16:32:00', set(PROFILE.get('post_mc', [1,2,3,4,5,7,9])))]:
    for n in range(1, 11):
        i = 0 if n <= 3 else 1 if n <= 6 else 2 if n <= 8 else 3
        key = keys[f'{form}{n}']
        score = int(n in correct_indices)
        response = key if score else next(c for c in 'ABCD' if c != key)
        row = dict(participant_id=PID, test=test, date='2026-11-04', time=at(time).strftime('%H:%M:%S'), form=form,
                   item=f'{form}{n}', topic=full_topics[i], taught_in_app='yes' if i < 2 else 'no',
                   type='mc', response=response, correct_answer=key, score=score, max=1,
                   scorer='SYNTHETIC_KEY_FIXTURE')
        responses.append(row)
        totals[f'{topics[i]}_{test}_mc'] = totals.get(f'{topics[i]}_{test}_mc', 0) + score
    for i, score in enumerate(PROFILE.get(test + '_wr', [s[2] for s in written[test]])):
        response = rubric_text[form][i][score][0]
        key = rubric_text[form][i][2][0]
        responses.append(dict(participant_id=PID, test=test, date='2026-11-04', time=at(time).strftime('%H:%M:%S'), form=form,
            item=f'W{form}{i+1}', topic=full_topics[i], taught_in_app='yes' if i < 2 else 'no',
            type='written', response=response, correct_answer=key, score=score, max=2,
            scorer='SYNTHETIC_RUBRIC_FIXTURE'))
        totals[f'{topics[i]}_{test}_wr'] = score

participant = dict(participant_id=PID, eligible='yes', prior_exposure='Simulated: attended lectures 19-22',
    pre_form=pre_form, date='2026-11-04', am_start=at('08:30:00').strftime('%H:%M:%S'), am_end=at('09:00:00').strftime('%H:%M:%S'), pm_start=at('16:30:00').strftime('%H:%M:%S'),
    **totals, help_steps=PROFILE.get('help_steps',''), reminders_sent=0, ext_rep=PROFILE.get('ext_rep','no'), ext_dr='no', ext_tx='no', ext_tl='no',
    ext_notes='SYNTHETIC: textbook review of replication assigned.' if PROFILE.get('ext_rep')=='yes' else 'SYNTHETIC: no outside studying assumed.', disappointed=PROFILE.get('disappointed','somewhat'), withdrawn='no',
    notes='SYNTHETIC PARTICIPANT. All times, answers, help observations and survey responses are invented for practice; not a real student.')
headers = {}
for name in ['participant-results', 'test-responses']:
    headers[name] = next(csv.reader(io.StringIO((ROOT / f'Context/{name}.csv').read_text())))
record = {'synthetic': True, 'participant_id': PID, 'build_id': BUILD,
          'timezone': 'America/New_York', 'study_date': '2026-11-04',
          'provenance': 'Deterministic invented fixture; no human participant or observed behavior.',
          'participant': participant, 'test_responses': responses, 'headers': headers,
          'profile': PROFILE,
          'session_intervals': {'pre_test': [at(t).strftime('%H:%M:%S') for t in ['08:32:00','08:42:00']],
            'moderated_app': [at('08:45:00').strftime('%H:%M:%S'),morning_end.astimezone(local).strftime('%H:%M:%S')],
            'post_test': [at(t).strftime('%H:%M:%S') for t in ['16:32:00','16:43:00']]}}
(OUT / 'records.json').write_text(json.dumps(record, indent=2) + '\n')

taught_pre = sum(totals[f'{t}_pre_{kind}'] for t in topics[:2] for kind in ['mc','wr'])
taught_post = sum(totals[f'{t}_post_{kind}'] for t in topics[:2] for kind in ['mc','wr'])
untaught_pre = sum(totals[f'{t}_pre_{kind}'] for t in topics[2:] for kind in ['mc','wr'])
untaught_post = sum(totals[f'{t}_post_{kind}'] for t in topics[2:] for kind in ['mc','wr'])
effect = (taught_post-taught_pre)/10*100 - (untaught_post-untaught_pre)/8*100
with sqlite3.connect(db_path) as db:
    assert db.execute('select count(*) from attempts').fetchone()[0] == len(attempts)
    assert db.execute('select count(*) from events').fetchone()[0] == len(events)
    db.execute('CREATE TABLE synthetic_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.executemany('INSERT INTO synthetic_metadata VALUES (?,?)',
        [('synthetic','true'),('participant_id',PID),('provenance',record['provenance'])])
assert len(responses)==28
metrics = {'synthetic': True, 'participant_id': PID, 'events': len(events), 'practice_attempts': len(attempts),
    'paper_responses': len(responses), 'taught_pre': taught_pre, 'taught_post': taught_post,
    'comparison_pre': untaught_pre, 'comparison_post': untaught_post,
    'app_effect_percentage_points': effect, 'qualifying_return': return_kind == 'qualifying',
    'disappointed': participant['disappointed'], 'outside_taught_study': participant['ext_rep']=='yes',
    'heartbeat_minutes': sum(e['event_name']=='heartbeat' for e in events)*.5}
(OUT / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
print(json.dumps({'participant':PID,'events':len(events),'attempts':len(attempts),
                  'paper_answers':len(responses),'app_effect_pp':effect}))
