# `@rdm/widgets-browser` implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land `@rdm/widgets-browser` v1 — three iframe widgets (markdown editor, Excalidraw embed, pomodoro timer), two capability providers (clipboard, notifications), manifest builder functions, and a Vite demo.

**Architecture:** TypeScript ESM source in `src/`, plain HTML+inline JS for iframes in `widgets/`, copied verbatim to `dist/widgets/` at build time via a tiny node script. Providers and manifest builders are pure functions; iframe widgets are dependency-free apart from CDN-loaded marked.js in the markdown widget. No bundler.

**Tech Stack:** TypeScript 5.x, Vitest with happy-dom for provider tests, `@rdm/widget-protocol` (manifest types) and `@rdm/canvas-runtime` (Provider type) as workspace deps. Vite for the demo dev server only.

**Reference docs:**
- Substrate design: `docs/plans/2026-04-29-canvas-substrate-design.md`
- Package design: `docs/plans/2026-04-30-widgets-browser-design.md`
- This plan: the *how*

**Working directory:** `/home/rdmontgomery/projects/rdmontgomry/.worktrees/widgets-browser` on branch `feat/widgets-browser`. All commands assume this CWD.

**Workspace gotcha (run once before starting):** `@rdm/widget-protocol` and `@rdm/canvas-runtime` both expose their public surface through `package.json` `exports` pointing at `./dist/...`. On a fresh worktree, those `dist/` directories don't exist yet, which causes Vite/Vitest's resolver to fail when test files `import` from them. Build them first so workspace consumers can resolve:

```bash
pnpm -r build
```

If you skip this and tests start failing with `Failed to resolve entry for package "@rdm/widget-protocol"`, that's why.

**Verification approach:** TDD for providers and manifests (pure functions with mockable boundaries). No unit tests for the iframe widget HTMLs — they're covered by the demo dev server, opened in a real browser as the manual e2e gate.

---

## Task 1: Bootstrap the `@rdm/widgets-browser` package skeleton

**Files:**
- Create: `packages/widgets-browser/package.json`
- Create: `packages/widgets-browser/tsconfig.json`
- Create: `packages/widgets-browser/scripts/copy-widgets.mjs`
- Create: `packages/widgets-browser/src/index.ts` (placeholder)

**Step 1: Make the directory tree**

```bash
mkdir -p packages/widgets-browser/src/manifests \
         packages/widgets-browser/src/providers \
         packages/widgets-browser/scripts \
         packages/widgets-browser/widgets/markdown \
         packages/widgets-browser/widgets/excalidraw \
         packages/widgets-browser/widgets/pomodoro \
         packages/widgets-browser/example
```

**Step 2: Write `packages/widgets-browser/package.json`**

```json
{
  "name": "@rdm/widgets-browser",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./manifests": {
      "types": "./dist/manifests/index.d.ts",
      "import": "./dist/manifests/index.js"
    },
    "./providers": {
      "types": "./dist/providers/index.d.ts",
      "import": "./dist/providers/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc && node scripts/copy-widgets.mjs",
    "typecheck": "tsc --noEmit",
    "dev": "vite example"
  },
  "peerDependencies": {
    "@rdm/canvas-runtime": "workspace:*",
    "@rdm/widget-protocol": "workspace:*"
  },
  "dependencies": {
    "@rdm/canvas-runtime": "workspace:*",
    "@rdm/widget-protocol": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.0.0",
    "react": "^19",
    "react-dom": "^19",
    "typescript": "^5.6.0",
    "vite": "^7"
  }
}
```

**Step 3: Write `packages/widgets-browser/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "**/*.test.ts", "**/*.test.tsx", "example", "widgets"]
}
```

**Step 4: Write the widget-copy script**

```js
// packages/widgets-browser/scripts/copy-widgets.mjs
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'widgets');
const dst = resolve(here, '..', 'dist', 'widgets');

if (existsSync(dst)) rmSync(dst, { recursive: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`copied ${src} -> ${dst}`);
```

**Step 5: Placeholder `src/index.ts`**

```ts
// @rdm/widgets-browser — public surface re-exports land here as modules ship.
export {};
```

**Step 6: pnpm install**

Run: `pnpm install`
Expected: pnpm picks up the new package, completes without errors.

