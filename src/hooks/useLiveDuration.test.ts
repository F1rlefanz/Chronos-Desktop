import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveDuration } from './useLiveDuration';
import type { Break } from '../types';

/**
 * Frames are pumped by hand and both clocks are pinned to the same controllable
 * value. Keeping them separate matters for one case below: the point of this
 * hook is that the duration follows the wall clock even when frames stop.
 */
const EPOCH = 1_700_000_000_000;
let perfNow = 0;
let wallNow = EPOCH;
let frameCallbacks: FrameRequestCallback[] = [];

function pumpFrame(advanceMs: number) {
  perfNow += advanceMs;
  wallNow += advanceMs;
  const due = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    due.forEach((cb) => cb(perfNow));
  });
}

const MINUTE = 60_000;

function entry(overrides: { endTime?: number | null; breaks?: Break[] } = {}) {
  return {
    startTime: EPOCH,
    endTime: null as number | null,
    breaks: [] as Break[],
    ...overrides,
  };
}

beforeEach(() => {
  perfNow = 0;
  wallNow = EPOCH;
  frameCallbacks = [];
  vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
  vi.spyOn(Date, 'now').mockImplementation(() => wallNow);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
    frameCallbacks = [];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLiveDuration', () => {
  it('is zero without an entry', () => {
    const { result } = renderHook(() => useLiveDuration(null, 10));
    expect(result.current).toBe(0);
  });

  it('follows the wall clock while running', () => {
    const running = entry();
    const { result } = renderHook(() => useLiveDuration(running, 10));

    pumpFrame(5 * MINUTE);
    expect(result.current).toBe(5 * MINUTE);

    pumpFrame(MINUTE);
    expect(result.current).toBe(6 * MINUTE);
  });

  it('counts time the window spent without frames', () => {
    // The defect this hook exists to fix: the old accumulator only advanced
    // inside the frame callback, so a minimised window under-reported. Here a
    // single frame arrives after a long gap and the full gap is counted.
    const running = entry();
    const { result } = renderHook(() => useLiveDuration(running, 10));

    pumpFrame(30 * MINUTE);
    expect(result.current).toBe(30 * MINUTE);
  });

  it('holds still while a break is running', () => {
    const paused = entry({
      breaks: [{ id: 'b1', startTime: EPOCH + 10 * MINUTE, endTime: null }],
    });
    const { result } = renderHook(() => useLiveDuration(paused, 10));

    // Ten minutes of work, then paused: the reading stays put no matter how
    // much wall-clock time passes, and no frames are requested for it.
    expect(result.current).toBe(10 * MINUTE);
    expect(frameCallbacks).toHaveLength(0);

    wallNow += 20 * MINUTE;
    expect(result.current).toBe(10 * MINUTE);
  });

  it('reports the fixed duration of a finished entry', () => {
    const finished = entry({ endTime: EPOCH + 42 * MINUTE });
    const { result } = renderHook(() => useLiveDuration(finished, 10));

    expect(result.current).toBe(42 * MINUTE);
    expect(frameCallbacks).toHaveLength(0);
  });

  it('subtracts closed breaks from the running total', () => {
    const running = entry({
      breaks: [{ id: 'b1', startTime: EPOCH + MINUTE, endTime: EPOCH + 3 * MINUTE }],
    });
    const { result } = renderHook(() => useLiveDuration(running, 10));

    pumpFrame(10 * MINUTE);
    expect(result.current).toBe(8 * MINUTE);
  });

  it('throttles state pushes to the configured interval', () => {
    const running = entry();
    const { result } = renderHook(() => useLiveDuration(running, 1000));

    pumpFrame(16); // first frame always pushes
    expect(result.current).toBe(16);

    pumpFrame(16); // too soon — the reading is not refreshed
    expect(result.current).toBe(16);

    pumpFrame(1000);
    expect(result.current).toBe(1032);
  });
});
