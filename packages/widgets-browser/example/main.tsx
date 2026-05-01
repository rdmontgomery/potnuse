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

function App() {
  return (
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
  );
}

createRoot(document.getElementById('root')!).render(<App />);
