// packages/canvas-runtime/src/core/handshake.test.ts
import { describe, expect, test, vi } from 'vitest';
import { runHandshake } from './handshake';
import type { WidgetManifest } from '@rdm/widget-protocol';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/path.html',
  capabilities: [],
  protocolVersion: 1,
};

function fakeIframe() {
  const captured: Array<{ payload: unknown; origin: string; ports: MessagePort[] }> = [];
  const contentWindow = {
    postMessage: vi.fn((payload: unknown, origin: string, transfer?: Transferable[]) => {
      const ports = (transfer ?? []).filter((t): t is MessagePort => t instanceof MessagePort);
      captured.push({ payload, origin, ports });
    }),
  };
  return { iframe: { contentWindow } as unknown as HTMLIFrameElement, captured };
}

describe('runHandshake', () => {
  test('posts init to the iframe origin with a transferred port and returns the canvas port', async () => {
    const { iframe, captured } = fakeIframe();
    const result = await runHandshake({
      iframe,
      manifest: MANIFEST,
      instanceId: 'i-42',
    });

    expect(captured.length).toBe(1);
    // '*' so the message reaches sandboxed (null-origin) iframes too.
    expect(captured[0]!.origin).toBe('*');
    expect(captured[0]!.payload).toMatchObject({
      rdm: 'init',
      protocolVersion: 1,
      instanceId: 'i-42',
      manifestId: MANIFEST.id,
    });
    expect(captured[0]!.ports).toHaveLength(1);

    expect(result.canvasPort).toBeInstanceOf(MessagePort);
    expect(captured[0]!.ports[0]).toBeInstanceOf(MessagePort);
  });

  test('end-to-end: messages flow over the returned port', async () => {
    const { iframe, captured } = fakeIframe();
    const { canvasPort } = await runHandshake({
      iframe,
      manifest: MANIFEST,
      instanceId: 'i-42',
    });

    const widgetPort = captured[0]!.ports[0]!;
    widgetPort.start();
    canvasPort.start();

    const got = await new Promise<unknown>((resolve) => {
      canvasPort.addEventListener('message', (event) => resolve(event.data), { once: true });
      widgetPort.postMessage({ type: 'event', name: 'lifecycle.ready' });
    });
    expect(got).toEqual({ type: 'event', name: 'lifecycle.ready' });
  });
});
