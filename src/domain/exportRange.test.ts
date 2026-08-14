import { describe, it, expect } from 'vitest';
import {
  defaultExportRange,
  resolveExportRange,
  selectEntriesForExport,
  ExportRangeSelection,
} from './exportRange';
import type { TimeEntry } from '../types';

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 0, 15, 18).getTime(); // Thursday, 15 January 2026

let seq = 0;
function entry(startTime: number, hours: number, overrides: Partial<TimeEntry> = {}): TimeEntry {
  seq += 1;
  return {
    id: `entry-${seq}`,
    title: 'Session',
    project: 'proj-work',
    tags: [],
    startTime,
    endTime: startTime + hours * HOUR,
    breaks: [],
    createdAt: startTime,
    updatedAt: startTime,
    source: 'manual',
    ...overrides,
  };
}

function selection(overrides: Partial<ExportRangeSelection> = {}): ExportRangeSelection {
  return { ...defaultExportRange(NOW), ...overrides };
}

describe('resolveExportRange', () => {
  it('covers everything with no boundary at all', () => {
    const resolved = resolveExportRange(selection({ kind: 'all' }), NOW);
    expect(resolved.range).toBeNull();
    expect(resolved.error).toBeNull();
  });

  it('resolves a specific month to that calendar month', () => {
    // The case rolling windows could not express: a timesheet for one month.
    const resolved = resolveExportRange(
      selection({ kind: 'specific-month', year: 2025, month: 11 }),
      NOW
    );

    expect(resolved.label).toBe('Dezember 2025');
    expect(resolved.slug).toBe('2025-12');
    expect(new Date(resolved.range!.from).getDate()).toBe(1);
    expect(new Date(resolved.range!.from).getMonth()).toBe(11);
    expect(new Date(resolved.range!.to).getFullYear()).toBe(2026);
  });

  it('resolves a specific year', () => {
    const resolved = resolveExportRange(selection({ kind: 'specific-year', year: 2024 }), NOW);
    expect(resolved.label).toBe('2024');
    expect(new Date(resolved.range!.from).getFullYear()).toBe(2024);
    expect(new Date(resolved.range!.to).getFullYear()).toBe(2025);
  });

  it('includes the whole of the final day of a custom range', () => {
    const resolved = resolveExportRange(
      selection({ kind: 'custom', from: '2026-01-05', to: '2026-01-06' }),
      NOW
    );

    const lateOnTheLastDay = new Date(2026, 0, 6, 23, 30).getTime();
    expect(lateOnTheLastDay).toBeLessThan(resolved.range!.to);
    expect(resolved.error).toBeNull();
  });

  it('accepts a single-day custom range', () => {
    const resolved = resolveExportRange(
      selection({ kind: 'custom', from: '2026-01-05', to: '2026-01-05' }),
      NOW
    );
    expect(resolved.error).toBeNull();
    expect(resolved.range!.to).toBeGreaterThan(resolved.range!.from);
  });

  it('rejects a custom range that runs backwards', () => {
    const resolved = resolveExportRange(
      selection({ kind: 'custom', from: '2026-01-10', to: '2026-01-01' }),
      NOW
    );
    expect(resolved.error).toMatch(/darf nicht vor dem Beginn liegen/i);
  });

  it('starts this week on Monday', () => {
    const resolved = resolveExportRange(selection({ kind: 'this-week' }), NOW);
    expect(new Date(resolved.range!.from).getDay()).toBe(1);
    expect(new Date(resolved.range!.from).getDate()).toBe(12);
  });
});

describe('selectEntriesForExport', () => {
  const inside = entry(new Date(2026, 0, 10, 9).getTime(), 2);
  const outside = entry(new Date(2025, 11, 10, 9).getTime(), 2);
  const otherProject = entry(new Date(2026, 0, 11, 9).getTime(), 1, { project: 'proj-study' });
  const running = entry(new Date(2026, 0, 15, 16).getTime(), 0, { endTime: null });

  const january = resolveExportRange(
    selection({ kind: 'specific-month', year: 2026, month: 0 }),
    NOW
  ).range;

  it('keeps only the entries inside the range', () => {
    const result = selectEntriesForExport([inside, outside], january, 'all');
    expect(result.entries.map((e) => e.id)).toEqual([inside.id]);
  });

  it('filters by project when one is chosen', () => {
    const result = selectEntriesForExport([inside, otherProject], january, 'proj-study');
    expect(result.entries.map((e) => e.id)).toEqual([otherProject.id]);
  });

  it('leaves out a running entry and reports that it did', () => {
    // A running entry's duration changes between exports, so including it
    // would make the same report disagree with itself an hour later.
    const result = selectEntriesForExport([inside, running], january, 'all');

    expect(result.entries.map((e) => e.id)).toEqual([inside.id]);
    expect(result.skippedRunning).toBe(1);
  });

  it('reports nothing skipped when everything is finished', () => {
    expect(selectEntriesForExport([inside], january, 'all').skippedRunning).toBe(0);
  });

  it('sorts oldest first, so the report reads chronologically', () => {
    const later = entry(new Date(2026, 0, 20, 9).getTime(), 1);
    const result = selectEntriesForExport([later, inside], january, 'all');
    expect(result.entries.map((e) => e.id)).toEqual([inside.id, later.id]);
  });

  it('produces the same selection twice for the same inputs', () => {
    const first = selectEntriesForExport([inside, running], january, 'all');
    const second = selectEntriesForExport([inside, running], january, 'all');
    expect(first.entries.map((e) => e.id)).toEqual(second.entries.map((e) => e.id));
  });
});
