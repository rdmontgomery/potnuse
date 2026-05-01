// packages/canvas-runtime/src/react/Canvas.tsx
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import type { WidgetManifest } from '@rdm/widget-protocol';
import {
  createCanvasStore,
  snapshotForPersistence,
  type CanvasStore,
  type PersistedSnapshot,
} from '../store/canvasStore';
import type { Provider } from '../core/dispatch';
import { createDebouncer, type PersistenceAdapter } from '../core/persistence';
import { CanvasProvider } from './hooks';
import { WidgetWindow } from './WidgetWindow';

export type CanvasProps = {
  canvasId: string;
  adapter: PersistenceAdapter;
  providers: Record<string, Provider>;
  defaultTimeoutMs?: number;
  initialWidgets?: Array<{
    manifest: WidgetManifest;
    placement: { x: number; y: number; w?: number; h?: number };
  }>;
  onError?: (e: Error) => void;
};

export function Canvas(props: CanvasProps) {
  const store = useMemo(() => createCanvasStore(), [props.canvasId]);
  return (
    <CanvasProvider store={store}>
      <CanvasInner {...props} store={store} />
    </CanvasProvider>
  );
}

function CanvasInner({
  canvasId,
  adapter,
  initialWidgets,
  onError,
  store,
}: CanvasProps & { store: CanvasStore }) {
  const document = useStore(store, (s) => s.document);

  // Hydrate from adapter, then apply initialWidgets if no persisted state.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = (await adapter.load(canvasId)) as PersistedSnapshot | null;
        if (cancelled) return;
        if (persisted) {
          store.getState().hydrate(persisted);
        } else if (initialWidgets) {
          for (const { manifest, placement } of initialWidgets) {
            store.getState().addWidget(manifest, placement);
          }
        }
      } catch (e: unknown) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, adapter]);

  // Debounced save on document change (skip the initial empty state).
  useEffect(() => {
    const save = createDebouncer((doc: typeof document) => {
      adapter.save(canvasId, snapshotForPersistence(doc)).catch(onError);
    }, 250);
    let firstSnapshot = true;
    const unsub = store.subscribe((s, prev) => {
      if (firstSnapshot) {
        firstSnapshot = false;
        return;
      }
      if (s.document !== prev.document) save(s.document);
    });
    return () => {
      save.cancel();
      unsub();
    };
  }, [canvasId, adapter, onError, store]);

  return (
    <div
      data-testid="rdm-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--rdm-canvas-bg, #fafafa)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: document.viewport.panX,
          top: document.viewport.panY,
          transform: `scale(${document.viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {document.widgets.map((w) => (
          <WidgetWindow key={w.instanceId} instanceId={w.instanceId} />
        ))}
      </div>
    </div>
  );
}
