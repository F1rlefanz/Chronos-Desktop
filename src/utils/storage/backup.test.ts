import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  backupName,
  backupsAvailable,
  ensureDailyBackup,
  writeBackup,
  revealBackups,
  setStorageAdapter,
} from './index';
import { createMemoryAdapter } from './memoryAdapter';
import { localStorageAdapter } from './localStorageAdapter';
import { BackupSupport, StorageAdapter, WriteResult } from './types';

/** A memory adapter that also keeps snapshots, standing in for the desktop. */
function createBackingAdapter() {
  const base = createMemoryAdapter();
  const written = new Map<string, string>();
  let revealed = 0;
  let failure: Extract<WriteResult, { ok: false }> | null = null;

  const backups: BackupSupport = {
    list: () => Promise.resolve([...written.keys()].sort()),
    write: (name, contents) => {
      if (failure) return Promise.resolve(failure);
      written.set(name, contents);
      return Promise.resolve({ ok: true });
    },
    reveal: () => {
      revealed += 1;
      return Promise.resolve();
    },
  };

  return {
    adapter: { ...base, backups } as StorageAdapter,
    written,
    revealCount: () => revealed,
    failBackups: (result: Extract<WriteResult, { ok: false }> | null) => {
      failure = result;
    },
  };
}

const noon = new Date(2026, 7, 13, 12, 30, 45);

afterAll(() => {
  setStorageAdapter(localStorageAdapter);
});

describe('backupName', () => {
  it('starts with a date so that sorting by name sorts by time', () => {
    const morning = backupName('daily', new Date(2026, 7, 13, 9, 5, 1));
    const evening = backupName('daily', new Date(2026, 7, 13, 21, 5, 1));
    const nextDay = backupName('daily', new Date(2026, 7, 14, 0, 0, 0));

    expect([nextDay, evening, morning].sort()).toEqual([morning, evening, nextDay]);
  });

  it('pads single digits so the ordering does not break in September', () => {
    expect(backupName('daily', new Date(2026, 8, 9, 8, 7, 6))).toBe(
      'chronos-backup-2026-09-09-080706-daily.json'
    );
  });

  it('names the reason, so the folder explains itself', () => {
    expect(backupName('before-clear', noon)).toContain('-before-clear.json');
    expect(backupName('before-import', noon)).toContain('-before-import.json');
  });
});

describe('backups on a backend that supports them', () => {
  let context: ReturnType<typeof createBackingAdapter>;

  beforeEach(() => {
    context = createBackingAdapter();
    setStorageAdapter(context.adapter);
  });

  it('reports that backups are available', () => {
    expect(backupsAvailable()).toBe(true);
  });

  it('writes a snapshot under its generated name', async () => {
    expect(await writeBackup('before-clear', '{"entries":[]}', noon)).toEqual({ ok: true });

    expect([...context.written.keys()]).toEqual([
      'chronos-backup-2026-08-13-123045-before-clear.json',
    ]);
    expect(context.written.get('chronos-backup-2026-08-13-123045-before-clear.json')).toBe(
      '{"entries":[]}'
    );
  });

  it('passes a rejected snapshot back to the caller', async () => {
    context.failBackups({ ok: false, reason: 'quota', message: 'Disk full.' });

    expect(await writeBackup('before-import', '{}', noon)).toMatchObject({ reason: 'quota' });
  });

  it('takes a daily snapshot when the day has none', async () => {
    const result = await ensureDailyBackup(() => '{"entries":[1]}', noon);

    expect(result).toEqual({ ok: true });
    expect([...context.written.keys()]).toEqual(['chronos-backup-2026-08-13-123045-daily.json']);
  });

  it('does not take a second daily snapshot on the same day', async () => {
    await ensureDailyBackup(() => '{}', noon);
    const later = new Date(2026, 7, 13, 18, 0, 0);

    const build = vi.fn(() => '{}');
    const result = await ensureDailyBackup(build, later);

    expect(result).toBeNull();
    // The payload is the whole history; building it on every start would be
    // wasted work, so the caller's builder must not even run.
    expect(build).not.toHaveBeenCalled();
    expect(context.written.size).toBe(1);
  });

  it('takes a new daily snapshot the next day', async () => {
    await ensureDailyBackup(() => '{}', noon);
    await ensureDailyBackup(() => '{}', new Date(2026, 7, 14, 8, 0, 0));

    expect(context.written.size).toBe(2);
  });

  it('is not satisfied by a snapshot taken for another reason', async () => {
    // Clearing the history in the morning must not cancel the daily snapshot:
    // the two protect against different accidents.
    await writeBackup('before-clear', '{}', new Date(2026, 7, 13, 9, 0, 0));

    const result = await ensureDailyBackup(() => '{}', noon);

    expect(result).toEqual({ ok: true });
    expect(context.written.size).toBe(2);
  });

  it('reveals the folder', async () => {
    await revealBackups();
    expect(context.revealCount()).toBe(1);
  });
});

describe('backups on a backend without them', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
  });

  it('reports that backups are unavailable', () => {
    expect(backupsAvailable()).toBe(false);
  });

  it('treats a requested snapshot as a no-op rather than a failure', async () => {
    // The caller asked for protection this backend cannot give; reporting a
    // write failure would put a banner in front of the user over something
    // they cannot act on.
    expect(await writeBackup('before-clear', '{}', noon)).toEqual({ ok: true });
  });

  it('skips the daily snapshot without building a payload', async () => {
    const build = vi.fn(() => '{}');

    expect(await ensureDailyBackup(build, noon)).toBeNull();
    expect(build).not.toHaveBeenCalled();
  });

  it('does nothing when asked to reveal the folder', async () => {
    await expect(revealBackups()).resolves.toBeUndefined();
  });
});
