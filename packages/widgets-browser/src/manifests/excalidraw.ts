import type { WidgetManifest } from '@rdm/widget-protocol';

export function excalidrawManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.excalidraw',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: [],
    defaultSize: { w: 540, h: 420 },
    name: 'Excalidraw',
    protocolVersion: 1,
  };
}
