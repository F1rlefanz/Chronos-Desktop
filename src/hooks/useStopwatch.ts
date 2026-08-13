import { useState, useRef, useCallback, useEffect } from 'react';
import { TimerState, Lap } from '../types';
import { TIME_CONSTANTS } from '../constants/defaultConfig';

export interface UseStopwatchReturn {
  elapsedTimeMs: number;
  timerState: TimerState;
  laps: Lap[];
  startTime: number | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  recordLap: () => Lap | null;
  stop: () => { totalMs: number; laps: Lap[]; startTime: number; endTime: number };
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

  const start = useCallback(() => {
    const nowTimestamp = Date.now();
    const perfNow = performance.now();

    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;
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
    // Flush the throttled value so the display shows the exact pause instant.
    setElapsedTimeMs(accumulatedTimeRef.current);
    setTimerState('PAUSED');
  }, []);

  const resume = useCallback(() => {
    const perfNow = performance.now();
    lastTickTimeRef.current = perfNow;
    lastRenderTimeRef.current = perfNow;
    setTimerState('RUNNING');
  }, []);

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

  const stop = useCallback(() => {
    lastTickTimeRef.current = null;

    const finalMs = accumulatedTimeRef.current;
    const endTime = Date.now();
    const recordedStartTime = startTimeRef.current || endTime - finalMs;

    setElapsedTimeMs(finalMs);
    setTimerState('STOPPED');

    return {
      totalMs: finalMs,
      laps: [...laps],
      startTime: recordedStartTime,
      endTime,
    };
  }, [laps]);

  const reset = useCallback(() => {
    lastTickTimeRef.current = null;
    startTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;
    lastRenderTimeRef.current = 0;

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
