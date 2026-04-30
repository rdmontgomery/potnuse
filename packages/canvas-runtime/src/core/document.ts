import type { WidgetManifest, WidgetLifecycleState } from '@rdm/widget-protocol';

export type WidgetEntry = {
  instanceId: string;
  manifest: WidgetManifest;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: unknown;
  lifecycle: WidgetLifecycleState;
};

export type CanvasDocument = {
  schemaVersion: 1;
  viewport: { panX: number; panY: number; zoom: number };
  widgets: WidgetEntry[];
};

export const FALLBACK_WIDGET_SIZE = { w: 320, h: 240 };

export function emptyCanvasDocument(): CanvasDocument {
  return {
    schemaVersion: 1,
    viewport: { panX: 0, panY: 0, zoom: 1 },
    widgets: [],
  };
}

export function createWidgetEntry(
  manifest: WidgetManifest,
  placement: { x: number; y: number; w?: number; h?: number },
): WidgetEntry {
  const w = placement.w ?? manifest.defaultSize?.w ?? FALLBACK_WIDGET_SIZE.w;
  const h = placement.h ?? manifest.defaultSize?.h ?? FALLBACK_WIDGET_SIZE.h;
  return {
    instanceId: crypto.randomUUID(),
    manifest,
    x: placement.x,
    y: placement.y,
    w,
    h,
    lifecycle: 'loading',
  };
}
