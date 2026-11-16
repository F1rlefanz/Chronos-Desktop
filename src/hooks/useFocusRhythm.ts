import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimeEntry } from '../types';
import {
  FocusExtension,
  FocusPhase,
  FocusPlan,
  FocusSignal,
  derivePhase,
  extendPhase,
  focusSignal,
} from '../domain/focus';

interface UseFocusRhythmOptions {
  /** The measurement in progress, or `null`. */
  entry: TimeEntry | null;
  plan: FocusPlan;
  /** The shared clock from `useNow`, so this agrees with everything else on screen. */
  now: number;
  /**
   * Off while the user is being asked something about the running entry — what
   * to do with one left over from before, or its times in the form. The phase
   * is still worked out, so the screen tells the truth; nothing is *done* or
   * *said* until the user has answered.
   */
  active: boolean;
  /** `fixed` mode: start the pause that should have started at `at`. */
  onAutoBreak: (at: number) => void;
  /** A block or pause has run its course. */
  onChime: () => void;
}

export interface FocusRhythm {
  phase: FocusPhase | null;
  signal: FocusSignal | null;
  /** Grant the current phase more time. */
  extend: (ms: number) => void;
}

/**
 * Watches a running entry against the rhythm and reacts once per occasion.
 *
 * The phase is recomputed from the entry on every tick, so there is nothing to
 * drift: a window that was minimised, a laptop that slept or a phone that froze
 * the WebView all come back to the right answer on the next tick. What is kept
 * here is only what cannot be derived — the extra time the user granted — and
 * the memory of which occasion has already been acted on.
 *
 * The pause in `fixed` mode is started *at the moment the block ended*, not at
 * the moment this notices. After a long absence the second differs from the
 * first, and counting the gap as work would be inventing time.
 */
export function useFocusRhythm({
  entry,
  plan,
  now,
  active,
  onAutoBreak,
  onChime,
}: UseFocusRhythmOptions): FocusRhythm {
  const [extension, setExtension] = useState<FocusExtension | null>(null);

  const phase = useMemo(
    () => derivePhase(entry, plan, now, extension),
    [entry, plan, now, extension]
  );
  const signal = active ? focusSignal(phase, plan, extension) : null;

  // One occasion — this phase, this signal, this much extra time — is acted on
  // once. Without it the effect would sound again on every tick the condition
  // stays true, and in `fixed` mode start a second pause before the first has
  // been written.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!phase || !signal) return;

    const granted = extension && extension.phaseStart === phase.phaseStart ? extension.ms : 0;
    const occasion = `${phase.phaseStart}:${signal}:${granted}`;
    if (handled.current === occasion) return;
    handled.current = occasion;

    if (signal === 'break-due' && phase.kind === 'focus' && phase.targetMs !== null) {
      onAutoBreak(phase.phaseStart + phase.targetMs);
    }
    onChime();
  }, [phase, signal, extension, onAutoBreak, onChime]);

  // Read at the moment of the click: "from now" depends on how far the phase
  // has run by then, so the extension is computed from the phase as it stands.
  const extend = useCallback(
    (ms: number) => {
      if (!phase) return;
      setExtension((current) => extendPhase(phase, current, ms));
    },
    [phase]
  );

  return { phase, signal, extend };
}
