// packages/canvas-runtime/src/core/viewport.test.ts
import { describe, expect, test } from 'vitest';
import {
  screenToCanvas,
  canvasToScreen,
  zoomAround,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  type Viewport,
} from './viewport';

const ID: Viewport = { panX: 0, panY: 0, zoom: 1 };

describe('screenToCanvas', () => {
  test('identity viewport: screen point equals canvas point', () => {
    expect(screenToCanvas(ID, { x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
  });

  test('with pan: subtracts pan', () => {
    expect(screenToCanvas({ panX: 50, panY: 30, zoom: 1 }, { x: 100, y: 100 }))
      .toEqual({ x: 50, y: 70 });
  });

  test('with zoom: divides by zoom', () => {
    expect(screenToCanvas({ panX: 0, panY: 0, zoom: 2 }, { x: 100, y: 200 }))
      .toEqual({ x: 50, y: 100 });
  });

  test('with both: subtract pan, divide by zoom', () => {
    expect(screenToCanvas({ panX: 100, panY: 100, zoom: 2 }, { x: 200, y: 300 }))
      .toEqual({ x: 50, y: 100 });
  });
});

describe('canvasToScreen', () => {
  test('identity: equal', () => {
    expect(canvasToScreen(ID, { x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
  });

  test('round-trip: screenToCanvas(canvasToScreen(p)) === p', () => {
    const v = { panX: 17, panY: -42, zoom: 1.5 };
    const p = { x: 99, y: 33 };
    const screen = canvasToScreen(v, p);
    const back = screenToCanvas(v, screen);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
});

describe('zoomAround', () => {
  test('zooming in around a point keeps that screen point fixed', () => {
    const v = { panX: 0, panY: 0, zoom: 1 };
    const anchor = { x: 100, y: 100 };
    const next = zoomAround(v, anchor, 2);
    expect(next.zoom).toBe(2);
    const before = screenToCanvas(v, anchor);
    const after = screenToCanvas(next, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});

describe('clampZoom', () => {
  test('respects MIN_ZOOM and MAX_ZOOM', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(9999)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
  });
});
