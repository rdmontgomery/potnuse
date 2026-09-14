# HYPOTHESIS

The wager (THESIS.md): existing memory benchmarks already measure a projection
of a discourse-memory order parameter. This file does the mapping —
**benchmark category → order parameter** — and then tries to *break* each
mapping. A mapping that can't be broken is either right or untested; a mapping
with no clean analog is a research question, and those are flagged loudest,
because they're the point.

The three candidate order parameters are defined in
[`src/mflock/order_params.py`](./src/mflock/order_params.py):

- **φ — polarization.** Flocking magnetization: how aligned the turns are.
- **ξ — retention / correlation length.** How far back memory stays coherent;
  `r(d) ~ exp(-d/ξ)`.
- **χ — susceptibility.** Linear response: `d(accuracy)/d(distractor load)`.

## Seed mappings (given)

- **RULER distractor sweeps ↔ χ (susceptibility).** RULER's whole design is to
  add needles/distractors and watch accuracy move. That derivative *is* χ.
- **LongMemEval session distance ↔ ξ (retention / correlation length).** Evidence
  sits some number of sessions back; accuracy-vs-distance is the retention
  curve, and its decay constant is ξ.

Everything below either extends these or admits it can't.

---

## LongMemEval → order parameter

| Category | Maps to | Defense | Break / where it leaks |
|---|---|---|---|
| `single-session-user` | **ξ** (one point on the curve) | Single fact at a known evidence distance; recall-vs-distance is exactly the retention curve. | Not a *sweep* — one question is one sample at one distance, so it constrains ξ only in aggregate. A lone instance reads more like a recall threshold than a decay. |
| `single-session-assistant` | **ξ** | Same as above; assistant-stated facts are just a different source turn. | If assistant turns are systematically more/less retrievable than user turns, the "source" is a hidden variable ξ doesn't capture. |
| `single-session-preference` | **ξ**, weakly | Preferences are facts with a distance; should decay like any other. | Preferences are stated *in passing* — low salience. Salience is a per-fact weight (a birth rate), not a distance. Leaks toward the birth-death ledger, not ξ. |
| `multi-session` | **no clean scalar analog** ⚑ | — | Requires *binding* evidence from ≥2 sessions. A scalar decay length can't express "both ends of a gap must be coherent at once." Wants a **two-point correlation function** C(d₁,d₂), not ξ. **Research question.** |
| `temporal-reasoning` | **no clean analog** ⚑ | — | It's about *ordering events on a time axis*, not magnetization, decay, or response. The flocking picture has no time coordinate on its position-space. **Research question: does the order parameter even live in a space that carries time?** |
| `knowledge-update` | **ξ, death-rate side** | A fact is overwritten; answering with the *latest* means the stale value was reaped. This is the death rate of the Malthusian ledger directly. | It's really a *competition* between an old and a new value — interference, closer to χ w.r.t. a contradicting distractor than to a clean decay. |
| `abstention` | **no clean analog** ⚑ (maybe φ→0) | Speculative: when the field is isotropic relative to the query (φ→0, nothing aligns), the right move is to abstain. | That's a decision boundary / false-positive control, not an order parameter. The demon *declining to sort noise* isn't on our list of three. **Research question.** |

---

## RULER → order parameter

| Category (tasks) | Maps to | Defense | Break / where it leaks |
|---|---|---|---|
| **Retrieval** (`niah_*`, 8) | **χ** (vs # needles/distractors) **and ξ** (vs length) | The seed mapping, cleanest case: `num_needle_*` is a literal distractor knob → χ; context length is a literal distance → ξ. Two order parameters, two axes, one task family. | If accuracy depends on needle *position* (lost-in-the-middle), neither a length-ξ nor a count-χ captures it — position is a third axis. |
| **Multi-hop Tracing** (`variable_tracking`) | **ξ** (chain length as distance) | A chain of L assignments resolves iff coherence persists across L hops — correlation length ≥ L. | Same leak as `multi-session`: hop-binding is a two-point (really L-point) correlation, not a single decay length. Partial **research question.** |
| **Aggregation** (`cwe`, `fwe`) | **φ-like: a global statistic of the field** | Strongest structural claim: the answer is the *most frequent words* — an empirical, population-level coarse-graining of the whole context. That's Beer's variety / a sufficient statistic / a coarse-grained mode — i.e. an order parameter *by construction*. Aggregation tasks may be measuring the order parameter most directly of all. | The specific statistic (word frequency) isn't *alignment*. The mapping is structural (a global mean over the field), not literal magnetization. Needs the φ definition generalized from "mean embedding" to "any coarse-grained sufficient statistic." |
| **Question Answering** (`qa_squad`, `qa_hotpot`) | **χ** (distractor paragraphs); `hotpot` also **ξ** | Gold paragraph buried among distractors → distractor-load response → χ. HotpotQA is multi-hop → adds a correlation-length component. | Real-text QA mixes in *parsing/reasoning* difficulty that has nothing to do with memory geometry — a confound neither χ nor ξ owns. |

---

## The categories with NO clean mflock analog (the research questions)

These are flagged ⚑ above and collected here because they are the experiment's
actual yield — the places the framework either grows a new observable or breaks:

1. **Multi-hop binding** (`multi-session`, `variable_tracking`, `qa_hotpot`).
   A scalar correlation length ξ is too poor. The honest object is a
   **two-point (or L-point) correlation function** C(dᵢ,dⱼ): coherence isn't
   "how far back" but "are these two distant points coherent *with each
   other*." If mflock needs this, ξ is a projection of something richer, and
   that something is the real order parameter.

2. **Temporal reasoning.** Requires a **time coordinate on the position-space**.
   Toner-Tu lives on space; argument-space has been treated as static. Does
   the order parameter live in a space that carries time, or is time a second
   field coupled to it? Unresolved, and central.

3. **Abstention.** A **decision boundary / disorder detector**, not a sorted
   quantity. Possibly the disordered phase (φ→0) read as "abstain," but that's
   a conjecture, not a measurement. The demon's choice *not* to sort is missing
   from the three candidates.

4. **Salience / birth rate.** `single-session-preference` exposed it: facts
   have weights (how loudly they were stated), and the Malthusian ledger's
   *birth* rate is unmeasured. Forgetting curves give the death rate a foothold
   (ξ); nothing here gives the birth rate one. (Carried over from THESIS open
   questions.)

---

## What would falsify the seed mappings (the empirical teeth)

The harness already estimates ξ (from LongMemEval `evidence_distance`) and χ
(from a distractor-load proxy) on every run. The framework earns its keep only
if these aren't independent decorations:

- **Collapse test.** Plot accuracy across both benchmarks against a single slow
  variable built from ξ and χ. The wager says the per-category curves collapse
  onto one. If they don't collapse, the order parameter is decorative — retire
  it (THESIS.md's own kill condition).
- **Sign and scaling of χ.** χ should be negative (accuracy falls with load) and
  should *steepen* near the effective-context-length transition. A flat or
  positive χ breaks the linear-response reading.
- **ξ vs the knowledge-update death rate.** If `knowledge-update` accuracy and
  the ξ fit from the other categories disagree on the same model, retention
  isn't one number — the ledger's birth and death rates have split, exactly as
  the salience leak predicts.

> Caveat stamped on all of the above: current numbers come from the offline
> **mock** model and a tiny fixture, whose decay is built-in by construction.
> The mappings are real predictions; the *values* only become evidence once a
> real model runs against the real datasets. Until then this file is a set of
> bets with their kill conditions attached, which is the most an honest
> hypothesis can be.
