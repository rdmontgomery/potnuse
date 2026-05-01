import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useCanvas } from '@rdm/canvas-runtime';
import { localStorageAdapter } from '@rdm/canvas-runtime/adapters';
import {
  markdownManifest,
  excalidrawManifest,
  pomodoroManifest,
} from '../src/manifests';
import { clipboardProvider, notificationsProvider } from '../src/providers';
import type { WidgetManifest } from '@rdm/widget-protocol';

const ORIGIN = 'http://localhost:5174';

type CatalogEntry = {
  label: string;
  manifest: WidgetManifest;
};

const CATALOG: CatalogEntry[] = [
  { label: 'Markdown', manifest: markdownManifest({ entry: `${ORIGIN}/markdown/index.html` }) },
  { label: 'Excalidraw', manifest: excalidrawManifest({ entry: `${ORIGIN}/excalidraw/index.html` }) },
  { label: 'Pomodoro', manifest: pomodoroManifest({ entry: `${ORIGIN}/pomodoro/index.html` }) },
];

function PermissionBanner() {
  const [state, setState] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  if (state === 'granted' || state === 'unsupported') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 1000,
        background: '#fffbeb',
        border: '1px solid #f59e0b',
        borderRadius: 4,
        padding: '8px 12px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>Notifications need permission for the pomodoro to chime.</span>
      <button
        onClick={async () => {
          const result = await Notification.requestPermission();
          setState(result);
        }}
        style={{ padding: '2px 8px', cursor: 'pointer' }}
      >
        Enable
      </button>
    </div>
  );
}

function AddWidgetToolbar() {
  const { document, addWidget } = useCanvas();

  const presentManifestIds = useMemo(
    () => new Set(document.widgets.map((w) => w.manifest.id)),
    [document.widgets],
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 999,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #d4d4d8',
        borderRadius: 4,
        padding: '6px 8px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#71717a' }}>Add:</span>
      {CATALOG.map((entry) => {
        const present = presentManifestIds.has(entry.manifest.id);
        return (
          <button
            key={entry.manifest.id}
            disabled={present}
            onClick={() => {
              const v = document.viewport;
              addWidget(entry.manifest, {
                x: -v.panX / v.zoom + 80,
                y: -v.panY / v.zoom + 80,
              });
            }}
            style={{ padding: '2px 8px', cursor: present ? 'default' : 'pointer' }}
            title={present ? 'already on canvas' : `add ${entry.label}`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

function App() {
  return (
    <>
      <PermissionBanner />
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas
          canvasId="example"
          adapter={localStorageAdapter()}
          providers={{
            clipboard: clipboardProvider(),
            notifications: notificationsProvider(),
          }}
          initialWidgets={CATALOG.map((entry, i) => ({
            manifest: entry.manifest,
            placement: [
              { x: 60, y: 60, w: 460, h: 320 },
              { x: 560, y: 60, w: 540, h: 380 },
              { x: 60, y: 420, w: 320, h: 240 },
            ][i] ?? { x: 60, y: 60 },
          }))}
          onError={(e) => console.warn('canvas error:', e)}
        >
          <AddWidgetToolbar />
        </Canvas>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
