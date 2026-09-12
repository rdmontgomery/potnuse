# @rdm/tape

Paper-trading harness for laddered exits on constant-product pools.

**This package cannot sign a transaction.** It has no keys, no signer, no
wallet dependency, and one write path: JSONL to disk. Everything here reads
pools and simulates. Live execution belongs behind a policy engine in a
separate repository with a separate blast radius — see *Tier 1* below.

## The three tiers

| Tier | What it is | Where it lives |
| --- | --- | --- |
| 1 — vault | Non-custodial signer with a policy engine: notional caps, contract allowlist, slippage bounds, daily ceiling. Dumb by design. | not here, and not in this repo |
| 2 — executor | Deterministic ladder: sizing, take-profit rungs, trailing stop, hard stop, time stop. No model in the loop. | `ladder.ts`, `fills.ts`, `bankroll.ts` |
| 3 — screen | Pre-trade risk read, sizing proposal, and the journal. | `screen.ts`, `journal.ts` |

Tier 2 is the edge. "Take a few multiples, leave runners" was never a bad
strategy; it failed because it was executed by a person with a dopamine
system. Encoding it is the entire product, and it is about three hundred
lines.

## The quote asset is a parameter

Every price in this package is base-against-quote, and the quote asset is
whatever the pool says it is: a stablecoin, wrapped ETH, a tokenized equity,
another memecoin. A stablecoin is not a special case, it is the degenerate
case where USD-per-quote is a constant.

This matters because dollar P&L on a non-stable pair is a product of two
moves. The pair ratio can double while the quote asset halves, and you have
made nothing. So `LadderPlan.denom` is explicit:

- `'quote'` — multiples against the pair ratio. Always available.
- `'usd'` — multiples in dollars. Requires a USD reference for the quote
  asset, and the engine **stalls rather than guessing** when that reference
  is missing. A stall is recorded, not swallowed.

Set it in `usdRef`: `pegged()` for a stablecoin, `floating()` for anything
with its own price, `unreferenced` when there is no honest dollar figure.

## The simulation is allowed to say no

Paper trading that flatters you is worse than none, because it launders a bad
plan into confidence. Every simulated fill pays:

- the venue fee and transfer tax, charged **on every rung**, not once;
- constant-product price impact at the real reserves;
- a latency haircut, on by default — you are never filled at a mark you
  observed a poll interval ago;
- the reserves the previous rung already moved. Laddering out of a thin pool
  costs more than four times one rung, and the model reflects that.

`tape report` warns if mean slippage comes in under 10bps, because that means
the fee schedule or the depth is wrong and nothing else in the summary can be
trusted.

## Bankroll rules

Kelly is not merely unknown on this payoff, it is unknowable: you cannot
estimate the win probability from any sample you will ever have, and the
estimator's variance swamps the estimate. What is left is crude and robust.

- **Fixed notional tickets** by default, sized off the original budget. Wins
  do not enlarge the next bet. Size drift after a winner is how a working
  strategy dies.
- **A program budget** treated as already spent. When it is committed, the
  program is over, profits notwithstanding.
- **No re-up on a loser**, permanently, per asset. Address casing cannot
  sneak one back in.
- **A cooldown after a realised loss.** Tilt is the largest line item in the
  historical P&L of everyone who has ever done this and the cheapest thing on
  this list to prevent.

## Running a paper week

```sh
node --experimental-strip-types packages/tape/src/cli.ts screen  ./my-market.json
node --experimental-strip-types packages/tape/src/cli.ts watch   ./my-market.json
node --experimental-strip-types packages/tape/src/cli.ts report  ./journals/run.jsonl
```

`examples/stable-quote.json` and `examples/floating-quote.json` are the two
shapes. Fill in the pool address and token decimals; anything you leave out
of `facts` stays **unknown**, and the screen treats unknown as a warning
rather than a pass.

The deliverable of the week is the journal, not the P&L. A handful of trades
on a fat-tailed payoff tells you almost nothing about edge. What the journal
gives you is the counterfactual: the same tape replayed against a different
ladder, via `replayFromJournal`. That is a real comparison, and it only works
because the engine is pure — no clock, no network, no randomness; time
arrives inside the mark.

## What this does not model

Stated plainly, because each of these is a way the paper week could lie:

- **Paths, only points.** Marks are spot observations. A wick through your
  stop between polls is invisible here, so poll interval is a risk parameter,
  not a performance knob. When a tick gaps through both a rung and the stop,
  the engine resolves it as the stop — the pessimistic reading, chosen so the
  simulation does not flatter itself.
- **Constant product only.** No concentrated liquidity, no multi-hop routing,
  no aggregator splitting. Real fills on a V3-style venue will differ.
- **No MEV.** The latency haircut is a crude stand-in for sandwiching and
  adverse selection, not a model of it.
- **No gas.** Irrelevant at these sizes on an L2, wrong everywhere else.
- **One market per session.** Cross-position correlation is not modelled;
  the bankroll caps concurrency instead.
