// @rdm/canvas-runtime — public surface re-exports.
export { Canvas } from './react/Canvas';
export type { CanvasProps } from './react/Canvas';
export { WidgetWindow } from './react/WidgetWindow';
export { CanvasProvider, useCanvas, useWidget, useViewport } from './react/hooks';
export {
  createCanvasStore,
  snapshotForPersistence,
  type CanvasStore,
  type CanvasState,
  type PersistedSnapshot,
} from './store/canvasStore';
export type { CanvasDocument, WidgetEntry } from './core/document';
export type { PersistenceAdapter } from './core/persistence';
export type {
  Provider,
  CapabilityHandler,
  CapabilityCtx,
  DispatchResult,
} from './core/dispatch';
