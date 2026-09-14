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

## Experiment 3 — recover an injected correlation length (the probe)

**Question.** Experiment 2 left ξ=∞, χ≈0 because the fixture was too easy to
perturb a careful reader. So: build a probe with a *principled, scaling*
difficulty, and check whether the retention estimator can recover a **known**
correlation length when one is deliberately injected.

**The probe** (`mflock-probe` → `fixtures/longmemeval_probe.json`, 17
instances). Every instance asks "what is my current gym locker code?" The true
answer is planted once; then later sessions plant *other-referent* number lures
(work locker, bike lock, wifi, garage) of the same 4-digit format. The further
back the true answer sits (larger `evidence_distance`), the more recent-but-
wrong numbers compete — difficulty rises with distance by construction. Plus
three abstention traps (a pool code that was never given).

**Two memory architectures, as backends:**

- **windowed (K=4)** — `--model window --window 4`. Sees only the last 4
  sessions; answers from an oracle over that window, else abstains. This
  *injects* a ground-truth correlation length of 4 sessions.
- **full context** — `--model file`, this session's model reading the whole
  haystack by hand (`experiments/claude_answers_probe.json`). Unbounded memory.

**Result.** The estimator recovers the injected window cleanly:

| model | overall | retention r(d) | d½ (recovered ξ) |
|---|---|---|---|
| **windowed K=4** | 0.765 | `1,1,1,1, 0,0,0,0` at d=`0,1,2,3,4,5,6,8` | **4.0** |
| **full context** | 1.000 | `1,1,1,1,1,1,1,1` | ∞ |

The windowed model's retention falls off a **cliff at exactly d=4** — and
`d_half` reads **4.0**, recovering the injected K. The full-context model stays
flat at 1.0, `d_half=∞`. Two architectures, two phases (finite vs. infinite
correlation length), and the order parameter separates them with the
*right number*. Both abstain correctly on the pool traps (3/3).

Two notes kept honest: (1) the exponential-fit ξ reads ∞ for *both* — a sharp
cliff isn't an exponential decay, which is precisely why `d_half` was added as
the cliff-detector; report d½ for windowed memory, ξ for graded decay. (2) χ
stays ≈0 on the load axis because the windowed model's failures are driven by
*distance crossing the window*, not by raw haystack depth — a correct and
falsifiable prediction in itself: susceptibility lives on the distance axis
here, not the load axis.

**Why this matters.** It's the first time the harness recovers a *known*
quantity. Inject ξ=4, measure d½=4. That's the minimum credibility test for an
order-parameter estimator — before trusting it on a real model where the true ξ
is unknown, show it returns the right answer when the truth is planted. It does.

---

## What this proves, and what it doesn't

**Proves:**

- The pipeline runs end-to-end from an actual LLM's answers, not just a mock.
- φ behaves like an order parameter on a controlled coherence sweep (Exp 1).
- The φ/ξ/χ triple distinguishes an ordered (saturated) system from a critical
  (decaying) one (Exp 2 vs. mock) — the harness can *see* a phase difference.
- The retention estimator recovers a **known** correlation length: inject a
  K=4 memory window, measure d½=4 (Exp 3). It returns the right answer when the
  truth is planted — the prerequisite for trusting it where the truth is not.

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
