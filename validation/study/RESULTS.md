# Six-participant validation results

Calculated from the recorded exports using `python3 validation/summarize_study.py`. See the [dataset guide](README.md) for provenance. No participant responses or observations are changed by this calculation.

**Score-adjusted analysis.** The following statistics include the documented adjustments in [score-adjustments.csv](score-adjustments.csv). These adjustments are analysis inputs, not new participant observations. Original recorded totals are preserved.

| User | Recorded taught post /10 | Adjustment | Analysis taught post /10 |
| --- | --- | --- | --- |
| user_P01 | 8 | -1 | 7 |
| user_P02 | 8 | -1 | 7 |
| user_P03 | 5 | -1 | 4 |
| user_P04 | 7 | -1 | 6 |
| user_P05 | 7 | -1 | 6 |
| user_P06 | 4 | -1 | 3 |

Mean comparison-adjusted gain using the original recorded totals: 12.08 pp. The remaining learning statistics use the score-adjusted totals.

| User | Taught pre → analysis post | Taught gain (pp) | Comparison pre → post | Comparison gain (pp) | Adjusted gain (pp) |
| --- | --- | --- | --- | --- | --- |
| [user_P01](user_P01/RESULTS.md) | 3 → 7 /10 | +40.0 | 3 → 4 /8 | +12.5 | +27.5 |
| [user_P02](user_P02/RESULTS.md) | 5 → 7 /10 | +20.0 | 4 → 5 /8 | +12.5 | +7.5 |
| [user_P03](user_P03/RESULTS.md) | 4 → 4 /10 | +0.0 | 3 → 5 /8 | +25.0 | -25.0 |
| [user_P04](user_P04/RESULTS.md) | 2 → 6 /10 | +40.0 | 2 → 3 /8 | +12.5 | +27.5 |
| [user_P05](user_P05/RESULTS.md) | 6 → 6 /10 | +0.0 | 4 → 4 /8 | +0.0 | +0.0 |
| [user_P06](user_P06/RESULTS.md) | 3 → 3 /10 | +0.0 | 3 → 5 /8 | +25.0 | -25.0 |

| User | App answers correct | Follow-ups | Visible heartbeat minutes | Qualifying return | Demand |
| --- | --- | --- | --- | --- | --- |
| user_P01 | 6/7 (85.7%) | 1 | 5.0 | yes | somewhat |
| user_P02 | 6/7 (85.7%) | 1 | 5.0 | yes | very |
| user_P03 | 6/8 (75.0%) | 2 | 5.5 | no | not |
| user_P04 | 6/7 (85.7%) | 1 | 5.0 | yes | very |
| user_P05 | 4/4 (100.0%) | 0 | 4.5 | no | somewhat |
| user_P06 | 3/6 (50.0%) | 2 | 5.5 | no | not |

Mean adjusted gain: **2.08 pp**; median: **3.75 pp**; sample standard deviation: **23.63 pp**; range: **-25.0 to 27.5 pp**. Positive adjusted gains: 3/6.

Mean adjusted gain excluding recorded outside study of taught topics: -3.00 pp (n=5).

| Study check | Analysis statistic | Protocol threshold | Met |
| --- | --- | --- | --- |
| Usability gate | Unaided: open_lesson 6/6, clips 5/6, answer 5/6, return_home 6/6 | Each step ≥5/6 | yes |
| H1 learning | Mean 2.08 pp; 3/6 positive | Mean ≥15 pp and ≥4 positive | no |
| H2 return | 3/6 | ≥3 qualifying returns | yes |
| H3 demand | 2/6 very disappointed | ≥3 very disappointed | no |

Adjusted gain = (taught post − taught pre) / 10 × 100 − (comparison post − comparison pre) / 8 × 100. A qualifying return requires an answer from one hour after the morning session ends through one hour before the evening session starts. Last-hour practice and opening without answering do not qualify.

App accuracy uses all recorded app attempts. Heartbeat minutes count visible-time heartbeat events at 30 seconds each. Equal adjusted gains can arise from different starting scores and usage patterns; individual reports retain those differences.

Thresholds follow [hypothesis-tests.md](../../Context/hypothesis-tests.md). This is a descriptive, six-person, same-day comparison; these statistics do not establish lasting recall or a causal effect.
