# @rdm/tape-runner

The cron Worker that builds tapes and runs the ladder against them.

Thin by design: every decision worth testing lives in `@rdm/tape`, which knows
nothing about Cloudflare and runs under plain Node in the suite. This package
supplies bindings and two entry points. **If logic starts accumulating here it
belongs in the package instead**, where it can be exercised without deploying.

No signer, no key, no wallet binding. It reads chains and writes rows.

## Why a separate Worker

The site's `wrangler.jsonc` lives at the repo root because Cloudflare CI
invokes wrangler from there. This one is deployed by hand, so a site build can
never ship the runner and a runner change can never ship the site. Different
things with different failure modes get different deploy buttons.

## Setup

```sh
pnpm --filter @rdm/tape-worker exec wrangler d1 create tape
# paste the printed database_id into wrangler.jsonc
pnpm --filter @rdm/tape-worker migrate
pnpm --filter @rdm/tape-worker exec wrangler secret put TAPE_READ_TOKEN
pnpm --filter @rdm/tape-worker deploy
```

Register a market — the CLI prints the statement rather than writing it, since
the Worker's HTTP surface is read-only on purpose:

```sh
node --experimental-strip-types packages/tape/src/cli.ts market ./my-market.json
```

Set `feed.startBlock` to the pool's deployment block for full history, or a
recent block to start from now. The cursor takes over from there.

## Endpoints

Read-only and **fail closed** — with no `TAPE_READ_TOKEN` set, nothing is
served. Put Cloudflare Access in front as well if you want the Google sign-in
instead of a bearer token.

| Path | What it returns |
| --- | --- |
| `/status` | bankroll, and each market's cursor and open position |
| `/markets` | the active watchlist with its configs |
| `/journal?market=0x…&limit=200` | recent events plus a summary |

## Operational notes

**A missed firing costs latency, not data.** The runner resumes from a block
cursor, so an outage, a deploy, or a failed minute is caught up on the next
one. This is the property the whole hosting choice rests on.

**The cursor advances last**, after the journal is flushed and the position is
saved. A firing that dies midway re-scans a range it partly processed —
duplicate marks are the same observations and harmless — rather than advancing
past events that were never written. Repeat rather than skip.

**Markets are isolated.** One pool's RPC timing out is recorded against that
market and costs the others nothing.

**Work is bounded per firing** (2,000 observations per market). A long backlog
is drained across several minutes instead of one firing being killed mid-flush.

Watch it with `pnpm --filter @rdm/tape-worker tail`. Each firing logs one
structured line: markets, observations, errors, and the block range per market.
