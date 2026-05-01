// packages/canvas-runtime/src/react/WidgetWindow.test.tsx
// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasProvider } from './hooks';
import { WidgetWindow } from './WidgetWindow';
import { createCanvasStore } from '../store/canvasStore';
import type { WidgetManifest } from '@rdm/widget-protocol';

const MANIFEST: WidgetManifest = {
  id: 'rdm.test.x',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'https://x.example/x.html',
  capabilities: [],
  protocolVersion: 1,
  name: 'Test Widget',
};

function setup() {
  const store = createCanvasStore();
  const id = store.getState().addWidget(MANIFEST, { x: 100, y: 100, w: 200, h: 150 });
  const utils = render(
    <CanvasProvider store={store}>
      <WidgetWindow instanceId={id} />
    </CanvasProvider>
  );
  return { ...utils, store, id };
}

describe('<WidgetWindow>', () => {
  test('renders with manifest name in the title bar', () => {
    setup();
    expect(screen.getByText('Test Widget')).toBeInTheDocument();
  });

  test('renders an iframe with the manifest entry as src and sandbox=allow-scripts', () => {
    setup();
    const iframe = screen.getByTitle('Test Widget') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://x.example/x.html');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  test('positions the window at (x, y) with (w, h) via inline style', () => {
    const { container } = setup();
    const root = container.querySelector('[data-rdm-widget-window]') as HTMLElement;
    expect(root.style.left).toBe('100px');
    expect(root.style.top).toBe('100px');
    expect(root.style.width).toBe('200px');
    expect(root.style.height).toBe('150px');
  });

  test('clicking the close button transitions the widget to unloaded and removes it', () => {
    const { store, id } = setup();
    fireEvent.click(screen.getByLabelText('Close widget'));
    expect(store.getState().document.widgets.find((w) => w.instanceId === id)).toBeUndefined();
  });

  test('dragging the title bar moves the widget by the cursor delta in canvas space', () => {
    const { container, store, id } = setup();
    const titleBar = container.querySelector('[data-rdm-titlebar]') as HTMLElement;

    fireEvent.pointerDown(titleBar, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 30, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 30, clientY: 40, pointerId: 1 });

    const w = store.getState().document.widgets.find((w) => w.instanceId === id)!;
    expect(w.x).toBe(130);
    expect(w.y).toBe(140);
  });
});
