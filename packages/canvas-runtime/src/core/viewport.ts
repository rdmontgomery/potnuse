// packages/canvas-runtime/src/core/viewport.ts
export type Viewport = { panX: number; panY: number; zoom: number };
export type Point = { x: number; y: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function screenToCanvas(v: Viewport, p: Point): Point {
  return {
    x: (p.x - v.panX) / v.zoom,
    y: (p.y - v.panY) / v.zoom,
  };
}

export function canvasToScreen(v: Viewport, p: Point): Point {
  return {
    x: p.x * v.zoom + v.panX,
    y: p.y * v.zoom + v.panY,
  };
}

export function zoomAround(v: Viewport, anchorScreen: Point, nextZoom: number): Viewport {
  const z = clampZoom(nextZoom);
  const anchorCanvas = screenToCanvas(v, anchorScreen);
  return {
    zoom: z,
    panX: anchorScreen.x - anchorCanvas.x * z,
    panY: anchorScreen.y - anchorCanvas.y * z,
  };
}
