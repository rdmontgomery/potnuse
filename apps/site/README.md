# potnuse

Personal site at **rdmontgomery.com**. A rhizome, not a tree — no index, only a door that opens to a random node.

Built with [Astro](https://astro.build) (static output), [React](https://react.dev) islands, and MDX content. Deployed to [Cloudflare Workers](https://workers.cloudflare.com) via static asset serving.

## Structure

```
src/
├── components/          # Astro + React island components
│   └── allons-jouer/    # Cajun accordion app UI
├── content/
│   ├── essays/          # Long-form writing
│   └── experiments/     # Exploratory projects
├── layouts/
├── lib/
│   ├── allons-jouer/    # Accordion app logic, audio, pitch detection
│   └── graph.ts         # Content graph for random navigation
└── pages/
    ├── index.astro      # The door (random node entry point)
    ├── allons-jouer.astro
    ├── graph.json.ts    # Graph data endpoint (baked at build time)
    └── [collection]/[...slug].astro
```

## Commands

| Command              | Action                                   |
| :------------------- | :--------------------------------------- |
| `pnpm install`       | Install dependencies                     |
| `pnpm dev`           | Start local dev server at localhost:4321 |
| `pnpm build`         | Build static site to `./dist/` (within this directory; `apps/site/dist/` from repo root) |
| `pnpm preview`       | Preview the build locally                |
| `pnpm generate-types`| Regenerate Cloudflare Worker types       |

## Deploy

From the repo root:

```sh
pnpm deploy   # builds the site and runs wrangler deploy against the root wrangler.jsonc
```

Static files in `apps/site/dist/` are served directly by Cloudflare Workers assets — no server Worker script is needed. The `wrangler.jsonc` at the repo root configures the assets binding (`assets.directory: "./apps/site/dist"`); it lives at root rather than alongside the site because Cloudflare's CI invokes wrangler from the workspace root.

## Content model

Each piece of content carries:
- `state` — `seedling` | `germinating` | `stable` | `fossil`
- `connects` — list of slugs this node links to (used for graph edges)
- `tags`, `date`, `description`
