// packages/canvas-runtime/src/react/hooks.test.tsx
// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { WidgetManifest } from '@rdm/widget-protocol';
import { createCanvasStore } from '../store/canvasStore';
import { CanvasProvider, useCanvas, useWidget, useViewport } from './hooks';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: [],
  protocolVersion: 1,
};

function wrapper(store = createCanvasStore()) {
  return ({ children }: { children: ReactNode }) => (
    <CanvasProvider store={store}>{children}</CanvasProvider>
  );
}

describe('useCanvas', () => {
  test('returns the document and store actions', () => {
    const store = createCanvasStore();
    const { result } = renderHook(() => useCanvas(), { wrapper: wrapper(store) });

    expect(result.current.document.widgets).toEqual([]);

    let id!: string;
    act(() => {
      id = result.current.addWidget(MANIFEST, { x: 0, y: 0 });
    });

    expect(result.current.document.widgets).toHaveLength(1);
    expect(result.current.document.widgets[0]!.instanceId).toBe(id);
  });
});

describe('useWidget', () => {
  test('returns the matching widget entry', () => {
    const store = createCanvasStore();
    const id = store.getState().addWidget(MANIFEST, { x: 0, y: 0 });
    const { result } = renderHook(() => useWidget(id), { wrapper: wrapper(store) });
    expect(result.current?.instanceId).toBe(id);
  });

  test('returns undefined for unknown id', () => {
    const { result } = renderHook(() => useWidget('nope'), { wrapper: wrapper() });
    expect(result.current).toBeUndefined();
  });
});

describe('useViewport', () => {
  test('returns viewport and panBy/setViewport actions', () => {
    const store = createCanvasStore();
    const { result } = renderHook(() => useViewport(), { wrapper: wrapper(store) });

    expect(result.current.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });

    act(() => {
      result.current.panBy({ dx: 10, dy: 20 });
    });

    expect(result.current.viewport).toMatchObject({ panX: 10, panY: 20 });
  });
});
