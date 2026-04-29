# rdmontgomry

Monorepo for projects under the **potnuse** umbrella.

## Workspace layout

    apps/
      site/                  # rdmontgomery.com — Astro static site, see apps/site/README.md
    packages/
      (empty for now — canvas-runtime, widget-protocol, widgets-browser land here)

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
