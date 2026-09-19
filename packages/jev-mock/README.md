# @rdm/jev-mock

A local stand-in for a System One model — TypeSafe's Jev is the one in view —
plus the scoring machinery to tell whether a stand-in is any good.

Nothing here makes a network call. There is no API key, no vendor SDK, and no
provider to configure. Point it at the same `decide(state, questions)` interface
the real client exposes and swap it out later by changing one import.

```ts
import { calibratedJev } from '@rdm/jev-mock';

const jev = calibratedJev({ seed: 1 });

const { answers } = await jev.decide('Help! My payouts have been failing for 3 days.', {
  urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
  team: {
    type: 'choice',
    instructions: 'Which team should handle this?',
    criteria: {
      billing: 'Payments, invoicing, refunds',
      technical: 'Bugs, outages, integrations',
      sales: null,
    },
  },
  anger: {
    type: 'score',
    instructions: 'How frustrated is the customer?',
    criteria: ['Calm', 'Frustrated', 'Very angry'],
  },
});

answers.team.choice;          // 'billing'  — typed to the keys you supplied
answers.urgent.probability;   // 0.93       — P(yes)
answers.anger.score;          // 1.13       — fractional position on the rubric
```

## The two mocks are not interchangeable

| | `shapeOnlyJev` | `calibratedJev` |
| --- | --- | --- |
| Answer types | correct | correct |
| Probabilities | uniform noise | calibrated by construction |
| Hidden ground truth | none | logged per decision |
| Good for | wiring, CI, contract tests | thresholds, escalation budgets, cost models |
| ECE over 20k items | 0.25 | 0.007 |
| Resolution | 0.0001 | 0.13 |

`shapeOnlyJev` produces valid JSON carrying zero information. That is not a
criticism — it is the correct tool for asserting that your client parses, your
branches are reachable and your error paths fire. It is the wrong tool for
choosing the number you compare a probability against, and most "mock the LLM"
advice stops here.

`calibratedJev` inverts the generative order: it draws a belief from a prior,
then draws the outcome *from that belief*, and reports the belief. The stream is
therefore exactly as honest as it claims to be, and `mock.log` hands you the
truths so you can score your own policy against a known oracle.

## Breaking it on purpose

`temperature` distorts every reported probability while leaving the latent truth
alone. Below 1 sharpens (overconfident); above 1 flattens (underconfident).

```ts
const hot = calibratedJev({ seed: 42, temperature: 0.5 });
```

This is the load-bearing feature. A vendor whose confidence runs 15% hot does
not fail your contract tests, does not throw, and does not change the shape of
anything. It changes how often your abstain band escalates, and therefore what
your automation costs. Over 20k items, with a fixed band derived from
`{ falsePositive: 5, falseNegative: 20, escalation: 1 }`:

| | escalated | false positives | false negatives | cost/item |
| --- | --- | --- | --- | --- |
| honest | 53.0% | 387 | 59 | 0.686 |
| T = 0.5 | 30.1% | 824 | 369 | 0.876 |

The overconfident model halves the human-review queue and costs 28% more.
Every operational dashboard you own would call that an improvement.

## Scoring

- `brier`, `logLoss` — strictly proper scoring rules. Their unique minimizer is
  the true conditional probability, so you cannot improve them by shading your
  reported confidence.
- `ece`, `bins`, `diagram` — expected calibration error and the reliability
  diagram behind it. ECE has a finite-sample noise floor around `1/sqrt(n)`:
  ~0.035 at n=500, ~0.007 at n=20000. Quoting an ECE without a sample size is
  quoting nothing.
- `murphy` — the three-term decomposition, `brier = reliability - resolution +
  uncertainty`. Reliability asks whether the number is honest; resolution asks
  whether it is informative. They move independently, which is the whole
  argument.

## Policy

- `threshold(costs)` — `cFP / (cFP + cFN)`. The expected-cost-optimal cutoff,
  in closed form, with no labelled data.
- `abstainBand(costs)` — adds a flat-cost human. Returns `degenerate: true` when
  a person costs more than the mistakes they would prevent.
- `evaluate(pairs, costs, band)` — what a policy actually cost.
- `sweep(pairs, costs)` — the grid search you are forced into when the score is
  not calibrated, for comparison. On a calibrated stream the closed form lands
  within half a percent of it.

## Running it

```
pnpm --filter @rdm/jev-mock demo        # regenerates every number quoted above
pnpm --filter @rdm/jev-mock typecheck
pnpm test                              # tests live in src/mock.test.ts
```

## What this is not

It is not a model. It cannot judge whether a ticket is urgent, and swapping the
mock for Jev will change every answer. What it can do is tell you, before you
have an API key, whether your *decision layer* is sound — and after you have
one, whether the model you are paying for is as honest as it says.

Jev's own documentation lists what the model is bad at (arithmetic, counting).
Do those in code. Cardinality limits — 2..255 choice options, 2..10 score
levels — are enforced locally in `validate`, so a malformed rubric fails without
a round trip.
