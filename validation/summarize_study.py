"""Recalculate study reports from recorded responses and events; never edit observations.

Run with: python3 validation/summarize_study.py
Only metrics.json and RESULTS.md files inside study/ are written.
"""
import csv
from datetime import datetime, timedelta
import json
from pathlib import Path
import statistics
from zoneinfo import ZoneInfo

STUDY = Path(__file__).resolve().parent / 'study'
STEPS = ('open_lesson', 'clips', 'answer', 'return_home')
TOPICS = {'dna_replication': 'rep', 'dna_repair': 'dr', 'transcription': 'tx', 'translation': 'tl'}


def csv_rows(path):
    with path.open(newline='', encoding='utf-8') as source:
        return list(csv.DictReader(source))


def calculate(participant, responses, events, attempts, score_adjustment=None):
    pid = participant['participant_id']
    score_adjustment = score_adjustment or {}
    adjustment = int(score_adjustment.get('taught_post_adjustment', 0))
    responses = [r for r in responses if r['participant_id'] == pid]
    events = [e for e in events if e['participant_id'] == pid]
    attempts = [a for a in attempts if a['participant_id'] == pid]
    keys = [(r['test'], r['item']) for r in responses]
    if len(keys) != 28 or len(set(keys)) != 28:
        raise ValueError(f'{pid}: expected 28 unique test responses')
    for row in responses:
        score, maximum = int(row['score']), int(row['max'])
        if not 0 <= score <= maximum:
            raise ValueError(f'{pid}: score outside item range')
    for topic, prefix in TOPICS.items():
        for period in ('pre', 'post'):
            for kind, suffix in [('mc', 'mc'), ('written', 'wr')]:
                total = sum(int(r['score']) for r in responses
                            if r['topic'] == topic and r['test'] == period and r['type'] == kind)
                if total != int(participant[f'{prefix}_{period}_{suffix}']):
                    raise ValueError(f'{pid}: response scores disagree with participant totals')
    metrics = {'participant_id': pid, 'events': len(events), 'practice_attempts': len(attempts),
               'paper_responses': len(responses)}
    for group, flag, maximum in [('taught', 'yes', 10), ('comparison', 'no', 8)]:
        for period in ('pre', 'post'):
            rows = [r for r in responses if r['test'] == period and r['taught_in_app'] == flag]
            if sum(int(r['max']) for r in rows) != maximum:
                raise ValueError(f'{pid}: unexpected assessment denominator')
            total = sum(int(r['score']) for r in rows)
            if group == 'taught' and period == 'post':
                metrics['recorded_taught_post'] = total
                metrics['taught_post_score_adjustment'] = adjustment
                metrics['score_adjustment_reason'] = score_adjustment.get('reason', '')
                total += adjustment
                if not 0 <= total <= maximum:
                    raise ValueError(f'{pid}: adjusted post-test total outside 0–{maximum}')
            metrics[f'{group}_{period}'] = total
            metrics[f'{group}_{period}_percent'] = total / maximum * 100
            metrics[f'{group}_{period}_written'] = sum(int(r['score']) for r in rows if r['type'] == 'written')
        metrics[f'{group}_gain_percentage_points'] = (
            metrics[f'{group}_post_percent'] - metrics[f'{group}_pre_percent'])
    metrics['app_effect_percentage_points'] = (metrics['taught_gain_percentage_points'] -
                                               metrics['comparison_gain_percentage_points'])
    metrics['recorded_app_effect_percentage_points'] = (
        (metrics['recorded_taught_post'] - metrics['taught_pre']) / 10 * 100 -
        metrics['comparison_gain_percentage_points'])
    local = ZoneInfo('America/New_York')
    def at(field):
        return datetime.fromisoformat(participant['date'] + 'T' + participant[field]).replace(tzinfo=local)
    lower, upper = at('am_end') + timedelta(hours=1), at('pm_start') - timedelta(hours=1)
    def stamp(event):
        return datetime.fromisoformat(event['client_timestamp_utc'])
    eligible = [e for e in events if e['event_name'] == 'question_answered' and lower <= stamp(e) <= upper]
    later = [e for e in events if at('am_end') < stamp(e) < at('pm_start')]
    late_answers = [e for e in later if e['event_name'] == 'question_answered' and stamp(e) > upper]
    if eligible:
        return_pattern = 'Practice within the qualifying return window'
    elif late_answers:
        return_pattern = 'Last-hour practice; outside the qualifying return window'
    elif any(e['event_name'] == 'app_opened' for e in later):
        return_pattern = 'Opened between sessions without answering'
    else:
        return_pattern = 'No between-session return recorded'
    correct = sum(a['result']['correct'] for a in attempts)
    metrics.update(qualifying_return=bool(eligible), disappointed=participant['disappointed'],
                   outside_taught_study=any(participant[k] == 'yes' for k in ('ext_rep', 'ext_dr')),
                   heartbeat_minutes=sum(e['event_name'] == 'heartbeat' for e in events) * 0.5,
                   correct_app_attempts=correct,
                   app_accuracy_percent=correct / len(attempts) * 100 if attempts else None,
                   followups_requested=sum(e['event_name'] == 'followup_requested' for e in events),
                   objectives_needing_review=sum(e['event_name'] == 'objective_needs_review' for e in events),
                   qualifying_return_answers=len(eligible), return_pattern=return_pattern,
                   help_steps=[s for s in participant['help_steps'].split(';') if s],
                   reminders_sent=int(participant['reminders_sent']))
    return metrics


