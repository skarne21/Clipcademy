# Six-participant validation results

Calculated from the recorded exports using `python3 validation/summarize_study.py`. See the [dataset guide](README.md) for provenance. No participant responses or observations are changed by this calculation.

**Score-adjusted analysis.** The following statistics include the documented adjustments in [score-adjustments.csv](score-adjustments.csv). These adjustments are analysis inputs, not new participant observations. Original recorded totals are preserved.

| User | Recorded taught post /10 | Adjustment | Analysis taught post /10 |
| --- | --- | --- | --- |
| user_P01 | 6 | -1 | 5 |
| user_P02 | 7 | -1 | 6 |
| user_P03 | 5 | -1 | 4 |
| user_P04 | 6 | -1 | 5 |
| user_P05 | 4 | -1 | 3 |
| user_P06 | 7 | -1 | 6 |

Mean comparison-adjusted gain using the original recorded totals: 8.33 pp. The remaining learning statistics use the score-adjusted totals.

| User | Taught pre → analysis post | Taught gain (pp) | Comparison pre → post | Comparison gain (pp) | Adjusted gain (pp) |
| --- | --- | --- | --- | --- | --- |
| [user_P01](user_P01/RESULTS.md) | 3 → 5 /10 | +20.0 | 3 → 4 /8 | +12.5 | +7.5 |
| [user_P02](user_P02/RESULTS.md) | 4 → 6 /10 | +20.0 | 4 → 5 /8 | +12.5 | +7.5 |
| [user_P03](user_P03/RESULTS.md) | 2 → 4 /10 | +20.0 | 3 → 5 /8 | +25.0 | -5.0 |
| [user_P04](user_P04/RESULTS.md) | 5 → 5 /10 | +0.0 | 4 → 5 /8 | +12.5 | -12.5 |
| [user_P05](user_P05/RESULTS.md) | 2 → 3 /10 | +10.0 | 2 → 3 /8 | +12.5 | -2.5 |
| [user_P06](user_P06/RESULTS.md) | 4 → 6 /10 | +20.0 | 3 → 5 /8 | +25.0 | -5.0 |

| User | App answers correct | Follow-ups | Visible heartbeat minutes | Qualifying return | Demand |
| --- | --- | --- | --- | --- | --- |
| user_P01 | 4/5 (80.0%) | 1 | 3.0 | no | somewhat |
| user_P02 | 4/6 (66.7%) | 2 | 3.0 | no | not |
| user_P03 | 4/5 (80.0%) | 1 | 3.0 | no | very |
| user_P04 | 4/6 (66.7%) | 2 | 3.0 | no | somewhat |
| user_P05 | 4/6 (66.7%) | 2 | 3.0 | no | not |
| user_P06 | 4/4 (100.0%) | 0 | 3.0 | no | very |

Mean adjusted gain: **-1.67 pp**; median: **-3.75 pp**; sample standard deviation: **7.85 pp**; range: **-12.5 to 7.5 pp**. Positive adjusted gains: 2/6.

Mean adjusted gain excluding recorded outside study of taught topics: 0.50 pp (n=5).

| Study check | Analysis statistic | Protocol threshold | Met |
| --- | --- | --- | --- |
| Usability gate | Unaided: open_lesson 6/6, clips 5/6, answer 5/6, return_home 6/6 | Each step ≥5/6 | yes |
| H1 learning | Mean -1.67 pp; 2/6 positive | Mean ≥15 pp and ≥4 positive | no |
| H2 return | 0/6 | ≥3 qualifying returns | no |
| H3 demand | 2/6 very disappointed | ≥3 very disappointed | no |

Adjusted gain = (taught post − taught pre) / 10 × 100 − (comparison post − comparison pre) / 8 × 100. A qualifying return requires an answer from one hour after the morning session ends through one hour before the evening session starts. Last-hour practice and opening without answering do not qualify.

App accuracy uses all recorded app attempts. Heartbeat minutes count visible-time heartbeat events at 30 seconds each. Equal adjusted gains can arise from different starting scores and usage patterns; individual reports retain those differences.

Thresholds follow [hypothesis-tests.md](../../Context/hypothesis-tests.md). This is a descriptive, six-person, same-day comparison; these statistics do not establish lasting recall or a causal effect.
