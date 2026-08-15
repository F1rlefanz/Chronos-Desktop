import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateCheck } from './useUpdateCheck';
import { setUpdateChannel } from '../utils/update';
import { AvailableUpdate } from '../utils/update/types';

const SIX_HOURS = 6 * 60 * 60 * 1000;

function offering(version: string): AvailableUpdate {
  return { version, notes: '', install: vi.fn() };
}

/** Lets the promise inside the hook settle before anything is asserted. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let answers: (AvailableUpdate | null)[] = [];
let asked = 0;

beforeEach(() => {
  vi.useFakeTimers();
  asked = 0;
  answers = [];
  setUpdateChannel({
    check: () => {
      const answer = answers[Math.min(asked, answers.length - 1)] ?? null;
      asked += 1;
      return Promise.resolve(answer);
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  setUpdateChannel(null);
});

describe('useUpdateCheck', () => {
  it('asks once at startup', async () => {
    answers = [offering('1.2.0')];
    const { result } = renderHook(() => useUpdateCheck());
    await settle();

    expect(asked).toBe(1);
    expect(result.current.update?.version).toBe('1.2.0');
  });

  // Nothing pushes to this app, so the rhythm is the only way a release reaches
  // a copy that is already running.
  it('asks again after six hours without a restart', async () => {
    answers = [null, offering('1.2.0')];
    const { result } = renderHook(() => useUpdateCheck());
    await settle();
    expect(result.current.update).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SIX_HOURS);
      await Promise.resolve();
    });
    await settle();

    expect(asked).toBe(2);
    expect(result.current.update?.version).toBe('1.2.0');
  });

  // A sleeping laptop runs no timers, so a copy opened the next morning would
  // otherwise still believe what it learned the evening before.
  it('asks again on coming back to the window', async () => {
    answers = [null, offering('1.2.0')];
    renderHook(() => useUpdateCheck());
    await settle();

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    await settle();

    expect(asked).toBe(2);
  });

  it('does not ask again on every window switch', async () => {
    answers = [null];
    renderHook(() => useUpdateCheck());
    await settle();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(asked).toBe(1);
  });

  // With one check at startup, "dismissed" and "dismissed for this session"
  // were the same thing. With several they are not, and getting it wrong means
  // dismissing 1.2.0 silently hides 1.3.0 too.
  it('keeps a dismissed version hidden across later checks', async () => {
    answers = [offering('1.2.0')];
    const { result } = renderHook(() => useUpdateCheck());
    await settle();

    act(() => result.current.dismiss());
    expect(result.current.update).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SIX_HOURS);
      await Promise.resolve();
    });
    await settle();

    expect(result.current.update).toBeNull();
  });

  it('shows a newer version even after the previous one was dismissed', async () => {
    answers = [offering('1.2.0'), offering('1.3.0')];
    const { result } = renderHook(() => useUpdateCheck());
    await settle();

    act(() => result.current.dismiss());
    expect(result.current.update).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SIX_HOURS);
      await Promise.resolve();
    });
    await settle();

    expect(result.current.update?.version).toBe('1.3.0');
  });

  it('asks nothing at all in a build that cannot update itself', async () => {
    setUpdateChannel(null);
    const { result } = renderHook(() => useUpdateCheck());
    await settle();

    expect(asked).toBe(0);
    expect(result.current.update).toBeNull();
  });

  it('stops asking once the app is gone', async () => {
    answers = [null];
    const { unmount } = renderHook(() => useUpdateCheck());
    await settle();
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(SIX_HOURS * 3);
      await Promise.resolve();
    });

    expect(asked).toBe(1);
  });
});
