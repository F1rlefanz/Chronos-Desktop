import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeEntry, Tombstone } from '../../types';
import { runSync, pushToSyncFolder, setSyncTransport, syncAvailable } from './index';
import { buildSyncPayload, isSyncFileName, parseSyncPayload, syncFileName } from './payload';
import { SyncTransport } from './types';

/**
 * A folder in memory.
 *
 * The point of these tests is what two devices end up with, which needs a
 * folder both can write to and neither can lock. Everything the real transport
 * adds — a path, IPC, a filesystem — is the part that cannot decide whether a
 * deletion survives a round trip.
 */
class FakeFolder {
  files = new Map<string, string>();
  reachable = true;
  writes = 0;

  transport(): SyncTransport {
    return {
      configure: async () => {
        if (!this.reachable) throw { reason: 'io', message: 'Der Ordner existiert nicht.' };
      },
      list: async () => [...this.files.keys()],
      read: async (name) => this.files.get(name) ?? null,
      write: async (name, contents) => {
        this.writes += 1;
        this.files.set(name, contents);
      },
      pickFolder: async () => null,
    };
  }
}

let folder: FakeFolder;

const DEVICE_A = 'aaaaaaaaaaaa';
const DEVICE_B = 'bbbbbbbbbbbb';

function entry(id: string, updatedAt: number, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id,
    title: id,
    project: 'proj-work',
    tags: [],
    startTime: 1_000,
    endTime: 2_000,
    breaks: [],
    createdAt: 1_000,
    updatedAt,
    source: 'manual',
    ...overrides,
  };
}

/** One device's whole state, so a test can hold two of them side by side. */
interface Device {
  id: string;
  entries: TimeEntry[];
  tombstones: Tombstone[];
}

function device(id: string, entries: TimeEntry[] = [], tombstones: Tombstone[] = []): Device {
  return { id, entries, tombstones };
}

/** Syncs one device against the folder and writes the result back into it. */
async function sync(from: Device): Promise<void> {
  const outcome = await runSync({
    folder: 'C:/shared',
    deviceId: from.id,
    entries: from.entries,
    tombstones: from.tombstones,
  });

  if (outcome.status !== 'ok') throw new Error(`sync failed: ${JSON.stringify(outcome)}`);

  from.entries = outcome.entries;
  from.tombstones = outcome.tombstones;
}

beforeEach(() => {
  folder = new FakeFolder();
  setSyncTransport(folder.transport());
});

afterEach(() => {
  setSyncTransport(null);
  vi.restoreAllMocks();
});

describe('syncAvailable', () => {
  it('is false without a transport, which is what hides the setting', () => {
    setSyncTransport(null);
    expect(syncAvailable()).toBe(false);
  });
});

