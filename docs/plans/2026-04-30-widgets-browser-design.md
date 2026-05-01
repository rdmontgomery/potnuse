# `@rdm/widgets-browser` package — design

Date: 2026-04-30
Status: design (pre-implementation)
Milestone: 4 of N (canvas substrate roadmap)

## What this is

The first browser-only widget collection. `@rdm/widgets-browser` ships three iframe widgets, two capability providers, and the manifest builders consumers use to wire them up. It's the package that turns `@rdm/canvas-runtime` from "a clever engine with no widgets" into "a thing you can play with."

It's also where the capability brokering API in canvas-runtime gets its first real provider. Until this package, dispatch was dead code — manifest declarations, provider lookup, error responses had been tested in isolation but never exercised by a real handler. Shipping `clipboard.read`/`write` and `notifications.notify` as real browser-API-backed handlers validates the brokering plumbing end to end.

The package is intentionally minimal. The substrate is supposed to grow widgets the way a hobbyist garden grows plants — three to start, more on weekends, no central authority deciding what's official. This v1 just plants enough seeds to prove the soil is alive.

## Goals and non-goals

**Goals**

- Three iframe widgets that exercise different parts of the substrate: state persistence (markdown), third-party cross-origin iframe (Excalidraw), capability brokering with notifications (pomodoro).
- Two browser-API-backed capability providers: clipboard (read + write), notifications (notify).
- Manifest builder functions that take an `entry` URL parameter, so consumers determine widget hosting.
- A self-hosted Vite demo that mounts canvas-runtime + all three widgets + both providers in one page.
- Provider unit tests that exercise the real handlers against mocked browser APIs.

**Non-goals**

- The `/playground` page on rdmontgomery.com. Lands in milestone 5 alongside the canvas-runtime extension that replays persisted widget state on init.
- A widget client lib (`@rdm/widget-client`). Defer until iframe handshake boilerplate is genuinely annoying — the three widgets in this PR write 10-12 lines each by hand.
- Native widget loading. Manifest's `kind: "iframe"` is the only kind shipped here; native lands when something needs it.
- More widgets (calculator, image viewer, code snippet, sticky note). Cheap to add later in their own PRs.
- State replay on widget reload. Persisted state is *saved* (canvas-runtime already does that), but widgets restart blank because canvas-runtime doesn't yet send persisted state to the iframe at init time. The fix is a small canvas-runtime extension that lands with milestone 5.
- Excalidraw state persistence. Excalidraw's own postMessage API supports it but is its own protocol; defer until someone needs it.

## Package shape

**Location:** `packages/widgets-browser/` in the existing pnpm workspace.
**Name:** `@rdm/widgets-browser`. Workspace-internal.

**Stack:**

- TypeScript 5.x ESM + plain HTML/JS for iframe widgets.
- `tsc` for `src/`. A tiny node script copies `widgets/` → `dist/widgets/` at build time.
- `vite` for the example dev server only (not in the build path).
- Workspace deps: `@rdm/widget-protocol` (manifest types) and `@rdm/canvas-runtime` (provider type).
- No bundler in the package's build path. The iframe widgets are intentionally dependency-free — they load `marked.js` from `https://esm.sh` at runtime; everything else is hand-written.

**Public surface (v1):**

- `./manifests` — `markdownManifest({ entry })`, `excalidrawManifest({ entry })`, `pomodoroManifest({ entry })`. Each returns a `WidgetManifest`.
- `./providers` — `clipboardProvider()`, `notificationsProvider()`. Each returns a `Provider` keyed for use in the canvas's `providers` prop (`{ clipboard: clipboardProvider(), notifications: notificationsProvider() }`).
- Barrel `.` re-exports both.
- `dist/widgets/` — three subdirs (`markdown/`, `excalidraw/`, `pomodoro/`), each containing `index.html` plus any per-widget assets. Consumers serve them as static files.

**Layout:**

