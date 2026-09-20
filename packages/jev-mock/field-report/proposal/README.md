# `sem_calibrate`: a proposal for duckdb-semantic-profile

A fourth SQL layer for the extension, in the same idiom as the other six. No
Rust, no new dependencies, no API calls. `70_calibration.sql` is 270 lines of
macros and `demo.py` runs them against the 580 real Jev judgments scored in the
report one directory up.

## What it is for

The extension turns values into probabilities. Nothing in it can yet answer the
question that immediately follows: **is a probability from this probe, on your
data, worth what it says?** Without an answer, `threshold := 0.7` is a number
somebody picked, and it is the same number for twenty probes whose measured
reliability spans a factor of 300.

## The four pieces

**`sem_costs()` / `sem_thresholds()` — no labels required.** One number per
probe: how many false flags you would accept to avoid one miss. Missing a
credential is not missing a mojibake. The cost-optimal cutoff is then
`1 / (1 + m)`, which is arithmetic rather than taste.

The catch, and it is why this is not simply "do it first": the formula assumes
the probability is honest. On the recorded corpus it lands 7x worse than the
best achievable cutoff, because Jev's mid-range is far less trustworthy than its
extremes. Declaring the costs is free. Using them requires the next piece.

**`sem_calibrate(labels)` — per-probe honesty.** Murphy's decomposition per
probe: reliability (is the number honest), resolution (is it informative), plus
the empirically cost-minimising cutoff and a shrunk version of it. `basis` says
which cutoff to actually use, and refuses to recommend one at all below ten
observed defects.

**`sem_probe_health(labels)` — the diagnostic.** A probe whose calibration sits
far off its peers is usually not a model failure; it is a question that was
worded badly. This is how you find out which.

**`sem_label_queue()` and `sem_drift()` — the loop.** The first decides what to
put in front of a person; the second decides when to bother.

## Shrinkage, because you will never have enough defects

With one or two labelled defects per probe you cannot fit twenty thresholds, and
one global threshold ignores a 300x spread. The middle is James-Stein: each
probe earns its own cutoff in proportion to how many **defects** it has seen —
the scarce resource — and gets the pooled one otherwise.

Run against the recorded corpus, this is exactly what it does:

```
probe_id                    defects   fitted_threshold   shrunk_threshold
unit_ambiguous                  4           0.38              0.747
row_is_test_data                4           0.95              0.937
operational_note_in_...         2           0.99              0.942
```

`unit_ambiguous` fits at 0.38 on four defects, which is noise; shrinkage drags
it back to the pool. And `basis` reads `too few defects to judge` for every row,
because on this corpus it is. That is the macro working: a hand-fitted threshold
on fourteen defects is overfitting, and the layer declines to do it.

## The part that is easy to get wrong

`sem_label_queue()` returns everything above the cutoff **plus a small random
sample from below it**, carrying `sampling_weight = 1/audit_rate`.

Review only what you flagged and you learn precision forever and recall never —
and the failure that actually costs you, a cutoff drifting up while defects slip
under it, is precisely the one you have made yourself blind to. Two or three
percent is enough to see it coming, and every aggregate in `sem_calibrate` is
weighted so the audit rows count for the population they stand for.

## One schema decision worth making early

```sql
CREATE TABLE sem_dispositions (
  profiled_table VARCHAR, row_id BIGINT, probe_id VARCHAR, column_name VARCHAR,
  probability DOUBLE, was_a_defect BOOLEAN, sampling_weight DOUBLE DEFAULT 1,
  reviewed_at TIMESTAMP DEFAULT now(), reviewer VARCHAR, model_version VARCHAR
);
```

The granularity is the whole point. A reviewer is not dismissing "row 47", they
are dismissing "row 47, flagged for `geo_inconsistent`". Logging the verdict per
row rather than per (row, probe) throws away the only thing that makes any of
this possible later, and it cannot be recovered afterwards. The extension only
reads this table; the user owns it.

## Running it

```sh
pip install duckdb && python3 demo.py
```

`demo-output.txt` is the recorded result.

## Status

`sem_costs`, `sem_thresholds`, `sem_calibrate`, `sem_reliability`,
`sem_probe_health` and `sem_drift` all execute and are exercised in `demo.py`
against real data.

**`sem_label_queue` is untested.** It calls `sem_values()`, so it only runs
inside the extension, and I have not run the extension. Treat it as a sketch of
the shape rather than working code.

The cost numbers in `sem_costs()` are invented. They are ratios worth arguing
about, not measurements, and the argument is the useful part.
