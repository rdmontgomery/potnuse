# `@rdm/widget-protocol` implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the `@rdm/widget-protocol` package — Zod schemas + inferred TypeScript types for widget manifest, RPC envelopes, capabilities, and lifecycle — as the typed contract every later substrate piece will consume.

**Architecture:** New workspace member at `packages/widget-protocol/`. ESM-only TypeScript, built with `tsc`, no bundler. Five source modules (`manifest`, `envelopes`, `capabilities`, `lifecycle`, `index`), each with a co-located `*.test.ts`. Vitest at workspace root, runs recursively across packages.

**Tech Stack:** TypeScript 5.x, Zod 3.x (or 4.x if stable), Vitest 1.x or 2.x, pnpm 10 workspaces. No transport, no runtime, no React.

**Reference docs:**
- Substrate design: `docs/plans/2026-04-29-canvas-substrate-design.md`
- Package design: `docs/plans/2026-04-29-widget-protocol-design.md` (the *what*)
- This plan: the *how*

**Working directory:** `/home/rdmontgomery/projects/rdmontgomry/.worktrees/widget-protocol` on branch `feat/widget-protocol`. All commands assume this CWD.

**Verification approach:** TDD throughout — write failing test, see it fail, implement, see it pass, commit. Workspace-level checks (full test suite, site build) run at the end to confirm nothing else broke.

---

## Task 1: Add Vitest at the workspace root

Set up the test runner before any tests exist. Configures discovery across `packages/*` so future tests land where they're expected.

**Files:**
- Modify: `package.json` (root) — add `vitest` devDep and `test` script
- Create: `vitest.config.ts` (root)
- Touched: `pnpm-lock.yaml` (regenerated)

**Step 1: Install Vitest at workspace root**

Run: `pnpm add -Dw vitest`
Expected: pnpm reports `vitest` added to root `devDependencies`. Lockfile updates. ~1-2s.

**Step 2: Add the test script to root `package.json`**

Edit `package.json` (root). In the `scripts` section, add a `test` entry:

```json
"test": "vitest run"
```

The full scripts block becomes:

```json
"scripts": {
  "dev": "pnpm --filter potnuse dev",
  "build": "pnpm --filter potnuse build",
  "preview": "pnpm --filter potnuse preview",
  "deploy": "pnpm --filter potnuse build && pnpm --filter potnuse exec wrangler --cwd ../.. deploy",
  "generate-types": "pnpm --filter potnuse generate-types",
  "test": "vitest run"
},
```

**Step 3: Create `vitest.config.ts` at root**

Create `vitest.config.ts` (at repo root):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

`passWithNoTests: true` means `pnpm test` succeeds even before any test files exist (we run it once now to verify the wiring; tests come later).

**Step 4: Verify Vitest runs**

Run: `pnpm test`
Expected: vitest starts, reports `No test files found, exiting with code 0` (or similar — exit code 0 is what matters).

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "$(cat <<'EOF'
chore: add vitest at workspace root

Configures test discovery across packages/*/src/**/*.test.ts. No tests
exist yet (passWithNoTests so the script succeeds); this just stages
the runner ahead of the @rdm/widget-protocol package landing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Bootstrap the `@rdm/widget-protocol` package skeleton

Create the package directory, `package.json`, `tsconfig.json`, and an empty `src/index.ts`. Verify pnpm picks it up as a workspace member and `tsc` builds clean.

**Files:**
- Create: `packages/widget-protocol/package.json`
- Create: `packages/widget-protocol/tsconfig.json`
- Create: `packages/widget-protocol/src/index.ts` (empty barrel placeholder)
- Touched: `pnpm-lock.yaml` (regenerated)

**Step 1: Make the package directory**

Run: `mkdir -p packages/widget-protocol/src`

**Step 2: Write `packages/widget-protocol/package.json`**

