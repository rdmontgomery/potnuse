export type PersistenceAdapter = {
  load(scope: string): Promise<unknown | null>;
  save(scope: string, doc: unknown): Promise<void>;
  subscribe(scope: string, cb: (doc: unknown) => void): () => void;
};

export type Debounced<A extends unknown[]> = ((...args: A) => void) & {
  flush(): void;
  cancel(): void;
};

export function createDebouncer<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) {
        const a = lastArgs;
        lastArgs = null;
        fn(...a);
      }
    }, delayMs);
  }) as Debounced<A>;

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      const a = lastArgs;
      lastArgs = null;
      fn(...a);
    }
  };

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  return debounced;
}
