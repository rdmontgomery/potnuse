# Monorepo conversion implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the existing single-package `rdmontgomry` repo into a pnpm monorepo with the Astro site at `apps/site/`, leaving room for future `packages/` (canvas-runtime, widget-protocol, widgets-browser) to land in their own PRs.

**Architecture:** pnpm workspaces. One workspace member at the end of this PR (`apps/site/`). Root `package.json` holds only workspace-level config (pnpm overrides, `onlyBuiltDependencies`, proxy scripts). All site source, deps, and configs move into `apps/site/`. No package extractions yet — those come in milestone 2 with `widget-protocol`.

**Tech Stack:** pnpm 10 workspaces, Astro 6 (static), Cloudflare Workers (static asset hosting via `wrangler.jsonc`), existing React 19 / MDX 5 / Zustand stack untouched.

**Reference docs:**
- Design doc: `docs/plans/2026-04-29-canvas-substrate-design.md` (the *why*)
- pnpm workspaces: https://pnpm.io/workspaces

**Working directory:** `/home/rdmontgomery/projects/rdmontgomry/.worktrees/canvas-substrate` on branch `feat/canvas-substrate`. All commands below assume this is your CWD.

**Verification approach:** This is a refactor, not new behavior. The "test" is *behavioral equivalence*: same `dist/` artifacts, same dev server, same wrangler validation. Capture baseline before, compare after.

---

## Task 1: Capture baseline build artifacts

We need a snapshot of `dist/` before restructuring so we can verify nothing changes.

**Files:**
- Create: `/tmp/monorepo-baseline-files.txt` (ephemeral, not committed)

**Step 1: Confirm clean tree**

Run: `git status --short`
Expected: empty output (no uncommitted changes; gitignore + design doc already committed).

**Step 2: Run baseline build**

Run: `pnpm build`
Expected: completes with "11 page(s) built". Note the page count and total build time for sanity reference.

**Step 3: Snapshot dist contents**

Run: `find dist -type f | sort > /tmp/monorepo-baseline-files.txt && wc -l /tmp/monorepo-baseline-files.txt`
Expected: a number > 0 (file count).

**Step 4: No commit — this is just a baseline.**

---

## Task 2: Create `pnpm-workspace.yaml`

This is the smallest meaningful first step — declare the workspace topology without moving any files yet.

**Files:**
- Create: `pnpm-workspace.yaml`

**Step 1: Write workspace file**

Create `pnpm-workspace.yaml` with this content:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 2: Verify pnpm still installs cleanly**

