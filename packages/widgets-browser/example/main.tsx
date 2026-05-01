import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@rdm/canvas-runtime';
import { localStorageAdapter } from '@rdm/canvas-runtime/adapters';
import {
  markdownManifest,
  excalidrawManifest,
  pomodoroManifest,
} from '../src/manifests';
import { clipboardProvider, notificationsProvider } from '../src/providers';

const ORIGIN = 'http://localhost:5174';

function PermissionBanner({ onGranted }: { onGranted: () => void }) {
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
          if (result === 'granted') onGranted();
        }}
        style={{ padding: '2px 8px', cursor: 'pointer' }}
      >
        Enable
      </button>
    </div>
  );
}

function App() {
  return (
    <>
      <PermissionBanner onGranted={() => {}} />
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas
          canvasId="example"
          adapter={localStorageAdapter()}
          providers={{
            clipboard: clipboardProvider(),
            notifications: notificationsProvider(),
          }}
          initialWidgets={[
            {
              manifest: markdownManifest({ entry: `${ORIGIN}/markdown/index.html` }),
              placement: { x: 60, y: 60, w: 460, h: 320 },
            },
            {
              manifest: excalidrawManifest({ entry: `${ORIGIN}/excalidraw/index.html` }),
              placement: { x: 560, y: 60, w: 540, h: 380 },
            },
            {
              manifest: pomodoroManifest({ entry: `${ORIGIN}/pomodoro/index.html` }),
              placement: { x: 60, y: 420, w: 320, h: 240 },
            },
          ]}
          onError={(e) => console.warn('canvas error:', e)}
        />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