Verify: `pnpm -r ls --depth=-1 2>/dev/null | grep widgets-browser`
Expected: line includes `@rdm/widgets-browser`.

**Step 7: Verify the build works (with empty widget tree, copy will succeed)**

Run: `pnpm --filter @rdm/widgets-browser build`
Expected: tsc completes silently. `ls packages/widgets-browser/dist` shows `index.js`, `index.d.ts`, plus `widgets/` (empty subdirs).

**Step 8: Verify root tests still pass**

Run: `pnpm test`
Expected: 133 tests pass.

**Step 9: Commit**

```bash
git add packages/widgets-browser/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(widgets-browser): bootstrap package skeleton

Empty ESM-only package with workspace deps on @rdm/widget-protocol and
@rdm/canvas-runtime. Build pipeline is tsc + a small node script that
copies widgets/ into dist/widgets/. Subpath exports declared for
./manifests and ./providers. Modules ship in subsequent commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `providers/clipboard.ts` (TDD)

**Files:**
- Create: `packages/widgets-browser/src/providers/clipboard.ts`
- Create: `packages/widgets-browser/src/providers/clipboard.test.ts`

**Step 1: Write the failing test (uses happy-dom)**

```ts
// packages/widgets-browser/src/providers/clipboard.test.ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clipboardProvider } from './clipboard';

const realClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: realClipboard,
    configurable: true,
    writable: true,
  });
});

function stubClipboard(impl: Partial<Clipboard>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl,
    configurable: true,
    writable: true,
  });
}

const ctx = {
  instanceId: 'i-1',
  manifestId: 'rdm.test.x',
  signal: new AbortController().signal,
  log: () => {},
};

describe('clipboardProvider', () => {
  test('read returns { text } from navigator.clipboard.readText', async () => {
    stubClipboard({ readText: vi.fn(async () => 'hello world') });
    const provider = clipboardProvider();
    const result = await provider.read!(undefined, ctx);
    expect(result).toEqual({ text: 'hello world' });
  });

  test('write coerces params.text to string and calls writeText', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    const result = await provider.write!({ text: 'wrote this' }, ctx);
    expect(writeText).toHaveBeenCalledWith('wrote this');
    expect(result).toEqual({ ok: true });
  });

  test('write coerces non-string text to string', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    await provider.write!({ text: 42 }, ctx);
    expect(writeText).toHaveBeenCalledWith('42');
  });

  test('write with missing text writes empty string', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    await provider.write!({}, ctx);
    expect(writeText).toHaveBeenCalledWith('');
  });

  test('read propagates underlying API errors', async () => {
    stubClipboard({ readText: vi.fn(async () => { throw new Error('denied'); }) });
    const provider = clipboardProvider();
    await expect(provider.read!(undefined, ctx)).rejects.toThrow(/denied/);
  });
});
```

**Step 2: Run; expect import-resolution failures for `./clipboard`.**

`pnpm test`

**Step 3: Implementation**

```ts
// packages/widgets-browser/src/providers/clipboard.ts
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

**Step 4: Run tests, expect all 5 new pass + 133 existing.**

`pnpm test` → 138 passing.

If `Failed to resolve entry for package "@rdm/canvas-runtime"`, run `pnpm --filter @rdm/canvas-runtime build` once and retry.

**Step 5: Typecheck silent**

`pnpm --filter @rdm/widgets-browser typecheck`

**Step 6: Commit**

```bash
git add packages/widgets-browser/src/providers/clipboard.ts packages/widgets-browser/src/providers/clipboard.test.ts
git commit -m "$(cat <<'EOF'
feat(widgets-browser): clipboard provider

clipboardProvider() returns a Provider with read and write handlers
backed by navigator.clipboard. read returns { text }; write coerces
params.text to a string (defaulting to empty) and returns { ok: true }.
Errors from the underlying API propagate as provider/error per the
canvas-runtime dispatch contract.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `providers/notifications.ts` (TDD)

**Files:**
- Create: `packages/widgets-browser/src/providers/notifications.ts`
- Create: `packages/widgets-browser/src/providers/notifications.test.ts`

**Step 1: Write the failing test**

```ts
// packages/widgets-browser/src/providers/notifications.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { notificationsProvider } from './notifications';

