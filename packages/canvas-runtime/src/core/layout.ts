// packages/canvas-runtime/src/core/layout.ts
import type { Rect } from './drag';

export type { Rect };

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isFullyOffscreen(widget: Rect, viewport: Rect): boolean {
  return !rectsIntersect(widget, viewport);
}
