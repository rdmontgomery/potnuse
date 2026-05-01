import { describe, expect, test } from 'vitest';
import { WidgetManifestSchema } from '@rdm/widget-protocol';
import { markdownManifest } from './markdown';
import { excalidrawManifest } from './excalidraw';
import { pomodoroManifest } from './pomodoro';

const HTTP = 'https://example.com/widgets/x.html';

describe('markdownManifest', () => {
  test('produces a valid manifest', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares clipboard.read and clipboard.write capabilities', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.capabilities).toEqual(expect.arrayContaining(['clipboard.read', 'clipboard.write']));
  });

  test('uses the supplied entry URL', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.entry).toBe(HTTP);
  });

  test('id is rdm.widget.markdown', () => {
    const m = markdownManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.markdown');
  });
});

describe('excalidrawManifest', () => {
  test('produces a valid manifest', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares no capabilities', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(m.capabilities).toEqual([]);
  });

  test('id is rdm.widget.excalidraw', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.excalidraw');
  });

  test('declares allow-same-origin sandbox so excalidraw.com IndexedDB works', () => {
    const m = excalidrawManifest({ entry: HTTP });
    expect(m.sandbox).toContain('allow-same-origin');
  });
});

describe('pomodoroManifest', () => {
  test('produces a valid manifest', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(() => WidgetManifestSchema.parse(m)).not.toThrow();
  });

  test('declares notifications.notify capability', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(m.capabilities).toEqual(['notifications.notify']);
  });

  test('id is rdm.widget.pomodoro', () => {
    const m = pomodoroManifest({ entry: HTTP });
    expect(m.id).toBe('rdm.widget.pomodoro');
  });
});

describe('all builders', () => {
  test.each([
    ['markdown', markdownManifest],
    ['excalidraw', excalidrawManifest],
    ['pomodoro', pomodoroManifest],
  ] as const)('%s rejects non-http entry through schema refinement', (_, builder) => {
    const m = builder({ entry: '/local/path' });
    expect(() => WidgetManifestSchema.parse(m)).toThrow();
  });
});
