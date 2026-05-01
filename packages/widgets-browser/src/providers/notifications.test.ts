// packages/widgets-browser/src/providers/notifications.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { notificationsProvider } from './notifications';

type NotificationCtor = ((title: string, options?: NotificationOptions) => Notification) & {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
};

let originalNotification: NotificationCtor | undefined;

beforeEach(() => {
  originalNotification = (globalThis as { Notification?: NotificationCtor }).Notification;
});

afterEach(() => {
  if (originalNotification) {
    (globalThis as { Notification?: NotificationCtor }).Notification = originalNotification;
  } else {
    delete (globalThis as { Notification?: NotificationCtor }).Notification;
  }
});

function installNotificationStub(opts: {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
}): { ctor: ReturnType<typeof vi.fn> } {
  const ctor = vi.fn();
  const stub = ctor as unknown as NotificationCtor;
  stub.permission = opts.permission;
  stub.requestPermission = opts.requestPermission ?? (async () => opts.permission);
  (globalThis as { Notification?: NotificationCtor }).Notification = stub;
  return { ctor };
}

const ctx = {
  instanceId: 'i-1',
  manifestId: 'rdm.test.x',
  signal: new AbortController().signal,
  log: () => {},
};

describe('notificationsProvider', () => {
  test('notify constructs a Notification when permission is granted', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    const result = await provider.notify!({ title: 'hi', body: 'there' }, ctx);
    expect(ctor).toHaveBeenCalledWith('hi', { body: 'there' });
    expect(result).toEqual({ ok: true });
  });

  test('notify falls back to "Notification" title when missing', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    await provider.notify!({}, ctx);
    expect(ctor).toHaveBeenCalledWith('Notification', undefined);
  });

  test('notify omits options when body is undefined', async () => {
    const { ctor } = installNotificationStub({ permission: 'granted' });
    const provider = notificationsProvider();
    await provider.notify!({ title: 'hi' }, ctx);
    expect(ctor).toHaveBeenCalledWith('hi', undefined);
  });

  test('notify requests permission when default and uses the result', async () => {
    let stub: NotificationCtor;
    const requestPermission = vi.fn(async () => {
      stub.permission = 'granted';
      return 'granted' as NotificationPermission;
    });
    const installed = installNotificationStub({ permission: 'default', requestPermission });
    stub = (globalThis as { Notification: NotificationCtor }).Notification;
    const provider = notificationsProvider();
    await provider.notify!({ title: 'hi' }, ctx);
    expect(requestPermission).toHaveBeenCalled();
    expect(installed.ctor).toHaveBeenCalled();
  });

  test('notify throws when permission is denied', async () => {
    installNotificationStub({ permission: 'denied' });
    const provider = notificationsProvider();
    await expect(provider.notify!({ title: 'hi' }, ctx)).rejects.toThrow(/permission denied/);
  });

  test('notify throws when Notification API is missing', async () => {
    delete (globalThis as { Notification?: NotificationCtor }).Notification;
    const provider = notificationsProvider();
    await expect(provider.notify!({ title: 'hi' }, ctx)).rejects.toThrow(/not available/);
  });
});
