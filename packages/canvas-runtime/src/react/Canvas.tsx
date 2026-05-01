// packages/canvas-runtime/src/react/Canvas.tsx
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { WidgetManifest } from '@rdm/widget-protocol';
import { ProtocolMessageSchema } from '@rdm/widget-protocol';
import {
  createCanvasStore,
  snapshotForPersistence,
  type CanvasStore,
  type PersistedSnapshot,
} from '../store/canvasStore';
// import { isFullyOffscreen } from '../core/layout';   // TODO: suspend/resume — deferred follow-up
import { dispatch, type Provider } from '../core/dispatch';
import { runHandshake } from '../core/handshake';
import { zoomAround } from '../core/viewport';
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
  /**
   * Optional overlay content rendered inside the CanvasProvider context, on
   * top of the canvas surface. Use this to layer in toolbars, palettes, or
   * "add widget" UIs that consume `useCanvas()` to drive the store.
   */
  children?: ReactNode;
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
  providers,
  defaultTimeoutMs = 30_000,
  initialWidgets,
  onError,
  children,
  store,
}: CanvasProps & { store: CanvasStore }) {
  const document = useStore(store, (s) => s.document);
  // TODO: suspend/resume on offscreen via isFullyOffscreen is deferred to a follow-up.
  const ports = useRef(new Map<string, MessagePort>());

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

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return; // pinch-zoom on trackpad sets ctrlKey
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const v = store.getState().document.viewport;
    const factor = Math.exp(-e.deltaY * 0.002);
    store.getState().setViewport(zoomAround(v, cursor, v.zoom * factor));
  }, [store]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 1 && !(e.button === 0 && e.shiftKey)) return; // middle-click or shift+left
    e.preventDefault();
    let last = { x: e.clientX, y: e.clientY };
    const handleMove = (ev: PointerEvent) => {
      store.getState().panBy({ dx: ev.clientX - last.x, dy: ev.clientY - last.y });
      last = { x: ev.clientX, y: ev.clientY };
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [store]);

  return (
    <div
      data-testid="rdm-canvas"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
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
        {document.widgets.map((widget) => (
          <WidgetWindow
            key={widget.instanceId}
            instanceId={widget.instanceId}
            onIframeLoad={async (iframe) => {
              if (ports.current.has(widget.instanceId)) return; // already handshaken
              try {
                const { canvasPort } = await runHandshake({
                  iframe,
                  manifest: widget.manifest,
                  instanceId: widget.instanceId,
                });
                ports.current.set(widget.instanceId, canvasPort);
                canvasPort.start();
                canvasPort.addEventListener('message', async (event) => {
                  const parsed = ProtocolMessageSchema.safeParse(event.data);
                  if (!parsed.success) return;
                  const msg = parsed.data;
                  if (msg.type === 'event' && msg.name === 'lifecycle.ready') {
                    try { store.getState().setLifecycle(widget.instanceId, 'ready'); }
                    catch (e: unknown) { onError?.(e instanceof Error ? e : new Error(String(e))); }
                    try { store.getState().setLifecycle(widget.instanceId, 'active'); }
                    catch { /* already-unloaded; ignore */ }
                    return;
                  }
                  if (msg.type !== 'req') return;
                  const result = await dispatch(
                    msg,
                    widget.manifest,
                    new Map(Object.entries(providers)),
                    defaultTimeoutMs,
                    {
                      instanceId: widget.instanceId,
                      manifestId: widget.manifest.id,
                      signal: new AbortController().signal,
                      log: () => {},
                    },
                  );
                  canvasPort.postMessage(result.ok
                    ? { type: 'res', id: msg.id, outcome: 'ok', result: result.result }
                    : { type: 'res', id: msg.id, outcome: 'err', error: result.error });
                });
              } catch (e: unknown) {
                onError?.(e instanceof Error ? e : new Error(String(e)));
              }
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
