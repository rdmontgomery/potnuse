# RESULTS

What's actually been measured, and what it does and doesn't show. Two
experiments runnable with no API key, because the model under test is the LLM
in the loop. Both are first cuts on a tiny fixture — read them as the
instrument proving it can move a needle, not as evidence about long-context
memory at scale.

---

## Experiment 1 — φ as a coherence detector (contamination-free)

**Question.** The polarization order parameter φ is computed from turn *texts*
alone — no model, no grading. So it can be tested directly: does a tightly
aligned discourse magnetize more than a scattered one?

**Design.** Three six-turn conversations on a coherence gradient (`mflock-phi`,
in `harness/experiments.py`):

- `focused` — every turn about marathon training.
- `drifting` — marathon → nutrition → travel, a slow topic drift.
- `scattered` — six unrelated turns (marathon, qubits, sourdough, tax law,
  cello, volcanology).

**Prediction.** φ(focused) > φ(drifting) > φ(scattered).

**Result.** Prediction holds, monotonically:

| conversation | φ |
|---|---|
| focused | **0.5243** |
| drifting | 0.4961 |
| scattered | 0.4735 |

The flocking observable orders the conversations the way the theory says it
should. The separation is modest because the default embedder is a
character-trigram hash — φ here is really measuring *lexical* cohesion as a
proxy for semantic alignment. The direction is the claim; a learned embedder
would widen the gap. Still: the first concrete, falsifiable mflock prediction
was made and it survived.

---

## Experiment 2 — Claude as the model under test

**Question.** "You are an LLM — can you run a mock experiment?" Yes: answer the
benchmark by hand and feed the answers through the same scorer an API run uses
(`mflock-run --model file --answers experiments/claude_answers_fixture.json`).

**Result.** Perfect on the fixture, and the order parameters say something
specific about *why*:

| | accuracy | φ | ξ | χ |
|---|---|---|---|---|
| **Claude (file)** | **1.000** (8/8) | 0.444 | ∞ | ≈ 0 (7.9e-17) |
| mock (decay-v1) | 0.750 | 0.444 | ∞ | −0.271 |

Every category — including abstention (correctly declining the Antarctica
question) — at 1.0.

**The physics reading.** This is the interesting part. A capable model on easy
data sits **deep in the ordered phase**: accuracy saturated, correlation length
infinite (no retention decay to measure), susceptibility zero (accuracy doesn't
respond to load because nothing is hard enough to perturb it). The mock, by
contrast, was *built* to sit near a transition — finite, negative χ; a
multi-session failure; an abstention slip. The harness cleanly tells the two
regimes apart with the same three numbers. That is exactly what an order
parameter is supposed to do: distinguish phases.

**The honest catch.** χ and ξ only carry information *near the transition*. On a
fixture this easy, a real model is too far into the ordered phase for them to
say anything — they read ∞ and 0 not because memory is perfect in general but
because this slice never drives the system hard enough to bend. And the run is
authorship-contaminated: the same model helped build the fixture, so 1.0 is an
upper bound, not a held-out score.

---

## What this proves, and what it doesn't

**Proves:**

- The pipeline runs end-to-end from an actual LLM's answers, not just a mock.
- φ behaves like an order parameter on a controlled coherence sweep (Exp 1).
- The φ/ξ/χ triple distinguishes an ordered (saturated) system from a critical
  (decaying) one (Exp 2 vs. mock) — the harness can *see* a phase difference.

**Doesn't prove (yet):**

- Anything about real long-context memory. The fixture is ~6 sessions; the
  transition for a frontier model lives out at hundreds of sessions / 100k+
  tokens (LongMemEval_M, RULER at 64–128k).
- The wager's collapse claim. That needs the system *driven to the transition*,
  where χ and ξ stop being ∞/0 and start tracing a curve.

## Next, to find the transition (where the order parameter lives)

1. **Drive the system there.** Run real LongMemEval_S/M and RULER distractor
   sweeps once HuggingFace and a key are reachable — that's where χ goes finite
   and ξ goes measurable.
2. **De-contaminate.** Use held-out instances the model didn't help author.
3. **Sharpen φ.** Swap the hashing embedder for a learned one; rerun Exp 1 and
   widen the gradient.
4. **The collapse test.** Plot per-category accuracy against ξ and χ across both
   benchmarks; check whether the curves fall onto one. Pass → the projection is
   found. Fail → retire the framework (THESIS.md's kill switch).

> Reproduce: `uv run mflock-phi` (Exp 1); `uv run mflock-run --model file
> --answers experiments/claude_answers_fixture.json && uv run mflock-score`
> (Exp 2). Result JSON + `results/index.html` land in `results/` (gitignored).
