import { useEffect, useState } from 'react';

/**
 * A timestamp that everything in one render can share, refreshed on a timer.
 *
 * Durations are derived rather than stored, which means a running entry is only
 * as current as the `now` it was measured against. Reading `Date.now()` inline
 * would do it — but once per call site, so a list total and the rows it sums
 * could be measured a millisecond apart, and it makes the component impure.
 *
 * Pass `null` to stop the clock: with nothing running there is nothing to
 * re-render for, and a component that re-renders every second forever is a
 * waste the previous stopwatch-shaped code made everywhere.
 */
export function useNow(intervalMs: number | null): number {
  // Seeded through the lazy initialiser rather than in the body: the clock has
  // to be right on the first paint, or a running entry renders as zero and then
  // jumps a tick later.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs === null) return;

    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
