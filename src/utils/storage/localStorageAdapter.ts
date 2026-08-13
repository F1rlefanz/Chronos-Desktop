import { logError, logWarn } from '../logging/logger';
import { StorageAdapter, WriteResult } from './types';

/** Legacy numeric codes browsers used before `QuotaExceededError` was named. */
const LEGACY_QUOTA_CODES = new Set([
  22, // QUOTA_EXCEEDED_ERR
  1014, // Firefox: NS_ERROR_DOM_QUOTA_REACHED
]);

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // `code` is deprecated but still the only signal in older engines.
    LEGACY_QUOTA_CODES.has(error.code)
  );
}

/**
 * Merely touching `window.localStorage` throws a SecurityError when storage is
 * blocked by policy, so even reading the property needs guarding.
 */
function getStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const localStorageAdapter: StorageAdapter = {
  name: 'localStorage',

  read(key: string): Promise<string | null> {
    const store = getStore();
    if (!store) return Promise.resolve(null);

    try {
      return Promise.resolve(store.getItem(key));
    } catch (error) {
      logWarn(`[Storage] Error reading key "${key}" from localStorage:`, error);
      return Promise.resolve(null);
    }
  },

  write(key: string, value: string): Promise<WriteResult> {
    const store = getStore();
    if (!store) {
      return Promise.resolve({
        ok: false,
        reason: 'unavailable',
        message: 'Browser storage is disabled for this site.',
      });
    }

    try {
      store.setItem(key, value);
      return Promise.resolve({ ok: true });
    } catch (error) {
      logError(`[Storage] Error writing key "${key}" to localStorage:`, error);

      if (isQuotaError(error)) {
        return Promise.resolve({
          ok: false,
          reason: 'quota',
          message: 'Browser storage is full — export a backup and clear old sessions.',
        });
      }

      return Promise.resolve({
        ok: false,
        reason: 'io',
        message: 'Browser storage rejected the write.',
      });
    }
  },
};