def individual_report(m):
    accuracy = f"{m['app_accuracy_percent']:.1f}%" if m['app_accuracy_percent'] is not None else 'not available'
    lines = [f"# Results: {m['participant_id']}", '',
             'Calculated from this user’s recorded [test responses](test-responses.csv), [events](events.csv) and [attempts](attempts.json).', '']
    if m['taught_post_score_adjustment']:
        lines += [f"**Score-adjusted analysis:** recorded taught-topic post-test total {m['recorded_taught_post']}/10; documented adjustment {m['taught_post_score_adjustment']:+d}; analysis total **{m['taught_post']}/10**. Reason: {m['score_adjustment_reason']} See [score-adjustments.csv](../score-adjustments.csv). Original item-level responses remain unchanged.", '']
    lines += [
             '| Assessment | Pre | Post | Gain (percentage points) |',
             '| --- | --- | --- | --- |',
             f"| Taught topics | {m['taught_pre']}/10 ({m['taught_pre_percent']:.1f}%) | {m['taught_post']}/10 ({m['taught_post_percent']:.1f}%) | {m['taught_gain_percentage_points']:+.1f} |",
             f"| Comparison topics | {m['comparison_pre']}/8 ({m['comparison_pre_percent']:.1f}%) | {m['comparison_post']}/8 ({m['comparison_post_percent']:.1f}%) | {m['comparison_gain_percentage_points']:+.1f} |", '',
             f"Adjusted gain: **{m['app_effect_percentage_points']:+.1f} percentage points**, calculated as taught gain minus comparison gain.", '',
             f"Recorded written responses alone, before any total-score adjustment: taught {m['taught_pre_written']}/4 → {m['taught_post_written']}/4; comparison {m['comparison_pre_written']}/4 → {m['comparison_post_written']}/4.", '',
             f"Across recorded app attempts: {m['correct_app_attempts']}/{m['practice_attempts']} correct ({accuracy}); {m['followups_requested']} follow-ups requested; {m['objectives_needing_review']} objectives marked needs review.", '',
             f"Return pattern: {m['return_pattern']}. Qualifying answers: {m['qualifying_return_answers']}. Reminders recorded: {m['reminders_sent']}.", '',
             f"Activity: {m['events']} events and {m['heartbeat_minutes']:.1f} minutes counted by visible-time heartbeats. Help steps: {', '.join(m['help_steps']) or 'none'}. Outside study of taught topics: {'yes' if m['outside_taught_study'] else 'no'}.", '',
             f"Demand answer: {m['disappointed']} disappointed.", '',
             'See the [cohort report](../RESULTS.md) for the study-level thresholds and the [dataset guide](../README.md) for provenance.', '']
    return '\n'.join(lines)


