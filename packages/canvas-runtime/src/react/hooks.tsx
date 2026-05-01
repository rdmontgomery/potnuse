// packages/canvas-runtime/src/react/hooks.tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { CanvasStore, CanvasState } from '../store/canvasStore';

const CanvasContext = createContext<CanvasStore | null>(null);

export function CanvasProvider({
  store,
  children,
}: {
  store: CanvasStore;
  children: ReactNode;
}) {
  return <CanvasContext.Provider value={store}>{children}</CanvasContext.Provider>;
}

function useCanvasStore(): CanvasStore {
  const store = useContext(CanvasContext);
  if (!store) {
    throw new Error('useCanvas must be used within <CanvasProvider>');
  }
  return store;
}

export function useCanvas(): CanvasState {
  const store = useCanvasStore();
  return useStore(store);
}

export function useWidget(instanceId: string) {
  const store = useCanvasStore();
  return useStore(store, (s) => s.document.widgets.find((w) => w.instanceId === instanceId));
}

export function useViewport() {
  const store = useCanvasStore();
  const viewport = useStore(store, (s) => s.document.viewport);
  const panBy = useStore(store, (s) => s.panBy);
  const setViewport = useStore(store, (s) => s.setViewport);
  return { viewport, panBy, setViewport };
}
