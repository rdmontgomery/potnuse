import type { PersistenceAdapter } from '../persistence';

const KEY_PREFIX = 'rdm.canvas:';

export function localStorageAdapter(): PersistenceAdapter {
  return {
    async load(scope) {
      const raw = localStorage.getItem(KEY_PREFIX + scope);
      return raw === null ? null : JSON.parse(raw);
    },
    async save(scope, doc) {
      localStorage.setItem(KEY_PREFIX + scope, JSON.stringify(doc));
    },
    subscribe(scope, cb) {
      const key = KEY_PREFIX + scope;
      const handler = (event: StorageEvent) => {
        if (event.key !== key || event.newValue === null) return;
        try {
          cb(JSON.parse(event.newValue));
        } catch {
          // malformed payload — ignore
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}