```
packages/widgets-browser/
  package.json
  tsconfig.json
  vite.config.ts                # demo dev server
  scripts/
    copy-widgets.mjs            # copies widgets/ → dist/widgets/ at build
  src/
    manifests/
      markdown.ts
      excalidraw.ts
      pomodoro.ts
      index.ts                  # barrel
    providers/
      clipboard.ts
      notifications.ts
      index.ts                  # barrel
    index.ts                    # package barrel
  widgets/                      # plain HTML + inline JS (no build step)
    markdown/index.html
    excalidraw/index.html
    pomodoro/index.html
  example/                      # Vite demo (not in dist)
    index.html
    main.tsx
```

## Manifest builders

Manifests are **builder functions, not pre-built objects.** Each consumer determines widget hosting (their own static dir, a CDN, a different origin), so the manifest's `entry` URL is supplied at the call site.

```ts
// src/manifests/markdown.ts
import type { WidgetManifest } from '@rdm/widget-protocol';

export function markdownManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.markdown',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: ['clipboard.read', 'clipboard.write'],
    defaultSize: { w: 480, h: 360 },
    name: 'Markdown',
    protocolVersion: 1,
  };
}
```

`excalidrawManifest` declares no capabilities; `pomodoroManifest` declares `notifications.notify`. The markdown widget declares both clipboard methods because both buttons could fire.

## Provider implementations

```ts
// src/providers/clipboard.ts
import type { Provider } from '@rdm/canvas-runtime';

export function clipboardProvider(): Provider {
  return {
    read: async () => ({ text: await navigator.clipboard.readText() }),
    write: async (params) => {
      const text = String((params as { text?: unknown })?.text ?? '');
      await navigator.clipboard.writeText(text);
      return { ok: true };
    },
  };
}
```

```ts
// src/providers/notifications.ts
import type { Provider } from '@rdm/canvas-runtime';

export function notificationsProvider(): Provider {
  return {
    notify: async (params) => {
      const p = (params ?? {}) as { title?: unknown; body?: unknown };
      const title = String(p.title ?? 'Notification');
      const body = p.body !== undefined ? String(p.body) : undefined;
      if (typeof Notification === 'undefined') {
        throw new Error('Notification API not available');
      }
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') {
        throw new Error('notification permission denied');
      }
      new Notification(title, body !== undefined ? { body } : undefined);
      return { ok: true };
    },
  };
}
```

**Param shapes are deliberately permissive.** Strongly-typed per-method param schemas live in capability-specific packages later (per the substrate design doc); v1 narrows manually inside the handler.

## Iframe widget HTMLs

All three widgets are dependency-free vanilla HTML + JS that do the canvas-runtime handshake: listen for `message` with `data.rdm === 'init'`, grab `event.ports[0]`, post `lifecycle.ready`, then run.

### `widgets/markdown/index.html` (~150 lines)

- Two-pane: textarea on left, rendered preview on right (toggle button to flip).
- Loads `marked` from `https://esm.sh/marked@13` for rendering.
- On any keystroke (debounced 200ms), posts `event widget.stateChanged { state: { md } }` over the port.
- Two toolbar buttons:
  - "Copy markdown" → posts `req clipboard.write { text: md }`. Awaits `res`. Shows a small status confirmation.
  - "Paste" → posts `req clipboard.read`. Awaits `res`. Replaces textarea content with the response's `text`.
- v1 limitation (documented in the widget UI): refresh = blank textarea. Persisted state replay is a milestone 5 concern.

### `widgets/excalidraw/index.html` (~30 lines)

- Handshake stub + nested `<iframe src="https://excalidraw.com">` filling 100% of the body.
- Posts `lifecycle.ready` immediately on init.
- No state persistence (documented limitation — refresh = blank canvas).
- The nested iframe needs `sandbox="allow-scripts allow-same-origin allow-popups"` for excalidraw.com to function. This is *inside* the widget's already-sandboxed outer iframe (canvas-runtime applies `sandbox="allow-scripts"` to the outer frame), so it's contained.

### `widgets/pomodoro/index.html` (~200 lines)

- UI: large countdown display (`mm:ss`), target-duration input (default 25 min), start / pause / reset buttons.
- State: `{ targetSec, remainingSec, running, startedAt }`. Posts `widget.stateChanged` on each user action.
- Tick loop via `setInterval(1000)` while running. Updates the display from state.
- On completion (remainingSec hits 0):
  - Posts `req notifications.notify { title: 'Pomodoro done', body: '<duration> elapsed' }`.
  - Logs the response in a small status line.

