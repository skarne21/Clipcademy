"""Create six varied, labeled fixtures; never use a live study database."""
import csv
from datetime import datetime, timedelta
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'validation/synthetic'
PROFILES = [
 dict(pre_mc=[1,4,7,9], post_mc=[1,2,3,4,5,7,9], pre_wr=[1,0,1,0], post_wr=[2,1,1,1],
      return_kind='qualifying', disappointed='somewhat', wrong_app_questions=['rep-q2']),
 dict(pre_mc=[1,2,4,5,7,9], post_mc=[1,2,3,4,5,7,8,9], pre_wr=[1,0,1,1], post_wr=[2,1,1,1],
      return_kind='qualifying', disappointed='very', wrong_app_questions=['dr-q1']),
 dict(pre_mc=[1,4,7,9], post_mc=[1,2,4,7,8,9], pre_wr=[1,1,1,0], post_wr=[1,1,1,1],
      return_kind='last_minute', disappointed='not', help_steps='clips', wrong_app_questions=['rep-q1','rep-r1']),
 dict(pre_mc=[1,4,7,9], post_mc=[1,2,3,4,5,7,9], pre_wr=[0,0,0,0], post_wr=[1,1,1,0],
      return_kind='qualifying', disappointed='very', ext_rep='yes', wrong_app_questions=['dr-q2']),
 dict(pre_mc=[1,2,4,5,7,9], post_mc=[1,2,3,4,5,7,9], pre_wr=[1,1,1,1], post_wr=[1,1,1,1],
      return_kind='open_only', disappointed='somewhat', wrong_app_questions=[]),
 dict(pre_mc=[1,4,7,9], post_mc=[1,2,4,7,8,9], pre_wr=[1,0,1,0], post_wr=[1,0,1,1],
      return_kind='none', disappointed='not', help_steps='answer', wrong_app_questions=['rep-q2','rep-r2','rep-r4']),
]
records, metrics, all_events, all_attempts = [], [], [], []
for i, profile in enumerate(PROFILES, 1):
    profile.update(participant_id=f'SIM_P{i:02}', offset_minutes=(i-1)*40, pre_form='A' if i%2 else 'B')
    env = dict(os.environ, CLIPCADEMY_SYNTHETIC_PROFILE=json.dumps(profile))
    subprocess.run([sys.executable, str(ROOT/'validation/generate_synthetic_participant.py')], env=env, check=True)
    folder = OUT / profile['participant_id']
    records.append(json.loads((folder/'records.json').read_text()))
    metrics.append(json.loads((folder/'metrics.json').read_text()))
    all_attempts.extend(json.loads((folder/'attempts.json').read_text()))
    with (folder/'events.csv').open() as f:
        all_events.extend(csv.DictReader(f))

def local_time(p, field):
    return datetime.fromisoformat(p['date']+'T'+p[field]).replace(tzinfo=ZoneInfo('America/New_York'))
