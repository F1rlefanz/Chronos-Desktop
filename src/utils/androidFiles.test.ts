import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { androidBackupSupport, androidFileSink, setAndroidFilesFolder } from './androidFiles';
import type { FileSink } from './fileTarget';
import type { BackupSupport, WriteResult } from './storage/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const invoked = vi.mocked(invoke);

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FChronos';

/** The app-private path that has always existed, and must stay reachable. */
function fallbackSink(): FileSink {
  return {
    write: vi.fn(async () => 'C:/app-private/chronos.pdf'),
    reveal: vi.fn(async () => {}),
  };
}

function fallbackBackups(): BackupSupport {
  return {
    list: vi.fn(async () => ['from-app-private.json']),
    write: vi.fn(async (): Promise<WriteResult> => ({ ok: true })),
    reveal: vi.fn(async () => {}),
  };
}

/** Answers the plugin calls; `files` is what the folder currently holds. */
function pluginAnswers(files: string[] = []) {
  invoked.mockImplementation(async (command: string) => {
    if (command === 'plugin:chronos-saf|list_files') return { files };
    return {};
  });
}

beforeEach(() => {
  invoked.mockReset();
  setAndroidFilesFolder('');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('with no folder chosen', () => {
  // Nothing is lost by not choosing one — the phone has to behave exactly as
  // it did before, rather than losing its export button to an empty setting.
  it('writes exports where they have always gone', async () => {
    const fallback = fallbackSink();
    const path = await androidFileSink(fallback).write('report.pdf', new Uint8Array([1, 2]));

    expect(fallback.write).toHaveBeenCalled();
    expect(path).toBe('C:/app-private/chronos.pdf');
    expect(invoked).not.toHaveBeenCalled();
  });

  it('keeps backing up app-privately', async () => {
    const fallback = fallbackBackups();
    const result = await androidBackupSupport(fallback).write('chronos-backup-x.json', '{}');

    expect(fallback.write).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});

describe('with a folder chosen', () => {
  beforeEach(() => {
    setAndroidFilesFolder(FOLDER);
  });

  it('writes an export into it and says where it landed', async () => {
    pluginAnswers();

    const path = await androidFileSink(fallbackSink()).write('bericht.pdf', new Uint8Array([0, 1]));

    expect(invoked).toHaveBeenCalledWith('plugin:chronos-saf|write_bytes', {
      payload: {
        role: 'files',
        name: 'bericht.pdf',
        mimeType: 'application/pdf',
        base64: 'AAE=',
      },
    });
    // Readable, not the tree URI it is stored as.
    expect(path).toBe('Documents/Chronos/bericht.pdf');
  });

  it('only counts its own snapshots, and leaves the rest of the folder alone', async () => {
    pluginAnswers(['einkaufsliste.json', 'chronos-backup-b.json', 'chronos-backup-a.json']);

    const names = await androidBackupSupport(fallbackBackups()).list();

    expect(names).toEqual(['chronos-backup-a.json', 'chronos-backup-b.json']);
  });

  it('deletes the oldest once there are more than twenty', async () => {
    // Sortable timestamps in the name, so lexicographic order is chronological.
    const existing = Array.from(
      { length: 22 },
      (_, i) => `chronos-backup-${String(i).padStart(3, '0')}.json`
    );
    pluginAnswers(existing);

    await androidBackupSupport(fallbackBackups()).write('chronos-backup-022.json', '{}');

    const deleted = invoked.mock.calls
      .filter(([command]) => command === 'plugin:chronos-saf|delete_file')
      .map(([, args]) => (args as { payload: { name: string } }).payload.name);

    expect(deleted).toEqual(['chronos-backup-000.json', 'chronos-backup-001.json']);
  });

  it('keeps every snapshot while there is room', async () => {
    pluginAnswers(['chronos-backup-a.json', 'chronos-backup-b.json']);

    await androidBackupSupport(fallbackBackups()).write('chronos-backup-c.json', '{}');

    expect(
      invoked.mock.calls.filter(([command]) => command === 'plugin:chronos-saf|delete_file')
    ).toHaveLength(0);
  });

  // The grant can be withdrawn and the folder can be deleted. A backup is the
  // wrong thing to lose over it, so it goes to the app-private folder instead.
  it('falls back rather than losing a snapshot when the folder is gone', async () => {
    invoked.mockRejectedValue(new Error('Der Ordner ist nicht mehr freigegeben.'));
    const fallback = fallbackBackups();

    const result = await androidBackupSupport(fallback).write('chronos-backup-x.json', '{}');

    expect(fallback.write).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('falls back for an export too, instead of failing the button', async () => {
    invoked.mockRejectedValue(new Error('weg'));
    const fallback = fallbackSink();

    await androidFileSink(fallback).write('bericht.csv', new Uint8Array([]));

    expect(fallback.write).toHaveBeenCalled();
  });
});
