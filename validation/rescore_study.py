"""Rescore recorded multiple-choice choices using Context/assessment.md.

python3 validation/rescore_study.py

The combined CSVs are the input source. Written responses and observations are
preserved. Participant copies, JSON records and calculated reports are refreshed.
"""
import csv
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

from summarize_study import STUDY, TOPICS, assessment_key, csv_rows, summarize


def write_csv(path, rows, fields):
    with path.open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def rescore_study(root=STUDY):
    key = assessment_key()
    assessment = Path(__file__).resolve().parents[1] / 'Context/assessment.md'
    raw_key = assessment.read_bytes()
    source_blob = hashlib.sha1(b'blob ' + str(len(raw_key)).encode() + b'\0' + raw_key).hexdigest()
    with tempfile.TemporaryDirectory(prefix='clipcademy-rescore-') as temp:
        staged = Path(temp) / 'study'
        shutil.copytree(root, staged)
        responses = csv_rows(staged / 'test-responses.csv')
        participants = csv_rows(staged / 'participant-results.csv')
        events = csv_rows(staged / 'events.csv')
        attempts = json.loads((staged / 'attempts.json').read_text())
        old_records = json.loads((staged / 'records.json').read_text())
        metadata = {r['participant_id']: r for r in old_records.get('participants', [])}
        changes = []
        for row in responses:
            if row['type'] != 'mc':
                continue
            correct = key.get(row['item'])
            choice = row['response'].strip().upper()
            if correct is None or row['form'] != row['item'][0] or choice not in {'', 'A', 'B', 'C', 'D'}:
                raise ValueError(f"Invalid assessment item or choice: {row['participant_id']} {row['item']}")
            score = str(int(choice == correct))
            if row['correct_answer'] != correct or row['score'] != score:
                changes.append(dict(participant_id=row['participant_id'], test=row['test'], item=row['item'],
                                    response=row['response'], previous_correct_answer=row['correct_answer'],
                                    correct_answer=correct, previous_score=row['score'], score=score))
            row['correct_answer'], row['score'] = correct, score
        ids = {p['participant_id'] for p in participants}
        if any(row['participant_id'] not in ids for rows in (responses, events, attempts) for row in rows):
            raise ValueError('Input includes an unknown participant ID')
        for participant in participants:
            own = [r for r in responses if r['participant_id'] == participant['participant_id']]
            for topic, prefix in TOPICS.items():
                for period in ('pre', 'post'):
                    participant[f'{prefix}_{period}_mc'] = str(sum(int(r['score']) for r in own
                        if r['topic'] == topic and r['test'] == period and r['type'] == 'mc'))
        write_csv(staged / 'test-responses.csv', responses, list(responses[0]))
        write_csv(staged / 'participant-results.csv', participants, list(participants[0]))
        records = []
        allowed_metadata = ('participant_id', 'build_id', 'timezone', 'study_date', 'provenance')
        for participant in participants:
            pid = participant['participant_id']
            folder = staged / pid
            folder.mkdir(exist_ok=True)
            previous = metadata.get(pid, {})
            own_metadata = folder / 'records.json'
            if own_metadata.exists():
                previous = {**previous, **json.loads(own_metadata.read_text())}
            record = {k: previous[k] for k in allowed_metadata if k in previous}
            record['participant_id'] = pid
            record['study_date'] = participant['date']
            record['participant'] = {k: int(v) if k.endswith(('_mc', '_wr')) or k == 'reminders_sent' else v
                                     for k, v in participant.items()}
            own_responses = [r for r in responses if r['participant_id'] == pid]
            record['test_responses'] = [{k: int(v) if k in {'score', 'max'} else v for k, v in r.items()}
                                      for r in own_responses]
            record['headers'] = {'participant-results': list(participant), 'test-responses': list(responses[0])}
            records.append(record)
            write_json(folder / 'records.json', record)
            for filename, rows in [('participant-results.csv', [participant]), ('test-responses.csv', own_responses),
                                   ('events.csv', [e for e in events if e['participant_id'] == pid])]:
                fields = list(rows[0]) if rows else list(events[0])
                write_csv(folder / filename, rows, fields)
            write_json(folder / 'attempts.json', [a for a in attempts if a['participant_id'] == pid])
        write_json(staged / 'records.json', {'participants': records})
        write_json(staged / 'assessment-key.json', dict(repository='skarne21/Clipcademy',
            path='Context/assessment.md', source_blob_sha1=source_blob,
            url='https://github.com/skarne21/Clipcademy/blob/member1/Context/assessment.md', multiple_choice=key))
        audit = staged / 'rescoring-audit.csv'
        if changes or not audit.exists():
            fields = ['participant_id', 'test', 'item', 'response', 'previous_correct_answer',
                      'correct_answer', 'previous_score', 'score']
            write_csv(audit, changes, fields)
        audit_rows = csv_rows(audit)
        score_changes = sum(r['previous_score'] != r['score'] for r in audit_rows)
        key_changes = sum(r['previous_correct_answer'] != r['correct_answer'] for r in audit_rows)
        (staged / 'RESCORING.md').write_text(f'''# Assessment scoring review

Multiple-choice responses were rescored using the repository's [Form A/B assessment](../../Context/assessment.md). Source Git blob: `{source_blob}`. The [machine-readable key](assessment-key.json) records all 20 answers.

The [audit](rescoring-audit.csv) records {key_changes} corrected answer-key entries and {score_changes} changed multiple-choice scores. Recorded participant choices, written response text, written scores, event timestamps, interview text and attempt outcomes were preserved. No prior one-point analysis adjustment was carried into this dataset.

The combined CSVs are authoritative for this scoring correction. Per-user exports, embedded records, topic totals and statistical reports were refreshed from those combined inputs. Stale session-interval metadata was omitted because the combined source does not provide those interval endpoints.

All 48 supplied written responses contain placeholder text. Their scores have not been regraded; totals that include them remain provisional. The identical event timelines, session-time discrepancies and interview claims also require checking against the original records. Correcting the multiple-choice key does not verify the collection history or resolve those issues.

Reproduce the correction with `python3 validation/rescore_study.py`. Recalculate reports with `python3 validation/summarize_study.py`; it now rejects multiple-choice scores or answer keys that disagree with the repository assessment.
''', encoding='utf-8')
        summary = summarize(staged)
        for path in staged.rglob('*'):
            if path.is_file():
                target = root / path.relative_to(staged)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)
    return dict(key_changes=key_changes, score_changes=score_changes, **summary)


if __name__ == '__main__':
    result = rescore_study()
    print(f"Repository key applied: {result['key_changes']} key entries and {result['score_changes']} scores corrected; "
          f"mean comparison-adjusted gain {result['mean_app_effect_pp']:.2f} pp.")