```json
{
  "name": "@rdm/widget-protocol",
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
    "./manifest": {
      "types": "./dist/manifest.d.ts",
      "import": "./dist/manifest.js"
    },
    "./envelopes": {
      "types": "./dist/envelopes.d.ts",
      "import": "./dist/envelopes.js"
    },
    "./capabilities": {
      "types": "./dist/capabilities.d.ts",
      "import": "./dist/capabilities.js"
    },
    "./lifecycle": {
      "types": "./dist/lifecycle.d.ts",
      "import": "./dist/lifecycle.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "zod": "^3 || ^4"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "zod": "^3 || ^4"
  }
}
```

The `peerDependencies` declares the contract; the matching entry in `devDependencies` is so the package's own tests/build have zod available locally. `^3 || ^4` accepts either major — Zod 3 and 4 use the same API surface for what we use.

**Step 3: Write `packages/widget-protocol/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
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
  "exclude": ["dist", "**/*.test.ts"]
}
```

**Step 4: Create empty barrel `packages/widget-protocol/src/index.ts`**

Create the file with a single comment so it's not literally empty:

```ts
// @rdm/widget-protocol — public surface re-exports land here as modules ship.
export {};
```

**Step 5: Install workspace deps**

Run: `pnpm install`
Expected: pnpm picks up the new package, installs `zod` and `typescript` into `packages/widget-protocol/node_modules`, completes without errors. The line `+ @rdm/widget-protocol@0.0.0` does NOT appear (it's a workspace member, not an install target).

Verify the package is visible to pnpm:

Run: `pnpm -r ls --depth=-1 2>/dev/null | grep -E 'widget-protocol|potnuse'`
Expected output includes both `@rdm/widget-protocol` and `potnuse`.

**Step 6: Verify the build pipeline**

Run: `pnpm --filter @rdm/widget-protocol build`
Expected: tsc completes silently. Verify the output:

Run: `ls packages/widget-protocol/dist`
Expected: `index.js`, `index.d.ts`, `index.js.map`, `index.d.ts.map` (four files, since `src/index.ts` is one source).

**Step 7: Verify Vitest still runs**

Run: `pnpm test`
Expected: still `No test files found`, exit 0.

**Step 8: Commit**

```bash
git add packages/widget-protocol/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(widget-protocol): bootstrap package skeleton

@rdm/widget-protocol is the typed contract every substrate piece will
consume (canvas-runtime, widgets-browser, morel). Lands as an empty
ESM-only package built with tsc — modules (manifest, envelopes,
capabilities, lifecycle) ship in subsequent commits via TDD.

Per-module exports declared in package.json so consumers can opt into
just what they use.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `capabilities` module (TDD)

Smallest module — implement first because `manifest` later imports `CapabilitySchema` from here.

**Files:**
- Create: `packages/widget-protocol/src/capabilities.test.ts`
- Create: `packages/widget-protocol/src/capabilities.ts`

**Step 1: Write the failing test**

Create `packages/widget-protocol/src/capabilities.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  CapabilitySchema,
  CAPABILITY_PATTERN,
  type KnownCapability,
  type Capability,
} from './capabilities';

describe('CapabilitySchema', () => {
  test('parses simple domain.verb', () => {
    expect(CapabilitySchema.parse('fs.read')).toBe('fs.read');
  });

  test('parses dotted-suffix forms (sub-namespacing)', () => {
    expect(CapabilitySchema.parse('fs.read.scoped')).toBe('fs.read.scoped');
  });

  test('rejects single-segment names', () => {
    expect(() => CapabilitySchema.parse('fs')).toThrow();
  });

  test('rejects uppercase', () => {
    expect(() => CapabilitySchema.parse('FS.read')).toThrow();
  });

  test('rejects names starting with a digit', () => {
    expect(() => CapabilitySchema.parse('1fs.read')).toThrow();
  });

  test('rejects empty string', () => {
    expect(() => CapabilitySchema.parse('')).toThrow();
  });

  test('rejects names with hyphens (capabilities use dots only)', () => {
    expect(() => CapabilitySchema.parse('fs-read')).toThrow();
  });
});