type NotificationCtor = ((title: string, options?: NotificationOptions) => Notification) & {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
};

let originalNotification: NotificationCtor | undefined;

beforeEach(() => {
  // happy-dom may or may not provide window.Notification; capture and restore.
  originalNotification = (globalThis as { Notification?: NotificationCtor }).Notification;
});

afterEach(() => {
  if (originalNotification) {
    (globalThis as { Notification?: NotificationCtor }).Notification = originalNotification;
  } else {
    delete (globalThis as { Notification?: NotificationCtor }).Notification;
  }
});

function installNotificationStub(opts: {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
}): { ctor: ReturnType<typeof vi.fn> } {
  const ctor = vi.fn();
  const stub = ctor as unknown as NotificationCtor;
  stub.permission = opts.permission;
  stub.requestPermission = opts.requestPermission ?? (async () => opts.permission);
  (globalThis as { Notification?: NotificationCtor }).Notification = stub;
  return { ctor };
}

const ctx = {
  instanceId: 'i-1',
  manifestId: 'rdm.test.x',
  signal: new AbortController().signal,
  log: () => {},
};

describe('notificationsProvider', () => {
  test('notify constructs a Notification when permission is granted', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    const result = await provider.notify!({ title: 'hi', body: 'there' }, ctx);
    expect(ctor).toHaveBeenCalledWith('hi', { body: 'there' });
    expect(result).toEqual({ ok: true });
  });

  test('notify falls back to "Notification" title when missing', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    await provider.notify!({}, ctx);
    expect(ctor).toHaveBeenCalledWith('Notification', undefined);
  });

  test('notify omits options when body is undefined', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    await provider.notify!({ title: 'hi' }, ctx);
    expect(ctor).toHaveBeenCalledWith('hi', undefined);
  });

  test('notify requests permission when default and uses the result', async () => {
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    const { ctor } = installNotificationStub({ permission: 'default', requestPermission });
    const provider = notificationsProvider();
    await provider.notify!({ title: 'hi' }, ctx);
    expect(requestPermission).toHaveBeenCalled();
    expect(ctor).toHaveBeenCalled();
  });

  test('notify throws when permission is denied', async () => {
    installNotificationStub({ permission: 'denied' });
    const provider = notificationsProvider();
    await expect(provider.notify!({ title: 'hi' }, ctx)).rejects.toThrow(/permission denied/);
  });

  test('notify throws when Notification API is missing', async () => {
    delete (globalThis as { Notification?: NotificationCtor }).Notification;
    const provider = notificationsProvider();
    await expect(provider.notify!({ title: 'hi' }, ctx)).rejects.toThrow(/not available/);
  });
});
```

**Step 2: Run, expect import-resolution failures.**

**Step 3: Implementation**

```ts
// packages/widgets-browser/src/providers/notifications.ts
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

**Step 4: pnpm test → all pass (138 + 6 = 144).**
**Step 5: typecheck silent.**
**Step 6: Commit**

```bash
git add packages/widgets-browser/src/providers/notifications.ts packages/widgets-browser/src/providers/notifications.test.ts
git commit -m "$(cat <<'EOF'
feat(widgets-browser): notifications provider

notificationsProvider() returns a Provider with a single notify handler
backed by window.Notification. Requests permission if default, throws
provider/error when denied or when the API is missing. Title defaults
to "Notification"; body is optional.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `providers/index.ts` barrel

**Files:**
- Create: `packages/widgets-browser/src/providers/index.ts`

```ts
// packages/widgets-browser/src/providers/index.ts
export { clipboardProvider } from './clipboard';
export { notificationsProvider } from './notifications';
```

`pnpm --filter @rdm/widgets-browser typecheck` — silent. `pnpm test` — still 144.

```bash
git add packages/widgets-browser/src/providers/index.ts
git commit -m "$(cat <<'EOF'
feat(widgets-browser): providers barrel

Exports clipboardProvider and notificationsProvider as the @rdm/widgets-browser/providers subpath surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manifest builders (markdown, excalidraw, pomodoro) + barrel — TDD

Combined task because the three builders are nearly identical pure functions; the test file covers all three.