for record, metric in zip(records, metrics):
    p = record['participant']
    lower, upper = local_time(p,'am_end')+timedelta(hours=1), local_time(p,'pm_start')-timedelta(hours=1)
    returned = any(e['event_name']=='question_answered' and e['participant_id']==p['participant_id'] and
        lower <= datetime.fromisoformat(e['client_timestamp_utc']) <= upper for e in all_events)
    assert returned == metric['qualifying_return']
    folder=OUT/p['participant_id']
    forms=f"{p['pre_form']} then {'B' if p['pre_form']=='A' else 'A'}"
    (folder/'README.md').write_text(f"# Synthetic participant {p['participant_id']}\n\nInvented practice data only. No real participant was observed or interviewed.\n\nForms: {forms}. {metric['paper_responses']} paper answers, {metric['practice_attempts']} app attempts and {metric['events']} events.\n\nFiles: [participant-results.csv](participant-results.csv), [test-responses.csv](test-responses.csv), [events.csv](events.csv), [clipcademy.db](clipcademy.db), [attempts.json](attempts.json), [records.json](records.json), [metrics.json](metrics.json), [interview.md](interview.md), [RESULTS.md](RESULTS.md).\n\nSee the [cohort guide](../README.md) for provenance and limitations.\n")
    (folder/'RESULTS.md').write_text(f"# Synthetic results: {p['participant_id']}\n\nInvented example, not actual user results.\n\nTaught score: {metric['taught_pre']}/10 to {metric['taught_post']}/10. Comparison score: {metric['comparison_pre']}/8 to {metric['comparison_post']}/8.\n\nIndividual app effect: {metric['app_effect_percentage_points']:.1f} percentage points. Eligible return: {'yes' if returned else 'no'}. Demand: {p['disappointed']}. Outside taught-topic study: {p['ext_rep']}. Assigned help: {p['help_steps'] or 'none'}.\n\nThis individual does not establish any real study hypothesis.\n")
    reason={'qualifying':'Returns between sessions to check recall.', 'last_minute':'Reviews only in the last hour before the evening test.',
            'open_only':'Opens the app but does not answer a question.', 'none':'Does not reopen the app between sessions.'}[record['profile']['return_kind']]
    (folder/'interview.md').write_text(f"# Synthetic interview: {p['participant_id']}\n\nAll responses and moderator observations are invented, not participant quotations.\n\n1. Last use: {reason}\n2. Recall versus recognition: the scenario does not measure an actual cognitive process.\n3. Follow-up: {('The scenario assigns at least one wrong answer and targeted explanation.' if record['profile']['wrong_app_questions'] else 'The scenario assigns no wrong answers, so no follow-up is seen.')}\n4. Study comparison: invented preference for short checks alongside lecture notes.\n5. Friction: invented concern about replaying familiar clips.\n6. Future use: invented interest in short checks before revision.\n\nDemand answer: {p['disappointed']}. Assigned help: {p['help_steps'] or 'none'}. Outside replication study: {p['ext_rep']}. No reminders, signup names or real personal data were generated.\n")

# The combined database preserves the app's actual schema and every graded attempt.
combined=OUT/'clipcademy.db'
if combined.exists(): combined.unlink()
with sqlite3.connect(combined) as target:
    with sqlite3.connect(OUT/'SIM_P01/clipcademy.db') as first:
        first.backup(target)
    for pid in [r['participant_id'] for r in records[1:]]:
        with sqlite3.connect(OUT/pid/'clipcademy.db') as source:
            for table in ['attempts','events']:
                rows=source.execute('select * from '+table).fetchall()
                target.executemany('insert into '+table+' values ('+','.join('?' for _ in rows[0])+')',rows)
    target.execute("update synthetic_metadata set value='SIM_P01-SIM_P06' where key='participant_id'")
    assert target.execute('select count(*) from attempts').fetchone()[0]==len(all_attempts)
    assert target.execute('select count(*) from events').fetchone()[0]==len(all_events)

