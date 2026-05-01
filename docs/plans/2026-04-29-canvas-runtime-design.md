# `@rdm/canvas-runtime` package — design

Date: 2026-04-29
Status: design (pre-implementation)
Milestone: 3 of N (canvas substrate roadmap)

## What this is

The engine. `@rdm/canvas-runtime` is the package that loads `@rdm/widget-protocol` manifests, mounts iframe (and eventually native) widgets into draggable, resizable windows on a pan/zoomable canvas, brokers capability requests between widgets and providers, and persists the layout through a pluggable adapter. It is the first piece of the substrate that *runs* — every later milestone (browser widgets, the site `/playground` page, morel host integration, the Tauri shell) plugs into the API this package defines.

It is deliberately **engine-only** for v1: no actual capability providers, no site integration, no widget content beyond a tiny self-hosted demo widget. Capabilities live with their providers (clipboard with `widgets-browser`, fs/pty with `morel`); this package only brokers.

## Goals and non-goals

**Goals**

- Pan/zoom canvas with windowed widgets that can be moved and resized.
- Iframe widget loading via the documented MessageChannel handshake; no real iframes shouldn't sneak past the protocol.
- Capability brokering: receive a `req` from a widget, route by manifest declaration + provider registry, race against a timeout, return a `res`.
- Pluggable persistence: one blob per canvas, with a `localStorage` adapter shipped by default.
- Lifecycle management including suspend/resume on offscreen.
- React surface for consumers (`<Canvas>`, hooks); business logic in plain TS modules so a future Solid/Svelte port doesn't require a rewrite.
- Self-hosted example HTML demo for local verification.

**Non-goals (for now)**

- Capability providers themselves (clipboard, fs, pty, llm, etc.). Those ship with the packages or services that own them.
- Site integration. The `/playground` page is its own milestone.
- Native widget loading. Manifest's `kind: "native"` is accepted by the protocol but produces a clear "not implemented in v1" error in this package's loader. Lands with `widgets-browser`.
- Selection, multi-select, drag-to-rearrange-stacking, snap-to-grid, undo/redo, context menus, custom keyboard shortcuts beyond browser defaults, touch gestures beyond mouse + trackpad pinch.
- Theming system. CSS variables for color/border/etc., consumer overrides them, no `<ThemeProvider>`.
- Animations beyond CSS defaults.

## Package shape

**Location:** `packages/canvas-runtime/` in the existing pnpm workspace.
**Name:** `@rdm/canvas-runtime`. Workspace-internal; not published to npm in v1.

**Stack:**
- TypeScript 5.x, ESM-only, built with `tsc`. No bundler.
- React 19 (peer dep, matches `apps/site`).
- Zustand 5 (peer dep, already in workspace).
- `@rdm/widget-protocol` as a workspace dep (`"workspace:*"`).
- Dev: `vitest` (workspace-root), `happy-dom`, `@testing-library/react`, `vite` for the example dev server.

**Internal architecture: business logic in plain modules, React is the renderer.** The discipline is "no business logic inside JSX." Pan/zoom math, drag math, layout-state diffing, capability dispatch, lifecycle state machine — all live in `src/core/` as pure functions or pure store reducers. The `src/react/` directory is the integration layer; it never embeds calculations.

```
packages/canvas-runtime/src/
  core/                      # framework-agnostic
    document.ts              # CanvasDocument shape, constructors, helpers
    viewport.ts              # pan/zoom math, screen↔canvas coords
    drag.ts                  # drag/resize math (deltas → new x/y/w/h)
    layout.ts                # axis-aligned bbox, offscreen detection
    lifecycle.ts             # state machine using widget-protocol's VALID_TRANSITIONS
    handshake.ts             # iframe MessageChannel handshake
    dispatch.ts              # capability request routing + timeout race
    persistence.ts           # adapter interface + debounced save loop
    adapters/
      localStorage.ts        # default adapter
  store/
    canvasStore.ts           # zustand store wiring core/* + persistence
  react/
    Canvas.tsx               # the top-level component
    WidgetWindow.tsx         # one window's chrome + <iframe>
    hooks.ts                 # useCanvas, useWidget, useViewport
  index.ts                   # barrel
example/
  index.html
  main.tsx
  widget.html
```

