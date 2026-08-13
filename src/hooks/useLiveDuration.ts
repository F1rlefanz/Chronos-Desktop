import { useEffect, useState } from 'react';
import { TimeEntry } from '../types';
import { hasRunningBreak, netMs } from '../domain/timeEntry';

type Measurable = Pick<TimeEntry, 'startTime' | 'endTime' | 'breaks'>;

/**
 * The net duration of a running entry, repainted smoothly.
 *
 * This replaces the accumulator that used to add up animation-frame deltas.
 * Frames still drive the repaint — a `setInterval` would visibly stutter
 * against the display's refresh rate — but the number itself now comes from the
 * wall clock, because frames are not a measure of elapsed time: a minimised
 * window stops receiving them, and the old accumulator silently lost every
 * second the window spent hidden.
 *
 * `intervalMs` throttles the state push, not the reading, so the configured
 * update rate controls how often React re-renders without costing accuracy.
 */
export function useLiveDuration(entry: Measurable | null, intervalMs: number): number {
  // A finished entry has a fixed duration, and one sitting inside a pause has a
  // duration that does not move either — gross and break time grow in lockstep,
  // so `netMs` returns the same answer for any `now`. Neither needs a clock.
  const ticking = entry !== null && entry.endTime === null && !hasRunningBreak(entry);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;

    let frameId = 0;
    // Negative infinity so the first frame pushes immediately rather than
    // leaving a freshly started measurement on a stale reading.
    let lastPush = -Infinity;

    const tick = () => {
      const frameTime = performance.now();
      if (frameTime - lastPush >= intervalMs) {
        lastPush = frameTime;
        setNow(Date.now());
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [ticking, intervalMs]);

  if (!entry) return 0;

  // The clock only advances while something is ticking, so for an entry that is
  // paused it can be older than the pause itself — and reading the entry
  // against a `now` that predates its own timestamps reports zero. An entry is
  // at least as old as the newest instant recorded in it, so that is the floor.
  const newestKnown = entry.breaks.reduce(
    (latest, pause) => Math.max(latest, pause.endTime ?? pause.startTime),
    entry.startTime
  );

  return netMs(entry, Math.max(now, newestKnown));
}
