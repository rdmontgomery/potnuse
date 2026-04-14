# potnuse — foundation handoff

**Date:** 2026-04-14
**State:** files on disk. nothing verified to run yet.
**Next session starts here.**

---

## what's decided

- **Shape:** garden (one continuous organism, frame is part of the work) with traces of workshop-open (visible unfinished state, ship before polish).
- **Structure:** Deleuzian **rhizome** — graph IA, not tree. Every node connects laterally. No canonical path. Door at `/`, no sitemap, no nav.
- **Stack:** Astro 6 static · React islands (`client:only="react"`) · MDX for prose · Zustand for island-local state · pnpm · strict TypeScript · deploys to Cloudflare Pages as pure static (no adapter active).
- **Repo name:** `potnuse` (wife's partially-public nickname) — public face is `rdmontgomery.com`.
- **Domain:** `rdmontgomery.com` already purchased on Cloudflare (2026-04-14).
- **First resident:** `allons-jouer` (Cajun accordion teaching app), lift-and-shifted from `~/projects/rahdoht/`.
- **Deferred to round 2:** a live **Toner-Tu** map at `/map` — pages as particles, edges as alignment interactions, the site becomes an in-vivo instance of the memory research program. Door stays the door.

## what's on disk (written, unverified)

```
~/projects/rdmontgomry/
├── astro.config.mjs         # react() + mdx(), no adapter (static build)
├── package.json             # name: potnuse, pnpm.onlyBuiltDependencies: [esbuild, sharp, workerd]
├── tsconfig.json            # strict, paths: @/* -> src/*
├── wrangler.jsonc           # left over from `astro add cloudflare`; harmless, will matter later
├── .gitignore
├── README.md
├── docs/plans/2026-04-14-foundation-handoff.md    # (this file)
└── src/
    ├── content.config.ts                  # Zod schema for nodes
    ├── content/
    │   ├── essays/colophon.mdx            # first seedling, connects to allons-jouer
    │   └── experiments/.gitkeep
    ├── lib/
    │   ├── graph.ts                       # buildGraph(), getBacklinks(), getForwardLinks(), getNode()
    │   └── allons-jouer/ (…)              # lifted from rahdoht, includes pitchDetection.worker.ts
    ├── components/
    │   ├── Backlinks.astro                # renders forward + back neighbors at foot of any node
    │   ├── StateBadge.astro               # seedling / germinating / stable / fossil
    │   └── allons-jouer/ (…)              # lifted from rahdoht
    ├── layouts/Base.astro                 # html shell, font vars, dark palette from K tokens
    └── pages/
        ├── index.astro                    # the door — single sigil, click → random graph node
        ├── allons-jouer.astro             # mounts <App client:only="react" /> + Backlinks
        ├── graph.json.ts                  # emits whole graph as JSON (prerender=true)
        └── [collection]/[...slug].astro   # renders any essay or experiment
```

### content graph schema

Frontmatter on every MDX node:

```yaml
title: string
date: YYYY-MM-DD (optional)
state: seedling | germinating | stable | fossil   # default: seedling
connects: [slug, slug, …]                         # default: []
tags: [string]                                    # default: []
description: string (optional)
```

`connects:` can reference another MDX node's slug OR a static-page slug (e.g. `allons-jouer`). Static pages are declared in `STATIC_NODES` in `src/lib/graph.ts` — add to that array for any new top-level page that should participate in the graph.

## first moves in next session (in order)

1. **Load memory** — `MEMORY.md` index is at `~/.claude/projects/-home-rdmontgomery-projects-rdmontgomry/memory/MEMORY.md`. `user_calibration.md` is authoritative for register; `project_rdmontgomery_vision.md` has the rhizome/garden frame.

2. **Verify the foundation builds.** Nothing has been run yet. From `~/projects/rdmontgomry/`:
   ```bash
   export PATH="/home/rdmontgomery/.nvm/versions/node/v22.19.0/bin:$PATH"
   pnpm install
   pnpm build
   ```
   Expect at least one error — the allons-jouer port is a React tree with Web Audio, Web Worker, localStorage-via-zustand-persist. It was clean of Next.js imports but not exercised under Astro's Vite. Fix errors as they surface.

3. **Dev server sanity check.**
   ```bash
   pnpm dev    # localhost:4321
   ```
   Three paths must work:
   - `/` — door page renders; clicking the sigil navigates to a random node (today: `/allons-jouer` or `/essays/colophon`).
   - `/allons-jouer` — accordion app mounts, all five screens load (home / freeplay / lesson / reference / tuner). Mic permission prompt is fine; you don't need to grant it for a smoke test.
   - `/essays/colophon` — MDX renders, `<StateBadge>` shows "seedling", `<Backlinks>` shows "Allons jouer" under "connects to".

4. **Git init + first commit + push.**
   ```bash
   git init
   git add .
   git commit -m "foundation: astro + react islands + content graph + allons-jouer port"
   gh repo create potnuse --public --source=. --push
   ```
   (Or `--private` if Rick wants it private while it's raw.)

5. **Wire Cloudflare Pages (Rick does this in the dashboard).**
   - Pages → Create project → Connect to Git → select `potnuse` repo.
   - Framework preset: **Astro**.
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Environment variables: `NODE_VERSION=22`
   - After first successful deploy, Custom domains → add `rdmontgomery.com` (DNS is already in CF). Add `www` too if desired.

## known risks / things I didn't verify

- **`pnpm build`** has never been run on this project. All typing assumed, none checked.
- **`client:only="react"`** on allons-jouer should prevent SSR-time `window`/`localStorage`/`AudioContext` access. Untested.
- **Web Worker path** in `useMic.ts` uses `new Worker(new URL('./pitchDetection.worker.ts', import.meta.url))` — Vite-native pattern, should work, untested here.
- **Google Fonts via `<link>`** in `Base.astro` is the fast-to-ship choice but not self-hosted. If we care about offline/CLS/Cloudflare edge caching, swap to local fonts later.
- **`src/content.config.ts`** is the Astro 5/6 canonical location. If Astro 6 actually expects `src/content/config.ts`, move it. Easy fix if the build complains.
- **Cloudflare adapter** was installed by `astro add cloudflare` but is NOT active in `astro.config.mjs` — we're shipping static. Adapter + wrangler stay as deps for when the first Worker route (agentic tooling) arrives.
- **Tests** from `rahdoht/` (`*.test.ts` files in `src/lib/allons-jouer/`) were copied along. No test runner is configured here. Either wire up Vitest or strip the test files. Defer.
- **Package script `generate-types: wrangler types`** was injected by the cloudflare adapter. Not needed until we use Workers; leaving it.
- **`src/styles/` directory exists but is empty.** All styles are currently in component `<style>` blocks or in `Base.astro`'s `<style is:global>`.

## shell gotcha

Every Bash tool call in this repo needs:
```bash
export PATH="/home/rdmontgomery/.nvm/versions/node/v22.19.0/bin:$PATH"
```
before `node`, `pnpm`, or `corepack`. The nvm shim doesn't propagate across tool invocations. (Could be fixed by dropping an `.envrc` with direnv, or by adding this to shell profile more robustly. Low priority.)

## deferred to future rounds

- `/map` — live Toner-Tu sim of the content graph (pages as particles, edges as alignment). Plan: consume `/graph.json`, render with Canvas/WebGL, include it as a second way in from the door.
- Real door object — current sigil is a crude concentric-rings SVG placeholder. Swap for a sentence / Borgesian fragment / Spare sigil when Rick picks.
- Ports from rahdoht: `wassies` (calculator), `palimpsest` (NFT minting + Web3), `smoke` (?). Each is a separate experiment node, separate decision about whether to lift-and-shift React or rewrite as Astro-native.
- Agentic tooling experiments — re-add `adapter: cloudflare()`, flip to `output: 'server'` (or per-route `prerender = false`), use Workers + Durable Objects + AI bindings.
- The flocking-Malthusian memory system — ongoing research thread; could become a live experiment node that's also the agentic memory driving site-level behavior.
- Tests: decide whether to wire Vitest or delete the `.test.ts` files copied from rahdoht.

## what to push back on

If next-session Claude (or Rick) is tempted to add Tailwind, a CMS, a UI library, or a second page framework before verifying the build works — push back. The foundation doesn't need any of those to ship a first commit. Ship first, add when something actually demands it.
