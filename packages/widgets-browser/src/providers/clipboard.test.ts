// packages/widgets-browser/src/providers/clipboard.test.ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clipboardProvider } from './clipboard';

const realClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: realClipboard,
    configurable: true,
    writable: true,
  });
});

function stubClipboard(impl: Partial<Clipboard>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl,
    configurable: true,
    writable: true,
  });
}

const ctx = {
  instanceId: 'i-1',
  manifestId: 'rdm.test.x',
  signal: new AbortController().signal,
  log: () => {},
};

describe('clipboardProvider', () => {
  test('read returns { text } from navigator.clipboard.readText', async () => {
    stubClipboard({ readText: vi.fn(async () => 'hello world') });
    const provider = clipboardProvider();
    const result = await provider.read!(undefined, ctx);
    expect(result).toEqual({ text: 'hello world' });
  });

  test('write coerces params.text to string and calls writeText', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    const result = await provider.write!({ text: 'wrote this' }, ctx);
    expect(writeText).toHaveBeenCalledWith('wrote this');
    expect(result).toEqual({ ok: true });
  });

  test('write coerces non-string text to string', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    await provider.write!({ text: 42 }, ctx);
    expect(writeText).toHaveBeenCalledWith('42');
  });

  test('write with missing text writes empty string', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard({ writeText });
    const provider = clipboardProvider();
    await provider.write!({}, ctx);
    expect(writeText).toHaveBeenCalledWith('');
  });

  test('read propagates underlying API errors', async () => {
    stubClipboard({ readText: vi.fn(async () => { throw new Error('denied'); }) });
    const provider = clipboardProvider();
    await expect(provider.read!(undefined, ctx)).rejects.toThrow(/denied/);
  });
});
