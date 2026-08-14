import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { localStorageAdapter } from './localStorageAdapter';

/** Replaces `window.localStorage` with something that throws on access. */
function breakLocalStorage(): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is disabled', 'SecurityError');
    },
  });

  return () => {
    if (original) {
      Object.defineProperty(window, 'localStorage', original);
    } else {
      Reflect.deleteProperty(window, 'localStorage');
    }
  };
}

describe('localStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a value', async () => {
    expect(await localStorageAdapter.write('k', 'hello')).toEqual({ ok: true });
    expect(await localStorageAdapter.read('k')).toEqual({ ok: true, value: 'hello' });
  });

  it('reads a key that was never written as a successful empty read', async () => {
    expect(await localStorageAdapter.read('never-written')).toEqual({ ok: true, value: null });
  });

  it('reports a full quota as such', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError');
    });

    expect(await localStorageAdapter.write('k', 'v')).toMatchObject({
      ok: false,
      reason: 'quota',
    });
  });

  it("recognises Firefox's differently named quota error", async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'NS_ERROR_DOM_QUOTA_REACHED');
    });

    expect(await localStorageAdapter.write('k', 'v')).toMatchObject({ reason: 'quota' });
  });

  it('reports any other rejection as an io failure', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('something else');
    });

    expect(await localStorageAdapter.write('k', 'v')).toMatchObject({ ok: false, reason: 'io' });
  });

  it('reports disabled storage as unavailable instead of throwing', async () => {
    const restore = breakLocalStorage();

    try {
      expect(await localStorageAdapter.write('k', 'v')).toMatchObject({
        ok: false,
        reason: 'unavailable',
      });
      // Not `null`: storage switched off is not storage that is empty, and
      // the caller would otherwise write its defaults over whatever is there.
      expect(await localStorageAdapter.read('k')).toMatchObject({ ok: false });
    } finally {
      restore();
    }
  });

  it('carries a message for the user on every failure', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError');
    });

    const result = await localStorageAdapter.write('k', 'v');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});
