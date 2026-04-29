# rdmontgomry monorepo

pnpm workspace. Site lives at `apps/site/` (see `apps/site/CLAUDE.md` for site-specific conventions: content model, exchange voice, MDX components).

## Adding a new package

Create `packages/<name>/` with its own `package.json`. The workspace picks it up automatically (`pnpm-workspace.yaml` covers `packages/*`).

Naming: scope packages under `@rdm/<name>` (e.g. `@rdm/widget-protocol`). The site (`apps/site`) is the only exception — it keeps the unscoped name `potnuse` for historical reasons.

## Commands

Run pnpm commands from the repo root. Root-level scripts (`dev`, `build`, `preview`, `deploy`, `generate-types`) proxy to the site via `pnpm --filter potnuse <script>`. To run a script in a specific workspace: `pnpm --filter <name> <script>`.

## Deploy

Confirm with Rick before deploying. `pnpm deploy` builds the site and runs `wrangler deploy` against `apps/site/wrangler.jsonc`.

## Design docs

`docs/plans/` holds design docs and implementation plans. Don't write content there — content lives in `apps/site/src/content/`.