describe('CAPABILITY_PATTERN', () => {
  test('exposes the regex as a constant', () => {
    expect(CAPABILITY_PATTERN.test('fs.read')).toBe(true);
    expect(CAPABILITY_PATTERN.test('FS.read')).toBe(false);
  });
});

describe('Capability type (compile-time)', () => {
  test('KnownCapability values are assignable to Capability', () => {
    const known: KnownCapability = 'fs.read';
    const c: Capability = known;
    expect(c).toBe('fs.read');
  });

  test('arbitrary strings are assignable to Capability', () => {
    const c: Capability = 'rdm.experimental.draw';
    expect(c).toBe('rdm.experimental.draw');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: vitest reports failures. The errors should be of the form `Failed to resolve import './capabilities'` for every test (module doesn't exist yet) — that's the failure we want.

**Step 3: Write minimal implementation**

Create `packages/widget-protocol/src/capabilities.ts`:

```ts
import { z } from 'zod';

export const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const CapabilitySchema = z.string().regex(
  CAPABILITY_PATTERN,
  'capability must be domain.verb (lowercase, dot-separated)'
);

export type KnownCapability =
  | 'fs.read'
  | 'fs.write'
  | 'fs.watch'
  | 'pty.spawn'
  | 'pty.attach'
  | 'llm.complete'
  | 'clipboard.read'
  | 'clipboard.write'
  | 'notifications.notify'
  | 'os.globalHotkey'
  | 'os.openWith'
  | 'os.dragIn';

export type Capability = KnownCapability | (string & {});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all `CapabilitySchema`, `CAPABILITY_PATTERN`, and `Capability type` tests pass. Should be ~10 passing tests.

Also typecheck:

Run: `pnpm --filter @rdm/widget-protocol typecheck`
Expected: silent (no errors).

**Step 5: Commit**

```bash
git add packages/widget-protocol/src/capabilities.ts packages/widget-protocol/src/capabilities.test.ts
git commit -m "$(cat <<'EOF'
feat(widget-protocol): capabilities module

CapabilitySchema validates domain.verb shape (one or more dot-separated
lowercase segments). KnownCapability lists the v1 set; Capability is
the hybrid type (KnownCapability | (string & {})) for autocomplete on
known caps + free-form on experimental ones.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `lifecycle` module (TDD)

Independent of all other modules. Small — enum + transition table.

**Files:**
- Create: `packages/widget-protocol/src/lifecycle.test.ts`
- Create: `packages/widget-protocol/src/lifecycle.ts`

**Step 1: Write the failing test**

Create `packages/widget-protocol/src/lifecycle.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  WidgetLifecycleStateSchema,
  VALID_TRANSITIONS,
  type WidgetLifecycleState,
} from './lifecycle';

const ALL_STATES: WidgetLifecycleState[] = [
  'loading',
  'ready',
  'active',
  'suspended',
  'unloaded',
];

describe('WidgetLifecycleStateSchema', () => {
  test.each(ALL_STATES)('parses %s', (s) => {
    expect(WidgetLifecycleStateSchema.parse(s)).toBe(s);
  });

  test('rejects unknown state', () => {
    expect(() => WidgetLifecycleStateSchema.parse('error')).toThrow();
  });

  test('rejects empty string', () => {
    expect(() => WidgetLifecycleStateSchema.parse('')).toThrow();
  });
});

describe('VALID_TRANSITIONS', () => {
  test('every state has an entry', () => {
    for (const state of ALL_STATES) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  test('unloaded is terminal (no outbound transitions)', () => {
    expect(VALID_TRANSITIONS.unloaded).toEqual([]);
  });

  test('every transition target is itself a valid state', () => {
    const validStates = new Set<WidgetLifecycleState>(ALL_STATES);
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(validStates).toContain(t);
      }
    }
  });

  test('active and suspended toggle to each other', () => {
    expect(VALID_TRANSITIONS.active).toContain('suspended');
    expect(VALID_TRANSITIONS.suspended).toContain('active');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: import-resolution failures for `./lifecycle`. The capabilities tests should still pass (independent).

**Step 3: Write minimal implementation**

Create `packages/widget-protocol/src/lifecycle.ts`:

```ts
import { z } from 'zod';

export const WidgetLifecycleStateSchema = z.enum([
  'loading',
  'ready',
  'active',
  'suspended',
  'unloaded',
]);

export type WidgetLifecycleState = z.infer<typeof WidgetLifecycleStateSchema>;

export const VALID_TRANSITIONS: Record<WidgetLifecycleState, WidgetLifecycleState[]> = {
  loading: ['ready', 'unloaded'],
  ready: ['active', 'unloaded'],
  active: ['suspended', 'unloaded'],
  suspended: ['active', 'unloaded'],
  unloaded: [],
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all lifecycle tests pass, plus the capabilities tests still passing.

Run: `pnpm --filter @rdm/widget-protocol typecheck`
Expected: silent.

**Step 5: Commit**

```bash
git add packages/widget-protocol/src/lifecycle.ts packages/widget-protocol/src/lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(widget-protocol): lifecycle module

WidgetLifecycleStateSchema enumerates the five widget states.
VALID_TRANSITIONS is exported data describing the legal transitions;
canvas-runtime imports the table to enforce them at runtime. The
protocol package itself stays runtime-free.

No 'error' state by design — failed loads transition to unloaded and
surface failure as an event.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `envelopes` module (TDD)

The biggest module. Three envelope kinds + a discriminated union, with a nested `outcome` discriminator inside `Response`.

**Files:**
- Create: `packages/widget-protocol/src/envelopes.test.ts`
- Create: `packages/widget-protocol/src/envelopes.ts`

**Step 1: Write the failing test**

Create `packages/widget-protocol/src/envelopes.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  RequestSchema,
  ResponseSchema,
  EventSchema,
  ProtocolMessageSchema,
} from './envelopes';

describe('RequestSchema', () => {
  test('parses a minimal request', () => {
    expect(RequestSchema.parse({ type: 'req', id: '1', method: 'fs.read' })).toEqual({
      type: 'req',
      id: '1',
      method: 'fs.read',
    });
  });

  test('parses a request with params', () => {
    const r = RequestSchema.parse({
      type: 'req',
      id: '1',
      method: 'fs.read',
      params: { path: '/x' },
    });
    expect(r.params).toEqual({ path: '/x' });
  });

  test('rejects empty id', () => {
    expect(() =>
      RequestSchema.parse({ type: 'req', id: '', method: 'fs.read' })
    ).toThrow();
  });

  test('rejects malformed method (single segment)', () => {
    expect(() =>
      RequestSchema.parse({ type: 'req', id: '1', method: 'fs' })
    ).toThrow();
  });

  test('rejects type=res', () => {
    expect(() =>
      RequestSchema.parse({ type: 'res', id: '1', method: 'fs.read' })
    ).toThrow();
  });
});

describe('ResponseSchema', () => {
  test('parses an ok response with result', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: { data: 42 },
    });
    expect(r).toMatchObject({ type: 'res', outcome: 'ok', result: { data: 42 } });
  });

  test('parses an err response with error', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'err',
      error: { code: 'capability/denied', message: 'no' },
    });
    expect(r).toMatchObject({
      type: 'res',
      outcome: 'err',
      error: { code: 'capability/denied', message: 'no' },
    });
  });

  test('strips an error field on an ok response (Zod default strip)', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: 1,
      error: { code: 'x', message: 'y' },
    });
    expect(r).toEqual({ type: 'res', id: '1', outcome: 'ok', result: 1 });
  });

  test('rejects err response with no error field', () => {
    expect(() =>
      ResponseSchema.parse({ type: 'res', id: '1', outcome: 'err' })
    ).toThrow();
  });

  test('rejects unknown outcome', () => {
    expect(() =>
      ResponseSchema.parse({ type: 'res', id: '1', outcome: 'maybe' })
    ).toThrow();
  });

  test('narrows result vs error via outcome discriminator', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: 42,
    });
    if (r.outcome === 'ok') {
      // TS: r.result is in scope, r.error is not
      expect(r.result).toBe(42);
    } else {
      throw new Error('should have narrowed to ok');
    }
  });
});

