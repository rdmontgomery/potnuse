// packages/canvas-runtime/src/store/canvasStore.ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { WidgetManifest, WidgetLifecycleState } from '@rdm/widget-protocol';
import {
  emptyCanvasDocument,
  createWidgetEntry,
  type CanvasDocument,
  type WidgetEntry,
} from '../core/document';
import { applyMove, applyResize, type Delta } from '../core/drag';
import { assertTransition } from '../core/lifecycle';

export type PersistedSnapshot = {
  schemaVersion: 1;
  viewport: CanvasDocument['viewport'];
  widgets: Array<Omit<WidgetEntry, 'lifecycle'>>;
};

export type CanvasState = {
  document: CanvasDocument;
  addWidget(
    manifest: WidgetManifest,
    placement: { x: number; y: number; w?: number; h?: number },
  ): string;
  removeWidget(instanceId: string): void;
  moveWidget(instanceId: string, delta: Delta): void;
  resizeWidget(instanceId: string, delta: Delta): void;
  setLifecycle(instanceId: string, next: WidgetLifecycleState): void;
  panBy(delta: Delta): void;
  setViewport(v: CanvasDocument['viewport']): void;
  hydrate(snapshot: PersistedSnapshot): void;
};

export type CanvasStore = StoreApi<CanvasState>;

export function createCanvasStore(initial?: PersistedSnapshot): CanvasStore {
  return createStore<CanvasState>((set, get) => ({
    document: initial ? hydrateDoc(initial) : emptyCanvasDocument(),

    addWidget(manifest, placement) {
      const entry = createWidgetEntry(manifest, placement);
      set((s) => ({
        document: {
          ...s.document,
          widgets: [...s.document.widgets, entry],
        },
      }));
      return entry.instanceId;
    },

    removeWidget(instanceId) {
      set((s) => ({
        document: {
          ...s.document,
          widgets: s.document.widgets.filter((w) => w.instanceId !== instanceId),
        },
      }));
    },

    moveWidget(instanceId, delta) {
      set((s) => ({
        document: {
          ...s.document,
          widgets: s.document.widgets.map((w) =>
            w.instanceId === instanceId
              ? { ...w, ...applyMove({ x: w.x, y: w.y, w: w.w, h: w.h }, delta) }
              : w,
          ),
        },
      }));
    },

    resizeWidget(instanceId, delta) {
      set((s) => ({
        document: {
          ...s.document,
          widgets: s.document.widgets.map((w) =>
            w.instanceId === instanceId
              ? { ...w, ...applyResize({ x: w.x, y: w.y, w: w.w, h: w.h }, delta) }
              : w,
          ),
        },
      }));
    },

    setLifecycle(instanceId, next) {
      const w = get().document.widgets.find((w) => w.instanceId === instanceId);
      if (!w) return;
      assertTransition(w.lifecycle, next);
      set((s) => ({
        document: {
          ...s.document,
          widgets: s.document.widgets.map((x) =>
            x.instanceId === instanceId ? { ...x, lifecycle: next } : x,
          ),
        },
      }));
    },

    panBy(delta) {
      set((s) => ({
        document: {
          ...s.document,
          viewport: {
            panX: s.document.viewport.panX + delta.dx,
            panY: s.document.viewport.panY + delta.dy,
            zoom: s.document.viewport.zoom,
          },
        },
      }));
    },

    setViewport(v) {
      set((s) => ({ document: { ...s.document, viewport: v } }));
    },

    hydrate(snapshot) {
      set({ document: hydrateDoc(snapshot) });
    },
  }));
}

function hydrateDoc(snapshot: PersistedSnapshot): CanvasDocument {
  return {
    schemaVersion: 1,
    viewport: snapshot.viewport,
    widgets: snapshot.widgets.map((w) => ({ ...w, lifecycle: 'loading' as WidgetLifecycleState })),
  };
}

export function snapshotForPersistence(doc: CanvasDocument): PersistedSnapshot {
  return {
    schemaVersion: 1,
    viewport: doc.viewport,
    widgets: doc.widgets.map(({ lifecycle: _lifecycle, ...rest }) => rest),
  };
}
