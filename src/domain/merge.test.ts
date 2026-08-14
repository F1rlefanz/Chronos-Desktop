import { describe, it, expect } from 'vitest';
import { mergeEntries, pruneTombstones, tombstoneFor } from './merge';
import { TimeEntry, Tombstone } from '../types';

function entry(id: string, updatedAt: number, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id,
    title: id,
    project: 'proj-work',
    tags: [],
    startTime: updatedAt,
    endTime: updatedAt + 1000,
    breaks: [],
    createdAt: updatedAt,
    updatedAt,
    source: 'stopwatch',
    ...overrides,
  };
}

const nothing = { entries: [], tombstones: [] };

describe('mergeEntries', () => {
  it('keeps what only one side has', () => {
    const result = mergeEntries(
      { entries: [entry('a', 10)], tombstones: [] },
      { entries: [entry('b', 20)], tombstones: [] }
    );

    expect(result.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(result.summary.added).toBe(1);
  });

  it('takes the newer copy of an entry both sides have', () => {
    const mine = entry('a', 10, { title: 'alt' });
    const theirs = entry('a', 20, { title: 'neu' });

    const result = mergeEntries(
      { entries: [mine], tombstones: [] },
      { entries: [theirs], tombstones: [] }
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('neu');
    expect(result.summary.updated).toBe(1);
  });

  it('keeps the local copy when neither is newer', () => {
    // Equal timestamps mean the same edit, or a clock that cannot separate
    // them. Rewriting what is on screen for no visible reason is worse.
    const mine = entry('a', 10, { title: 'meins' });
    const theirs = entry('a', 10, { title: 'ihres' });

    const result = mergeEntries(
      { entries: [mine], tombstones: [] },
      { entries: [theirs], tombstones: [] }
    );

    expect(result.entries[0].title).toBe('meins');
    expect(result.summary.unchanged).toBe(1);
  });

  it('never blends two versions of one entry', () => {
    // A record made of one device's start and the other's end is one nobody
    // ever entered.
    const mine = entry('a', 10, { startTime: 100, endTime: 200 });
    const theirs = entry('a', 20, { startTime: 300, endTime: 400 });

    const result = mergeEntries(
      { entries: [mine], tombstones: [] },
      { entries: [theirs], tombstones: [] }
    );

    expect(result.entries[0].startTime).toBe(300);
    expect(result.entries[0].endTime).toBe(400);
  });
});

describe('mergeEntries and deletions', () => {
  it('applies a deletion the other side made', () => {
    const result = mergeEntries(
      { entries: [entry('a', 10)], tombstones: [] },
      { entries: [], tombstones: [tombstoneFor('a', 20)] }
    );

    expect(result.entries).toEqual([]);
    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: 20 }]);
    expect(result.summary.deleted).toBe(1);
  });

  // Without a tombstone the other side cannot tell "deleted here" from "not
  // seen here yet", so every merge would faithfully resurrect the entry.
  it('does not resurrect an entry the other side still has', () => {
    const result = mergeEntries(
      { entries: [], tombstones: [tombstoneFor('a', 20)] },
      { entries: [entry('a', 10)], tombstones: [] }
    );

    expect(result.entries).toEqual([]);
  });

  it('lets a later edit beat an earlier deletion', () => {
    const result = mergeEntries(
      { entries: [], tombstones: [tombstoneFor('a', 10)] },
      { entries: [entry('a', 20)], tombstones: [] }
    );

    expect(result.entries.map((e) => e.id)).toEqual(['a']);
  });

  it('drops the tombstone once the entry has outlived it', () => {
    // Otherwise the stale record would kill the entry again on every merge.
    const result = mergeEntries(
      { entries: [], tombstones: [tombstoneFor('a', 10)] },
      { entries: [entry('a', 20)], tombstones: [] }
    );

    expect(result.tombstones).toEqual([]);
  });

  it('treats a deletion at the same moment as the edit as winning', () => {
    const result = mergeEntries(
      { entries: [entry('a', 20)], tombstones: [] },
      { entries: [], tombstones: [tombstoneFor('a', 20)] }
    );

    expect(result.entries).toEqual([]);
  });

  it('keeps the later of two deletions of the same entry', () => {
    const result = mergeEntries(
      { entries: [], tombstones: [tombstoneFor('a', 10)] },
      { entries: [], tombstones: [tombstoneFor('a', 30)] }
    );

    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: 30 }]);
  });
});

describe('mergeEntries as an operation', () => {
  it('changes nothing when both sides are identical', () => {
    const same = { entries: [entry('a', 10), entry('b', 20)], tombstones: [tombstoneFor('c', 5)] };

    const result = mergeEntries(same, same);

    expect(result.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(result.tombstones).toEqual([{ id: 'c', deletedAt: 5 }]);
    expect(result.summary.added).toBe(0);
    expect(result.summary.updated).toBe(0);
  });

  // Merging must not depend on which device asked, or two devices would
  // converge on different answers and keep overwriting each other forever.
  it('reaches the same set whichever side merges', () => {
    const a = {
      entries: [entry('x', 10), entry('shared', 30)],
      tombstones: [tombstoneFor('gone', 40)],
    };
    const b = { entries: [entry('y', 20), entry('shared', 10)], tombstones: [] };

    const oneWay = mergeEntries(a, b);
    const otherWay = mergeEntries(b, a);

    expect(oneWay.entries.map((e) => e.id).sort()).toEqual(
      otherWay.entries.map((e) => e.id).sort()
    );
    expect(oneWay.tombstones).toEqual(otherWay.tombstones);
  });

  it('is stable when run twice', () => {
    const a = { entries: [entry('x', 10)], tombstones: [tombstoneFor('gone', 40)] };
    const b = { entries: [entry('y', 20)], tombstones: [] };

    const once = mergeEntries(a, b);
    const twice = mergeEntries(once, once);

    expect(twice.entries).toEqual(once.entries);
    expect(twice.tombstones).toEqual(once.tombstones);
  });

  it('survives an empty other side', () => {
    const mine = { entries: [entry('a', 10)], tombstones: [] };

    expect(mergeEntries(mine, nothing).entries).toEqual(mine.entries);
  });

  it('sorts newest first, the way the history reads them', () => {
    const result = mergeEntries(
      { entries: [entry('old', 10, { startTime: 100 })], tombstones: [] },
      { entries: [entry('new', 20, { startTime: 900 })], tombstones: [] }
    );

    expect(result.entries.map((e) => e.id)).toEqual(['new', 'old']);
  });
});

describe('pruneTombstones', () => {
  it('forgets a deletion once the entry exists again', () => {
    const stones: Tombstone[] = [tombstoneFor('a', 10), tombstoneFor('b', 20)];

    expect(pruneTombstones(stones, [entry('a', 30)])).toEqual([{ id: 'b', deletedAt: 20 }]);
  });

  it('keeps one record per id, the latest', () => {
    const stones: Tombstone[] = [tombstoneFor('a', 10), tombstoneFor('a', 30)];

    expect(pruneTombstones(stones, [])).toEqual([{ id: 'a', deletedAt: 30 }]);
  });
});
