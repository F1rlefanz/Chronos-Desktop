/**
 * Which stretch of time an export covers.
 *
 * The previous options were rolling windows — "past 7 days", "past 30 days" —
 * which cannot express the thing exports are actually for. "January 2026" is
 * the question a timesheet answers, and a 30-day window ending today is never
 * that. These are calendar boundaries.
 *
 * The resolver lives here, beside the aggregates, so the export and the charts
 * agree about where a week starts and which day an entry belongs to.
 */

import { TimeEntry } from '../types';
import {
  MONTH_LABELS,
  Range,
  endOfDay,
  entriesInRange,
  monthRange,
  startOfDay,
  weekRange,
  yearRange,
} from './stats';
import { isRunning } from './timeEntry';
import { formatDateOnly } from '../utils/timeFormatters';

export type ExportRangeKind =
  | 'all'
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'this-year'
  | 'specific-month'
  | 'specific-year'
  | 'custom';

export interface ExportRangeSelection {
  kind: ExportRangeKind;
  /** 0-11, for `specific-month`. */
  month: number;
  /** For `specific-month` and `specific-year`. */
  year: number;
  /** `YYYY-MM-DD`, for `custom`. Inclusive on both ends. */
  from: string;
  to: string;
}

export const EXPORT_RANGE_LABELS: Record<ExportRangeKind, string> = {
  all: 'Alle Daten',
  today: 'Heute',
  'this-week': 'Diese Woche',
  'this-month': 'Dieser Monat',
  'this-year': 'Dieses Jahr',
  'specific-month': 'Bestimmter Monat',
  'specific-year': 'Bestimmtes Jahr',
  custom: 'Freier Zeitraum',
};

export function defaultExportRange(now: number): ExportRangeSelection {
  const today = new Date(now);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;

  return {
    kind: 'this-month',
    month: today.getMonth(),
    year: today.getFullYear(),
    from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: iso(today),
  };
}

export interface ResolvedRange {
  /** `null` covers everything — there is no boundary to apply. */
  range: Range | null;
  /** Human wording for the report header. */
  label: string;
  /** Filename-safe stem. */
  slug: string;
  /** Set when the selection cannot be read, e.g. a custom range back to front. */
  error: string | null;
}

export function resolveExportRange(selection: ExportRangeSelection, now: number): ResolvedRange {
  const today = new Date(now);

  switch (selection.kind) {
    case 'all':
      return { range: null, label: 'Alle Daten', slug: 'alle-daten', error: null };

    case 'today':
      return {
        range: { from: startOfDay(today), to: endOfDay(today) },
        label: formatDateOnly(today.getTime()),
        slug: `day-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        error: null,
      };

    case 'this-week': {
      const range = weekRange(today);
      const monday = new Date(range.from);
      return {
        range,
        label: `Woche ab ${formatDateOnly(monday.getTime())}`,
        slug: `week-${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
        error: null,
      };
    }

    case 'this-month':
      return describeMonth(today.getFullYear(), today.getMonth());

    case 'this-year':
      return describeYear(today.getFullYear());

    case 'specific-month':
      return describeMonth(selection.year, selection.month);

    case 'specific-year':
      return describeYear(selection.year);

    case 'custom': {
      const from = new Date(`${selection.from}T00:00`);
      const to = new Date(`${selection.to}T00:00`);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return { range: null, label: '', slug: '', error: 'Bitte Beginn und Ende wählen.' };
      }
      if (startOfDay(to) < startOfDay(from)) {
        return {
          range: null,
          label: '',
          slug: '',
          error: 'Das Ende darf nicht vor dem Beginn liegen.',
        };
      }

      return {
        // Inclusive of the whole final day, which is what a person picking a
        // date on a form means by "to".
        range: { from: startOfDay(from), to: endOfDay(to) },
        label: `${formatDateOnly(from.getTime())} – ${formatDateOnly(to.getTime())}`,
        slug: `${selection.from}_to_${selection.to}`,
        error: null,
      };
    }
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function describeMonth(year: number, month: number): ResolvedRange {
  return {
    range: monthRange(year, month),
    label: `${MONTH_LABELS[month]} ${year}`,
    slug: `${year}-${pad(month + 1)}`,
    error: null,
  };
}

function describeYear(year: number): ResolvedRange {
  return { range: yearRange(year), label: String(year), slug: String(year), error: null };
}

export interface ExportSelection {
  entries: TimeEntry[];
  /** Running entries left out, so the caller can say so rather than hide it. */
  skippedRunning: number;
}

/**
 * The entries an export should contain.
 *
 * A measurement still running is deliberately excluded. Its duration grows
 * between one export and the next, so including it would mean the same
 * "January 2026" report produced twice in one morning disagrees with itself —
 * and a timesheet that is not reproducible is worse than one that is missing a
 * line the user can see is missing.
 */
export function selectEntriesForExport(
  entries: TimeEntry[],
  range: Range | null,
  projectId: string
): ExportSelection {
  const inRange = range === null ? entries : entriesInRange(entries, range);
  const forProject =
    projectId === 'all' ? inRange : inRange.filter((entry) => entry.project === projectId);

  const finished = forProject.filter((entry) => !isRunning(entry));

  return {
    entries: [...finished].sort((a, b) => a.startTime - b.startTime),
    skippedRunning: forProject.length - finished.length,
  };
}
