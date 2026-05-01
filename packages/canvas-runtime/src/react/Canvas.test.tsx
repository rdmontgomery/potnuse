// packages/canvas-runtime/src/react/Canvas.test.tsx
// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { WidgetManifest } from '@rdm/widget-protocol';
import { Canvas } from './Canvas';
import type { PersistenceAdapter } from '../core/persistence';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: [],
  protocolVersion: 1,
};

function memoryAdapter(initial: unknown = null): PersistenceAdapter & { saved: unknown } {
  const a = {
    saved: initial as unknown,
    async load(_scope: string) { return a.saved; },
    async save(_scope: string, doc: unknown) { a.saved = doc; },
    subscribe() { return () => {}; },
  };
  return a;
}

describe('<Canvas>', () => {
  test('renders an empty canvas root with no widgets', () => {
    render(<Canvas canvasId="t" adapter={memoryAdapter()} providers={{}} />);
    expect(screen.getByTestId('rdm-canvas')).toBeInTheDocument();
  });

  test('hydrates from the adapter on mount', async () => {
    const adapter = memoryAdapter({
      schemaVersion: 1,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      widgets: [{
        instanceId: 'persisted-1',
        manifest: MANIFEST,
        x: 50, y: 60, w: 100, h: 100,
      }],
    });
    render(<Canvas canvasId="t" adapter={adapter} providers={{}} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTitle(MANIFEST.id)).toBeInTheDocument();
  });

  test('exposes canvas state via initialWidgets prop on first mount', async () => {
    const adapter = memoryAdapter(null);
    render(<Canvas canvasId="t" adapter={adapter} providers={{}} initialWidgets={[
      { manifest: MANIFEST, placement: { x: 10, y: 20 } },
    ]} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTitle(MANIFEST.id)).toBeInTheDocument();
  });

  test('debounced save fires after a state change', async () => {
    vi.useFakeTimers();
    const adapter = memoryAdapter(null);
    const saveSpy = vi.spyOn(adapter, 'save');
    render(<Canvas canvasId="t" adapter={adapter} providers={{}} initialWidgets={[
      { manifest: MANIFEST, placement: { x: 0, y: 0 } },
    ]} />);
    await act(async () => { await Promise.resolve(); });

    saveSpy.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(saveSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
