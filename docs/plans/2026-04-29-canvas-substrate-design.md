# potnuse canvas substrate — design

Date: 2026-04-29
Status: design (pre-implementation)

## What this is

A browser-based infinite-canvas dashboard whose only opinion is that *widgets are the point*. The canvas is infrastructure: pan, zoom, place windows, persist layout. Everything interesting — terminals, Claude Code sessions, file explorers, drawing surfaces, custom HTML toys — is a widget.

The substrate is named **potnuse** (already the umbrella concept, the name of the site, and the package name). The long-running server that owns terminals, the filesystem, and other OS-attached resources is named **morel**, after the perpetual-host machine in Bioy Casares' *La invención de Morel*.

## Goals and non-goals

**Goals**

- A tinkering platform with unknown ceiling — adding a new widget type should be cheap enough to do for a single evening's experiment.
- Long-term productivity: terminal sessions and Claude Code processes survive browser reload, laptop sleep, and tab close. You attach and detach; the work doesn't notice.
- Reachable from a laptop or iPad on the tailnet, with deep OS integration on the primary machine.
- Demoable on rdmontgomery.com — the substrate itself, plus a curated palette of browser-only widgets, with no home box involved.

**Non-goals (for now)**

- Multi-user collaboration. Single user, one tailnet, one filesystem.
- Public internet exposure of the home host.
- A drawing-tool product. Sketching is a widget (Excalidraw, tldraw), not a built-in feature of the canvas.

## Architecture

```
                 ┌─────────────────────────────────────────┐
                 │  Frontend bundle  (canvas-runtime)       │
                 │  ┌──────────────────────────────────┐   │
                 │  │ pan/zoom, window chrome,          │   │
                 │  │ capability hub, layout state      │   │
                 │  └─────┬────────────────────┬───────┘   │
                 │        │ MessagePort        │           │
                 │  ┌─────▼──────┐    ┌────────▼────────┐  │
                 │  │ iframe     │    │ native widgets  │  │
                 │  │ widgets    │    │ (1st-party,     │  │
                 │  │ (sandbox)  │    │  React)         │  │
                 │  └────────────┘    └─────────────────┘  │
                 └────────────────┬────────────────────────┘
                                  │  WebSocket (capability RPC)
                 ┌────────────────▼────────────────────────┐
                 │  morel  (separate repo)                  │
                 │  pty • fs • llm • sessions • SQLite      │
                 └──────────────────────────────────────────┘
```

### Three boundaries

1. **Canvas ↔ Widget** — postMessage over a per-widget `MessagePort`. Strictly typed. Same shape for iframe widgets and native React widgets; the canvas runtime hands a `port` to both.
2. **Frontend ↔ morel** — WebSocket carrying capability RPC and session-attach messages. *Optional.* If absent, the canvas loads with `capabilities: []` and any widget needing more is grayed out with a "needs local host" pill.
3. **Persistence adapter ↔ store** — small interface (`load(scope)`, `save(scope, doc)`, `subscribe(scope, cb)`). Three implementations day one: `localStorage`, `morel-sqlite`, and a stub for `worker-do` later.

### Three deployment topologies, one frontend

| Topology | Shell | Host | Adapter | Widget palette |
|---|---|---|---|---|
| Home install | Tauri | morel, same box | `morel-sqlite` | full |
| Tailnet remote | browser | morel over TLS | `morel-sqlite` | full |
| Site demo | browser | none | `localStorage` | browser-only |

The frontend doesn't branch on which one — it asks the injected persistence adapter and capability registry at boot. The site and the home box run the same `canvas-runtime` build.

## Widget protocol

Every widget ships a manifest:

```json
{
  "id": "rdm.widget.markdown-editor",
  "version": "0.3.0",
  "kind": "iframe",
  "entry": "https://widgets.rdm.dev/markdown/index.html",
  "capabilities": ["fs.read", "fs.write"],
  "default-size": { "w": 480, "h": 360 }
}
```

