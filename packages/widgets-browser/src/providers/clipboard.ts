// packages/widgets-browser/src/providers/clipboard.ts
import type { Provider } from '@rdm/canvas-runtime';

export function clipboardProvider(): Provider {
  return {
    read: async () => ({ text: await navigator.clipboard.readText() }),
    write: async (params) => {
      const text = String((params as { text?: unknown })?.text ?? '');
      await navigator.clipboard.writeText(text);
      return { ok: true };
    },
  };
}