Run: `pnpm install`
Expected: completes without errors. No new packages found yet (apps/ and packages/ don't exist), but the workspace file is valid.

**Step 3: Confirm build still works**

Run: `pnpm build`
Expected: same "11 page(s) built" output.

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "$(cat <<'EOF'
chore: declare pnpm workspace topology

Empty workspace: apps/* and packages/* scopes, no members yet.
Site files move into apps/site/ in the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Move site files into `apps/site/`

This is the big atomic restructure. Mid-restructure states won't build, so do all moves + new files in one shot before re-running `pnpm install`.

**Files:**
- Create: `apps/site/` (directory)
- Move: `src/` → `apps/site/src/`
- Move: `public/` → `apps/site/public/`
- Move: `scripts/` → `apps/site/scripts/`
- Move: `astro.config.mjs` → `apps/site/astro.config.mjs`
- Move: `tsconfig.json` → `apps/site/tsconfig.json`
- Move: `wrangler.jsonc` → `apps/site/wrangler.jsonc`
- Move: `package.json` → `apps/site/package.json` (then split — see step 4)
- Move: `README.md` → `apps/site/README.md` (will be replaced with monorepo README in Task 5)
- Move: `CLAUDE.md` → `apps/site/CLAUDE.md` (will be replaced with monorepo CLAUDE.md in Task 5)
- Stay at root: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`, `.vscode/`, `.git/`, `.claude/`, `.worktrees/`, `node_modules/` (will be regenerated), build outputs (gitignored)

**Step 1: Make the target directory**

Run: `mkdir -p apps/site`

**Step 2: Move source/config files with `git mv`**

```bash
git mv src apps/site/src
git mv public apps/site/public
git mv scripts apps/site/scripts
git mv astro.config.mjs apps/site/astro.config.mjs
git mv tsconfig.json apps/site/tsconfig.json
git mv wrangler.jsonc apps/site/wrangler.jsonc
git mv package.json apps/site/package.json
git mv README.md apps/site/README.md
git mv CLAUDE.md apps/site/CLAUDE.md
```

After these, `git status --short` should show a list of `R` (renamed) entries.

**Step 3: Edit `apps/site/package.json` — strip root-only fields**

Remove `pnpm.onlyBuiltDependencies` and `overrides` from `apps/site/package.json` (they will move to the new root `package.json` in Step 4). Keep everything else — name, scripts, deps.

The resulting `apps/site/package.json` should look like:

```json
{
  "name": "potnuse",
  "type": "module",
  "version": "0.0.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "generate-types": "wrangler types",
    "deploy": "astro build && wrangler deploy"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^13.1.9",
    "@astrojs/mdx": "^5.0.3",
    "@astrojs/react": "^5.0.3",
    "@types/d3": "^7.4.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "astro": "^6.1.6",
    "d3": "^7.9.0",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "wrangler": "^4.82.2",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "sharp": "^0.34.5"
  }
}
```

Note the new `deploy` script — combines build and wrangler deploy in one command.

**Step 4: Create new root `package.json`**

Create `package.json` (at repo root) with minimal workspace config and proxy scripts:

```json
{
  "name": "rdmontgomry",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "pnpm --filter potnuse dev",
    "build": "pnpm --filter potnuse build",
    "preview": "pnpm --filter potnuse preview",
    "deploy": "pnpm --filter potnuse deploy",
    "generate-types": "pnpm --filter potnuse generate-types"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "sharp",
      "workerd"
    ],
    "overrides": {
      "vite": "^7"
    }
  }
}
```

Note: `overrides` moved from top-level (where it was in the old single-package `package.json`) into `pnpm.overrides`. In pnpm workspaces, the top-level `overrides` field still works, but `pnpm.overrides` is the documented form for workspace roots. Either is fine — using `pnpm.overrides` is slightly more correct.

**Step 5: Clean stale root install state**

Old `node_modules/`, `dist/`, and `.astro/` at root reflect the pre-monorepo structure. Wipe them:

```bash
rm -rf node_modules dist .astro
```

These are all gitignored, so nothing tracked is lost.

**Step 6: Reinstall**

Run: `pnpm install`
Expected: completes without errors. New layout: `node_modules/` at root (hoisted shared deps) and `apps/site/node_modules/` (workspace symlinks).

Verify both exist:
```bash
ls -d node_modules apps/site/node_modules
```

**Step 7: Run build via root proxy**

Run: `pnpm build`
Expected: same "11 page(s) built" output as baseline. Build artifacts now at `apps/site/dist/` (not root `dist/`).

**Step 8: Verify dist artifacts match baseline**

```bash
find apps/site/dist -type f | sort | sed 's|^apps/site/||' > /tmp/monorepo-after-files.txt
diff /tmp/monorepo-baseline-files.txt /tmp/monorepo-after-files.txt
```

Expected: empty diff. Same files in same relative locations.

If diff is non-empty, investigate before committing — something about the move broke a path resolution.

**Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: convert to pnpm monorepo, site at apps/site

Splits the single package.json into a minimal root (workspace config,
pnpm overrides, proxy scripts) and apps/site/package.json (the site's
own deps and scripts). All site source, configs, and scripts move
into apps/site/ via git mv to preserve history.

Build artifacts unchanged: same 11 pages, same dist file tree (now
at apps/site/dist/). Root pnpm scripts (dev, build, preview, deploy,
generate-types) proxy via --filter potnuse, so the daily commands stay
the same from the repo root.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verify dev server (manual smoke check)

Build artifacts equivalence is necessary but not sufficient. The dev server has its own code path.

**Step 1: Start dev server**

Run: `pnpm dev`
Expected: Astro starts, shows "Local: http://localhost:4321/" within ~3 seconds.

**Step 2: Manual click-through**

Open `http://localhost:4321/` in a browser. The site routes random visitors to a content node. Verify:
- The page loads (no blank screen).
- The "rhizome" link in the nav works (`/rhizome`).
- One essay or experiment loads (`/essays/colophon` or `/experiments/ladder`).

If anything 404s or 500s that didn't before, stop and investigate. Likely culprits: stale `.astro/` types pointing at old `src/` paths, or a missed file in the move.

**Step 3: Stop the dev server**

Ctrl-C.

**Step 4: No commit — manual verification only.**

---

## Task 5: Verify wrangler config

We can't actually deploy without the user's say-so, but we can validate the wrangler config compiles.

**Step 1: Dry-run wrangler from site dir**

Run: `pnpm --filter potnuse exec wrangler deploy --dry-run --outdir /tmp/wrangler-dry`
Expected: succeeds, prints something like "Total Upload: ..." and exits 0. No actual deploy happens.

If it fails with a path error, the wrangler config still expects the old `./dist` to exist at root rather than in the site dir. Wrangler resolves `assets.directory` relative to the config file's location, so `wrangler.jsonc` at `apps/site/wrangler.jsonc` with `"directory": "./dist"` should resolve to `apps/site/dist/` correctly.

**Step 2: No commit.**

---

## Task 6: New root `README.md` + new root `CLAUDE.md`

The site's README and CLAUDE.md moved to `apps/site/`. Root needs new ones describing the monorepo as a whole.

**Files:**
- Create: `README.md` (new, describes monorepo)
- Create: `CLAUDE.md` (new, describes monorepo conventions)
- (No edits to `apps/site/README.md` or `apps/site/CLAUDE.md` — they keep their existing site-specific content.)

**Step 1: Write new root `README.md`**

```markdown
# rdmontgomry

Monorepo for projects under the **potnuse** umbrella.

## Workspace layout

```
apps/
  site/                  # rdmontgomery.com — Astro static site, see apps/site/README.md
packages/
  (empty for now — canvas-runtime, widget-protocol, widgets-browser land here)
```

## Commands (run from repo root)

| Command            | Action                                          |
| ------------------ | ----------------------------------------------- |
| `pnpm install`     | Install all workspace deps                      |
| `pnpm dev`         | Start the site dev server (proxies to apps/site)|
| `pnpm build`       | Build the site                                  |
| `pnpm preview`     | Preview the built site                          |
| `pnpm deploy`      | Build + deploy site to Cloudflare Workers       |

## Future work

The canvas-substrate design lives at `docs/plans/2026-04-29-canvas-substrate-design.md`. Implementation lands in `packages/` over subsequent PRs.
```

**Step 2: Write new root `CLAUDE.md`**

```markdown
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
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: add root README and CLAUDE.md for monorepo

Site-specific README and CLAUDE.md remain at apps/site/. The new root
docs describe the workspace as a whole: layout, commands, naming
conventions, where future packages will land.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final sanity pass

**Step 1: Confirm tree state**

```bash
git status --short
```
Expected: empty (everything committed).

**Step 2: Inspect commit log**

```bash
git log --oneline main..HEAD
```
Expected: four commits on top of main:
- `chore: gitignore .worktrees/`
- `docs: design potnuse canvas substrate + morel host`
- `chore: declare pnpm workspace topology`
- `chore: convert to pnpm monorepo, site at apps/site`
- `docs: add root README and CLAUDE.md for monorepo`

(That's five — the design-doc + gitignore commits already landed before this plan started.)

**Step 3: Final build**

```bash
pnpm build
```
Expected: clean build, 11 pages.

**Step 4: Final type generation**

```bash
pnpm generate-types
```
Expected: succeeds. Generates `apps/site/worker-configuration.d.ts`. If this changes the file, that's a real change to commit; if it's identical to what's already on disk, no change.

If it produced changes:
```bash
git add apps/site/worker-configuration.d.ts
git commit -m "chore: regenerate cloudflare types post-monorepo"
```

**Step 5: Done.**

The branch is ready for PR review. The user opens the PR via `gh pr create` (or pushes the branch and uses the GitHub UI).

---

## Out of scope for this PR

- Adding `@rdm/widget-protocol`, `@rdm/canvas-runtime`, or `@rdm/widgets-browser` packages. Those land in milestone 2 with concrete content.
- Renaming the site package from `potnuse` to `@rdm/site`. Possible later — not necessary now and adds churn to imports / wrangler / deploy commands.
- TypeScript project references between packages. There's only one package with code, so references would be premature.
- A shared `tsconfig.base.json` at root. Same reason.

## Failure modes to watch for

- **`scripts/build-og.mjs` referencing `public/`** — the script uses `resolve('public/og-default.svg')`, which is relative to CWD. After the move, the script lives at `apps/site/scripts/build-og.mjs` and will be run with CWD = `apps/site/` (when invoked via pnpm filter), so the relative path still resolves. If you ever invoke it from the root manually, you'd need to `cd apps/site` first. This is *not* a problem to fix in this PR — flag it only if a smoke test catches it.
- **Astro `paths: { "@/*": ["src/*"] }`** — `baseUrl` is `.` and tsconfig now lives at `apps/site/tsconfig.json`, so `@/*` resolves to `apps/site/src/*`. Correct.
- **`tsconfig.json` `include` of `**/*`** — would now match nothing useful inside `apps/site/` if the tsconfig were at root. Since it lives in `apps/site/`, `**/*` matches files there. Correct.
- **pnpm-lock.yaml diff size** — the lockfile regenerates with workspace structure. Diff will be large; that's expected, not a problem.
