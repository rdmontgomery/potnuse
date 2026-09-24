---
name: calibration-loop
description: Set up a calibrated decision layer around any model that returns probabilities (TypeSafe's Jev, an LLM's log-probs, a classifier's scores) so that thresholds come from costs instead of guesswork and stay honest in production. Covers a per-question calibration table, cost-derived thresholds, a decision log, an annotation queue with a weighted random audit, refitting against held-back labels, a label-free drift alarm, and a fake calibrated model for testing the whole thing before real labels exist. Use this whenever someone is thresholding a model's probability or confidence to automate a decision (routing, approvals, triage, moderation, fraud, data-quality flags), asks what threshold to use, wants to know whether a model's confidence can be trusted, is wiring Jev or structured LLM outputs into production code, or mentions calibration, reliability diagrams, Platt scaling, or recalibration, even if they don't use the word calibration.
---

# Calibration loop

A model's probability is only worth thresholding if it is honest: among the
items it calls 0.8, about 80% should turn out true. Most models' numbers aren't
honest out of the box (preference tuning makes LLMs overconfident; a model
trained at one base rate is wrong at another), but honesty is cheap to repair
on your own data, and once it's repaired the threshold stops being a guess and
becomes arithmetic. This skill sets up the repair and keeps it current.

Background, with the simulations behind every claim here:
https://rdmontgomery.com/experiments/probability-you-can-count-on (the practical post; the two before it are linked from there)

`reference/loop.ts` and `reference/schema.sql` are working reference
implementations of every piece. They are self-contained; adapt them to the
repo's language, storage and conventions rather than vendoring them blindly.

## Before writing code: find the decisions

Read the codebase for places where a model's probability or confidence is
compared to a number, or where a model's answer triggers an action without a
person reading it first. For each one, write down:

1. **The question, as worded.** Each distinct question the model answers is
   its own forecaster with its own bend, so calibration is per question, never
   per model. "Distinct" means the exact definition (instructions, criteria,
   options) on an exact model version: reword a question and it becomes a new
   forecaster, even if its id didn't change. Key calibration rows on the id, a
   hash of the definition, and the model version.
2. **What acting on it does**, and the two costs: acting when you shouldn't
   (false positive) and not acting when you should (false negative). Right
   calls cost nothing. Get rough numbers from whoever owns the outcome; a
   ratio is enough. If the costs vary per item (a refund's amount), note which
   field carries them.
3. **Whether the truth is ever learnable.** If nobody will ever find out
   whether the model was right, the probability can't be calibrated and this
   skill doesn't apply to that decision. Say so rather than building it.
4. **Whether the raw probability is available.** For LLMs, prefer token
   log-probs or a model like Jev that returns probabilities. Stated
   confidences ("I'm 90% sure") pile up on a few round numbers; the ties
   destroy ranking information that no recalibration can recover.

Show the user this inventory and the cost ratios before building anything.
It is the part they know better than you do, and getting a cost wrong moves
every threshold.

## The four parts

### 1. Serving path

Small, and on every request:

```
raw   = model's probability for (item, question)     (Jev: answers[id].noul)
key   = question id + hash of its definition + model version
p     = calibration[key] applied to raw               (identity until first fit)
act   = p >= falsePositive / (falsePositive + falseNegative)
log(item, question, model_version, raw, p, act)
```

- Yes/no probabilities: Platt, `sigmoid(slope * logit(raw) + intercept)`.
- Choice distributions: one temperature per question, dividing the log
  probabilities before renormalizing. This is a good first fix, not a general
  one; if a choice question is still miscalibrated after it (check per option),
  it needs a richer map.
- If costs vary per item, compute the threshold per item from its own costs.
- Log `raw`, not only `p`. Refitting needs what the model actually said.
- Pin the model version. An alias like `latest` moves every probability the
  table was fitted to; store the version with each calibration row and with
  each decision.

### 2. Annotation queue

This is where most implementations go wrong, so explain it to the user. Labels
usually come from review work people already do: someone upholds or reverses
an automated action. That only ever labels items you acted on, so you learn
precision and never recall, and the costliest failure (the threshold drifting
while real cases slip under it) is invisible.

Fix: route a small random share of *all* decisions (2-3%, acted on or not) to
the same queue, deterministically by hashing item id and question, and record
`reason` (`acted` or `audit`) and `weight` (1, or 1/audit_rate). Compute
anything that should describe all traffic (calibration fits, reliability,
counts) from the audit rows, weighted. Acted-on rows are fine for precision.

Label per (item, question), not per item: "this denial was wrong" is a fact
about one question, not about the item's other answers.

### 3. Refit

On a schedule, or when drift fires:

- Fit each question on its labels (`fitPlatt` / `fitTemperature`), holding
  back the most recent slice. Publish the new row only if it beats the
  current one on the held-back rows (`compareOnHoldout`).
- Budget labels by question: a few hundred per question fixes a temperature
  bend with Platt; thousands are needed for a flexible fit. Below ~10 observed
  positives, don't fit that question at all; fall back to the identity or to a
  fit pooled across similar questions, and say so.
- A base-rate mismatch (the model was trained where positives were 50%, your
  traffic is 8%) is fixed exactly with no labels, under label shift: when the
  share of positives changed but positives and negatives each still look as
  they did in training. Add `logit(your_rate) - logit(training_rate)` to every
  logit. Try this first when both rates are known; estimating your rate from
  unlabelled traffic needs further assumptions (Lipton et al., 2018).
- Never report calibration measured on the rows it was fit on; isotonic
  regression scores a perfect in-sample ECE at any sample size.

### 4. Drift alarm

Needs no labels. Compare each question's distribution of raw probabilities
over the last week against the period the current row was fitted on, using
the population stability index (`psi`). Above ~0.25, investigate and pull
fresh labels forward; 0.1-0.25, watch. A model version change always means a
refit.

Be clear with the user that this is an alarm, not a calibration test.
Calibration can decay while the score histogram stays the same (what the
positive cases look like changes, the scores don't), and the histogram can
move while calibration holds. The scheduled random audit from part 2 is the
only thing that checks calibration itself, so it keeps running regardless of
what the alarm says.

## Test before real labels exist

Use `calibratedMock` to generate a stream whose honesty you control: at
temperature 1 it is calibrated by construction (belief first, truth drawn
from the belief); below 1 it is overconfident. Write tests that:

- the serving path with an identity table passes an honest stream through
  with reliability near 0;
- fitting Platt on a cooled stream (temperature 0.5) cuts held-out reliability
  by an order of magnitude and leaves resolution unchanged (a monotone map
  can't reorder anything);
- the audit share in the queue is within a point of the configured rate, and
  weighted counts from audit rows recover the true positive count;
- `psi` stays under 0.1 on two draws of the same stream and fires on a cooled
  one.

## What to hand back

- The inventory (questions, costs, whether truth is learnable).
- The code, adapted to the repo, with tests passing.
- A short note on anything left out and why (unlearnable questions, stated
  confidences with no probability available, too few positives to fit).
- The label budget per question you'd recommend, and who in the organization
  would need to do the reviewing.

If costs vary per item (refund amounts), check calibration within each cost
band, not just overall, before using per-item thresholds. If you report an
expected count with an error bar from sum(p(1-p)), say that it assumes
independent outcomes and is a lower bound when outcomes cluster.

"Honest" in all of this means calibrated over a population of items: an
empirical relationship between stated probabilities and outcomes, not a claim
about any single answer.

Keep the reliability and the resolution next to each other in anything you
report. A model that says the base rate to everything is perfectly honest and
useless; honesty is the cheap part, and resolution (how well the model tells
your items apart) is what the model is actually worth. Higher resolution
doesn't guarantee lower cost at a particular threshold, so compare candidate
models at the user's own threshold, on their own labels.
