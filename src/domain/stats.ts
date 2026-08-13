/**
 * Aggregates over time entries.
 *
 * Nothing here is cached or precomputed: every total is recomputed from the
 * entries themselves. That is what keeps a correction consistent everywhere at
 * once — edit an entry and the day, the week, the month and the chart all move
 * together, because none of them is a separate stored number that could be
 * forgotten. The data sets are small enough that the honest version is also the
 * fast one.
 *
 * Every function takes `now` explicitly, so a running entry can be aggregated
 * in a test without waiting for real time to pass.
 */

import { TimeEntry } from '../types';
import { dayKeyFor, dayKeyOf, netMs, totalNetMs } from './timeEntry';

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** Three-letter forms, for chart axes where the full name will not fit. */
export const MONTH_LABELS_SHORT = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

/** A half-open interval `[from, to)` in epoch milliseconds. */
export interface Range {
  from: number;
  to: number;
}

export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/** Monday to the following Monday — ISO weeks, as used across Europe. */
export function weekRange(date: Date): Range {
  const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
  return {
    from: monday.getTime(),
    to: new Date(monday.getTime() + weekLengthOf(monday)).getTime(),
  };
}

/**
 * Seven days from `monday`, measured on the calendar rather than as
 * `7 * 24 * 60 * 60 * 1000` — the week containing a daylight-saving change is
 * an hour shorter or longer, and a fixed constant would slide the boundary into
 * the neighbouring day.
 */
function weekLengthOf(monday: Date): number {
  const next = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return next.getTime() - monday.getTime();
}

export function monthRange(year: number, month: number): Range {
  return {
    from: new Date(year, month, 1).getTime(),
    to: new Date(year, month + 1, 1).getTime(),
  };
}

export function yearRange(year: number): Range {
  return { from: new Date(year, 0, 1).getTime(), to: new Date(year + 1, 0, 1).getTime() };
}

/**
 * The entries belonging to a range.
 *
 * Selection is by the entry's *day*, not by raw timestamp, so it agrees with
 * `dayKeyFor`: an entry that runs past midnight belongs to the day it started
 * on, and it must not fall into two buckets — or none — depending on which
 * function did the asking.
 */
export function entriesInRange(entries: TimeEntry[], range: Range): TimeEntry[] {
  return entries.filter((entry) => entry.startTime >= range.from && entry.startTime < range.to);
}

export function totalInRange(entries: TimeEntry[], range: Range, now: number): number {
  return totalNetMs(entriesInRange(entries, range), now);
}

/** The five headline figures. */
export interface Summary {
  today: number;
  week: number;
  month: number;
  year: number;
  allTime: number;
}

export function summarise(entries: TimeEntry[], now: number): Summary {
  const today = new Date(now);

  return {
    today: totalInRange(entries, { from: startOfDay(today), to: endOfDay(today) }, now),
    week: totalInRange(entries, weekRange(today), now),
    month: totalInRange(entries, monthRange(today.getFullYear(), today.getMonth()), now),
    year: totalInRange(entries, yearRange(today.getFullYear()), now),
    allTime: totalNetMs(entries, now),
  };
}

/** Net time per day for one calendar month, keyed `YYYY-MM-DD`. */
export function dailyTotals(
  entries: TimeEntry[],
  year: number,
  month: number,
  now: number
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const entry of entriesInRange(entries, monthRange(year, month))) {
    const key = dayKeyFor(entry);
    totals.set(key, (totals.get(key) ?? 0) + netMs(entry, now));
  }

  return totals;
}

/** Net time per weekday, Monday first, over whichever entries are given. */
export function weekdayTotals(entries: TimeEntry[], now: number): number[] {
  const totals = new Array<number>(7).fill(0);

  for (const entry of entries) {
    const weekday = (new Date(entry.startTime).getDay() + 6) % 7;
    totals[weekday] += netMs(entry, now);
  }

  return totals;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/** The last `weeks` weeks, oldest first, labelled by the Monday's date. */
export function weeklySeries(entries: TimeEntry[], weeks: number, now: number): SeriesPoint[] {
  const thisWeek = weekRange(new Date(now));
  const points: SeriesPoint[] = [];

  for (let offset = weeks - 1; offset >= 0; offset--) {
    const monday = new Date(thisWeek.from);
    monday.setDate(monday.getDate() - offset * 7);
    const range = weekRange(monday);

    points.push({
      label: `${monday.getDate()}.${monday.getMonth() + 1}.`,
      value: totalInRange(entries, range, now),
    });
  }

  return points;
}

/** All twelve months of a year, oldest first. */
export function monthlySeries(entries: TimeEntry[], year: number, now: number): SeriesPoint[] {
  return MONTH_LABELS_SHORT.map((label, month) => ({
    label,
    value: totalInRange(entries, monthRange(year, month), now),
  }));
}

/** Every year that has an entry, oldest first. Empty when there is no data. */
export function yearlySeries(entries: TimeEntry[], now: number): SeriesPoint[] {
  if (entries.length === 0) return [];

  const years = entries.map((entry) => new Date(entry.startTime).getFullYear());
  const first = Math.min(...years);
  const last = Math.max(...years);

  const points: SeriesPoint[] = [];
  for (let year = first; year <= last; year++) {
    points.push({ label: String(year), value: totalInRange(entries, yearRange(year), now) });
  }

  return points;
}

/**
 * The cells of a month grid, Monday first, padded to whole weeks.
 *
 * `null` marks the padding either side, so the caller renders a grid without
 * recomputing which weekday the first of the month fell on.
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** The entries recorded on one calendar day, newest first. */
export function entriesOnDay(entries: TimeEntry[], day: Date): TimeEntry[] {
  const key = dayKeyOf(day);
  return entries
    .filter((entry) => dayKeyFor(entry) === key)
    .sort((a, b) => b.startTime - a.startTime);
}