## Demo

```tsx
// example/main.tsx
import { createRoot } from 'react-dom/client';
import { Canvas } from '@rdm/canvas-runtime';
import { localStorageAdapter } from '@rdm/canvas-runtime/adapters';
import {
  markdownManifest,
  excalidrawManifest,
  pomodoroManifest,
} from '../src/manifests';
import { clipboardProvider, notificationsProvider } from '../src/providers';

const ORIGIN = 'http://localhost:5174';

createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0 }}>
    <Canvas
      canvasId="example"
      adapter={localStorageAdapter()}
      providers={{
        clipboard: clipboardProvider(),
        notifications: notificationsProvider(),
      }}
      initialWidgets={[
        { manifest: markdownManifest({ entry: `${ORIGIN}/widgets/markdown/index.html` }), placement: { x: 60, y: 60, w: 460, h: 320 } },
        { manifest: excalidrawManifest({ entry: `${ORIGIN}/widgets/excalidraw/index.html` }), placement: { x: 560, y: 60, w: 540, h: 380 } },
        { manifest: pomodoroManifest({ entry: `${ORIGIN}/widgets/pomodoro/index.html` }), placement: { x: 60, y: 420, w: 320, h: 240 } },
      ]}
    />
  </div>
);
```

`vite.config.ts`: `root: 'example'`, `server: { port: 5174 }`, `publicDir: '../widgets'` so widget HTMLs are served at `/widgets/*` during dev. `pnpm --filter @rdm/widgets-browser dev` opens it locally.

## Tests

- **Provider unit tests** (DOM env, mocked browser APIs):
  - `clipboardProvider().read` returns `{ text }` from `navigator.clipboard.readText` (stubbed); `write` stringifies params and calls `writeText`; both reject with provider/error code path when the underlying API throws.
  - `notificationsProvider().notify` requires permission, throws when denied, constructs a real `new Notification(title, { body })` when granted.
- **Manifest builder unit tests**: each builder returns a manifest that parses through `WidgetManifestSchema` from `@rdm/widget-protocol`. Catches shape regressions if the schema or builder drift.
- **Iframe HTML/JS** gets no unit tests — covered manually by the demo. Three small files; protocol-level coverage already lives in canvas-runtime's handshake/dispatch tests.

Roughly 12-18 new tests. Total: 133 → ~150.

## Workspace changes

- New: `packages/widgets-browser/`.
- Root devDeps: nothing new — `vitest`, `happy-dom`, `@testing-library/react`, `vite`, `@vitejs/plugin-react` all already at root.
- `pnpm-workspace.yaml`: unchanged.
- `apps/site/`: untouched.

## What's not in this PR (and where it lands)

- **Site `/playground` page.** Milestone 5. Will be the visible payoff on rdmontgomery.com.
- **Persisted-state replay** on widget init. Small canvas-runtime extension — folded into milestone 5's PR.
- **Widget client lib** (`@rdm/widget-client`). Defer until handshake boilerplate is genuinely annoying.
- **More widgets**. Cheap to add per-widget in their own PRs.
- **Native widget loader.** Wait until something needs it.
- **Excalidraw state persistence.** Use Excalidraw's postMessage API. Defer.
- **Tauri OS capabilities** (`os.notify`, `os.globalHotkey`). Separate desktop-shell milestone.

## Future doors kept open

- The `notifications.notify` provider has a clear extension point: when Tauri ships, `os.notify` can be a different provider on the same channel name without widgets needing to know. The widget just declares `notifications.notify`; whichever provider is registered at canvas init time gets the call.
- The clipboard provider's params shape can tighten via a capability-specific schema package (`@rdm/cap-clipboard`) without breaking the runtime contract.
- The widget HTMLs are dependency-free for v1; if they grow, each can become a Vite-built sub-app with its own `dist/widgets/<name>/` output and the manifest's `entry` URL still points at `index.html`.
