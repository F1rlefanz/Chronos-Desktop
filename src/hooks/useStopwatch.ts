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

export function useStopwatch(intervalMs: number = TIME_CONSTANTS.DEFAULT_TIMER_UPDATE_INTERVAL_MS): UseStopwatchReturn {
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);
  const [timerState, setTimerState] = useState<TimerState>('IDLE');
  const [laps, setLaps] = useState<Lap[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);

  // High-precision refs for drift-free calculations
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastLapTotalMsRef = useRef<number>(0);

  // Core ticker loop
  const updateTick = useCallback(() => {
    if (lastTickTimeRef.current !== null) {
      const now = performance.now();
      const delta = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;
      accumulatedTimeRef.current += delta;
      setElapsedTimeMs(accumulatedTimeRef.current);
    }
    animFrameIdRef.current = requestAnimationFrame(updateTick);
  }, []);

  const start = useCallback(() => {
    const nowTimestamp = Date.now();
    const perfNow = performance.now();

    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;
    startTimeRef.current = nowTimestamp;
    lastTickTimeRef.current = perfNow;

    setElapsedTimeMs(0);
    setLaps([]);
    setStartTime(nowTimestamp);
    setTimerState('RUNNING');
  }, []);

  const pause = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastTickTimeRef.current = null;
    setTimerState('PAUSED');
  }, []);

  const resume = useCallback(() => {
    lastTickTimeRef.current = performance.now();
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
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastTickTimeRef.current = null;

    const finalMs = accumulatedTimeRef.current;
    const endTime = Date.now();
    const recordedStartTime = startTimeRef.current || endTime - finalMs;

    setTimerState('STOPPED');

    return {
      totalMs: finalMs,
      laps: [...laps],
      startTime: recordedStartTime,
      endTime,
    };
  }, [laps]);

  const reset = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastTickTimeRef.current = null;
    startTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    lastLapTotalMsRef.current = 0;

    setElapsedTimeMs(0);
    setLaps([]);
    setStartTime(null);
    setTimerState('IDLE');
  }, []);

  // Sync state & animation frame loop
  useEffect(() => {
    if (timerState === 'RUNNING') {
      animFrameIdRef.current = requestAnimationFrame(updateTick);
    } else if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [timerState, updateTick]);

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
