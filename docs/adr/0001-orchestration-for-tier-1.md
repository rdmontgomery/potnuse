# ADR 0001 — Orchestration for tier 1 (durable execution)

**Status:** Open. Decide before any signer exists; do not decide now.
**Date raised:** 2026-09-12
**Decides:** what runs the live execution workflow once tier 1 is built.

## Context

Tiers 2 and 3 run on a one-minute Cloudflare cron over D1 (`packages/tape-worker`).
That was chosen because the workload is **naturally idempotent**: its only side
effects are inserting rows and advancing a block cursor, and the chain is
re-queryable forever. Re-running a firing is harmless by construction, which is
why `runOnce` can write journal, then state, then cursor, and simply repeat a
partly-processed range after a crash. Repeat rather than skip.

Restate was raised as an alternative. Its virtual objects — keyed entities,
isolated state per key, single-writer per key, parallel across keys — are close
to an exact description of what the store and runner hand-roll. Cloudflare
Durable Objects offer similar semantics on infrastructure already in use, and
were not considered at the time. That was a gap in the reasoning, not a
considered trade-off.

Neither was adopted, for one reason: **durable execution earns its keep on
non-idempotent side effects**, and tier 2/3 has none. Restate additionally
requires a stateful server (self-hosted binary on a persistent volume, or
Restate Cloud), which is the dependency the cursor design specifically removed
the need for. Handlers can run on Workers; the server cannot.

## Why this becomes a real decision at tier 1

Live execution is the opposite shape:

    submit swap → await receipt → record fill → update position

This has a non-idempotent step in the middle. A crash between submit and record
leaves the system genuinely unable to say whether it holds a position, and
"just re-run it" goes from harmless to catastrophic — the failure mode is a
double buy, or a position the ladder does not know it owns and therefore never
exits. That is precisely the problem durable execution exists to solve, and it
cannot be engineered away with an ordering invariant the way tier 2/3's was.

## Options to evaluate (when tier 1 is built, not before)

1. **Restate.** Virtual objects map cleanly onto per-position workflows. Needs
   a stateful server or the managed cloud. Evaluate the operational cost against
   a hobby-scale program.
2. **Temporal.** Mature, heavier, more operational surface. The incumbent to
   beat rather than the default.
3. **Cloudflare Durable Objects.** Per-position object with storage and alarms,
   on infrastructure already in use. Weaker durable-execution guarantees than
   the above — it gives state and single-writer concurrency, not automatic
   replay of a partially-executed workflow — so the crash-consistency work
   would still be hand-written.
4. **Hand-rolled state machine with an idempotency key on submission.** Cheapest;
   viable if the signer's API supports client-supplied idempotency keys, which
   turns "did I submit?" back into a question with an answer.

Option 4 deserves a serious look before reaching for infrastructure: if
submission can be made idempotent at the boundary, tier 1 collapses back to the
same shape as tier 2/3 and none of this is needed.

## Cost of being wrong

Low, and deliberately so. `runOnce` and `enterMarket` are the only orchestration
in the system, roughly 200 lines in one file. `ladder.ts`, `fills.ts`,
`bankroll.ts` and `screen.ts` are pure and do not know a runner exists; the
store is one interface with two implementations already. Swapping the
orchestration layer is a day, not a rewrite.

The orchestration choice is the one most likely to be wrong, so it was kept the
thinnest. That property is worth preserving — if logic starts accumulating in
the runner, this ADR gets more expensive to act on.

## Decision

Deferred. Revisit when tier 1 is specified, and evaluate option 4 first.
