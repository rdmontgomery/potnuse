// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { localStorageAdapter } from './localStorage';

afterEach(() => {
  localStorage.clear();
});

describe('localStorageAdapter', () => {
  test('save then load round-trips', async () => {
    const a = localStorageAdapter();
    await a.save('default', { hello: 'world' });
    const got = await a.load('default');
    expect(got).toEqual({ hello: 'world' });
  });

  test('load returns null for missing scope', async () => {
    const a = localStorageAdapter();
    expect(await a.load('nope')).toBeNull();
  });

  test('save uses a namespaced key', async () => {
    const a = localStorageAdapter();
    await a.save('default', { x: 1 });
    expect(localStorage.getItem('rdm.canvas:default')).toBe(JSON.stringify({ x: 1 }));
  });

  test('subscribe fires when the relevant key changes via storage event', () => {
    const a = localStorageAdapter();
    const cb = vi.fn();
    const off = a.subscribe('default', cb);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rdm.canvas:default',
      newValue: JSON.stringify({ updated: true }),
    }));

    expect(cb).toHaveBeenCalledWith({ updated: true });

    off();
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rdm.canvas:default',
      newValue: JSON.stringify({ stale: true }),
    }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('subscribe ignores other-scope storage events', () => {
    const a = localStorageAdapter();
    const cb = vi.fn();
    a.subscribe('default', cb);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rdm.canvas:other',
      newValue: '{}',
    }));
    expect(cb).not.toHaveBeenCalled();
  });
});
