# `@rdm/widget-protocol` package — design

Date: 2026-04-29
Status: design (pre-implementation)
Milestone: 2 of N (canvas substrate roadmap)

## What this is

The first concrete package in the canvas-substrate workspace. `@rdm/widget-protocol` is the typed contract every widget and the canvas-runtime agree on: manifest shape, RPC envelope shape, capability namespace, and lifecycle states. It is pure declarations — Zod schemas, inferred TypeScript types, and a small amount of constant data (lifecycle transition table, capability regex). No transport, no runtime, no React.

It is the package every other piece in this workspace will depend on:

- `canvas-runtime` (later milestone) imports it to validate incoming widget messages and broker capability calls.
- `widgets-browser` (later milestone) imports it to declare manifests and type widget message handlers.
- `morel` (separate repo, later) imports it to validate WebSocket envelopes from the frontend.

Defining it first, before any of those exist, forces the discipline of "what does a widget actually look like?" before a runtime grows around accidental answers.

## Goals and non-goals

**Goals**

- One source of truth for the wire shape that crosses every trust boundary in the substrate (widget ↔ canvas, canvas ↔ host).
- Runtime validation at boundaries — Zod schemas, not just types.
- Ergonomic for widget authors: a manifest is a small JSON-shaped object; the schema gives clear error messages when wrong.
- Extensible: known capabilities have autocomplete; experimental capabilities still typecheck.
- Tiny package surface; small enough to read in one sitting.

**Non-goals**

- No transport code. postMessage adapters, MessagePort wiring, WebSocket envelopes are `canvas-runtime` and `morel` concerns.
- No widget runtime helpers (React hooks, lifecycle managers). Those are `widgets-browser`.
- No registry. Just types describing what a registry would look like.
- No capability granularity (scoped paths, time-windows, quotas). v1 capabilities are bare strings; granularity is post-v1 and may live in capability-specific schemas elsewhere.
- No author/icon/integrity metadata in the manifest. Defer until something needs them.

## Package shape

**Location:** `packages/widget-protocol/` in the existing pnpm workspace (already covered by `packages/*`).

**Name:** `@rdm/widget-protocol`.

**Source/build:**

- TypeScript sources in `src/`, ESM-only output in `dist/`.
- `tsc` is the entire build pipeline. No bundler. Consumers import individual modules and let their own bundlers do the work.
- `package.json` exports map declares per-module entries (`./manifest`, `./envelopes`, `./capabilities`, `./lifecycle`) plus `.` as a barrel, so consumers can opt in to just what they use.
- `package.json` `"type": "module"`. Targets `ES2022`. Declaration files emitted alongside JS.
- `peerDependencies`: `zod ^3` (matching whatever the workspace settles on; re-pinned if `zod ^4` lands first). No runtime dependencies of our own.

**Tests:** Vitest at the workspace root, configured to discover `packages/*/src/**/*.test.ts`. Adding Vitest is a single `pnpm add -Dw vitest` plus a root `pnpm test` script that runs `vitest run`.

**Public surface (v1):**

- `manifest` module — `WidgetManifestSchema` and inferred `WidgetManifest` type.
- `envelopes` module — `RequestSchema`, `ResponseSchema`, `EventSchema`, the `ProtocolMessageSchema` discriminated union, and inferred types.
- `capabilities` module — `KnownCapability` union, `CapabilitySchema`, `CAPABILITY_PATTERN` regex.
- `lifecycle` module — `WidgetLifecycleStateSchema`, inferred `WidgetLifecycleState` type, and a `VALID_TRANSITIONS` constant.
- Barrel `index.ts` re-exporting everything.

## Manifest schema

```ts
// packages/widget-protocol/src/manifest.ts
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

**Key decisions:**

- **`id` is reverse-DNS** (`rdm.widget.markdown-editor`). Prevents collisions, signals namespacing.
- **`entry` is a single string with a kind-specific refinement.** `iframe` entries must be http(s) URLs; `native` entries are module specifiers the canvas-runtime resolves later.
- **`capabilities` defaults to `[]`** — a widget that asks for nothing is valid.
- **`defaultSize` optional** — canvas can pick.
- **`protocolVersion` literal `1`** — future breaking changes bump to `2`; canvas refuses mismatched versions cleanly.
- **camelCase field names** so the inferred TS type is ergonomic. Manifest JSON files use the same camelCase.

**Out of v1:** `author`, `homepage`, `icon`, `permissions` granularity beyond capability strings, signature/integrity.

## Envelope schemas

```ts
// packages/widget-protocol/src/envelopes.ts
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

**Key decisions:**

