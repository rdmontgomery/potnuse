# Trading harness

Design notes for `packages/tape`. Written down because the reasoning matters
more than the code, and because the parts that are *not* built are as much a
decision as the parts that are.

## Why the agent does not hold keys

The instinct is to hand a model a trading SDK and a wallet. Inverted. The SDK
is commodity, the model is the worst component to put near a keypair, and the
thing that actually produces capital preservation is a deterministic policy
layer that holds the keys and refuses anything outside envelope.

So: the model proposes, a dumb auditable gate disposes. Turnkey-style policy
engines evaluate inside the same enclave that signs, which means a
compromised or hallucinating agent physically cannot emit a transaction
outside spec. That layer is tier 1 and it does not live in this repository.

## Why latency does not matter here

The memecoin tooling literature is about launch sniping: sub-millisecond
execution, bundles won and lost at 200ms. That is a different game. Buying an
established pool on a minutes-long horizon has a latency budget wide enough
that a model in the loop is fine — as long as it is nowhere near tier 1.

The corollary is that speed is not the edge, and anyone selling speed as the
edge for this style of trading is selling to the wrong buyer.

## Why the quote asset is a parameter

A pair quoted in a stablecoin and a pair quoted in a tokenized equity are the
same object with different price references. Special-casing stablecoins would
have baked an assumption into the engine that is false for a large and
growing share of interesting pools.

Making it a parameter forces the real question into the open: a multiple in
dollars and a multiple against the pair are different numbers, and which one
the ladder measures is a strategy decision. `denom` is therefore explicit and
never inferred, and the engine stalls rather than guessing when a dollar
reference is missing.

## Why the fill model is pessimistic by default

Paper trading that flatters you is worse than none: it launders a bad plan
into confidence. Fees are charged on every rung, impact is taken at real
reserves, reserves are fed forward so laddering out of a thin pool costs what
it actually costs, and a latency haircut is on by default. `report` warns when
slippage comes back implausibly small.

## Why the bankroll rules are crude

Kelly needs a win probability. On a payoff this fat-tailed, that probability
cannot be estimated from any sample a retail trader will ever accumulate, and
the estimator's variance swamps the estimate. Crude and robust beats precise
and wrong: a written-off budget, equal tickets that do not grow after a
winner, a permanent ban on re-upping a loser, and a cooldown after a realised
loss.

Every one of those refusals fires at the exact moment a person is least able
to supply it themselves. That is the whole design.

## Open questions

- **Path risk.** Marks are points; a wick through the stop between polls is
  invisible. Either poll fast enough that it does not matter, or read swap
  events and reconstruct the path. The second is correct and not yet built.
- **Concentrated liquidity.** The fill model is constant-product only. A V3
  venue will fill differently and the model will be wrong in a direction that
  is not obviously conservative.
- **Rung placement.** The example plan (2x/3x/5x, 40/30/15, 15% runner) is a
  guess dressed as a default. The paper journal exists to replace it with
  something fitted to observed tapes.
