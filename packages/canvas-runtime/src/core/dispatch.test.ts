// packages/canvas-runtime/src/core/dispatch.test.ts
import { describe, expect, test, vi } from 'vitest';
import type { Request, WidgetManifest } from '@rdm/widget-protocol';
import { dispatch, type Provider, type CapabilityCtx } from './dispatch';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: ['clipboard.read', 'clipboard.write'],
  protocolVersion: 1,
};

const ctx: CapabilityCtx = {
  instanceId: 'i-1',
  manifestId: MANIFEST.id,
  signal: new AbortController().signal,
  log: () => {},
};

const REQ = (method: string, params?: unknown): Request => ({
  type: 'req',
  id: '1',
  method,
  ...(params !== undefined ? { params } : {}),
});

describe('dispatch', () => {
  test('returns ok with provider result on happy path', async () => {
    const providers = new Map<string, Provider>([
      ['clipboard', { read: async () => ({ text: 'hi' }) }],
    ]);
    const r = await dispatch(REQ('clipboard.read'), MANIFEST, providers, 1000, ctx);
    expect(r).toEqual({ ok: true, result: { text: 'hi' } });
  });

  test('returns capability/denied when method not in manifest.capabilities', async () => {
    const providers = new Map<string, Provider>([
      ['fs', { read: async () => 'should not run' }],
    ]);
    const r = await dispatch(REQ('fs.read'), MANIFEST, providers, 1000, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('capability/denied');
  });

  test('returns capability/unavailable when domain has no provider', async () => {
    const providers = new Map<string, Provider>();
    const r = await dispatch(REQ('clipboard.read'), MANIFEST, providers, 1000, ctx);
    if (r.ok) throw new Error('expected error');
    expect(r.error.code).toBe('capability/unavailable');
  });

  test('returns method/unknown when provider lacks the method', async () => {
    const providers = new Map<string, Provider>([
      ['clipboard', { read: async () => 'x' }],
    ]);
    const r = await dispatch(REQ('clipboard.write', { text: 'y' }), MANIFEST, providers, 1000, ctx);
    if (r.ok) throw new Error('expected error');
    expect(r.error.code).toBe('method/unknown');
  });

  test('returns provider/error when handler throws', async () => {
    const providers = new Map<string, Provider>([
      ['clipboard', { read: async () => { throw new Error('boom'); } }],
    ]);
    const r = await dispatch(REQ('clipboard.read'), MANIFEST, providers, 1000, ctx);
    if (r.ok) throw new Error('expected error');
    expect(r.error.code).toBe('provider/error');
    expect(r.error.message).toContain('boom');
  });

  test('returns provider/timeout when handler does not resolve in time', async () => {
    vi.useFakeTimers();
    const providers = new Map<string, Provider>([
      ['clipboard', { read: () => new Promise(() => {}) }],
    ]);
    const promise = dispatch(REQ('clipboard.read'), MANIFEST, providers, 50, ctx);
    await vi.advanceTimersByTimeAsync(60);
    const r = await promise;
    if (r.ok) throw new Error('expected error');
    expect(r.error.code).toBe('provider/timeout');
    vi.useRealTimers();
  });

  test('passes ctx and parsed params to the handler', async () => {
    const handler = vi.fn(async (params: unknown, _ctx: CapabilityCtx) => params);
    const providers = new Map<string, Provider>([
      ['clipboard', { read: handler }],
    ]);
    await dispatch(REQ('clipboard.read', { mode: 'plain' }), MANIFEST, providers, 1000, ctx);
    expect(handler).toHaveBeenCalledWith({ mode: 'plain' }, expect.objectContaining({
      instanceId: 'i-1',
      manifestId: 'rdm.test.x',
    }));
  });
});
