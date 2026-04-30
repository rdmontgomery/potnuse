import { describe, expect, test } from 'vitest';
import {
  emptyCanvasDocument,
  createWidgetEntry,
  type CanvasDocument,
} from './document';
import type { WidgetManifest } from '@rdm/widget-protocol';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: [],
  protocolVersion: 1,
};

describe('emptyCanvasDocument', () => {
  test('returns a document with schemaVersion 1, default viewport, no widgets', () => {
    const doc = emptyCanvasDocument();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
    expect(doc.widgets).toEqual([]);
  });
});

describe('createWidgetEntry', () => {
  test('produces an entry with random instanceId and lifecycle=loading', () => {
    const e = createWidgetEntry(MANIFEST, { x: 100, y: 200 });
    expect(e.instanceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.lifecycle).toBe('loading');
    expect(e.x).toBe(100);
    expect(e.y).toBe(200);
    expect(e.manifest).toBe(MANIFEST);
  });

  test('uses manifest defaultSize when no size override', () => {
    const e = createWidgetEntry(
      { ...MANIFEST, defaultSize: { w: 480, h: 360 } },
      { x: 0, y: 0 }
    );
    expect(e.w).toBe(480);
    expect(e.h).toBe(360);
  });

  test('uses fallback size 320x240 when manifest has no defaultSize', () => {
    const e = createWidgetEntry(MANIFEST, { x: 0, y: 0 });
    expect(e.w).toBe(320);
    expect(e.h).toBe(240);
  });

  test('size override wins over manifest defaultSize', () => {
    const e = createWidgetEntry(
      { ...MANIFEST, defaultSize: { w: 480, h: 360 } },
      { x: 0, y: 0, w: 600, h: 400 }
    );
    expect(e.w).toBe(600);
    expect(e.h).toBe(400);
  });

  test('two calls produce distinct instanceIds', () => {
    const a = createWidgetEntry(MANIFEST, { x: 0, y: 0 });
    const b = createWidgetEntry(MANIFEST, { x: 0, y: 0 });
    expect(a.instanceId).not.toBe(b.instanceId);
  });
});