event_headers=next(csv.reader((ROOT/'Context/events.csv').open()))
all_events.sort(key=lambda e:e['client_timestamp_utc'])
with (OUT/'events.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=event_headers,lineterminator='\n');writer.writeheader();writer.writerows(all_events)
(OUT/'attempts.json').write_text(json.dumps(all_attempts,indent=2)+'\n')
(OUT/'records.json').write_text(json.dumps({'synthetic':True,'participants':records},indent=2)+'\n')
mean=sum(m['app_effect_percentage_points'] for m in metrics)/6
positive=sum(m['app_effect_percentage_points']>0 for m in metrics)
returns=sum(m['qualifying_return'] for m in metrics)
very=sum(m['disappointed']=='very' for m in metrics)
without=[m for m in metrics if not m['outside_taught_study']]
gate={step:sum(step not in r['participant']['help_steps'].split(';') for r in records)
      for step in ['open_lesson','clips','answer','return_home']}
summary={'synthetic':True,'participants':6,'paper_responses':sum(m['paper_responses'] for m in metrics),
    'events':len(all_events),'practice_attempts':len(all_attempts),'gate_unaided_counts':gate,
    'mean_app_effect_pp':mean,'positive_effects':positive,'qualifying_returns':returns,'very_disappointed':very,
    'outside_study_exclusion_n':len(without),'mean_effect_without_outside_study_pp':sum(m['app_effect_percentage_points'] for m in without)/len(without),
    'fixture_h1':mean>=15 and positive>=4,'fixture_h2':returns>=3,'fixture_h3':very>=3,
    'real_study_conclusion':'No inference: all six records are synthetic.'}
(OUT/'metrics.json').write_text(json.dumps(summary,indent=2)+'\n')
rows=['| Participant | Forms | Taught pre/post | Comparison pre/post | Effect (pp) | Eligible return | Demand |',
      '| --- | --- | --- | --- | --- | --- | --- |']
for r,m in zip(records,metrics):
    p=r['participant']; rows.append(f"| {p['participant_id']} | {p['pre_form']}→{'B' if p['pre_form']=='A' else 'A'} | {m['taught_pre']}→{m['taught_post']} /10 | {m['comparison_pre']}→{m['comparison_post']} /8 | {m['app_effect_percentage_points']:.1f} | {m['qualifying_return']} | {m['disappointed']} |")
(OUT/'RESULTS.md').write_text('# Six-participant synthetic example\n\nInvented practice data only. None of these are real user observations.\n\n'+'\n'.join(rows)+f"\n\nMean effect: {mean:.2f} pp; positive effects: {positive}/6. Eligible returns: {returns}/6. Very disappointed: {very}/6.\n\nExcluding the assigned outside-study participant: n={len(without)}, mean effect {summary['mean_effect_without_outside_study_pp']:.2f} pp.\n\nIn this fixture only: usability gate passes (unaided counts {gate}); H1 {'passes' if summary['fixture_h1'] else 'fails'}, H2 {'passes' if summary['fixture_h2'] else 'fails'}, H3 {'passes' if summary['fixture_h3'] else 'fails'}. The fixture's decision-table path is to fix the teaching. These are demonstrations of calculations, not evidence for a product decision.\n\nSIM_P03's last-minute answers and SIM_P05's open-only session do not count as returns. SIM_P06 has no return session. All six have post-tests; no missing value was converted to zero.\n\nApp effect = (taught post − taught pre)/10 ×100 − (comparison post − comparison pre)/8 ×100. Usability help and all interview answers are assigned, not observed.\n")
(OUT/'README.md').write_text(f"# Six synthetic validation participants\n\nAll records are deterministic invented fixtures for practice, not data from real users. Study date 2026-11-04 and every response, timestamp, help observation, survey answer and behavior are simulated.\n\nCombined exports use the exact Context CSV headers: [participant-results.csv](participant-results.csv), [test-responses.csv](test-responses.csv), [events.csv](events.csv). There are 6 participant rows, {summary['paper_responses']} paper answers, {len(all_events)} events and {len(all_attempts)} graded app attempts.\n\n[Results](RESULTS.md), [metrics](metrics.json), [combined isolated database](clipcademy.db), [records](records.json) and [attempts](attempts.json).\n\nIndividual folders: "+', '.join(f'[{r["participant_id"]}]({r["participant_id"]}/README.md)' for r in records)+". Each contains the same export types, a separate database and assigned interview notes.\n\nOdd-numbered participants take A then B; even-numbered take B then A. Morning appointments are 40 minutes apart; evening appointments start 8 hours later. Scoring follows the current assessment key/rubric. Synthetic choices are deterministic, not sampled from observed student behavior or tuned to make all hypotheses pass.\n\nActual local grading/event handlers generate the attempts and events. No browser watched clips and no server was contacted. Video durations come from current media manifests. The synthetic build is valid only in the isolated fixture configuration, not a released study build. Each database has a synthetic_metadata table, and every exported record has a SIM_ participant ID. Databases are locally present but ignored by Git's existing *.db rule.\n\nKeep these files separate from actual study data. The Context templates, production database, real participant codes and source application code were not modified. Nothing was pushed.\n\nReproduce JSON, database and event outputs with `python3 validation/generate_synthetic_cohort.py`; moderator CSVs are materialized from records.json using the matching headers.\n")
print(json.dumps(summary,indent=2))
