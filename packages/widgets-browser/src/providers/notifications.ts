// packages/widgets-browser/src/providers/notifications.ts
import type { Provider } from '@rdm/canvas-runtime';

export function notificationsProvider(): Provider {
  return {
    notify: async (params) => {
      const p = (params ?? {}) as { title?: unknown; body?: unknown };
      const title = String(p.title ?? 'Notification');
      const body = p.body !== undefined ? String(p.body) : undefined;
      if (typeof Notification === 'undefined') {
        throw new Error('Notification API not available');
      }
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') {
        throw new Error('notification permission denied');
      }
      new Notification(title, body !== undefined ? { body } : undefined);
      return { ok: true };
    },
  };
}
