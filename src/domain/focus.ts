/**
 * The focus rhythm, worked out from an entry rather than kept beside it.
 *
 * A focus block is nothing more than the stretch of a running entry between two
 * pauses, so which block the user is in, how far into it, and whether a pause is
 * due are all facts about the entry's start and breaks. Nothing here is stored:
 * a second copy of "which phase are we in" is exactly what would disagree with
 * the entry after a crash, a sleeping laptop or Android freezing the WebView —
 * recomputing it from timestamps makes all three the same case as a normal tick.
 *
 * Pure functions over `TimeEntry`, with `now` passed in, like `timeEntry.ts`.
 */

import { AppSettings, FocusMode, TimeEntry } from '../types';
import { FOCUS_LIMITS } from '../constants/defaultConfig';

const MINUTE = 60_000;

export const FOCUS_MODES: readonly FocusMode[] = ['fixed', 'flex', 'open'];

/** In `open` mode a pause is suggested after this long without one. */
export const OPEN_SUGGEST_AFTER_MS = 90 * MINUTE;

/** What "Weiter im Fluss" adds to a block, and what "Noch nicht" pushes a suggestion back by. */
export const FLOW_EXTENSION_MS = 10 * MINUTE;
export const OPEN_SNOOZE_MS = 30 * MINUTE;

/** The "+5 min" button, on a block and on a pause alike. */
export const NUDGE_EXTENSION_MS = 5 * MINUTE;

/** After this many blocks the pause in `fixed` mode is the long one. */
export const LONG_BREAK_EVERY = 4;
export const LONG_BREAK_FACTOR = 3;

/** In `flex` and `open` the pause is this share of the block just worked, within bounds. */
const FLEX_BREAK_SHARE = 1 / 5;
const FLEX_BREAK_MIN_MS = 3 * MINUTE;
const FLEX_BREAK_MAX_MS = 20 * MINUTE;

export interface FocusPlan {
  mode: FocusMode;
  focusMs: number;
  breakMs: number;
}

export function planFromSettings(
  settings: Pick<AppSettings, 'focusMode' | 'focusMinutes' | 'breakMinutes'>
): FocusPlan {
  return {
    mode: settings.focusMode,
    focusMs: settings.focusMinutes * MINUTE,
    breakMs: settings.breakMinutes * MINUTE,
  };
}

/**
 * Extra time the user granted the phase they are in ("+5 min", "im Fluss").
 *
 * Tied to the phase it was given in by that phase's start: the next block or
 * pause starts clean without anyone having to remember to reset it. It is not
 * stored on the entry, so after a restart the original target applies again —
 * the worst outcome is being asked once more.
 */
export interface FocusExtension {
  phaseStart: number;
  ms: number;
}

export type FocusPhase =
  | {
      kind: 'focus';
      /** Which block this is, counting from 1. */
      block: number;
      phaseStart: number;
      elapsedMs: number;
      /** `null` in `open` mode, where there is no block to end. */
      targetMs: number | null;
      /** What a pause after this block would last. */
      suggestedBreakMs: number;
    }
  | {
      kind: 'break';
      /** The block this pause follows. */
      block: number;
      phaseStart: number;
      elapsedMs: number;
      targetMs: number;
    };

/** How long a pause should be after a block of the given length. */
export function suggestBreakMs(plan: FocusPlan, focusedMs: number, block: number): number {
  if (plan.mode === 'fixed') {
    return block % LONG_BREAK_EVERY === 0 ? plan.breakMs * LONG_BREAK_FACTOR : plan.breakMs;
  }
  const share = Math.round(focusedMs * FLEX_BREAK_SHARE);
  return Math.min(FLEX_BREAK_MAX_MS, Math.max(FLEX_BREAK_MIN_MS, share));
}

/**
 * Where a running entry stands, or `null` if there is nothing running.
 *
 * Breaks are read in time order whatever order they are stored in, because an
 * entry that was edited or merged from another device owes nobody an ordering.
 */
export function derivePhase(
  entry: TimeEntry | null,
  plan: FocusPlan,
  now: number,
  extension: FocusExtension | null = null
): FocusPhase | null {
  if (!entry || entry.endTime !== null) return null;

  const extra = (phaseStart: number): number =>
    extension && extension.phaseStart === phaseStart ? extension.ms : 0;

  const breaks = [...entry.breaks].sort((a, b) => a.startTime - b.startTime);
  let blockStart = entry.startTime;
  let block = 1;

  for (const pause of breaks) {
    if (pause.endTime === null) {
      const focusedMs = Math.max(0, pause.startTime - blockStart);
      return {
        kind: 'break',
        block,
        phaseStart: pause.startTime,
        elapsedMs: Math.max(0, now - pause.startTime),
        targetMs: suggestBreakMs(plan, focusedMs, block) + extra(pause.startTime),
      };
    }
    blockStart = pause.endTime;
    block += 1;
  }

  const elapsedMs = Math.max(0, now - blockStart);
  return {
    kind: 'focus',
    block,
    phaseStart: blockStart,
    elapsedMs,
    targetMs: plan.mode === 'open' ? null : plan.focusMs + extra(blockStart),
    suggestedBreakMs: suggestBreakMs(plan, elapsedMs, block),
  };
}

/**
 * What the rhythm wants to say right now, if anything.
 *
 * - `break-due`: `fixed` mode only; the block is over and the pause starts by
 *   itself.
 * - `goal-reached`: `flex` mode; the block's target is reached and the user is
 *   asked whether to stay in it.
 * - `long-run`: `open` mode; a long stretch without a pause.
 * - `break-over`: the pause has lasted as long as suggested.
 */
export type FocusSignal = 'break-due' | 'goal-reached' | 'long-run' | 'break-over';

export function focusSignal(
  phase: FocusPhase | null,
  plan: FocusPlan,
  extension: FocusExtension | null = null
): FocusSignal | null {
  if (!phase) return null;

  if (phase.kind === 'break') {
    return phase.elapsedMs >= phase.targetMs ? 'break-over' : null;
  }

  if (plan.mode === 'open') {
    const extra = extension && extension.phaseStart === phase.phaseStart ? extension.ms : 0;
    return phase.elapsedMs >= OPEN_SUGGEST_AFTER_MS + extra ? 'long-run' : null;
  }

  if (phase.targetMs !== null && phase.elapsedMs >= phase.targetMs) {
    return plan.mode === 'fixed' ? 'break-due' : 'goal-reached';
  }
  return null;
}

/**
 * A loaded or imported value, forced into what the settings may hold.
 *
 * A settings file is input like any other: a hand-edited `focusMinutes: 0` would
 * make every block end the moment it begins, and `-5` would never end.
 */
export function clampMinutes(value: number, limits: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

export function normalizeFocusSettings(
  raw: Pick<AppSettings, 'focusMode' | 'focusMinutes' | 'breakMinutes'>,
  fallback: Pick<AppSettings, 'focusMode' | 'focusMinutes' | 'breakMinutes'>
): Pick<AppSettings, 'focusMode' | 'focusMinutes' | 'breakMinutes'> {
  return {
    focusMode: FOCUS_MODES.includes(raw.focusMode) ? raw.focusMode : fallback.focusMode,
    focusMinutes: Number.isFinite(raw.focusMinutes)
      ? clampMinutes(raw.focusMinutes, FOCUS_LIMITS.focusMinutes)
      : fallback.focusMinutes,
    breakMinutes: Number.isFinite(raw.breakMinutes)
      ? clampMinutes(raw.breakMinutes, FOCUS_LIMITS.breakMinutes)
      : fallback.breakMinutes,
  };
}
