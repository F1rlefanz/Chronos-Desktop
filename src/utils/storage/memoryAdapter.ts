import { StorageAdapter, WriteResult } from './types';

export interface MemoryAdapter extends StorageAdapter {
  /** Seeds a raw value, including deliberately malformed JSON. */
  seed(key: string, value: string): void;
  peek(key: string): string | null;
  clear(): void;
  /** Makes every subsequent write fail; `null` restores success. */
  failWrites(result: Extract<WriteResult, { ok: false }> | null): void;
}

/**
 * Non-persistent adapter used by the tests. It also serves as the second
 * implementation of `StorageAdapter`: if something can only be expressed
 * against `localStorage`, it shows up here first.
 */
export function createMemoryAdapter(): MemoryAdapter {
  const store = new Map<string, string>();
  let failure: Extract<WriteResult, { ok: false }> | null = null;

  return {
    name: 'memory',

    read(key) {
      return Promise.resolve(store.get(key) ?? null);
    },

    write(key, value) {
      if (failure) return Promise.resolve(failure);
      store.set(key, value);
      return Promise.resolve({ ok: true });
    },

    seed(key, value) {
      store.set(key, value);
    },

    peek(key) {
      return store.get(key) ?? null;
    },

    clear() {
      store.clear();
      failure = null;
    },

    failWrites(result) {
      failure = result;
    },
  };
}
