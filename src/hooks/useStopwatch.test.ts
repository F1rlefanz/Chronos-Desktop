import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStopwatch } from './useStopwatch';
import { breakMs, netMs } from '../domain/timeEntry';

/**
 * The hook drives itself from requestAnimationFrame + performance.now(), so
 * tests advance a controllable clock and pump frames by hand. Real timers would
 * make every assertion a race.
 *
 * `Date.now` is pinned to the same clock: pauses are recorded as wall-clock
 * timestamps, so a fake performance clock alone would leave every break with a
 * duration of zero.
 */
const EPOCH = 1_700_000_000_000;
let now = 0;
let frameCallbacks: FrameRequestCallback[] = [];

function pumpFrame(advanceMs: number) {
  now += advanceMs;
  const due = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    due.forEach((cb) => cb(now));
  });
}

beforeEach(() => {
  now = 0;
  frameCallbacks = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(Date, 'now').mockImplementation(() => EPOCH + now);
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

describe('useStopwatch', () => {
  it('starts idle at zero', () => {
    const { result } = renderHook(() => useStopwatch());
    expect(result.current.timerState).toBe('IDLE');
    expect(result.current.elapsedTimeMs).toBe(0);
    expect(result.current.laps).toEqual([]);
  });

  it('accumulates elapsed time while running', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    expect(result.current.timerState).toBe('RUNNING');

    pumpFrame(500);
    pumpFrame(500);

    expect(result.current.elapsedTimeMs).toBeCloseTo(1000, 5);
  });

  it('freezes time while paused and continues on resume', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);
    act(() => result.current.pause());

    const atPause = result.current.elapsedTimeMs;
    expect(result.current.timerState).toBe('PAUSED');

    // Wall clock moves on, but no frames run while paused.
    now += 5000;
    expect(result.current.elapsedTimeMs).toBe(atPause);

    act(() => result.current.resume());
    pumpFrame(250);

    expect(result.current.elapsedTimeMs).toBeCloseTo(atPause + 250, 5);
  });

  it('reports lap time and split time separately', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);
    act(() => {
      result.current.recordLap();
    });
    pumpFrame(400);
    act(() => {
      result.current.recordLap();
    });

    // Newest lap first.
    const [second, first] = result.current.laps;
    expect(result.current.laps).toHaveLength(2);

    expect(first.lapNumber).toBe(1);
    expect(first.lapTimeMs).toBeCloseTo(1000, 5);
    expect(first.splitTimeMs).toBeCloseTo(1000, 5);

    expect(second.lapNumber).toBe(2);
    expect(second.lapTimeMs).toBeCloseTo(400, 5);
    expect(second.splitTimeMs).toBeCloseTo(1400, 5);
  });

  it('refuses to record a lap while idle', () => {
    const { result } = renderHook(() => useStopwatch());
    let lap = null;
    act(() => {
      lap = result.current.recordLap();
    });
    expect(lap).toBeNull();
    expect(result.current.laps).toEqual([]);
  });

  it('returns the facts of the run from stop()', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);
    act(() => {
      result.current.recordLap();
    });
    pumpFrame(500);

    let stopped!: ReturnType<typeof result.current.stop>;
    act(() => {
      stopped = result.current.stop();
    });

    expect(result.current.timerState).toBe('STOPPED');
    expect(stopped.endTime).toBeGreaterThanOrEqual(stopped.startTime);
    expect(stopped.breaks).toEqual([]);
    // Laps are a live display concern and never reach the saved entry.
    expect(stopped).not.toHaveProperty('laps');
    // The display is flushed to the exact stop instant, not the last throttled tick.
    expect(result.current.elapsedTimeMs).toBeCloseTo(1500, 5);
  });

  it('records a pause as a closed break on the wall clock', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);

    act(() => result.current.pause());
    now += 3000; // paused wall-clock time
    act(() => result.current.resume());

    pumpFrame(500);

    let stopped!: ReturnType<typeof result.current.stop>;
    act(() => {
      stopped = result.current.stop();
    });

    expect(stopped.breaks).toHaveLength(1);
    expect(breakMs({ breaks: stopped.breaks })).toBeCloseTo(3000, -1);
    // Paused time is excluded from the derived net duration.
    expect(netMs(stopped)).toBeCloseTo(1500, -1);
  });

  it('closes a pause that is never resumed before stopping', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);
    act(() => result.current.pause());
    now += 2000;

    let stopped!: ReturnType<typeof result.current.stop>;
    act(() => {
      stopped = result.current.stop();
    });

    expect(stopped.breaks).toHaveLength(1);
    expect(stopped.breaks[0].endTime).not.toBeNull();
    expect(breakMs({ breaks: stopped.breaks })).toBeCloseTo(2000, -1);
  });

  it('records no break for a session that never paused', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);

    let stopped!: ReturnType<typeof result.current.stop>;
    act(() => {
      stopped = result.current.stop();
    });

    expect(stopped.breaks).toEqual([]);
    expect(breakMs({ breaks: stopped.breaks })).toBe(0);
  });

  it('clears everything on reset, from any state', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    pumpFrame(1000);
    act(() => {
      result.current.recordLap();
    });
    act(() => result.current.pause());
    act(() => result.current.reset());

    expect(result.current.timerState).toBe('IDLE');
    expect(result.current.elapsedTimeMs).toBe(0);
    expect(result.current.laps).toEqual([]);
    expect(result.current.startTime).toBeNull();
  });

  it('throttles renders to intervalMs without losing elapsed time', () => {
    const { result } = renderHook(() => useStopwatch(100));

    act(() => result.current.start());

    // Below the interval: accumulated internally, not yet pushed to state.
    pumpFrame(20);
    expect(result.current.elapsedTimeMs).toBe(0);

    // Crossing the interval publishes the full accumulated total, not just the
    // last frame's delta.
    pumpFrame(90);
    expect(result.current.elapsedTimeMs).toBeCloseTo(110, 5);
  });
});