Widgets never talk to morel directly. They request capabilities; the canvas brokers. That is what keeps iframe sandboxing meaningful and what lets the same widget run unchanged across topologies.

### Wire shape

JSON envelopes over the MessagePort. Three message kinds:

- `req` (widget → canvas): `{ id, method, params }` — RPC into a capability.
- `res` (canvas → widget): `{ id, result | error }` — reply.
- `event` (either direction): unsolicited — resize notifications, state-changed notifications.

### Lifecycle

`loading → ready → active ⇄ suspended → unloaded`. Offscreen widgets can be suspended by the canvas; that is how the platform scales to dozens of widgets without melting the CPU.

### State ownership

Widgets *produce* state, the canvas *persists* it through the adapter. Widgets never write storage themselves. Same widget, different topologies, different stores — no widget code change.

## Session and process model

The promise: close your tab, terminals keep running, you reconnect and reattach. morel plays the tmux role.

When a widget calls `pty.spawn({ shell, cwd })`, morel:

1. Creates a PTY with `node-pty`.
2. Wraps it in a session record — `{ sessionId, kind: "pty", createdAt, ringBuffer, subscribers }`.
3. Stores the session in an in-memory registry, with metadata in SQLite.
4. Returns the `sessionId` to the widget.

The widget stores `sessionId` in its persisted state. That is the only thing it needs to reattach. Output is mirrored into a bounded ring buffer (≈ 1 MB per session) — that is the scrollback that survives reload.

### Reattachment flow

On boot, the frontend asks the persistence adapter for layout, gets back N widgets each with their state. Each terminal widget calls `pty.attach(sessionId)`. morel either replays the ring buffer and resumes streaming, or returns `gone` (host restarted) and the widget shows "session ended, click to start fresh."

### Claude Code is a special PTY

`claudeCode.spawn({ cwd, prompt? })` returns a `sessionId`; the same attach/detach logic applies. Multiple concurrent Claude Code sessions are just multiple PTYs.

### What dies when

Sessions die when (a) explicitly closed, (b) morel restarts, or (c) a sweeper reaps sessions older than N days with no subscribers. No magic.

## Desktop shell, auth, deployment

### Tauri, not Electron

Lighter (system webview, ~3-5 MB binary), stricter security default, which matches a substrate that runs arbitrary widgets. The frontend is the same web bundle; Tauri exposes OS-integration capabilities — `os.globalHotkey`, `os.notify`, `os.tray`, `os.dragIn`, `os.openWith` — into the same capability registry. A widget that wants global hotkeys declares the capability and gets it on desktop, falls back gracefully in the browser.

morel runs as a sibling process, not inside Tauri. Tauri talks to it over the same WebSocket the browser would use. That is what keeps tailnet remote access working with no special path.

### Auth tiers, smallest scope first

1. **localhost-only** (default). Tauri and same-machine browsers work; nothing else can reach it.
2. **Tailscale-only** mode. morel binds to its tailnet IP, presents a Tailscale-issued TLS cert, trusts any device on the tailnet.
3. **Token mode**. Bearer token in the WS handshake; tokens generated out of band.

Start at #1; layer #2 when remote access actually matters; treat #3 as the escape hatch.

### Deployment topology

- **Home box (WSL2 / Linux server):** `morel` daemon under systemd. Owns SQLite, PTYs, FS access.
- **Tauri app on the primary machine:** boots, connects to local morel.
- **rdmontgomery.com:** static frontend with `localStorage` adapter and the browser-only widget palette. No host. No auth.
- **Optional later:** a Cloudflare Worker + Durable Object as a "lite morel" that serves `llm.complete` (proxying the Anthropic API), enabling a real Claude *chat* widget on the site without exposing the home box.

## Repository structure

Monorepo inside `rdmontgomry` with package boundaries from day one. pnpm workspaces. Separate repo for morel.

