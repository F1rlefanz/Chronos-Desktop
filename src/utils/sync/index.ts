import { TimeEntry, Tombstone } from '../../types';
import { mergeEntries, MergeInput, MergeResult } from '../../domain/merge';
import { logInfo, logWarn } from '../logging/logger';
import { buildSyncPayload, isSyncFileName, parseSyncPayload, syncFileName } from './payload';
import { SyncTransport } from './types';

export type { SyncTransport } from './types';

let transport: SyncTransport | null = null;

/** Installed by `main.tsx` for the desktop build; nothing else has one. */
export function setSyncTransport(next: SyncTransport | null): void {
  transport = next;
}

/** Whether this build can sync at all — the settings hide the section if not. */
export function syncAvailable(): boolean {
  return transport !== null;
}

/** Opens the folder picker. `null` when cancelled or when there is no picker. */
export async function pickSyncFolder(): Promise<string | null> {
  if (!transport) return null;
  return transport.pickFolder();
}

export type SyncSummary = MergeResult['summary'];

export interface SyncRequest {
  folder: string;
  deviceId: string;
  entries: TimeEntry[];
  tombstones: Tombstone[];
  /**
   * Runs once, immediately before anything foreign is merged in — and only when
   * there is something to merge. Returning `false` calls the whole thing off,
   * which is what a refused backup means: a merge replaces the local set, so
   * the snapshot has to exist before it, not after.
   */
  beforeMerge?: () => Promise<boolean>;
}

export type SyncOutcome =
  | {
      status: 'ok';
      entries: TimeEntry[];
      tombstones: Tombstone[];
      /** False when every device already agreed — nothing to write locally. */
      changed: boolean;
      /** How many other devices were read. */
      peers: number;
      /** Files that looked like ours but could not be read. */
      unreadable: number;
      summary: SyncSummary;
    }
  | { status: 'aborted' }
  | { status: 'failed'; message: string };

const NO_TRANSPORT = 'Der Abgleich über einen Ordner ist in dieser Version der App nicht möglich.';

/** Rust errors arrive as `{ reason, message }`; anything else as itself. */
function detailOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function addSummaries(a: SyncSummary, b: SyncSummary): SyncSummary {
  return {
    added: a.added + b.added,
    updated: a.updated + b.updated,
    deleted: a.deleted + b.deleted,
    unchanged: a.unchanged + b.unchanged,
  };
}

/**
 * Reads every other device's file, merges them in, and writes ours back.
 *
 * The merge itself is `src/domain/merge.ts` — a pure function this only feeds.
 * What happens here is transport: which files to read, what to do with one that
 * cannot be read, and when to give up. A single unreadable file is counted and
 * skipped rather than failing the sync, because the alternative is that one
 * half-copied file from one device blocks every other device indefinitely.
 */
export async function runSync(request: SyncRequest): Promise<SyncOutcome> {
  const { folder, deviceId, beforeMerge } = request;

  if (!transport) return { status: 'failed', message: NO_TRANSPORT };
  if (!folder) return { status: 'failed', message: 'Es ist kein Ordner für den Abgleich gewählt.' };

  const own = syncFileName(deviceId);

  let names: string[];
  try {
    await transport.configure(folder);
    names = (await transport.list()).filter((name) => isSyncFileName(name) && name !== own);
  } catch (error) {
    logWarn('[Sync] Could not open the shared folder:', error);
    return {
      status: 'failed',
      message: `Der Ordner für den Abgleich ist nicht erreichbar: ${detailOf(error)}`,
    };
  }

  // Read everything first, so the backup below is only taken when a merge is
  // actually going to happen.
  const foreign: MergeInput[] = [];
  let unreadable = 0;

  for (const name of names) {
    try {
      const raw = await transport.read(name);
      if (raw === null) continue;

      const payload = parseSyncPayload(raw);
      if (payload === null) {
        unreadable += 1;
        logWarn(`[Sync] Ignoring "${name}": not a readable Chronos file.`);
        continue;
      }

      foreign.push(payload);
    } catch (error) {
      unreadable += 1;
      logWarn(`[Sync] Could not read "${name}":`, error);
    }
  }

  let merged: MergeInput = { entries: request.entries, tombstones: request.tombstones };
  let summary: SyncSummary = { added: 0, updated: 0, deleted: 0, unchanged: 0 };

  if (foreign.length > 0) {
    if (beforeMerge && !(await beforeMerge())) return { status: 'aborted' };

    for (const theirs of foreign) {
      const result = mergeEntries(merged, theirs);
      merged = { entries: result.entries, tombstones: result.tombstones };
      summary = addSummaries(summary, result.summary);
    }
  }

  // Written even when nothing changed: this file is how the other devices see
  // *our* records, and they have no other way of learning about them.
  try {
    await transport.write(own, buildSyncPayload(deviceId, merged.entries, merged.tombstones));
  } catch (error) {
    logWarn('[Sync] Could not write our own file:', error);
    return {
      status: 'failed',
      message: `Die eigenen Daten konnten nicht in den Ordner geschrieben werden: ${detailOf(error)}`,
    };
  }

  const changed = summary.added + summary.updated + summary.deleted > 0;
  logInfo(
    `[Sync] ${foreign.length} device(s) read, ${summary.added} added, ` +
      `${summary.updated} updated, ${summary.deleted} deleted, ${unreadable} unreadable.`
  );

  return {
    status: 'ok',
    entries: merged.entries,
    tombstones: merged.tombstones,
    changed,
    peers: foreign.length,
    unreadable,
    summary,
  };
}

/**
 * Writes our own records into the folder without reading anyone else's.
 *
 * What happens as the window closes. Merging at that moment would change the
 * data behind a user who can no longer see it, and the half of a sync that
 * matters here is the outgoing one — the day's work has to reach the folder
 * before the app is gone. Reading waits until the next start, where the result
 * is visible on screen.
 */
export async function pushToSyncFolder(request: {
  folder: string;
  deviceId: string;
  entries: TimeEntry[];
  tombstones: Tombstone[];
}): Promise<boolean> {
  if (!transport || !request.folder) return false;

  try {
    await transport.configure(request.folder);
    await transport.write(
      syncFileName(request.deviceId),
      buildSyncPayload(request.deviceId, request.entries, request.tombstones)
    );
    return true;
  } catch (error) {
    logWarn('[Sync] Could not write to the shared folder:', error);
    return false;
  }
}
