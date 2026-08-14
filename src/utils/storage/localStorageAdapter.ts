import { logError, logWarn } from '../logging/logger';
import { ReadResult, StorageAdapter, WriteResult } from './types';

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

  read(key: string): Promise<ReadResult> {
    const store = getStore();
    // Storage switched off is not an empty storage: answering `null` here would
    // let the caller conclude nothing was ever saved and write over it.
    if (!store) {
      return Promise.resolve({
        ok: false,
        message: 'Der Browser-Speicher ist für diese Seite deaktiviert.',
      });
    }

    try {
      return Promise.resolve({ ok: true, value: store.getItem(key) });
    } catch (error) {
      logWarn(`[Storage] Error reading key "${key}" from localStorage:`, error);
      return Promise.resolve({
        ok: false,
        message: 'Der Browser-Speicher hat das Lesen abgelehnt.',
      });
    }
  },

  write(key: string, value: string): Promise<WriteResult> {
    const store = getStore();
    if (!store) {
      return Promise.resolve({
        ok: false,
        reason: 'unavailable',
        message: 'Der Browser-Speicher ist für diese Seite deaktiviert.',
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
          message:
            'Der Browser-Speicher ist voll — Sicherung exportieren und alte Einträge löschen.',
        });
      }

      return Promise.resolve({
        ok: false,
        reason: 'io',
        message: 'Der Browser-Speicher hat das Schreiben abgelehnt.',
      });
    }
  },
};
