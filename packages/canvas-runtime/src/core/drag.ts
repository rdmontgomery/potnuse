// packages/canvas-runtime/src/core/drag.ts
export type Rect = { x: number; y: number; w: number; h: number };
export type Delta = { dx: number; dy: number };

export const MIN_WIDGET_SIZE = 80;

export function applyMove(r: Rect, d: Delta): Rect {
  return { x: r.x + d.dx, y: r.y + d.dy, w: r.w, h: r.h };
}

export function applyResize(r: Rect, d: Delta): Rect {
  return {
    x: r.x,
    y: r.y,
    w: Math.max(MIN_WIDGET_SIZE, r.w + d.dx),
    h: Math.max(MIN_WIDGET_SIZE, r.h + d.dy),
  };
}
