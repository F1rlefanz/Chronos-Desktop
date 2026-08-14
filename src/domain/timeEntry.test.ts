import { describe, it, expect } from 'vitest';
import {
  breakMs,
  dayKeyFor,
  grossMs,
  hasRunningBreak,
  isRunning,
  netMs,
  totalNetMs,
  validateEntryInput,
} from './timeEntry';
import type { Break, TimeEntry } from '../types';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** 2026-01-15, 09:00 local time — a fixed anchor for every case below. */
const START = new Date(2026, 0, 15, 9, 0, 0).getTime();

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    title: 'Session',
    project: 'proj-work',
    tags: [],
    startTime: START,
    endTime: START + 2 * HOUR,
    breaks: [],
    createdAt: START,
    updatedAt: START,
    source: 'stopwatch',
    ...overrides,
  };
}

function pause(offsetMs: number, durationMs: number | null): Break {
  return {
    id: `break-${offsetMs}`,
    startTime: START + offsetMs,
    endTime: durationMs === null ? null : START + offsetMs + durationMs,
  };
}

describe('duration derivation', () => {
  it('derives gross time from the two timestamps', () => {
    expect(grossMs(entry())).toBe(2 * HOUR);
  });

  it('subtracts breaks from gross to get net', () => {
    const e = entry({ breaks: [pause(30 * MINUTE, 15 * MINUTE)] });
    expect(breakMs(e)).toBe(15 * MINUTE);
    expect(netMs(e)).toBe(2 * HOUR - 15 * MINUTE);
  });

  it('counts a running entry up to the given now, not the real clock', () => {
    const e = entry({ endTime: null });
    expect(isRunning(e)).toBe(true);
    expect(netMs(e, START + 90 * MINUTE)).toBe(90 * MINUTE);
    // The same entry read a minute later is a minute longer — nothing is cached.
    expect(netMs(e, START + 91 * MINUTE)).toBe(91 * MINUTE);
  });

  it('counts a running break up to now as well', () => {
    const e = entry({ endTime: null, breaks: [pause(30 * MINUTE, null)] });
    expect(hasRunningBreak(e)).toBe(true);
    expect(breakMs(e, START + HOUR)).toBe(30 * MINUTE);
    expect(netMs(e, START + HOUR)).toBe(30 * MINUTE);
  });

  it('never reports a negative duration', () => {
    // Not reachable through the UI — validation rejects it — but an imported
    // file has not been through validation.
    const e = entry({ breaks: [pause(0, 5 * HOUR)] });
    expect(netMs(e)).toBe(0);
  });

  it('sums net time across entries with one shared clock', () => {
    const finished = entry({ id: 'a' });
    const running = entry({ id: 'b', startTime: START + 3 * HOUR, endTime: null });
    expect(totalNetMs([finished, running], START + 4 * HOUR)).toBe(3 * HOUR);
  });
});

describe('dayKeyFor', () => {
  it('uses local time, not UTC', () => {
    // 23:30 local would already be the next day in UTC for positive offsets.
    expect(dayKeyFor({ startTime: new Date(2026, 0, 15, 23, 30).getTime() })).toBe('2026-01-15');
  });

  it('anchors an entry that runs past midnight to the day it started on', () => {
    // The documented rule. A change here is a product decision, not a bug fix.
    const overnight = entry({
      startTime: new Date(2026, 0, 31, 22, 0).getTime(),
      endTime: new Date(2026, 1, 1, 1, 0).getTime(),
    });
    expect(dayKeyFor(overnight)).toBe('2026-01-31');
    expect(netMs(overnight)).toBe(3 * HOUR);
  });
});

describe('validateEntryInput', () => {
  const base = { startTime: START, endTime: START + 2 * HOUR, breaks: [] };

  it('accepts an ordinary entry', () => {
    const result = validateEntryInput(base, START + 3 * HOUR);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects an end that is not after the beginning', () => {
    const result = validateEntryInput({ ...base, endTime: START }, START + HOUR);
    expect(result.errors).toContain('Das Ende muss nach dem Beginn liegen.');
  });

  it('accepts an entry that runs past midnight', () => {
    // The case that makes the comparable app unusable: a single date field
    // turns 22:00 -> 01:00 into an end before the start. Here the two
    // timestamps carry their own dates, so this simply validates.
    const result = validateEntryInput(
      {
        startTime: new Date(2026, 0, 15, 22, 0).getTime(),
        endTime: new Date(2026, 0, 16, 1, 0).getTime(),
        breaks: [],
      },
      new Date(2026, 0, 16, 9, 0).getTime()
    );
    expect(result.errors).toEqual([]);
  });

  it('leaves a running entry without an end alone', () => {
    const result = validateEntryInput({ ...base, endTime: null }, START + HOUR);
    expect(result.errors).toEqual([]);
  });

  it('rejects breaks that outlast the entry', () => {
    const result = validateEntryInput(
      { ...base, breaks: [pause(0, 90 * MINUTE), pause(90 * MINUTE, 45 * MINUTE)] },
      START + 3 * HOUR
    );
    expect(result.errors).toContain('Die Pausen sind zusammen länger als der Eintrag.');
  });

  it('rejects a break that sits outside the entry', () => {
    const result = validateEntryInput(
      { ...base, breaks: [pause(3 * HOUR, 10 * MINUTE)] },
      START + 4 * HOUR
    );
    expect(result.errors).toContain('Eine Pause liegt außerhalb des Eintrags.');
  });

  it('rejects a break that ends before it starts', () => {
    const result = validateEntryInput(
      {
        ...base,
        breaks: [{ id: 'b', startTime: START + HOUR, endTime: START + 30 * MINUTE }],
      },
      START + 3 * HOUR
    );
    expect(result.errors).toContain('Eine Pause endet vor ihrem Beginn.');
  });

  it('warns about an implausibly long entry without blocking it', () => {
    const result = validateEntryInput({ ...base, endTime: START + 20 * HOUR }, START + 21 * HOUR);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/16 Stunden/);
  });

  it('warns about a beginning in the future without blocking it', () => {
    const result = validateEntryInput(
      { startTime: START + 5 * HOUR, endTime: START + 6 * HOUR, breaks: [] },
      START
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('Der Beginn liegt in der Zukunft.');
  });
});
