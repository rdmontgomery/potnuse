# rdmontgomry monorepo

pnpm workspace. Site lives at `apps/site/` (see `apps/site/CLAUDE.md` for site-specific conventions: content model, exchange voice, MDX components).

## Adding a new package

Create `packages/<name>/` with its own `package.json`. The workspace picks it up automatically (`pnpm-workspace.yaml` covers `packages/*`).

Naming: scope packages under `@rdm/<name>` (e.g. `@rdm/widget-protocol`). The site (`apps/site`) is the only exception — it keeps the unscoped name `potnuse` for historical reasons.

## Commands

Run pnpm commands from the repo root. Root-level scripts (`dev`, `build`, `preview`, `deploy`, `generate-types`) proxy to the site via `pnpm --filter potnuse <script>`. To run a script in a specific workspace: `pnpm --filter <name> <script>`.

## Deploy

Confirm with Rick before deploying. `pnpm deploy` builds the site and runs `wrangler deploy` against the root `wrangler.jsonc`. The wrangler config lives at the repo root (not inside `apps/site/`) because Cloudflare's CI invokes `npx wrangler versions upload` from the workspace root and looks for the config there. Its `assets.directory` points at `./apps/site/dist`.

## Trading harness (`packages/tape`)

`@rdm/tape` is a paper-trading harness: pool reads, a deterministic exit
ladder, bankroll rules, a pre-trade screen and a JSONL journal.

**Hard boundary: nothing in this repo may sign a transaction.** No private
keys, no signer, no wallet SDK, no mnemonic — not in `packages/tape`, not in
an env var, not in a config file. This repo deploys to a CDN; a signer here
has the wrong blast radius. Live execution goes in a separate private repo
behind a policy engine. If a change would add a signing dependency to this
workspace, it belongs elsewhere.

### Runner (`packages/tape-worker`)

The cron Worker (`tape-runner`) that drives the harness. Deployed **separately**
from the site with `pnpm --filter @rdm/tape-worker deploy` — the site's config
at the repo root is untouched, so neither deploy can ship the other.

Keep it thin. Logic belongs in `@rdm/tape`, which is Cloudflare-free and tested
under Node; the Worker supplies bindings and entry points only.

`@rdm/tape` must stay importable from a Worker: no `node:` imports in the
package root or in `./feed`. Filesystem paths live in `@rdm/tape/node` and are
for the CLI and tests. `wrangler deploy --dry-run` is the check.

## Design docs

`docs/plans/` holds design docs and implementation plans. Don't write content there — content lives in `apps/site/src/content/`.
