import type { WidgetManifest } from '@rdm/widget-protocol';

export function pomodoroManifest(opts: { entry: string }): WidgetManifest {
  return {
    id: 'rdm.widget.pomodoro',
    version: '0.0.1',
    kind: 'iframe',
    entry: opts.entry,
    capabilities: ['notifications.notify'],
    defaultSize: { w: 320, h: 240 },
    name: 'Pomodoro',
    protocolVersion: 1,
  };
}
