// packages/canvas-runtime/src/core/drag.test.ts
import { describe, expect, test } from 'vitest';
import { applyMove, applyResize, MIN_WIDGET_SIZE } from './drag';

const RECT = { x: 100, y: 100, w: 200, h: 150 };

describe('applyMove', () => {
  test('translates by canvas-space delta', () => {
    expect(applyMove(RECT, { dx: 50, dy: -20 })).toEqual({
      x: 150,
      y: 80,
      w: 200,
      h: 150,
    });
  });

  test('zero delta is identity', () => {
    expect(applyMove(RECT, { dx: 0, dy: 0 })).toEqual(RECT);
  });
});

describe('applyResize (bottom-right corner)', () => {
  test('grows by delta', () => {
    expect(applyResize(RECT, { dx: 30, dy: 40 })).toEqual({
      x: 100,
      y: 100,
      w: 230,
      h: 190,
    });
  });

  test('floors at MIN_WIDGET_SIZE', () => {
    expect(applyResize(RECT, { dx: -10000, dy: -10000 })).toEqual({
      x: 100,
      y: 100,
      w: MIN_WIDGET_SIZE,
      h: MIN_WIDGET_SIZE,
    });
  });

  test('shrinks but clamps just one axis if other is fine', () => {
    expect(applyResize({ x: 0, y: 0, w: 200, h: 200 }, { dx: -190, dy: -50 })).toEqual({
      x: 0,
      y: 0,
      w: MIN_WIDGET_SIZE,
      h: 150,
    });
  });
});