```
rdmontgomry/                       (this repo, expanded into a monorepo)
  pnpm-workspace.yaml
  apps/
    site/                          (the current Astro site)
  packages/
    widget-protocol/               (postMessage schema, capability types)
    canvas-runtime/                (pan/zoom, window chrome, layout)
    widgets-browser/               (Excalidraw, markdown, calc, etc.)

morel/                             (separate repo)
  src/                             (Node or Bun; pty, fs, llm, sessions)
  depends on widget-protocol via git or url dep until ever published
```

The site imports `@rdm/canvas-runtime` and `@rdm/widgets-browser` like any other consumer. Single-commit changes across boundaries are possible; the boundaries themselves prevent the canvas from quietly reaching into site internals. When something stabilizes, `git filter-repo --subdirectory-filter packages/<x>` extracts a clean standalone repo with full history.

## Demo modes on rdmontgomery.com

Lowest to highest effort:

1. **Inline single widget in MDX.** `<Widget src="..." />` Astro component, just an iframe with the known protocol. Drop one into an essay. Zero substrate.
2. **Embedded mini-canvas in an experiments page.** Small React island, a few browser-only widgets, layout in localStorage. Sweet spot for "this is what I'm building" posts.
3. **Full `/playground` page.** Whole substrate, browser-only widget palette, optional Worker-backed Claude chat widget.
4. **Live writeup with both.** An `experiments/` entry that *contains* a mini-canvas. Maximally on-brand.

## Open future doors, do not depend on them

### HTML-in-Canvas

The WICG `drawElementImage` / `texElementImage2D` proposal is real and shipping behind a flag in Chromium 146+ (origin trial M148–M151). It keeps DOM interactivity intact while letting the browser render subtrees through the canvas pipeline — which would make pan/zoom buttery at large widget counts, and 3D effects possible.

Caveats:

- Chromium-only behind a flag. No Safari, no iPad.
- Iframe children are not in scope — the proposal targets element subtrees the page controls. So this benefits *native* widgets, not iframe widgets.

Implication: keep the rendering layer behind a thin abstraction (a `WidgetWindow` component that takes position, size, and content). Swapping a native widget from CSS-transform positioning to canvas-rendered subtree should be a one-day refactor when the API matures, not a one-month one.

## What we are not deciding now

- Drawing tools as a built-in (we are using Excalidraw / tldraw as widgets instead).
- Multi-user / CRDT sync.
- A widget marketplace. (The capability + manifest model leaves the door open; we do not need to walk through it now.)

## First implementation milestones

These are sketched, not committed — a `writing-plans` pass should turn each into ordered tasks.

1. **Monorepo conversion.** Split the current `rdmontgomry` repo into `apps/site/` + empty `packages/`. Verify `pnpm dev`, `pnpm build`, `wrangler deploy` still work unchanged.
2. **`widget-protocol` package.** Manifest schema, RPC envelope types, capability registry types. Pure types and zod schemas; no runtime.
3. **`canvas-runtime` package, browser-only first.** Pan/zoom on a CSS-transformed div, draggable/resizable iframe windows, MessagePort wiring, localStorage persistence adapter. No host yet.
4. **`widgets-browser` starter set.** Two widgets to prove the protocol: a markdown editor (state ownership, persistence) and an Excalidraw embed (third-party iframe, no state). Both pure-static.
5. **`/playground` page on the site.** First demo of (3) + (4).
6. **`morel` repo bootstrap.** Node/Bun service. WS endpoint. PTY capability. SQLite session registry. Bound to localhost only.
7. **Terminal widget (native).** First widget to consume a host capability. Validates reattachment semantics.
8. **Tauri shell.** Wraps the frontend, connects to local morel, exposes one OS capability (`os.notify`) to prove the integration path.
9. **Claude Code widget.** A `claudeCode.spawn` capability in morel and a widget that uses it. The first piece of "the dream" working end to end.
10. **Tailnet mode for morel.** Layer in Tailscale TLS and remote access.