describe('runSync', () => {
  it('leaves its own file behind when it is the first device there', async () => {
    const a = device(DEVICE_A, [entry('e1', 10)]);

    const outcome = await runSync({
      folder: 'C:/shared',
      deviceId: a.id,
      entries: a.entries,
      tombstones: a.tombstones,
    });

    expect(outcome).toMatchObject({ status: 'ok', peers: 0, changed: false });
    expect([...folder.files.keys()]).toEqual([syncFileName(DEVICE_A)]);
  });

  it('carries an entry from one device to the other', async () => {
    const a = device(DEVICE_A, [entry('from-a', 10)]);
    const b = device(DEVICE_B, []);

    await sync(a);
    await sync(b);

    expect(b.entries.map((e) => e.id)).toEqual(['from-a']);
  });

  it('keeps the newer edit and does not blend the two', async () => {
    const a = device(DEVICE_A, [entry('shared', 10, { title: 'alt', notes: 'von A' })]);
    const b = device(DEVICE_B, [entry('shared', 20, { title: 'neu' })]);

    await sync(a);
    await sync(b);
    await sync(a);

    expect(a.entries).toHaveLength(1);
    expect(a.entries[0].title).toBe('neu');
    // The older copy's fields do not survive inside the newer record — a
    // half-merged entry is one nobody ever typed in.
    expect(a.entries[0].notes).toBeUndefined();
  });

  it('deletes on the other device, and the deletion stays deleted', async () => {
    const a = device(DEVICE_A, [entry('doomed', 10)]);
    const b = device(DEVICE_B, []);

    await sync(a);
    await sync(b);
    expect(b.entries).toHaveLength(1);

    // A deletes it, the way `removeEntries` does: the entry goes, a tombstone
    // takes its place.
    a.entries = [];
    a.tombstones = [{ id: 'doomed', deletedAt: 30 }];

    await sync(a);
    await sync(b);
    expect(b.entries).toEqual([]);

    // The second round is the one that finds a missing tombstone: without it,
    // A's copy would hand the entry straight back.
    await sync(a);
    await sync(b);
    expect(b.entries).toEqual([]);
    expect(a.entries).toEqual([]);
  });

  it('brings two devices that both worked offline to the same set', async () => {
    const a = device(DEVICE_A, [entry('only-a', 10)]);
    const b = device(DEVICE_B, [entry('only-b', 11)]);

    await sync(a);
    await sync(b);
    await sync(a);

    const ids = (d: Device) => d.entries.map((e) => e.id).sort();
    expect(ids(a)).toEqual(['only-a', 'only-b']);
    expect(ids(b)).toEqual(['only-a', 'only-b']);
  });

  it('changes nothing on a second run', async () => {
    const a = device(DEVICE_A, [entry('e1', 10)]);
    const b = device(DEVICE_B, [entry('e2', 11)]);

    await sync(a);
    await sync(b);
    await sync(a);

    const before = JSON.stringify(a.entries);
    const outcome = await runSync({
      folder: 'C:/shared',
      deviceId: a.id,
      entries: a.entries,
      tombstones: a.tombstones,
    });

    expect(outcome).toMatchObject({ status: 'ok', changed: false });
    expect(JSON.stringify(a.entries)).toBe(before);
  });

  it('keeps a running measurement on the device it runs on', async () => {
    const a = device(DEVICE_A, [entry('running', 10, { endTime: null })]);
    const b = device(DEVICE_B, []);

    await sync(a);
    await sync(b);

    expect(b.entries).toEqual([]);
  });

  it('explains an unreachable folder instead of throwing', async () => {
    folder.reachable = false;

    const outcome = await runSync({
      folder: 'C:/gone',
      deviceId: DEVICE_A,
      entries: [],
      tombstones: [],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' && outcome.message).toContain('existiert nicht');
  });

  it('skips a file it cannot read rather than failing the whole sync', async () => {
    folder.files.set(syncFileName(DEVICE_B), '{ half a file');
    folder.files.set('einkaufsliste.json', '["Milch"]');

    const outcome = await runSync({
      folder: 'C:/shared',
      deviceId: DEVICE_A,
      entries: [entry('mine', 10)],
      tombstones: [],
    });

    // The shopping list is not ours to read; the half-written file is, and is
    // counted so the user can be told.
    expect(outcome).toMatchObject({ status: 'ok', unreadable: 1, peers: 0 });
  });

  it('does not merge — or write — when the backup before it was refused', async () => {
    const a = device(DEVICE_A, [entry('from-a', 10)]);
    await sync(a);
    const writesBefore = folder.writes;

    const outcome = await runSync({
      folder: 'C:/shared',
      deviceId: DEVICE_B,
      entries: [],
      tombstones: [],
      beforeMerge: () => Promise.resolve(false),
    });

    expect(outcome).toEqual({ status: 'aborted' });
    expect(folder.writes).toBe(writesBefore);
  });

  it('does not ask for a backup when there is nothing to merge', async () => {
    const beforeMerge = vi.fn(() => Promise.resolve(true));

    await runSync({
      folder: 'C:/shared',
      deviceId: DEVICE_A,
      entries: [entry('e1', 10)],
      tombstones: [],
      beforeMerge,
    });

    expect(beforeMerge).not.toHaveBeenCalled();
  });

  it('fails with a message when there is no transport at all', async () => {
    setSyncTransport(null);

    const outcome = await runSync({
      folder: 'C:/shared',
      deviceId: DEVICE_A,
      entries: [],
      tombstones: [],
    });

    expect(outcome.status).toBe('failed');
  });
});

describe('pushToSyncFolder', () => {
  it('writes our own records without reading anyone else in', async () => {
    folder.files.set(syncFileName(DEVICE_B), buildSyncPayload(DEVICE_B, [entry('from-b', 10)], []));

    const written = await pushToSyncFolder({
      folder: 'C:/shared',
      deviceId: DEVICE_A,
      entries: [entry('from-a', 10)],
      tombstones: [],
    });

    expect(written).toBe(true);
    const ours = parseSyncPayload(folder.files.get(syncFileName(DEVICE_A)) ?? '');
    expect(ours?.entries.map((e) => e.id)).toEqual(['from-a']);
  });

  it('reports a folder it cannot reach rather than throwing on close', async () => {
    folder.reachable = false;

    await expect(
      pushToSyncFolder({ folder: 'C:/gone', deviceId: DEVICE_A, entries: [], tombstones: [] })
    ).resolves.toBe(false);
  });
});

describe('the file format', () => {
  it('only claims files that are ours', () => {
    expect(isSyncFileName(syncFileName(DEVICE_A))).toBe(true);
    expect(isSyncFileName('einkaufsliste.json')).toBe(false);
    expect(isSyncFileName('chronos-../../elsewhere.json')).toBe(false);
    expect(isSyncFileName('chronos-.json')).toBe(false);
  });

  it('normalises what it reads, because a foreign file is untrusted', () => {
    const raw = JSON.stringify({
      entries: [{ id: 'x', startTime: 5, endTime: 9 }, 'not an entry'],
      tombstones: [{ id: 'gone', deletedAt: 3 }, { nonsense: true }],
    });

    const parsed = parseSyncPayload(raw);

    expect(parsed?.entries).toHaveLength(1);
    expect(parsed?.entries[0].title).toBe('Ohne Titel');
    expect(parsed?.tombstones).toEqual([{ id: 'gone', deletedAt: 3 }]);
  });

  it('gives up on a file that is not one, instead of reading it as empty', () => {
    expect(parseSyncPayload('{ half')).toBeNull();
    expect(parseSyncPayload('[]')).toBeNull();
    expect(parseSyncPayload('{"device":"x"}')).toBeNull();
  });
});