- **`type` discriminator** — easy to read, narrow, and debug.
- **`Response` uses a nested `outcome` discriminator** so once `outcome === 'ok'` is checked, `result` is accessible and `error` vanishes (and vice versa). Strict TypeScript narrowing throughout.
- **`error.code` is a free string**, not an enum. Conventions live in docs (`'capability/denied'`, `'envelope/invalid'`, `'method/unknown'`).
- **`method` and event `name` share the capability regex.** A capability called `fs.read` is invoked via `method: 'fs.read'`. The capability *is* the method namespace.
- **`params`, `result`, `payload`, `data` are `z.unknown()`.** Capability-specific schemas refine them at the next layer; the envelope is only the transport.
- **No `meta`, `traceId`, or `timestamp` field.** Add when something earns it.

## Capabilities

```ts
// packages/widget-protocol/src/capabilities.ts
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

**Key decisions:**

- **Hybrid type** (`KnownCapability | (string & {})`) gives autocomplete on the known set while accepting arbitrary `domain.verb` strings without widening to plain `string`.
- **Schema validates shape**, not membership. Whether the canvas honors an unknown capability is policy, not protocol.
- **v1 known set** is drawn from the substrate design doc plus the OS-integration capabilities Tauri will expose later. Adding capability names is non-breaking; removing one is a major bump.

## Lifecycle

```ts
// packages/widget-protocol/src/lifecycle.ts
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

**Key decisions:**

- **No `error` state.** A widget that fails to load goes `loading → unloaded` and the canvas surfaces the failure as an event. Adding a top-level `error` state implies recovery flows we don't have.
- **`VALID_TRANSITIONS` is exported data, not enforced behavior.** Canvas-runtime imports the table and rejects illegal transitions. Protocol package stays runtime-free.

## Tests

For each module, a sibling `*.test.ts` covering:

- **`manifest.test.ts`** — minimal valid manifest parses; missing `id`/`version`/`kind`/`entry` rejects with the expected `path`; iframe entry refinement rejects non-http URLs; default `capabilities: []` populated; default `protocolVersion: 1` populated; reverse-DNS id regex rejects single-segment ids and uppercase.
- **`envelopes.test.ts`** — `req`/`res`/`event` parse; `ProtocolMessageSchema` narrows correctly via `type` discriminator; `ResponseSchema` `outcome` discriminator narrows `result` vs `error`; missing `id` rejects; bad `method` regex rejects; unknown extra fields rejected (Zod default — confirm).
- **`capabilities.test.ts`** — `fs.read` parses; `FS.READ` (uppercase) rejects; `fs` (single segment) rejects; `fs.read.scoped` (three segments) parses (the regex allows `domain.verb` and additionally `domain.verb.suffix`); confirm intent. Decision: regex permits `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` which means *one or more* dot-separated segments after the first, so `fs.read.scoped` does parse. That's intentional — leaves room for sub-namespacing without a regex change.
- **`lifecycle.test.ts`** — every enum value parses; non-enum string rejects; `VALID_TRANSITIONS` shape: every key has a value, no transitions out of `unloaded`.

Tests are co-located in `src/` (not a separate `tests/` directory) so a consumer reading the package can see schema and tests side by side.

## Repository changes

Beyond the new package directory:

- **Root `package.json`** — add `vitest` as a dev dependency; add `"test": "vitest run"` script.
- **Workspace test config** — `vitest.config.ts` at workspace root pointing at `packages/*/src/**/*.test.ts`.
- **Root `tsconfig.json`** — none today, but probably the right time to add a `tsconfig.base.json` at root that `packages/widget-protocol/tsconfig.json` extends. Defer if the package's tsconfig can stand alone (it can — `tsc` doesn't need a shared base for one package).

## What's not in this PR

- The `canvas-runtime` package. That milestone will consume this protocol but doesn't exist yet.
- Any widget that uses the manifest. First widget lands with `widgets-browser`.
- Capability-specific param/result schemas (`fs.ReadParams`, `pty.SpawnResult`, etc.). Those live closer to the implementations of those capabilities — `morel` for backend caps, `canvas-runtime` for browser-only caps.
- Publishing to npm. The package stays workspace-internal until something outside the workspace needs it.

## Future doors kept open

- A `protocolVersion: 2` schema with breaking shape changes — the literal field gives canvas-runtime a clean rejection path.
- Capability-specific schemas as separate packages (`@rdm/cap-fs`, `@rdm/cap-pty`) that re-export per-method param/result types. Or a single growing module under `widget-protocol/src/methods/`. Either works; we don't have to decide today.
- A widget signature / integrity field in the manifest. Adds a new optional field, doesn't break existing manifests.
- HTML-in-Canvas-rendered native widgets — the `kind: "native"` branch already exists and the entry is a module specifier; nothing about the protocol changes.
