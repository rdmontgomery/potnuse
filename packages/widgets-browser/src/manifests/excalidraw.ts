import type { WidgetManifest } from '@rdm/widget-protocol';

export function excalidrawManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.excalidraw',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: [],
    // Excalidraw needs allow-same-origin for IndexedDB/localStorage,
    // plus popups/forms/downloads for its export and library features.
    sandbox: [
      'allow-same-origin',
      'allow-popups',
      'allow-popups-to-escape-sandbox',
      'allow-forms',
      'allow-downloads',
    ],
    defaultSize: { w: 540, h: 420 },
    name: 'Excalidraw',
    protocolVersion: 1,
  };
}
