import { useState, useRef, useCallback, useEffect } from 'react';
import { Break, TimerState } from '../types';
import { TIME_CONSTANTS } from '../constants/defaultConfig';

/**
 * A split time, shown while the stopwatch runs and never stored.
 *
 * It lives here rather than in `../types` because it is not part of the data
 * model: a lap says something about a stopwatch run, not about worked time, and
 * an entry that was typed in by hand can never have one.
 */
export interface Lap {
  id: string;
  lapNumber: number;
  lapTimeMs: number;
  splitTimeMs: number;
  timestamp: number;
}

/**
 * What a finished run contributes to an entry: the facts, not the arithmetic.
 *
 * Deliberately no total — the duration is derived from these three by
 * `netMs`, so there is no second number that could disagree with them. The
 * accumulator behind `elapsedTimeMs` drives the live display only; it stops
 * advancing when the window stops receiving animation frames, which makes it
 * the wrong thing to persist.
 */
export interface StopwatchResult {
  startTime: number;
  endTime: number;
  breaks: Break[];
}

export interface UseStopwatchReturn {
  elapsedTimeMs: number;
  timerState: TimerState;
  laps: Lap[];
  startTime: number | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  recordLap: () => Lap | null;
  stop: () => StopwatchResult;
  reset: () => void;
}

export function useStopwatch(
  intervalMs: number = TIME_CONSTANTS.DEFAULT_TIMER_UPDATE_INTERVAL_MS
): UseStopwatchReturn {
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);
  const [timerState, setTimerState] = useState<TimerState>('IDLE');
  const [laps, setLaps] = useState<Lap[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);

  // High-precision refs for drift-free calculations
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number | null>(null);
  const lastLapTotalMsRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  // Pauses, recorded on the wall clock as they happen. The accumulator above
  // deliberately does not advance while paused; keeping the gaps as timestamped
  // events rather than one running total is what lets a pause be corrected
  // afterwards, and what survives being written to disk mid-run.
  const breaksRef = useRef<Break[]>([]);

  const start = useCallback(() => {
    const nowTimestamp = Date.now();
    const perfNow = performance.now();

    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;
    breaksRef.current = [];
    startTimeRef.current = nowTimestamp;
    lastTickTimeRef.current = perfNow;
    lastRenderTimeRef.current = perfNow;

    setElapsedTimeMs(0);
    setLaps([]);
    setStartTime(nowTimestamp);
    setTimerState('RUNNING');
  }, []);

  // The ticker loop is owned by the effect below; leaving RUNNING is enough to
  // stop it, so pause/stop/reset only settle their own bookkeeping.
  const pause = useCallback(() => {
    lastTickTimeRef.current = null;
    breaksRef.current = [
      ...breaksRef.current,
      {
        id: `break-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        startTime: Date.now(),
        endTime: null,
      },
    ];
    // Flush the throttled value so the display shows the exact pause instant.
    setElapsedTimeMs(accumulatedTimeRef.current);
    setTimerState('PAUSED');
  }, []);

  /** Closes an open pause, if there is one. Idempotent: stop after pause. */
  const settlePause = useCallback(() => {
    const open = breaksRef.current.findIndex((pause) => pause.endTime === null);
    if (open === -1) return;

    const settled = [...breaksRef.current];
    settled[open] = { ...settled[open], endTime: Date.now() };
    breaksRef.current = settled;
  }, []);

  const resume = useCallback(() => {
    const perfNow = performance.now();
    settlePause();
    lastTickTimeRef.current = perfNow;
    lastRenderTimeRef.current = perfNow;
    setTimerState('RUNNING');
  }, [settlePause]);

  const recordLap = useCallback((): Lap | null => {
    if (timerState !== 'RUNNING' && timerState !== 'PAUSED') return null;

    const currentTotalMs = accumulatedTimeRef.current;
    const lapDurationMs = currentTotalMs - lastLapTotalMsRef.current;
    lastLapTotalMsRef.current = currentTotalMs;

    const newLap: Lap = {
      id: `lap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lapNumber: laps.length + 1,
      lapTimeMs: lapDurationMs,
      splitTimeMs: currentTotalMs,
      timestamp: Date.now(),
    };

    setLaps((prev) => [newLap, ...prev]);
    return newLap;
  }, [timerState, laps.length]);

  const stop = useCallback((): StopwatchResult => {
    lastTickTimeRef.current = null;
    // Stopping straight out of PAUSED still closes that pause.
    settlePause();

    const finalMs = accumulatedTimeRef.current;
    const endTime = Date.now();
    const recordedStartTime = startTimeRef.current ?? endTime - finalMs;

    setElapsedTimeMs(finalMs);
    setTimerState('STOPPED');

    return {
      startTime: recordedStartTime,
      endTime,
      breaks: breaksRef.current,
    };
  }, [settlePause]);

  const reset = useCallback(() => {
    lastTickTimeRef.current = null;
    startTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;
    lastRenderTimeRef.current = 0;
    breaksRef.current = [];

    setElapsedTimeMs(0);
    setLaps([]);
    setStartTime(null);
    setTimerState('IDLE');
  }, []);

  // Core ticker loop, owned entirely by this effect: it runs while the timer is
  // RUNNING and is cancelled by the cleanup on any other state.
  //
  // Elapsed time is accumulated at full animation-frame resolution; only the
  // React state push is throttled to `intervalMs`, so the configured update
  // interval controls re-render frequency without costing timing accuracy.
  useEffect(() => {
    if (timerState !== 'RUNNING') return;

    let frameId = 0;

    const tick = () => {
      if (lastTickTimeRef.current !== null) {
        const now = performance.now();
        const delta = now - lastTickTimeRef.current;
        lastTickTimeRef.current = now;
        accumulatedTimeRef.current += delta;

        if (now - lastRenderTimeRef.current >= intervalMs) {
          lastRenderTimeRef.current = now;
          setElapsedTimeMs(accumulatedTimeRef.current);
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [timerState, intervalMs]);

  return {
    elapsedTimeMs,
    timerState,
    laps,
    startTime,
    start,
    pause,
    resume,
    recordLap,
    stop,
    reset,
  };
}
