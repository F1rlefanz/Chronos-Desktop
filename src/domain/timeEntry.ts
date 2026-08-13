/**
 * Everything the app knows about how long an entry lasted.
 *
 * Pure functions over `TimeEntry`: no React, no persistence, no clock of their
 * own — `now` is always passed in, which is what makes a running entry testable
 * without waiting for time to pass. Every duration shown, summed, exported or
 * charted comes from here, so there is one definition of "net time" rather than
 * one per screen.
 */

import { Break, TimeEntry } from '../types';
import { TIME_CONSTANTS } from '../constants/defaultConfig';

/** Beyond this, a manually entered stretch of work is worth a second look. */
export const IMPLAUSIBLE_ENTRY_HOURS = 16;

export function isRunning(entry: Pick<TimeEntry, 'endTime'>): boolean {
  return entry.endTime === null;
}

export function isBreakRunning(entry: Break): boolean {
  return entry.endTime === null;
}

export function hasRunningBreak(entry: Pick<TimeEntry, 'breaks'>): boolean {
  return entry.breaks.some(isBreakRunning);
}

/** A single pause, counted up to `now` while it is still running. */
export function breakDurationMs(pause: Break, now: number = Date.now()): number {
  const end = pause.endTime ?? now;
  return Math.max(0, end - pause.startTime);
}

/** Time spent paused. */
export function breakMs(entry: Pick<TimeEntry, 'breaks'>, now: number = Date.now()): number {
  return entry.breaks.reduce((total, pause) => total + breakDurationMs(pause, now), 0);
}

/** Wall-clock time from start to end, pauses included. */
export function grossMs(
  entry: Pick<TimeEntry, 'startTime' | 'endTime'>,
  now: number = Date.now()
): number {
  const end = entry.endTime ?? now;
  return Math.max(0, end - entry.startTime);
}

/**
 * The time that actually counts as worked: gross minus pauses.
 *
 * Clamped at zero so that a hand-edited entry whose pauses exceed its span
 * shows nothing rather than a negative duration — `validateEntryInput` rejects
 * that combination up front, but a file imported from elsewhere has not been
 * through it.
 */
export function netMs(
  entry: Pick<TimeEntry, 'startTime' | 'endTime' | 'breaks'>,
  now: number = Date.now()
): number {
  return Math.max(0, grossMs(entry, now) - breakMs(entry, now));
}

/**
 * Closes the open pause in a list, if there is one.
 *
 * Idempotent, because two different transitions need it: resuming, and
 * stopping straight out of a pause. A measurement must never be written out
 * with a pause that has no end — it would keep growing against `now` for as
 * long as the entry exists and quietly eat the recorded time.
 */
export function closeOpenBreak(breaks: Break[], at: number = Date.now()): Break[] {
  const open = breaks.findIndex(isBreakRunning);
  if (open === -1) return breaks;

  const closed = [...breaks];
  closed[open] = { ...closed[open], endTime: at };
  return closed;
}

/** Sums net time over many entries — the one place aggregates start from. */
export function totalNetMs(entries: TimeEntry[], now: number = Date.now()): number {
  return entries.reduce((total, entry) => total + netMs(entry, now), 0);
}

/**
 * The day an entry belongs to, as a local `YYYY-MM-DD` key.
 *
 * An entry counts towards the day it *started* on, so a stretch of work from
 * 22:00 to 01:00 belongs entirely to the earlier day. That is a decision, not
 * an accident: splitting net time across the days it touches is more accurate
 * but has to be honoured by every aggregate, and this way the rule lives in one
 * function that can be changed later. The calendar says so on screen.
 */
export function dayKeyFor(entry: Pick<TimeEntry, 'startTime'>): string {
  return dayKeyOf(new Date(entry.startTime));
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift across midnight. */
export function dayKeyOf(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** The parts of an entry a person can type; the rest is bookkeeping. */
export interface EntryInput {
  startTime: number;
  endTime: number | null;
  breaks: Break[];
}

/**
 * Errors and warnings are different things, and the difference matters.
 *
 * An error means the entry cannot be stored as described — end before start is
 * not a judgement call. A warning means the values are unusual but might be
 * exactly right, so the user is asked rather than blocked; a 17-hour day is
 * suspicious, not impossible.
 */
export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateEntryInput(input: EntryInput, now: number = Date.now()): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(input.startTime)) {
    errors.push('Der Beginn ist keine gültige Zeitangabe.');
    return { errors, warnings };
  }

  const running = input.endTime === null;

  if (!running) {
    if (!Number.isFinite(input.endTime)) {
      errors.push('Das Ende ist keine gültige Zeitangabe.');
      return { errors, warnings };
    }
    if (input.endTime! <= input.startTime) {
      errors.push('Das Ende muss nach dem Beginn liegen.');
    }
  }

  const spanEnd = input.endTime ?? now;

  for (const pause of input.breaks) {
    if (pause.endTime !== null && pause.endTime < pause.startTime) {
      errors.push('Eine Pause endet vor ihrem Beginn.');
      break;
    }
  }

  for (const pause of input.breaks) {
    const pauseEnd = pause.endTime ?? spanEnd;
    if (pause.startTime < input.startTime || pauseEnd > spanEnd) {
      errors.push('Eine Pause liegt außerhalb des Eintrags.');
      break;
    }
  }

  const gross = Math.max(0, spanEnd - input.startTime);
  const pauses = input.breaks.reduce((total, pause) => total + breakDurationMs(pause, spanEnd), 0);

  if (pauses > gross) {
    errors.push('Die Pausen sind zusammen länger als der Eintrag.');
  }

  if (gross > IMPLAUSIBLE_ENTRY_HOURS * TIME_CONSTANTS.MS_PER_HOUR) {
    warnings.push(`Der Eintrag ist länger als ${IMPLAUSIBLE_ENTRY_HOURS} Stunden. Bitte prüfen.`);
  }

  if (input.startTime > now) {
    warnings.push('Der Beginn liegt in der Zukunft.');
  }

  return { errors, warnings };
}