**Files:**
- Create: `packages/widgets-browser/src/manifests/markdown.ts`
- Create: `packages/widgets-browser/src/manifests/excalidraw.ts`
- Create: `packages/widgets-browser/src/manifests/pomodoro.ts`
- Create: `packages/widgets-browser/src/manifests/index.ts`
- Create: `packages/widgets-browser/src/manifests/manifests.test.ts`

**Step 1: Test (verbatim)**

```ts
// packages/widgets-browser/src/manifests/manifests.test.ts
import { describe, expect, test } from 'vitest';
import { WidgetManifestSchema } from '@rdm/widget-protocol';
import { markdownManifest } from './markdown';
import { excalidrawManifest } from './excalidraw';
import { pomodoroManifest } from './pomodoro';

const HTTP = 'https://example.com/widgets/x.html';

describe('markdownManifest', () => {
  test('produces a valid manifest', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares clipboard.read and clipboard.write capabilities', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.capabilities).toEqual(expect.arrayContaining(['clipboard.read', 'clipboard.write']));
  });

  test('uses the supplied entry URL', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.entry).toBe(HTTP);
  });

  test('id is rdm.widget.markdown', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.markdown');
  });
});

describe('excalidrawManifest', () => {
  test('produces a valid manifest', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares no capabilities', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(m.capabilities).toEqual([]);
  });

  test('id is rdm.widget.excalidraw', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.excalidraw');
  });
});

describe('pomodoroManifest', () => {
  test('produces a valid manifest', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares notifications.notify capability', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(m.capabilities).toEqual(['notifications.notify']);
  });

  test('id is rdm.widget.pomodoro', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.pomodoro');
  });
});

describe('all builders', () => {
  test.each([
    ['markdown', markdownManifest],
    ['excalidraw', excalidrawManifest],
    ['pomodoro', pomodoroManifest],
  ] as const)('%s rejects non-http entry through schema refinement', (_, builder) => {
    const m = builder({ entry: '/local/path' });
    expect(() => WidgetManifestSchema.parse(m)).toThrow();
  });
});
```

**Step 2: pnpm test → import-resolution failures.**

**Step 3: Implementations**

```ts
// packages/widgets-browser/src/manifests/markdown.ts
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

```ts
// packages/widgets-browser/src/manifests/excalidraw.ts
import type { WidgetManifest } from '@rdm/widget-protocol';

export function excalidrawManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.excalidraw',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: [],
    defaultSize: { w: 540, h: 420 },
    name: 'Excalidraw',
    protocolVersion: 1,
  };
}
```

```ts
// packages/widgets-browser/src/manifests/pomodoro.ts
import type { WidgetManifest } from '@rdm/widget-protocol';

export function pomodoroManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.pomodoro',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: ['notifications.notify'],
    defaultSize: { w: 320, h: 240 },
    name: 'Pomodoro',
    protocolVersion: 1,
  };
}
```

```ts
// packages/widgets-browser/src/manifests/index.ts
export { markdownManifest } from './markdown';
export { excalidrawManifest } from './excalidraw';
export { pomodoroManifest } from './pomodoro';
```

**Step 4: pnpm test → 144 + 13 = 157 passing.**
**Step 5: typecheck silent.**
**Step 6: Commit**

```bash
git add packages/widgets-browser/src/manifests/
git commit -m "$(cat <<'EOF'
feat(widgets-browser): manifest builders + barrel

Three builder functions (markdownManifest, excalidrawManifest,
pomodoroManifest) returning WidgetManifest objects with parametric
entry URLs. Capabilities pinned per widget: markdown declares
clipboard.read+write, excalidraw none, pomodoro notifications.notify.
Tests validate each manifest parses through WidgetManifestSchema and
that schema refinement rejects non-http entries.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `widgets/markdown/index.html`

No tests; manual verification via the demo.

**Files:**
- Create: `packages/widgets-browser/widgets/markdown/index.html`

