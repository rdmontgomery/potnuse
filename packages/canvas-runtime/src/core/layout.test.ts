// packages/canvas-runtime/src/core/layout.test.ts
import { describe, expect, test } from 'vitest';
import { rectsIntersect, isFullyOffscreen } from './layout';

describe('rectsIntersect', () => {
  test('overlapping rects intersect', () => {
    expect(
      rectsIntersect(
        { x: 0, y: 0, w: 100, h: 100 },
        { x: 50, y: 50, w: 100, h: 100 }
      )
    ).toBe(true);
  });

  test('disjoint rects do not intersect', () => {
    expect(
      rectsIntersect(
        { x: 0, y: 0, w: 100, h: 100 },
        { x: 200, y: 200, w: 100, h: 100 }
      )
    ).toBe(false);
  });

  test('touching edges count as not intersecting (open intervals)', () => {
    expect(
      rectsIntersect(
        { x: 0, y: 0, w: 100, h: 100 },
        { x: 100, y: 0, w: 100, h: 100 }
      )
    ).toBe(false);
  });
});

describe('isFullyOffscreen', () => {
  test('widget inside viewport is not offscreen', () => {
    expect(
      isFullyOffscreen(
        { x: 100, y: 100, w: 50, h: 50 },
        { x: 0, y: 0, w: 800, h: 600 }
      )
    ).toBe(false);
  });

  test('widget far past viewport right edge is offscreen', () => {
    expect(
      isFullyOffscreen(
        { x: 1000, y: 100, w: 50, h: 50 },
        { x: 0, y: 0, w: 800, h: 600 }
      )
    ).toBe(true);
  });

  test('widget partially in viewport is not offscreen', () => {
    expect(
      isFullyOffscreen(
        { x: 750, y: 100, w: 100, h: 50 },
        { x: 0, y: 0, w: 800, h: 600 }
      )
    ).toBe(false);
  });
});