describe('EventSchema', () => {
  test('parses a minimal event', () => {
    expect(EventSchema.parse({ type: 'event', name: 'widget.resized' })).toEqual({
      type: 'event',
      name: 'widget.resized',
    });
  });

  test('parses an event with payload', () => {
    const e = EventSchema.parse({
      type: 'event',
      name: 'widget.resized',
      payload: { w: 100, h: 100 },
    });
    expect(e.payload).toEqual({ w: 100, h: 100 });
  });

  test('rejects malformed name (single segment)', () => {
    expect(() => EventSchema.parse({ type: 'event', name: 'resized' })).toThrow();
  });

  test('rejects type=req', () => {
    expect(() => EventSchema.parse({ type: 'req', name: 'a.b' })).toThrow();
  });
});

describe('ProtocolMessageSchema', () => {
  test('narrows to req on type=req', () => {
    const m = ProtocolMessageSchema.parse({
      type: 'req',
      id: '1',
      method: 'fs.read',
    });
    if (m.type === 'req') {
      expect(m.method).toBe('fs.read');
    } else {
      throw new Error('expected req');
    }
  });

  test('narrows to res on type=res', () => {
    const m = ProtocolMessageSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
    });
    expect(m.type).toBe('res');
  });

  test('narrows to event on type=event', () => {
    const m = ProtocolMessageSchema.parse({ type: 'event', name: 'a.b' });
    expect(m.type).toBe('event');
  });

  test('rejects unknown type', () => {
    expect(() => ProtocolMessageSchema.parse({ type: 'unknown' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: import-resolution failures for `./envelopes`. Existing capabilities + lifecycle tests still pass.

**Step 3: Write minimal implementation**

Create `packages/widget-protocol/src/envelopes.ts`:

```ts
import { z } from 'zod';

const EnvelopeIdSchema = z.string().min(1);
const NamespacedNameSchema = z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);

export const RequestSchema = z.object({
  type: z.literal('req'),
  id: EnvelopeIdSchema,
  method: NamespacedNameSchema,
  params: z.unknown().optional(),
});

export const ResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    type: z.literal('res'),
    id: EnvelopeIdSchema,
    outcome: z.literal('ok'),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('res'),
    id: EnvelopeIdSchema,
    outcome: z.literal('err'),
    error: z.object({
      code: z.string(),
      message: z.string(),
      data: z.unknown().optional(),
    }),
  }),
]);

export const EventSchema = z.object({
  type: z.literal('event'),
  name: NamespacedNameSchema,
  payload: z.unknown().optional(),
});

export const ProtocolMessageSchema = z.discriminatedUnion('type', [
  RequestSchema,
  ResponseSchema,
  EventSchema,
]);

export type Request = z.infer<typeof RequestSchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type Event = z.infer<typeof EventSchema>;
export type ProtocolMessage = z.infer<typeof ProtocolMessageSchema>;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all envelope tests pass alongside the prior modules.

Run: `pnpm --filter @rdm/widget-protocol typecheck`
Expected: silent.

**Step 5: Commit**

```bash
git add packages/widget-protocol/src/envelopes.ts packages/widget-protocol/src/envelopes.test.ts
git commit -m "$(cat <<'EOF'
feat(widget-protocol): envelopes module

Three envelope kinds (req/res/event) discriminated by 'type'. Response
nests an additional 'outcome' discriminator so once outcome === 'ok'
is checked, result is in scope and error is not (and vice versa) —
strict TS narrowing throughout.

method and event name share the capability domain.verb regex; the
capability's name *is* its method namespace.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `manifest` module (TDD)

Imports `CapabilitySchema` from `./capabilities`. Includes the kind-specific entry refinement.

**Files:**
- Create: `packages/widget-protocol/src/manifest.test.ts`
- Create: `packages/widget-protocol/src/manifest.ts`

**Step 1: Write the failing test**

Create `packages/widget-protocol/src/manifest.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { WidgetManifestSchema, type WidgetManifest } from './manifest';

const VALID_IFRAME_MANIFEST = {
  id: 'rdm.widget.markdown-editor',
  version: '0.3.0',
  kind: 'iframe' as const,
  entry: 'https://widgets.example.com/markdown/index.html',
};

describe('WidgetManifestSchema', () => {
  test('parses a minimal valid iframe manifest', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m).toMatchObject({
      id: 'rdm.widget.markdown-editor',
      kind: 'iframe',
      capabilities: [],
      protocolVersion: 1,
    });
  });

  test('parses a native manifest with module specifier entry', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        kind: 'native',
        entry: '@rdm/widgets-browser/markdown',
      })
    ).not.toThrow();
  });

  test('rejects iframe entry that is not http(s)', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        entry: '/local/path',
      })
    ).toThrow(/iframe entry must be an http\(s\) URL/);
  });

  test('rejects single-segment id', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, id: 'foo' })
    ).toThrow();
  });

  test('rejects uppercase id', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, id: 'Rdm.widget.x' })
    ).toThrow();
  });

  test('rejects non-semver version', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, version: '1' })
    ).toThrow();
  });

  test('accepts pre-release semver version', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        version: '1.2.3-beta.4',
      })
    ).not.toThrow();
  });

  test('defaults capabilities to []', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m.capabilities).toEqual([]);
  });

  test('defaults protocolVersion to 1', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m.protocolVersion).toBe(1);
  });

  test('rejects protocolVersion 2', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, protocolVersion: 2 })
    ).toThrow();
  });

  test('parses optional defaultSize', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      defaultSize: { w: 480, h: 360 },
    });
    expect(m.defaultSize).toEqual({ w: 480, h: 360 });
  });

  test('rejects negative defaultSize.w', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        defaultSize: { w: -1, h: 360 },
      })
    ).toThrow();
  });

  test('rejects non-integer defaultSize', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        defaultSize: { w: 100.5, h: 200 },
      })
    ).toThrow();
  });

  test('parses with capabilities array', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      capabilities: ['fs.read', 'fs.write'],
    });
    expect(m.capabilities).toEqual(['fs.read', 'fs.write']);
  });

  test('rejects malformed capability in array', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        capabilities: ['FS.read'],
      })
    ).toThrow();
  });

  test('parses optional name and description', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      name: 'Markdown Editor',
      description: 'A widget for editing markdown.',
    });
    expect(m.name).toBe('Markdown Editor');
    expect(m.description).toBe('A widget for editing markdown.');
  });
});

describe('WidgetManifest type (compile-time)', () => {
  test('inferred type accepts a literal manifest', () => {
    const m: WidgetManifest = {
      id: 'rdm.widget.x',
      version: '0.0.1',
      kind: 'iframe',
      entry: 'https://x.example/x.html',
      capabilities: [],
      protocolVersion: 1,
    };
    expect(m.id).toBe('rdm.widget.x');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: import-resolution failures for `./manifest`. The other three modules' tests still pass.

**Step 3: Write minimal implementation**

Create `packages/widget-protocol/src/manifest.ts`:

```ts
import { z } from 'zod';
import { CapabilitySchema } from './capabilities';

const WidgetIdSchema = z.string().regex(
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/,
  'widget id must be reverse-DNS-style: domain.namespace.name'
);

const SemverSchema = z.string().regex(
  /^\d+\.\d+\.\d+(-[\w.-]+)?$/,
  'must be semver'
);

export const WidgetManifestSchema = z.object({
  id: WidgetIdSchema,
  version: SemverSchema,
  kind: z.enum(['iframe', 'native']),
  entry: z.string(),
  capabilities: z.array(CapabilitySchema).default([]),
  defaultSize: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  protocolVersion: z.literal(1).default(1),
}).refine(
  (m) => m.kind !== 'iframe' || /^https?:\/\//.test(m.entry),
  { message: 'iframe entry must be an http(s) URL', path: ['entry'] }
);

export type WidgetManifest = z.infer<typeof WidgetManifestSchema>;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all manifest tests pass plus all prior. Total ~40-50 passing tests across the package.

Run: `pnpm --filter @rdm/widget-protocol typecheck`
Expected: silent.

**Step 5: Commit**

```bash
git add packages/widget-protocol/src/manifest.ts packages/widget-protocol/src/manifest.test.ts
git commit -m "$(cat <<'EOF'
feat(widget-protocol): manifest module

WidgetManifestSchema validates reverse-DNS ids, semver versions, the
iframe-vs-native kind, and the iframe-entry-must-be-http(s) refinement.
capabilities defaults to [], protocolVersion is literal 1 (future
breaking changes bump to 2 with a clean rejection path on the canvas).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Barrel `index.ts` and dist build verification

Replace the placeholder `index.ts` with real re-exports. Verify `tsc` builds the whole package and emits the expected `dist/` artifacts for every per-module export entry declared in `package.json`.

**Files:**
- Modify: `packages/widget-protocol/src/index.ts`

**Step 1: Replace the barrel placeholder**

Overwrite `packages/widget-protocol/src/index.ts`:

```ts
export * from './manifest';
export * from './envelopes';
export * from './capabilities';
export * from './lifecycle';
```

**Step 2: Build the package**

Run: `pnpm --filter @rdm/widget-protocol build`
Expected: tsc completes silently.

**Step 3: Verify expected dist artifacts**

Run: `ls packages/widget-protocol/dist`

Expected (16 files — 4 per source × 4 source modules + 4 for the barrel index):
```
capabilities.d.ts        capabilities.d.ts.map    capabilities.js          capabilities.js.map
envelopes.d.ts           envelopes.d.ts.map       envelopes.js             envelopes.js.map
index.d.ts               index.d.ts.map           index.js                 index.js.map
lifecycle.d.ts           lifecycle.d.ts.map       lifecycle.js             lifecycle.js.map
manifest.d.ts            manifest.d.ts.map        manifest.js              manifest.js.map
```

(That's 5 modules × 4 files = 20 files.)

If any module is missing, investigate before proceeding — it likely means `tsc` couldn't resolve a module or `include`/`exclude` in `tsconfig.json` is dropping something.

**Step 4: Verify the barrel re-exports everything**

Run a quick smoke check via Node:

```bash
node --input-type=module -e "import('./packages/widget-protocol/dist/index.js').then(m => console.log(Object.keys(m).sort().join('\\n')))"
```

Expected output (order doesn't matter, but at minimum these names must appear):
```
CAPABILITY_PATTERN
CapabilitySchema
EventSchema
ProtocolMessageSchema
RequestSchema
ResponseSchema
VALID_TRANSITIONS
WidgetLifecycleStateSchema
WidgetManifestSchema
```

(Type-only exports — `KnownCapability`, `Capability`, `Request`, `Response`, `Event`, `ProtocolMessage`, `WidgetLifecycleState`, `WidgetManifest` — are erased at runtime and won't appear in `Object.keys`.)

**Step 5: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass. Roughly 40-50 tests total.

**Step 6: Commit**

```bash
git add packages/widget-protocol/src/index.ts
git commit -m "$(cat <<'EOF'
feat(widget-protocol): barrel index re-exports the four modules

Consumers can `import { WidgetManifestSchema } from '@rdm/widget-protocol'`
or pick a specific subpath like '@rdm/widget-protocol/manifest' — both
resolve via the package.json exports map.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Workspace-level final sanity pass

Confirm nothing else in the workspace broke and the branch is ready for PR.

**Step 1: Confirm clean tree**

Run: `git status --short`
Expected: empty output. (The `dist/` directory at `packages/widget-protocol/dist` is gitignored via the workspace-root `.gitignore`'s `dist/` pattern, which matches at any depth.)

If `packages/widget-protocol/dist` shows up as untracked, the gitignore pattern isn't catching it. Verify with `git check-ignore packages/widget-protocol/dist` — should return the path. If it doesn't, add `dist/` to `packages/widget-protocol/.gitignore` or rely on the root one.

**Step 2: Inspect commits**

Run: `git log --oneline main..HEAD`

Expected eight commits in this order (top is most recent):

```
<sha> feat(widget-protocol): barrel index re-exports the four modules
<sha> feat(widget-protocol): manifest module
<sha> feat(widget-protocol): envelopes module
<sha> feat(widget-protocol): lifecycle module
<sha> feat(widget-protocol): capabilities module
<sha> feat(widget-protocol): bootstrap package skeleton
<sha> chore: add vitest at workspace root
<sha> docs: implementation plan for widget-protocol package
<sha> docs: design @rdm/widget-protocol package (milestone 2)
```

(Two pre-existing docs commits — design + plan — landed before this task list, so the count is ten total commits ahead of main.)

**Step 3: Run the entire test suite from the root**

Run: `pnpm test`
Expected: all tests pass.

**Step 4: Verify the site still builds**

Run: `pnpm build`
Expected: the existing site still builds clean — 11 pages, same as baseline. The monorepo conversion in milestone 1 means the site is unaffected by the new package, but verify.

**Step 5: Verify the package builds**

Run: `pnpm --filter @rdm/widget-protocol build`
Expected: tsc clean.

**Step 6: Done.**

The branch is ready for PR. Push and open per `superpowers:finishing-a-development-branch`.

---

## Out of scope for this PR

- **`canvas-runtime` package.** Lands in milestone 3.
- **`widgets-browser` package.** Milestone 4.
- **Capability-specific param/result schemas** (e.g., `fs.ReadParams`, `pty.SpawnResult`). Live closer to capability implementations.
- **Publishing to npm.** Stays workspace-internal.
- **A shared `tsconfig.base.json`** at workspace root. Not needed yet — `widget-protocol`'s tsconfig stands alone.
- **Stricter `passthrough` / `strict` mode on Zod schemas.** v1 uses Zod's default `strip` behavior; revisit when we have a real reason to reject extra fields.

## Failure modes to watch for

- **`zod ^3 || ^4` peer range** — if pnpm resolves differently from what the test code assumes, a subtle API drift could fail. Both 3.x and 4.x support every method we use; if anything fails, pin to one major.
- **`verbatimModuleSyntax: true`** in tsconfig will reject `import { type X } from ...` mixed-mode imports. The plan uses pure `type` re-exports through `export *` which is fine, but if the implementer adds `import { Foo, type Bar }` they'll get an error. Either split the imports or drop `verbatimModuleSyntax`. Recommended: keep `verbatimModuleSyntax`, split imports.
- **Vitest test discovery** — if `pnpm test` reports zero tests after Task 3 (when tests exist), check `vitest.config.ts` `include` glob and confirm test files end in `.test.ts` (not `.spec.ts`).
- **Per-module exports map** — if a consumer (in a future milestone) imports `'@rdm/widget-protocol/manifest'` and it 404s, the `exports` block in `package.json` is mis-keyed. Verified in Task 2; doesn't need re-checking unless it changes.
