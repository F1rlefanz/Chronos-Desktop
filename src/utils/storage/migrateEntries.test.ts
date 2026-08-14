import { describe, it, expect, vi } from 'vitest';
import { migrateEntries } from './index';
import { breakMs, netMs } from '../../domain/timeEntry';

vi.mock('../logging/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

const START = 1_700_000_000_000;

describe('migrateEntries', () => {
  it('returns nothing for a value that is not a list', () => {
    expect(migrateEntries(null)).toEqual([]);
    expect(migrateEntries({ entries: [] })).toEqual([]);
    expect(migrateEntries('[]')).toEqual([]);
  });

  it('converts a 0.3.0 stopwatch record and preserves its net time', () => {
    // The old shape: a duration accumulated from animation frames (already net
    // of pauses) stored beside wall-clock timestamps, plus laps.
    const [entry] = migrateEntries([
      {
        id: 'old-1',
        title: 'Legacy run',
        project: 'proj-work',
        tags: ['a'],
        startTime: START,
        endTime: START + 3600_000, // one hour on the wall clock
        durationMs: 3000_000, // 50 minutes actually ran
        pauseDurationMs: 600_000,
        laps: [{ id: 'lap-1', lapNumber: 1, lapTimeMs: 500, splitTimeMs: 500 }],
        createdAt: START,
        updatedAt: START,
      },
    ]);

    expect(netMs(entry)).toBe(3000_000);
    expect(breakMs(entry)).toBe(600_000);
    expect(entry.breaks).toHaveLength(1);
    // The reconstructed pause sits inside the entry, so validation accepts it.
    expect(entry.breaks[0].startTime).toBeGreaterThanOrEqual(entry.startTime);
    expect(entry.breaks[0].endTime).toBe(entry.endTime);
    expect(entry.source).toBe('stopwatch');
    expect(entry).not.toHaveProperty('durationMs');
    expect(entry).not.toHaveProperty('laps');
  });

  it('leaves a record that is already in the current shape untouched', () => {
    const current = {
      id: 'new-1',
      title: 'Current',
      project: 'proj-work',
      tags: [],
      startTime: START,
      endTime: START + 1000,
      breaks: [{ id: 'b1', startTime: START + 100, endTime: START + 300 }],
      createdAt: START,
      updatedAt: START,
      source: 'manual' as const,
    };

    expect(migrateEntries([current])).toEqual([current]);
  });

  it('keeps a running entry running', () => {
    const [entry] = migrateEntries([{ id: 'r', startTime: START, endTime: null }]);
    expect(entry.endTime).toBeNull();
  });

  it('drops records it cannot read rather than storing half an entry', () => {
    const entries = migrateEntries([{ id: 'ok', startTime: START, endTime: START + 1 }, 7, null]);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('ok');
  });

  it('produces no break when the old record never paused', () => {
    const [entry] = migrateEntries([
      {
        id: 'old-2',
        startTime: START,
        endTime: START + 1000,
        durationMs: 1000,
        pauseDurationMs: 0,
      },
    ]);

    expect(entry.breaks).toEqual([]);
    expect(netMs(entry)).toBe(1000);
  });
});
