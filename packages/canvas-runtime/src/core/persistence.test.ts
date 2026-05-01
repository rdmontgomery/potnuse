import { describe, expect, test, vi } from 'vitest';
import { createDebouncer, type PersistenceAdapter } from './persistence';

describe('createDebouncer', () => {
  test('coalesces rapid calls into a single invocation', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 100);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(99);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');

    vi.useRealTimers();
  });

  test('separate batches fire separately', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 50);

    debounced('first');
    await vi.advanceTimersByTimeAsync(60);
    expect(fn).toHaveBeenCalledWith('first');

    debounced('second');
    await vi.advanceTimersByTimeAsync(60);
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  test('flush() invokes immediately and cancels pending timer', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 100);

    debounced('x');
    debounced.flush();

    expect(fn).toHaveBeenCalledWith('x');
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  test('cancel() drops the pending invocation', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 100);

    debounced('x');
    debounced.cancel();

    await vi.advanceTimersByTimeAsync(200);
    expect(fn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('PersistenceAdapter type', () => {
  test('a minimal adapter compiles', () => {
    const a: PersistenceAdapter = {
      load: async () => null,
      save: async () => {},
      subscribe: () => () => {},
    };
    expect(typeof a.load).toBe('function');
  });
});
