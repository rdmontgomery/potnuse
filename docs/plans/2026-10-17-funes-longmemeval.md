# Funes on LongMemEval — a pre-registered memory experiment

Status: prediction written 2026-10-17, nothing run yet. Due for the January
lunch-and-learn ("Borges's Two Diseases"), slide `now-funes`. Number needed by
2026-12-20.

## Claim

Forgetting is what creates a metric. A memory that never forgets (Funes) can
store every fact but cannot tell a stale fact from a current one, because it
has no operation that makes two observations "the same thing." A memory with
birth, merge and death should therefore win exactly where the answer changed
over time, and lose where the question wants one verbatim detail.

## Predictions (signs, written before any run)

| LongMemEval category       | Prediction                         |
| -------------------------- | ---------------------------------- |
| knowledge-update           | forgetting > retain-all            |
| temporal-reasoning         | forgetting > retain-all            |
| single-session (user/asst) | retain-all > forgetting            |
| multi-session              | no prediction                      |
| abstention variants        | forgetting ≥ retain-all (weak)     |

The interesting result is the crossover: a forgetting store that wins
everywhere or loses everywhere means the effect is context length, not
forgetting. Condition C exists to catch that.

## Conditions

All three use the same reader model, the same prompt and the official
LongMemEval judge. Only the memory differs.

- **A. Retain-all.** Every turn of every session is kept. Retrieval over all
  of it (top-k turns by embedding), so A and B see comparable context sizes.
- **B. Malthusian.** After each session, extract atomic facts. Birth: a new
  fact enters at weight 1. Merge: a new fact that supersedes an old one kills
  the old one; the supersession gate is a typed yes/no with a probability
  (Jev-shaped; `@rdm/jev-mock` until a real client exists). Death: weights
  decay by λ per session unless the fact is retrieved or restated. Retrieval
  over surviving facts.
- **C. Random forgetting.** B's extraction, then drop facts at random to match
  B's memory size session by session. Same budget, no judgment about which
  facts are stale.

B beating A could be compression alone. B beating C is the claim.

## Data

LongMemEval (Wu et al., 2024), the `_S` split: 500 questions, each over a
history of roughly 40 sessions. Check the category names and split sizes
against the release before writing code; the table above uses the paper's
categories as remembered.

## Measured

Per-category accuracy for A, B, C. Memory size over sessions for B. One sweep
of λ over a small grid (say 4 values), reported in full rather than picking
the best: the curve of knowledge-update accuracy against λ is the thing to put
on the slide if it has a peak.

## Rules

- Run once on the full split per condition. Report every number, including
  the ones that contradict the table.
- No tuning on the test questions. If λ needs choosing, choose it on a held-out
  slice of 50 questions and say so.
- API keys come from the environment and are never committed.

## Out of scope

The Toner–Tu / flocking framing of discourse. This experiment tests only the
birth–death claim about memory.
