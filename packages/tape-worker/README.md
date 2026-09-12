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

## Deploys are merges to main, same as the site

Once wired, this deploys exactly like everything else in the repo: merge to
main, Cloudflare rebuilds. It is a *second* Worker rather than a second kind of
thing, so it needs its own Workers Builds connection — one-time dashboard work,
not an ongoing manual step.

In the Cloudflare dashboard, connect the repo to a Worker named `tape-runner`
with:

| Setting | Value |
| --- | --- |
| Root directory | `packages/tape-worker` |
| Build command | `pnpm install` |
| Deploy command | `pnpm run deploy` |
| Build watch paths | `packages/tape-worker/*`, `packages/tape/*` |

The watch paths matter in a monorepo: without them every site commit rebuilds
the runner and every runner commit rebuilds the site. With them, each rebuilds
only when something it depends on actually changed.

**Migrations run on deploy.** The `deploy` script is
`wrangler d1 migrations apply TAPE_DB --remote && wrangler deploy`, so a schema
change ships with the commit that needs it rather than being a step someone has
to remember. It references the *binding* name, not the database name, so it
survives the database being renamed or recreated.

## One-time setup

Four things that a git push genuinely cannot do, because they create resources
or hold secrets:

```sh
pnpm --filter @rdm/tape-worker exec wrangler d1 create tape
# paste the printed database_id into wrangler.jsonc — this one is a code change
pnpm --filter @rdm/tape-worker exec wrangler secret put TAPE_READ_TOKEN
pnpm --filter @rdm/tape-worker deploy   # first deploy, to create the Worker
```

Then connect the repo as above. After that you never run wrangler again.

Then open the Worker's URL, sign in with the token, and paste a contract
address. Discovery reads decimals, symbols and (given a factory) the pool
address on-chain, so the only things typed by hand are addresses.

Set **start block** to the pool's deployment block for full history, or a recent
block to start from now. The cursor takes over from there.

## The page

Everything is behind the token and **fails closed** — with no `TAPE_READ_TOKEN`
set, nothing is served at all. Put Cloudflare Access in front as well if you
want the Google sign-in rather than a token.

| Route | What it does |
| --- | --- |
| `/` | watchlist, bankroll, add-a-contract form, journal tail |
| `POST /market` | discover, screen, and watch — **stores nothing if the screen blocks** |
| `POST /market/enter` | open a paper ticket by hand |
| `POST /market/deactivate` | stop watching |
| `/api/status`, `/api/journal` | the same data as JSON, for scripts |

This surface was read-only in the first cut, on the reasoning that a mutation
path on the internet was not worth saving a paste. That reasoning no longer
holds: driving the harness from a phone *is* the point, and none of these
writes can move money. They add a market, open a simulated position, or stop a
scan. The signer boundary is unchanged.

**Opening a ticket is always manual.** `runOnce` never opens a position —
deciding which tickers enter the universe is the one judgement this system
leaves to a person.

### Running without a stop

Set **stop multiple** to `0`. The paper week exists partly to find out whether
the stop pays for itself, and a stop-out ends the tape that would answer it.

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