**Step 1: Write the file**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Markdown Widget</title>
  <style>
    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
    body { display: flex; flex-direction: column; }
    .toolbar {
      display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #ddd;
      background: #fafafa; align-items: center;
    }
    button { padding: 4px 10px; cursor: pointer; }
    .panes { display: flex; flex: 1; min-height: 0; }
    .panes > * { flex: 1; min-width: 0; padding: 8px; box-sizing: border-box; overflow: auto; }
    textarea {
      width: 100%; height: 100%; border: 0; resize: none; outline: none;
      font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px;
      box-sizing: border-box;
    }
    .preview { border-left: 1px solid #ddd; }
    .preview h1, .preview h2, .preview h3 { margin-top: 0.5em; }
    .preview pre {
      background: #f3f3f3; padding: 8px; border-radius: 4px; overflow: auto;
      font-size: 12px;
    }
    .status { color: #666; font-size: 11px; margin-left: auto; }
    .caveat { color: #b45309; font-size: 11px; padding: 4px 8px; background: #fffbeb; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="copy">Copy markdown</button>
    <button id="paste">Paste from clipboard</button>
    <span class="status" id="status"></span>
  </div>
  <div class="caveat">v1: textarea starts blank on each reload (state persistence in flight)</div>
  <div class="panes">
    <textarea id="src" placeholder="# Hello&#10;&#10;Type some markdown..."></textarea>
    <div class="preview" id="preview"></div>
  </div>
  <script type="module">
    import { marked } from 'https://esm.sh/marked@13';

    const src = document.getElementById('src');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    const setStatus = (msg) => {
      status.textContent = msg;
      if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 1500);
    };

    const render = () => { preview.innerHTML = marked.parse(src.value); };
    render();

    let port = null;
    let nextReqId = 1;
    const pending = new Map();

    function rpc(method, params) {
      return new Promise((resolve, reject) => {
        if (!port) return reject(new Error('not connected'));
        const id = String(nextReqId++);
        pending.set(id, { resolve, reject });
        port.postMessage({ type: 'req', id, method, params });
      });
    }

    function handleMessage(event) {
      const msg = event.data;
      if (msg && msg.type === 'res' && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.outcome === 'ok') resolve(msg.result);
        else reject(new Error(msg.error?.message ?? 'rpc error'));
      }
    }

    let saveTimer = null;
    src.addEventListener('input', () => {
      render();
      if (!port) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        port.postMessage({
          type: 'event',
          name: 'widget.stateChanged',
          payload: { state: { md: src.value } },
        });
      }, 200);
    });

    document.getElementById('copy').addEventListener('click', async () => {
      try {
        await rpc('clipboard.write', { text: src.value });
        setStatus('copied');
      } catch (e) {
        setStatus('copy failed: ' + e.message);
      }
    });

    document.getElementById('paste').addEventListener('click', async () => {
      try {
        const result = await rpc('clipboard.read');
        const text = (result && typeof result === 'object' && 'text' in result) ? String(result.text) : '';
        src.value = text;
        render();
        setStatus('pasted');
      } catch (e) {
        setStatus('paste failed: ' + e.message);
      }
    });

    function init() {
      window.addEventListener('message', function onInit(event) {
        if (!event.data || event.data.rdm !== 'init') return;
        window.removeEventListener('message', onInit);
        port = event.ports[0];
        port.start();
        port.addEventListener('message', handleMessage);
        port.postMessage({ type: 'event', name: 'lifecycle.ready' });
      });
    }
    init();
  </script>
</body>
</html>
```

**Step 2: Verify the build copies it.**

Run: `pnpm --filter @rdm/widgets-browser build`
Expected: `ls packages/widgets-browser/dist/widgets/markdown/index.html` exists.

**Step 3: Commit**

```bash
git add packages/widgets-browser/widgets/markdown/index.html
git commit -m "$(cat <<'EOF'
feat(widgets-browser): markdown editor iframe widget

Two-pane textarea + rendered preview using marked.js from esm.sh.
Toolbar buttons for clipboard.read and clipboard.write capabilities.
Posts widget.stateChanged events on debounced keystrokes (200ms) so
canvas-runtime persists the markdown source.

v1 limitation surfaced in the widget UI: textarea starts blank on
each reload because canvas-runtime doesn't yet replay state at init
time. Restoration lands in milestone 5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `widgets/excalidraw/index.html`

**Files:**
- Create: `packages/widgets-browser/widgets/excalidraw/index.html`

