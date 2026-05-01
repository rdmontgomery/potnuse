// packages/canvas-runtime/example/main.tsx
import { createRoot } from 'react-dom/client';
import { Canvas } from '../src/react/Canvas';
import { localStorageAdapter } from '../src/core/adapters';
import type { WidgetManifest } from '@rdm/widget-protocol';

const W: WidgetManifest = {
  id: 'rdm.example.poke',
  version: '0.0.1',
  kind: 'iframe',
  entry: 'http://localhost:5173/widget.html',
  capabilities: [],
  protocolVersion: 1,
  name: 'Poke Widget',
};

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        canvasId="example"
        adapter={localStorageAdapter()}
        providers={{}}
        initialWidgets={[
          { manifest: W, placement: { x: 80, y: 80, w: 320, h: 220 } },
          { manifest: W, placement: { x: 460, y: 120, w: 320, h: 220 } },
        ]}
        onError={(e) => console.warn('canvas error:', e)}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
