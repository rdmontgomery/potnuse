// packages/canvas-runtime/src/store/canvasStore.test.ts
import { describe, expect, test } from 'vitest';
import type { WidgetManifest } from '@rdm/widget-protocol';
import { createCanvasStore } from './canvasStore';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: [],
  protocolVersion: 1,
};

describe('createCanvasStore', () => {
  test('starts with empty document', () => {
    const store = createCanvasStore();
    const state = store.getState();
    expect(state.document.widgets).toEqual([]);
    expect(state.document.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  test('addWidget appends a widget entry in lifecycle=loading', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 50, y: 60 });
    const widgets = store.getState().document.widgets;
    expect(widgets).toHaveLength(1);
    expect(widgets[0]!.instanceId).toBe(id);
    expect(widgets[0]!.lifecycle).toBe('loading');
    expect(widgets[0]!.x).toBe(50);
  });

  test('removeWidget drops the entry', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 0, y: 0 });
    store.getState().removeWidget(id);
    expect(store.getState().document.widgets).toEqual([]);
  });

  test('moveWidget updates position by canvas-space delta', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 100, y: 100 });
    store.getState().moveWidget(id, { dx: 10, dy: -5 });
    const w = store.getState().document.widgets.find((w) => w.instanceId === id)!;
    expect(w.x).toBe(110);
    expect(w.y).toBe(95);
  });

  test('resizeWidget updates size by delta, floored at MIN_WIDGET_SIZE', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 0, y: 0, w: 200, h: 200 });
    store.getState().resizeWidget(id, { dx: -10000, dy: 0 });
    const w = store.getState().document.widgets.find((w) => w.instanceId === id)!;
    expect(w.w).toBeGreaterThanOrEqual(80);
  });

  test('setLifecycle rejects illegal transitions', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 0, y: 0 });
    expect(() => store.getState().setLifecycle(id, 'active')).toThrow(/illegal/);
  });

  test('setLifecycle accepts legal transitions', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 0, y: 0 });
    store.getState().setLifecycle(id, 'ready');
    store.getState().setLifecycle(id, 'active');
    const w = store.getState().document.widgets.find((w) => w.instanceId === id)!;
    expect(w.lifecycle).toBe('active');
  });

  test('panBy updates viewport pan', () => {
    const store = createCanvasStore();
    store.getState().panBy({ dx: 10, dy: 20 });
    expect(store.getState().document.viewport).toMatchObject({ panX: 10, panY: 20 });
  });

  test('setViewport replaces the viewport', () => {
    const store = createCanvasStore();
    store.getState().setViewport({ panX: 1, panY: 2, zoom: 3 });
    expect(store.getState().document.viewport).toEqual({ panX: 1, panY: 2, zoom: 3 });
  });

  test('hydrate replaces document with persisted snapshot, snapping lifecycle to loading', () => {
    const store = createCanvasStore();
    store.getState().hydrate({
      schemaVersion: 1,
      viewport: { panX: 5, panY: 5, zoom: 1.5 },
      widgets: [{
        instanceId: 'persisted-1',
        manifest: MANIFEST,
        x: 0, y: 0, w: 200, h: 200,
      }],
    });
    const w = store.getState().document.widgets[0]!;
    expect(w.instanceId).toBe('persisted-1');
    expect(w.lifecycle).toBe('loading');
    expect(store.getState().document.viewport.zoom).toBe(1.5);
  });
});