**Step 1: Write the file**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Excalidraw Widget</title>
  <style>
    html, body { margin: 0; height: 100%; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    .caveat {
      position: absolute; top: 4px; right: 8px;
      color: #b45309; font-size: 10px; background: #fffbeb;
      padding: 2px 6px; border-radius: 3px; font-family: system-ui, sans-serif;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <iframe
    src="https://excalidraw.com/"
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
    allow="clipboard-read; clipboard-write"
  ></iframe>
  <div class="caveat">v1: drawings don't persist across reload</div>
  <script>
    function init() {
      window.addEventListener('message', function onInit(event) {
        if (!event.data || event.data.rdm !== 'init') return;
        window.removeEventListener('message', onInit);
        const port = event.ports[0];
        port.start();
        port.postMessage({ type: 'event', name: 'lifecycle.ready' });
      });
    }
    init();
  </script>
</body>
</html>
```

**Step 2: Build, verify the file lands in dist/widgets/excalidraw/.**
**Step 3: Commit**

```bash
git add packages/widgets-browser/widgets/excalidraw/index.html
git commit -m "$(cat <<'EOF'
feat(widgets-browser): excalidraw embed iframe widget

Thin wrapper that nests an iframe to excalidraw.com. Posts
lifecycle.ready immediately. Inner iframe gets allow-scripts,
allow-same-origin, allow-popups so excalidraw.com runs fully; this
sits inside the outer canvas-runtime sandbox so it remains contained.

v1 limitation: drawings reset on reload (Excalidraw's own postMessage
state API exists but is its own protocol; deferred).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `widgets/pomodoro/index.html`

**Files:**
- Create: `packages/widgets-browser/widgets/pomodoro/index.html`

**Step 1: Write the file**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pomodoro Widget</title>
  <style>
    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
    body {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 12px; box-sizing: border-box;
    }
    .display { font-size: 48px; font-variant-numeric: tabular-nums; font-weight: 200; }
    .controls { display: flex; gap: 8px; }
    button { padding: 6px 14px; cursor: pointer; }
    label { font-size: 12px; color: #555; }
    input[type=number] { width: 60px; padding: 2px 4px; }
    .status { font-size: 11px; color: #666; min-height: 14px; }
    .caveat { font-size: 10px; color: #b45309; }
  </style>
</head>
<body>
  <div>
    <label>Minutes:
      <input id="duration" type="number" min="1" max="120" value="25">
    </label>
  </div>
  <div class="display" id="display">25:00</div>
  <div class="controls">
    <button id="start">Start</button>
    <button id="pause">Pause</button>
    <button id="reset">Reset</button>
  </div>
  <div class="status" id="status"></div>
  <div class="caveat">v1: state resets on reload</div>
  <script>
    const display = document.getElementById('display');
    const status = document.getElementById('status');
    const durationInput = document.getElementById('duration');

    let port = null;
    let nextReqId = 1;
    const pending = new Map();

    function rpc(method, params) {
      return new Promise((resolve, reject) => {
        if (!port) return reject(new Error('not connected'));
        const id = String(nextReqId++);
        pending.set(id, { resolve, reject });
        port.postMessage({ type: 'req', id, method, params });
      });
    }

    function handleMessage(event) {
      const msg = event.data;
      if (msg && msg.type === 'res' && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.outcome === 'ok') resolve(msg.result);
        else reject(new Error(msg.error?.message ?? 'rpc error'));
      }
    }

    let state = {
      targetSec: 25 * 60,
      remainingSec: 25 * 60,
      running: false,
    };
    let tickHandle = null;

    function fmt(s) {
      const mm = Math.floor(s / 60);
      const ss = s % 60;
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    function render() {
      display.textContent = fmt(Math.max(0, state.remainingSec));
    }

    function postState() {
      if (!port) return;
      port.postMessage({
        type: 'event',
        name: 'widget.stateChanged',
        payload: { state: { ...state } },
      });
    }

    async function complete() {
      state.running = false;
      stopTick();
      render();
      postState();
      status.textContent = 'done';
      try {
        await rpc('notifications.notify', {
          title: 'Pomodoro done',
          body: `${Math.floor(state.targetSec / 60)} minutes elapsed`,
        });
      } catch (e) {
        status.textContent = 'notify failed: ' + e.message;
      }
    }

    function tick() {
      state.remainingSec -= 1;
      render();
      if (state.remainingSec <= 0) complete();
    }

    function startTick() {
      stopTick();
      tickHandle = setInterval(tick, 1000);
    }

    function stopTick() {
      if (tickHandle !== null) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
    }

    durationInput.addEventListener('change', () => {
      const mins = Math.max(1, Math.min(120, Number(durationInput.value) || 25));
      durationInput.value = String(mins);
      state.targetSec = mins * 60;
      if (!state.running) state.remainingSec = state.targetSec;
      render();
      postState();
    });

    document.getElementById('start').addEventListener('click', () => {
      if (state.running) return;
      if (state.remainingSec <= 0) state.remainingSec = state.targetSec;
      state.running = true;
      startTick();
      postState();
      status.textContent = 'running';
    });

    document.getElementById('pause').addEventListener('click', () => {
      if (!state.running) return;
      state.running = false;
      stopTick();
      postState();
      status.textContent = 'paused';
    });

    document.getElementById('reset').addEventListener('click', () => {
      state.running = false;
      stopTick();
      state.remainingSec = state.targetSec;
      render();
      postState();
      status.textContent = '';
    });

    function init() {
      window.addEventListener('message', function onInit(event) {
        if (!event.data || event.data.rdm !== 'init') return;
        window.removeEventListener('message', onInit);
        port = event.ports[0];
        port.start();
        port.addEventListener('message', handleMessage);
        port.postMessage({ type: 'event', name: 'lifecycle.ready' });
        render();
      });
    }
    init();
  </script>
</body>
</html>
```

**Step 2: Build, verify file lands in dist.**
**Step 3: Commit**

```bash
git add packages/widgets-browser/widgets/pomodoro/index.html
git commit -m "$(cat <<'EOF'
feat(widgets-browser): pomodoro timer iframe widget

Configurable countdown (default 25 min) with start/pause/reset. State
{ targetSec, remainingSec, running } posted to canvas-runtime as
widget.stateChanged events. On completion, posts a req for
notifications.notify which the canvas brokers to the registered
notifications provider — first end-to-end exercise of the capability
brokering API in production code.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Vite demo + barrel + runtime smoke check

**Files:**
- Create: `packages/widgets-browser/vite.config.ts`
- Create: `packages/widgets-browser/example/index.html`
- Create: `packages/widgets-browser/example/main.tsx`
- Modify: `packages/widgets-browser/src/index.ts` (replace placeholder with barrel)

**Step 1: vite.config.ts**

```ts
// packages/widgets-browser/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'example',
  publicDir: resolve(here, 'widgets'),
  plugins: [react()],
  server: { port: 5174 },
});
```

The `publicDir` makes the `widgets/` directory available at `/widgets/*` during dev — so `markdown/index.html` is reachable at `http://localhost:5174/markdown/index.html`. Adjust manifest entry URLs in `main.tsx` accordingly.

**Step 2: example/main.tsx**

```tsx
// packages/widgets-browser/example/main.tsx
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

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        canvasId="example"
        adapter={localStorageAdapter()}
        providers={{
          clipboard: clipboardProvider(),
          notifications: notificationsProvider(),
        }}
        initialWidgets={[
          {
            manifest: markdownManifest({ entry: `${ORIGIN}/markdown/index.html` }),
            placement: { x: 60, y: 60, w: 460, h: 320 },
          },
          {
            manifest: excalidrawManifest({ entry: `${ORIGIN}/excalidraw/index.html` }),
            placement: { x: 560, y: 60, w: 540, h: 380 },
          },
          {
            manifest: pomodoroManifest({ entry: `${ORIGIN}/pomodoro/index.html` }),
            placement: { x: 60, y: 420, w: 320, h: 240 },
          },
        ]}
        onError={(e) => console.warn('canvas error:', e)}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
```

**Step 3: example/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>@rdm/widgets-browser example</title>
  <style>html, body, #root { margin: 0; height: 100%; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**Step 4: Replace `src/index.ts` with the barrel**

```ts
// packages/widgets-browser/src/index.ts
export * from './manifests';
export * from './providers';
```

**Step 5: Verify the dev server starts**

Build canvas-runtime first if you haven't already (so workspace resolution works for `@rdm/canvas-runtime` imports):

```bash
pnpm --filter @rdm/canvas-runtime build
```

Then launch dev server in background:

```bash
pnpm --filter @rdm/widgets-browser dev &
```

Wait ~5 seconds, then `curl -s http://localhost:5174/ | head -5` should return the index.html. Curl `http://localhost:5174/markdown/index.html` and verify it returns the markdown widget HTML. Kill the server.

**Step 6: pnpm test → 157 still passing.**

**Step 7: Commit**

```bash
git add packages/widgets-browser/vite.config.ts packages/widgets-browser/example/ packages/widgets-browser/src/index.ts
git commit -m "$(cat <<'EOF'
feat(widgets-browser): vite demo and barrel index

Demo mounts canvas-runtime with all three widgets and both providers,
serving widget HTMLs from a publicDir pointed at the package's widgets/
folder. Barrel re-exports manifests and providers as the default import.

Run with: pnpm --filter @rdm/widgets-browser dev (port 5174).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Workspace-level final sanity

**Step 1: Confirm clean tree**

`git status --short` → empty.

**Step 2: Inspect commits**

`git log --oneline main..HEAD`

Expected commits (top-most first), roughly:
- feat(widgets-browser): vite demo and barrel index
- feat(widgets-browser): pomodoro timer iframe widget
- feat(widgets-browser): excalidraw embed iframe widget
- feat(widgets-browser): markdown editor iframe widget
- feat(widgets-browser): manifest builders + barrel
- feat(widgets-browser): providers barrel
- feat(widgets-browser): notifications provider
- feat(widgets-browser): clipboard provider
- feat(widgets-browser): bootstrap package skeleton
- docs: implementation plan for widgets-browser
- docs: design @rdm/widgets-browser package (milestone 4)

11 commits ahead of main.

**Step 3: Full test suite**

`pnpm test` → 157 passing across ~19 test files.

**Step 4: All builds clean**

```bash
pnpm --filter @rdm/widget-protocol build
pnpm --filter @rdm/canvas-runtime build
pnpm --filter @rdm/widgets-browser build
pnpm build   # site
```

Each must exit 0. Site build emits 11 pages.

**Step 5: Manual demo verification (this is the e2e gate; user-driven)**

```bash
pnpm --filter @rdm/widgets-browser dev
```

Open `http://localhost:5174` in a browser. Verify:
- Three widget windows render (markdown, Excalidraw, pomodoro).
- Markdown: typing in the textarea updates the preview pane; "Copy markdown" puts it on the clipboard; "Paste from clipboard" replaces the textarea with clipboard content.
- Excalidraw: nested iframe loads excalidraw.com and you can scribble.
- Pomodoro: setting "1" minute, hitting Start, waiting → at 0:00 a system notification fires (after granting permission once).
- Drag/zoom/pan all work as in canvas-runtime's own demo.

**Step 6: Done.**

Branch ready for PR. Push and open per `superpowers:finishing-a-development-branch`.

---

## Out of scope for this PR

- `/playground` page on rdmontgomery.com.
- canvas-runtime extension to replay persisted state on widget init (folds into milestone 5).
- Widget client lib (`@rdm/widget-client`).
- More widgets (calculator, image viewer, code-snippet viewer, sticky note).
- Native widget loader.
- Excalidraw state persistence via its postMessage API.
- Tauri OS capability providers.

## Failure modes to watch for

- **Workspace resolution**: tests/dev fail with `Failed to resolve entry for package "@rdm/...". The package may have incorrect main/module/exports`. Build the named package once: `pnpm --filter @rdm/<name> build`. Recurring symptom on fresh worktrees.
- **happy-dom Notification missing**: happy-dom doesn't always expose `window.Notification`. The notifications test stubs the global directly; if a future happy-dom version changes the global shape, the tests' `(globalThis as ...).Notification = ...` assignment may need adjustment.
- **Marked.js CDN unreachable in offline manual testing**: the markdown widget loads `marked` from `https://esm.sh`. If you test the demo offline, the preview pane will be empty. Self-hosting `marked.js` is a small follow-up if it ever matters; the iframe loading itself isn't blocked.
- **Excalidraw sandbox**: if excalidraw.com adds an X-Frame-Options header, embedding will break. Currently it allows iframing. If this changes, switch to a self-hosted `@excalidraw/excalidraw` build.
- **Notification permission UX**: the first time the pomodoro widget completes, the browser will prompt for permission. The test plan flags this; in production use the consumer page can `await Notification.requestPermission()` ahead of time to control timing.
