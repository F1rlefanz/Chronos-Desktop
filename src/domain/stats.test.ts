import { describe, it, expect } from 'vitest';
import {
  dailyTotals,
  entriesInRange,
  entriesOnDay,
  monthGrid,
  monthRange,
  monthlySeries,
  summarise,
  weekRange,
  weekdayTotals,
  weeklySeries,
  yearlySeries,
} from './stats';
import type { TimeEntry } from '../types';

const HOUR = 60 * 60 * 1000;

function at(year: number, month: number, day: number, hour = 9): number {
  return new Date(year, month, day, hour).getTime();
}

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
    source: 'manual',
    ...overrides,
  };
}

// Thursday, 15 January 2026.
const NOW = at(2026, 0, 15, 18);

describe('ranges', () => {
  it('starts the week on Monday', () => {
    const range = weekRange(new Date(NOW));
    expect(new Date(range.from).getDay()).toBe(1);
    expect(new Date(range.from).getDate()).toBe(12);
    // Half-open: the following Monday is excluded.
    expect(new Date(range.to).getDate()).toBe(19);
  });

  it('treats a Sunday as belonging to the week that began on Monday', () => {
    const sunday = new Date(2026, 0, 18, 12);
    expect(new Date(weekRange(sunday).from).getDate()).toBe(12);
  });

  it('keeps a month range inside the month', () => {
    const range = monthRange(2026, 0);
    expect(new Date(range.from).getDate()).toBe(1);
    expect(new Date(range.to).getMonth()).toBe(1);
  });
});

describe('entriesInRange', () => {
  it('selects by the day an entry started on', () => {
    // Consistent with dayKeyFor: an entry running past midnight into February
    // still counts as January, and must not appear in both months.
    const overnight = entry(at(2026, 0, 31, 22), 3);
    const january = entriesInRange([overnight], monthRange(2026, 0));
    const february = entriesInRange([overnight], monthRange(2026, 1));

    expect(january).toHaveLength(1);
    expect(february).toHaveLength(0);
  });
});

describe('summarise', () => {
  const entries = [
    entry(at(2026, 0, 15, 9), 2), // today
    entry(at(2026, 0, 13, 9), 1), // this week
    entry(at(2026, 0, 5, 9), 3), // this month
    entry(at(2025, 11, 20, 9), 4), // last year
  ];

  it('nests the periods correctly', () => {
    const summary = summarise(entries, NOW);

    expect(summary.today).toBe(2 * HOUR);
    expect(summary.week).toBe(3 * HOUR);
    expect(summary.month).toBe(6 * HOUR);
    expect(summary.year).toBe(6 * HOUR);
    expect(summary.allTime).toBe(10 * HOUR);
  });

  it('counts a running entry up to now', () => {
    const running = entry(at(2026, 0, 15, 16), 0, { endTime: null });
    const summary = summarise([running], NOW);

    expect(summary.today).toBe(2 * HOUR);
    expect(summary.allTime).toBe(2 * HOUR);
  });

  it('is all zeroes without entries', () => {
    expect(summarise([], NOW)).toEqual({
      today: 0,
      week: 0,
      month: 0,
      year: 0,
      allTime: 0,
    });
  });

  it('follows an edit without anything being recomputed by hand', () => {
    const before = summarise([entry(at(2026, 0, 15, 9), 2)], NOW);
    const after = summarise([entry(at(2026, 0, 15, 9), 5)], NOW);

    expect(before.today).toBe(2 * HOUR);
    expect(after.today).toBe(5 * HOUR);
  });
});

describe('dailyTotals', () => {
  it('adds up several entries on the same day', () => {
    const totals = dailyTotals(
      [entry(at(2026, 0, 15, 9), 2), entry(at(2026, 0, 15, 14), 1), entry(at(2026, 0, 16, 9), 4)],
      2026,
      0,
      NOW
    );

    expect(totals.get('2026-01-15')).toBe(3 * HOUR);
    expect(totals.get('2026-01-16')).toBe(4 * HOUR);
    expect(totals.has('2026-01-17')).toBe(false);
  });

  it('subtracts breaks', () => {
    const withBreak = entry(at(2026, 0, 15, 9), 4, {
      breaks: [{ id: 'b1', startTime: at(2026, 0, 15, 11), endTime: at(2026, 0, 15, 12) }],
    });

    expect(dailyTotals([withBreak], 2026, 0, NOW).get('2026-01-15')).toBe(3 * HOUR);
  });
});

describe('weekdayTotals', () => {
  it('is Monday-first', () => {
    const monday = entry(at(2026, 0, 12, 9), 1);
    const sunday = entry(at(2026, 0, 18, 9), 2);
    const totals = weekdayTotals([monday, sunday], NOW);

    expect(totals[0]).toBe(1 * HOUR);
    expect(totals[6]).toBe(2 * HOUR);
    expect(totals).toHaveLength(7);
  });
});

describe('series', () => {
  it('returns the requested number of weeks, oldest first', () => {
    const points = weeklySeries([entry(at(2026, 0, 15, 9), 2)], 4, NOW);

    expect(points).toHaveLength(4);
    expect(points[3].value).toBe(2 * HOUR); // the current week is last
    expect(points[0].value).toBe(0);
  });

  it('returns all twelve months', () => {
    const points = monthlySeries([entry(at(2026, 2, 3, 9), 5)], 2026, NOW);

    expect(points).toHaveLength(12);
    expect(points[2]).toEqual({ label: 'Mar', value: 5 * HOUR });
    expect(points[0].value).toBe(0);
  });

  it('spans every year between the first and last entry', () => {
    const points = yearlySeries([entry(at(2024, 0, 1, 9), 1), entry(at(2026, 0, 1, 9), 2)], NOW);

    expect(points.map((p) => p.label)).toEqual(['2024', '2025', '2026']);
    expect(points[1].value).toBe(0); // a year with no entries is still shown
  });

  it('has no years to show without entries', () => {
    expect(yearlySeries([], NOW)).toEqual([]);
  });
});

describe('monthGrid', () => {
  it('pads to whole weeks, Monday first', () => {
    // 1 January 2026 is a Thursday, so three empty cells come first.
    const cells = monthGrid(2026, 0);

    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 3).every((cell) => cell === null)).toBe(true);
    expect(cells[3]?.getDate()).toBe(1);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(31);
  });

  it('handles a leap February', () => {
    expect(monthGrid(2028, 1).filter((cell) => cell !== null)).toHaveLength(29);
  });
});

describe('entriesOnDay', () => {
  it('returns that day only, newest first', () => {
    const morning = entry(at(2026, 0, 15, 9), 1);
    const evening = entry(at(2026, 0, 15, 17), 1);
    const other = entry(at(2026, 0, 16, 9), 1);

    const result = entriesOnDay([morning, evening, other], new Date(at(2026, 0, 15)));

    expect(result.map((e) => e.id)).toEqual([evening.id, morning.id]);
  });
});
