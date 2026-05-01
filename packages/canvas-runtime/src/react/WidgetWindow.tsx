// packages/canvas-runtime/src/react/WidgetWindow.tsx
import { useCallback, useRef } from 'react';
import { useCanvas, useWidget } from './hooks';

export type WidgetWindowProps = {
  instanceId: string;
  onIframeLoad?: (iframe: HTMLIFrameElement) => void;
};

export function WidgetWindow({ instanceId, onIframeLoad }: WidgetWindowProps) {
  const { moveWidget, resizeWidget, removeWidget } = useCanvas();
  const widget = useWidget(instanceId);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const resizeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const onTitleBarPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    const handleMove = (ev: PointerEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      moveWidget(instanceId, { dx: ev.clientX - origin.x, dy: ev.clientY - origin.y });
      dragOriginRef.current = { x: ev.clientX, y: ev.clientY };
    };
    const handleUp = () => {
      dragOriginRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [instanceId, moveWidget]);

  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeOriginRef.current = { x: e.clientX, y: e.clientY };
    const handleMove = (ev: PointerEvent) => {
      const origin = resizeOriginRef.current;
      if (!origin) return;
      resizeWidget(instanceId, { dx: ev.clientX - origin.x, dy: ev.clientY - origin.y });
      resizeOriginRef.current = { x: ev.clientX, y: ev.clientY };
    };
    const handleUp = () => {
      resizeOriginRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [instanceId, resizeWidget]);

  if (!widget) return null;

  const title = widget.manifest.name ?? widget.manifest.id;

  return (
    <div
      data-rdm-widget-window
      data-rdm-lifecycle={widget.lifecycle}
      style={{
        position: 'absolute',
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        width: `${widget.w}px`,
        height: `${widget.h}px`,
        background: 'var(--rdm-window-bg, #fff)',
        border: '1px solid var(--rdm-window-border, #ccc)',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        data-rdm-titlebar
        onPointerDown={onTitleBarPointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'var(--rdm-titlebar-bg, #f3f3f3)',
          color: 'var(--rdm-titlebar-fg, #222)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 12 }}>
          <span
            data-rdm-lifecycle-dot
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              marginRight: 6,
              background: lifecycleColor(widget.lifecycle),
            }}
          />
          {title}
        </span>
        <button
          aria-label="Close widget"
          onClick={() => removeWidget(instanceId)}
          style={{
            border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <iframe
        ref={iframeRef}
        title={title}
        src={widget.manifest.entry}
        sandbox="allow-scripts"
        onLoad={() => {
          if (iframeRef.current && onIframeLoad) {
            onIframeLoad(iframeRef.current);
          }
        }}
        style={{ flex: 1, border: 0 }}
      />
      <div
        data-rdm-resize-handle
        onPointerDown={onResizePointerDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background:
            'linear-gradient(135deg, transparent 50%, var(--rdm-window-border, #999) 50%)',
        }}
      />
    </div>
  );
}

function lifecycleColor(state: string): string {
  switch (state) {
    case 'loading': return 'var(--rdm-dot-loading, #f59e0b)';
    case 'ready':
    case 'active': return 'var(--rdm-dot-active, #10b981)';
    case 'suspended': return 'var(--rdm-dot-suspended, #6b7280)';
    case 'unloaded': return 'var(--rdm-dot-unloaded, #ef4444)';
    default: return '#999';
  }
}