`example/` is NOT shipped in `dist/` (not in `package.json` `files`). It exists for local `pnpm dev` and as a reference reviewers can read.

**Public surface (v1 barrel + subpath exports):**
- `.` (barrel) — `Canvas`, `WidgetWindow`, hooks, types
- `./adapters` — `localStorageAdapter()` factory
- `./core` — testable internals (mostly used by the package's own tests, but exported because someone might want to drive the canvas headlessly)

## Core data model

```ts
import type { WidgetManifest, WidgetLifecycleState } from '@rdm/widget-protocol';

export type CanvasDocument = {
  schemaVersion: 1;
  viewport: { panX: number; panY: number; zoom: number };
  widgets: Array<{
    instanceId: string;            // ulid
    manifest: WidgetManifest;       // full manifest, embedded
    x: number; y: number;           // top-left in canvas coords
    w: number; h: number;
    state?: unknown;                // widget's own state, opaque
    lifecycle: WidgetLifecycleState; // runtime; persisted as 'ready' on reload
  }>;
};
```

The whole document is one persistence blob. On reload, `lifecycle` snaps back to `loading`; the canvas walks each widget through the handshake again. This is per the substrate design's "single blob per canvas" decision (Question 4 in the brainstorm).

## Iframe handshake and widget lifecycle

**Mount flow** when the canvas instantiates a widget:

1. Generate `instanceId`, push the widget into the store with `lifecycle: 'loading'`.
2. Render a `<WidgetWindow>` containing a positioned `<iframe>` with `src = manifest.entry`, `sandbox="allow-scripts"` (we add `allow-same-origin` only if a manifest opts in via a future field; v1 stays strict).
3. On the iframe's `load` event, `core/handshake.ts` runs:
   - Create a `MessageChannel`.
   - `iframe.contentWindow.postMessage({ rdm: 'init', protocolVersion: 1, instanceId, manifestId: manifest.id }, new URL(entry).origin, [channel.port2])`.
   - Hold `channel.port1` as the canvas-side end.
   - `port1.start()` and set `port1.onmessage` to feed `core/dispatch.ts`.
4. Widget's onboarding code (documented):
   - Listens for `'message'` on `window`, filters for `data.rdm === 'init'`.
   - Grabs `event.ports[0]`.
   - Tears down the window listener.
   - Posts `{ type: 'event', name: 'lifecycle.ready', payload: {} }` over the new port.
5. Canvas sees `lifecycle.ready` → transitions widget to `ready`. If currently in viewport, immediately to `active`.

**Handshake timeout:** if no `lifecycle.ready` arrives within 10s (configurable per canvas), transition to `unloaded`, post a `widget.failedToLoad` event into the store, render an error chip in the window's title bar.

**Suspend/resume on offscreen:** every viewport change runs an axis-aligned bounding-box check against each widget's `(x, y, w, h)` against the visible viewport rect. Fully-offscreen widgets receive an `event lifecycle.suspend` over their port and transition to `suspended`. The iframe stays mounted (cheap to keep around); the widget is expected to throttle or pause its own internals on receiving suspend. Coming back into view sends `lifecycle.resume`.

**Unmount:** `unloaded` removes the iframe, closes the port, removes the widget from the store, persists.

**One widget = one iframe.** No iframe sharing. Sandbox guarantees stay clean and a widget crash doesn't take others down. The cost is N iframes for N widgets — exactly the scaling pressure the HTML-in-Canvas escape valve is reserved for.

## Capability dispatch

```ts
export type CapabilityCtx = {
  instanceId: string;
  manifestId: string;
  signal: AbortSignal;
  log: (level: 'info' | 'warn' | 'error', msg: string, meta?: unknown) => void;
};

export type CapabilityHandler =
  (params: unknown, ctx: CapabilityCtx) => Promise<unknown>;

export type Provider = Record<string, CapabilityHandler>; // method name → handler

export type DispatchResult =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: string; message: string; data?: unknown } };
```

**Pure dispatch fn** (testable without React, iframes, or zustand):

```ts
export async function dispatch(
  req: Request,
  manifest: WidgetManifest,
  providers: ReadonlyMap<string, Provider>,
  defaultTimeoutMs: number,
  ctx: CapabilityCtx,
): Promise<DispatchResult>;
```

**Order of checks** (each returns a clean error code):

1. **Manifest declaration.** Is `req.method` in `manifest.capabilities` (or does any declared capability prefix-match for sub-namespaced methods)? If not → `capability/denied`. **No provider lookup.** The manifest is the ACL.
2. **Provider registered.** Domain split on first dot; provider exists? If not → `capability/unavailable`.
3. **Method on provider.** Method exists on the provider object? If not → `method/unknown`.
4. **Run handler.** `Promise.race` between the handler call and a timeout (default 30s, override per canvas init). Resolve → `{ ok: true, result }`. Reject → `provider/error` with thrown message. Timeout → `provider/timeout` (and call `ctx.signal.abort()` so well-behaved handlers can clean up).

**Runtime layer** wraps the pure dispatch:

```ts
port.addEventListener('message', async (event) => {
  const parsed = ProtocolMessageSchema.safeParse(event.data);
  if (!parsed.success) {
    // Malformed envelope: best we can do is log; no envelope id to reply to.
    return;
  }
  const msg = parsed.data;
  if (msg.type !== 'req') return; // res/event from widget routed elsewhere
  const result = await dispatch(msg, widget.manifest, providers, timeout, ctx);
  port.postMessage(result.ok
    ? { type: 'res', id: msg.id, outcome: 'ok', result: result.result }
    : { type: 'res', id: msg.id, outcome: 'err', error: result.error });
});
```

**Error codes (v1 conventions, free strings, documented in README):**
- `envelope/invalid` — schema parse failed
- `capability/denied` — manifest didn't declare it
- `capability/unavailable` — no provider for the domain
- `method/unknown` — domain has provider but no handler for that method
- `provider/error` — handler threw
- `provider/timeout` — handler exceeded the timeout

## Persistence

```ts
export type PersistenceAdapter = {
  load(scope: string): Promise<unknown | null>;
  save(scope: string, doc: unknown): Promise<void>;
  subscribe(scope: string, cb: (doc: unknown) => void): () => void;
};

export type PersistedSnapshot = {
  schemaVersion: 1;
  viewport: { panX: number; panY: number; zoom: number };
  widgets: Array<{
    instanceId: string;
    manifest: WidgetManifest;
    x: number; y: number; w: number; h: number;
    state?: unknown;
  }>;
};
```

The adapter is generic (stores `unknown`); canvas-runtime is responsible for shaping the snapshot. `lifecycle` is **runtime-only**, omitted from the persisted snapshot.

**Save loop:** zustand subscription → debounced 250ms → `adapter.save(canvasId, snapshot)`. The debouncer is in `core/persistence.ts` and is itself a pure function over (clock, debounceMs, callback).

**`localStorageAdapter`** (default):
- `load`: `JSON.parse(localStorage.getItem('rdm.canvas:' + scope))`, returns `null` if absent.
- `save`: `localStorage.setItem(...)`.
- `subscribe`: listens to `'storage'` events on `window`, fires the callback when the relevant key changes from another tab.

## React API

```tsx
import { Canvas } from '@rdm/canvas-runtime';
import { localStorageAdapter } from '@rdm/canvas-runtime/adapters';

<Canvas
  canvasId="default"
  adapter={localStorageAdapter()}
  providers={{}}             // domain → Provider; empty in v1
  defaultTimeoutMs={30_000}
  initialWidgets={[]}        // optional seed manifests for first load
  onError={(e) => console.warn(e)}
/>
```

`<Canvas>` owns:
- A zustand store, one per `canvasId` (memoized).
- Pan/zoom event handling on the root `<div>` (wheel for zoom around cursor, space-or-middle-mouse for pan).
- The persistence loop (debounced 250ms after the last change).
- The widget windows.

**Hooks (escape hatches):**

```ts
useCanvas(canvasId): { document, addWidget, removeWidget, ... }
useWidget(canvasId, instanceId): { widget, sendEvent }
useViewport(canvasId): { panX, panY, zoom, panTo, zoomTo }
```

Used by overlay UIs (toolbar, mini-map, "add widget" dialog). None ship in v1; the hooks are exported so the site `/playground` page can build a toolbar in its own milestone.

## Window chrome

- **Title bar** — shows `manifest.name ?? manifest.id`. Drag handle (whole title bar). A small lifecycle dot (`loading`/`active`/`suspended`/error). A close button → `lifecycle: 'unloaded'`.
- **Resize from the bottom-right corner only** — 12×12 grab handle. Edges aren't resize handles in v1 (cleaner hit-testing). Revisit if anyone misses it.
- **No minimize, no maximize.** Suspend-on-offscreen handles "out of view." If a widget needs full-canvas attention, panning to it works.
- **Default styles** via CSS variables (`--rdm-canvas-bg`, `--rdm-window-border`, `--rdm-titlebar-fg`, etc.). Consumer overrides; no `<ThemeProvider>`.
- **Click moves widget to top of stack** (z-index). The store tracks an `activeOrder: string[]` (instanceIds) for this — minor, but it's a real UX expectation.
- **No focus management beyond the browser default.** Tab moves focus into the iframe.

## Testing strategy

- **Unit tests** for `core/*` — pan/zoom math, drag math, lifecycle state machine, capability dispatch, layout offscreen detection, persistence debouncer. Pure functions or pure store reducers. Vitest, fast, no DOM.
- **Integration tests** for the iframe handshake using `MessageChannel` directly — no real iframe needed. A test "widget" is a closure that holds `port2`; the canvas's `core/handshake.ts` runs against `port1`. Verifies init→ready→active flow, suspend/resume, dispatch round-trip.
- **DOM-aware tests** for `<WidgetWindow>` drag/resize using `happy-dom` + `@testing-library/react`. Verifies pointer events update store positions and persistence fires.
- **Manual e2e** is the example HTML, opened in a real browser. Not automated in v1.

Roughly: 60-80 tests in `core/`, 10-15 in `react/`, 5-10 integration. The bulk lives in pure modules.

## Self-hosted demo

`packages/canvas-runtime/example/`:
- `index.html` — loads `main.tsx` via Vite dev server.
- `main.tsx` — instantiates `<Canvas>` with two manifests pointing at `./widget.html` (different `instanceId`, same widget code).
- `widget.html` — ~50 lines of standalone HTML: handshake on `'message'`, posts `lifecycle.ready`, renders "I am widget {instanceId}", a button that posts an `event widget.clicked` over the port.

Run with `pnpm --filter @rdm/canvas-runtime dev` against `example/`. Demo URL: `localhost:5173`.

## Workspace changes

- New: `packages/canvas-runtime/`.
- Root `package.json`: no new scripts. The existing `pnpm test` discovers `packages/*/src/**/*.test.ts`.
- Root devDeps: `happy-dom`, `@testing-library/react`, `vite` (for the example dev server). All hoist.
- `pnpm-workspace.yaml`: unchanged.
- `apps/site/`: unchanged. No integration in v1.

## What's not in this PR (and where it lands)

- Real capability providers (clipboard, fs, pty, llm) — `widgets-browser` for browser-only caps; `morel` for host caps.
- Site `/playground` page — its own milestone, probably bundled with the first `widgets-browser` shipment.
- Native widget loader — `widgets-browser` ships first native widgets and the resolver.
- A widget client lib (`@rdm/widget-client`) — punted until the first widget says "writing the handshake by hand is annoying." The first widget in `widgets-browser` will tell us.
- Tauri-injected `os.*` capabilities — separate desktop-shell milestone.
- HTML-in-Canvas integration — future option once the API stabilizes outside Chromium-flagged.

## Future doors kept open

- The `kind: "native"` branch is wired in the protocol; canvas-runtime's loader is a stub today and grows when widgets-browser arrives.
- Per-method timeout/metadata moves from "default per canvas" to "per provider method" by allowing a provider entry to be either a function or `{ handler, timeoutMs }`. Backwards-compatible.
- Selection, undo/redo, snap-to-grid, mini-map — all overlay UIs that consume the public hooks; they don't need changes inside `<Canvas>` itself.
- A second persistence adapter (`morel-sqlite`, `worker-do`) drops in via the `PersistenceAdapter` interface without touching the runtime.
