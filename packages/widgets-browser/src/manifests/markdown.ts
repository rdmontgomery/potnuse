import type { WidgetManifest } from '@rdm/widget-protocol';

export function markdownManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.markdown',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: ['clipboard.read', 'clipboard.write'],
    defaultSize: { w: 480, h: 360 },
    name: 'Markdown',
    protocolVersion: 1,
  };
}