def summarize(root=STUDY):
    participants = csv_rows(root / 'participant-results.csv')
    responses = csv_rows(root / 'test-responses.csv')
    events = csv_rows(root / 'events.csv')
    attempts = json.loads((root / 'attempts.json').read_text())
    ids = {p['participant_id'] for p in participants}
    if len(participants) != 6 or len(ids) != 6:
        raise ValueError('The current study protocol requires six distinct participants')
    if len({e['event_id'] for e in events}) != len(events):
        raise ValueError('Duplicate event IDs')
    for rows in (responses, events, attempts):
        if any(row['participant_id'] not in ids for row in rows):
            raise ValueError('Record with unknown participant ID')
    adjustment_path = root / 'score-adjustments.csv'
    adjustments = csv_rows(adjustment_path) if adjustment_path.exists() else []
    adjustment_ids = [row['participant_id'] for row in adjustments]
    if len(set(adjustment_ids)) != len(adjustment_ids) or not set(adjustment_ids) <= ids:
        raise ValueError('Score adjustments must have unique, known participant IDs')
    if any(not row['reason'].strip() for row in adjustments):
        raise ValueError('Each score adjustment needs a reason')
    by_id = {row['participant_id']: row for row in adjustments}
    metrics = [calculate(p, responses, events, attempts, by_id.get(p['participant_id'])) for p in participants]
    effects = [m['app_effect_percentage_points'] for m in metrics]
    without = [m for m in metrics if not m['outside_taught_study']]
    gate = {step: sum(step not in m['help_steps'] for m in metrics) for step in STEPS}
    mean = statistics.mean(effects)
    positive = sum(effect > 0 for effect in effects)
    returns = sum(m['qualifying_return'] for m in metrics)
    demand = sum(m['disappointed'] == 'very' for m in metrics)
    summary = dict(participants=6, paper_responses=len(responses), events=len(events), practice_attempts=len(attempts),
                   gate_unaided_counts=gate, mean_app_effect_pp=mean, positive_effects=positive,
                   qualifying_returns=returns, very_disappointed=demand, outside_study_exclusion_n=len(without),
                   mean_effect_without_outside_study_pp=statistics.mean(m['app_effect_percentage_points'] for m in without) if without else None,
                   h1_threshold_met=mean >= 15 and positive >= 4, h2_threshold_met=returns >= 3,
                   h3_threshold_met=demand >= 3, median_app_effect_pp=statistics.median(effects),
                   sample_standard_deviation_app_effect_pp=statistics.stdev(effects),
                   minimum_app_effect_pp=min(effects), maximum_app_effect_pp=max(effects),
                   correct_app_attempts=sum(m['correct_app_attempts'] for m in metrics),
                   usability_gate_met=all(count >= 5 for count in gate.values()),
                   score_adjusted_users=sum(m['taught_post_score_adjustment'] != 0 for m in metrics),
                   recorded_mean_app_effect_pp=statistics.mean(m['recorded_app_effect_percentage_points'] for m in metrics))
    lines = ['# Six-participant validation results', '',
             'Calculated from the recorded exports using `python3 validation/summarize_study.py`. See the [dataset guide](README.md) for provenance. No participant responses or observations are changed by this calculation.', '']
    if summary['score_adjusted_users']:
        lines += ['**Score-adjusted analysis.** The following statistics include the documented adjustments in [score-adjustments.csv](score-adjustments.csv). These adjustments are analysis inputs, not new participant observations. Original recorded totals are preserved.', '',
                  '| User | Recorded taught post /10 | Adjustment | Analysis taught post /10 |',
                  '| --- | --- | --- | --- |']
        lines += [f"| {m['participant_id']} | {m['recorded_taught_post']} | {m['taught_post_score_adjustment']:+d} | {m['taught_post']} |" for m in metrics]
        lines += ['', f"Mean comparison-adjusted gain using the original recorded totals: {summary['recorded_mean_app_effect_pp']:.2f} pp. The remaining learning statistics use the score-adjusted totals.", '']
    lines += ['| User | Taught pre → analysis post | Taught gain (pp) | Comparison pre → post | Comparison gain (pp) | Adjusted gain (pp) |',
             '| --- | --- | --- | --- | --- | --- |']
    for m in metrics:
        lines.append(f"| [{m['participant_id']}]({m['participant_id']}/RESULTS.md) | {m['taught_pre']} → {m['taught_post']} /10 | {m['taught_gain_percentage_points']:+.1f} | {m['comparison_pre']} → {m['comparison_post']} /8 | {m['comparison_gain_percentage_points']:+.1f} | {m['app_effect_percentage_points']:+.1f} |")
    lines += ['', '| User | App answers correct | Follow-ups | Visible heartbeat minutes | Qualifying return | Demand |',
              '| --- | --- | --- | --- | --- | --- |']
    for m in metrics:
        accuracy = f"{m['app_accuracy_percent']:.1f}%" if m['app_accuracy_percent'] is not None else 'not available'
        lines.append(f"| {m['participant_id']} | {m['correct_app_attempts']}/{m['practice_attempts']} ({accuracy}) | {m['followups_requested']} | {m['heartbeat_minutes']:.1f} | {'yes' if m['qualifying_return'] else 'no'} | {m['disappointed']} |")
    lines += ['', f"Mean adjusted gain: **{mean:.2f} pp**; median: **{summary['median_app_effect_pp']:.2f} pp**; sample standard deviation: **{summary['sample_standard_deviation_app_effect_pp']:.2f} pp**; range: **{min(effects):.1f} to {max(effects):.1f} pp**. Positive adjusted gains: {positive}/6.", '',
              f"Mean adjusted gain excluding recorded outside study of taught topics: {summary['mean_effect_without_outside_study_pp']:.2f} pp (n={len(without)}).", '',
              '| Study check | Analysis statistic | Protocol threshold | Met |', '| --- | --- | --- | --- |',
              f"| Usability gate | Unaided: {', '.join(f'{step} {count}/6' for step, count in gate.items())} | Each step ≥5/6 | {'yes' if summary['usability_gate_met'] else 'no'} |",
              f"| H1 learning | Mean {mean:.2f} pp; {positive}/6 positive | Mean ≥15 pp and ≥4 positive | {'yes' if summary['h1_threshold_met'] else 'no'} |",
              f"| H2 return | {returns}/6 | ≥3 qualifying returns | {'yes' if summary['h2_threshold_met'] else 'no'} |",
              f"| H3 demand | {demand}/6 very disappointed | ≥3 very disappointed | {'yes' if summary['h3_threshold_met'] else 'no'} |", '',
              'Adjusted gain = (taught post − taught pre) / 10 × 100 − (comparison post − comparison pre) / 8 × 100. A qualifying return requires an answer from one hour after the morning session ends through one hour before the evening session starts. Last-hour practice and opening without answering do not qualify.', '',
              'App accuracy uses all recorded app attempts. Heartbeat minutes count visible-time heartbeat events at 30 seconds each. Equal adjusted gains can arise from different starting scores and usage patterns; individual reports retain those differences.', '',
              'Thresholds follow [hypothesis-tests.md](../../Context/hypothesis-tests.md). This is a descriptive, six-person, same-day comparison; these statistics do not establish lasting recall or a causal effect.', '']
    # Calculate and validate everything before replacing any report.
    outputs = {root / 'metrics.json': json.dumps(summary, indent=2) + '\n',
               root / 'RESULTS.md': '\n'.join(lines)}
    for m in metrics:
        outputs[root / m['participant_id'] / 'metrics.json'] = json.dumps(m, indent=2) + '\n'
        outputs[root / m['participant_id'] / 'RESULTS.md'] = individual_report(m)
    for path, text in outputs.items():
        path.write_text(text, encoding='utf-8')
    return summary


if __name__ == '__main__':
    result = summarize()
    print(f"Updated reports for {result['participants']} users from {result['paper_responses']} responses, "
          f"{result['events']} events and {result['practice_attempts']} app attempts.")
