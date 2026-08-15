import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, setUpdateChannel, updatesAvailable } from './index';

afterEach(() => {
  setUpdateChannel(null);
  vi.restoreAllMocks();
});

describe('checkForUpdate', () => {
  it('has nothing to say in a build with no channel — the browser', () => {
    expect(updatesAvailable()).toBe(false);
    return expect(checkForUpdate()).resolves.toBeNull();
  });

  it('passes on what the channel found', async () => {
    const update = { version: '9.9.9', notes: '', install: vi.fn() };
    setUpdateChannel({ check: () => Promise.resolve(update) });

    expect(updatesAvailable()).toBe(true);
    await expect(checkForUpdate()).resolves.toBe(update);
  });

  // The check runs on its own at startup, so a failure is not something the
  // user asked for and must not reach them: a laptop opened on a train has no
  // network, and that is not an error worth interrupting anyone about. It also
  // must not escape — an unhandled rejection at startup is a logged crash.
  it('swallows an unreachable release rather than throwing at startup', async () => {
    setUpdateChannel({
      check: () => Promise.reject(new Error('getaddrinfo ENOTFOUND github.com')),
    });

    await expect(checkForUpdate()).resolves.toBeNull();
  });

  it('swallows a channel that throws synchronously', async () => {
    setUpdateChannel({
      check: () => {
        throw new Error('kaputt');
      },
    });

    await expect(checkForUpdate()).resolves.toBeNull();
  });
});
