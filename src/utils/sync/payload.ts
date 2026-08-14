import { TimeEntry, Tombstone } from '../../types';
import { isRunning } from '../../domain/timeEntry';
import { normalizeTimeEntry } from '../dataExporter';
import { migrateTombstones } from '../storage';
import { isDeviceId } from './deviceId';

/**
 * What one device leaves in the shared folder for the others to read.
 *
 * One file per device, never a shared one. Two devices then never write the
 * same file, so the folder's sync client — OneDrive, Syncthing, a network
 * drive — cannot produce a conflicting copy that Chronos would have to resolve.
 * Reading is the opposite: every foreign file is read and merged in, which is
 * safe in any order because `mergeEntries` is idempotent and symmetric.
 */
export interface SyncPayload {
  /** The shape of this file, so a later change can be recognised. */
  version: 1;
  device: string;
  writtenAt: number;
  entries: TimeEntry[];
  tombstones: Tombstone[];
}

const PREFIX = 'chronos-';
const SUFFIX = '.json';

export function syncFileName(deviceId: string): string {
  return `${PREFIX}${deviceId}${SUFFIX}`;
}

/**
 * Whether a file in the folder is one of ours.
 *
 * The folder belongs to the user, not to Chronos: it may well hold a shopping
 * list, and reading everything with a `.json` extension would be both wrong and
 * rude.
 */
export function isSyncFileName(name: string): boolean {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return false;
  return isDeviceId(name.slice(PREFIX.length, name.length - SUFFIX.length));
}

/**
 * A measurement still running belongs to the device it runs on.
 *
 * Sharing it would put a second device into a state it cannot honestly be in —
 * both would show a stopwatch running, both would write to the same open entry,
 * and whichever stopped it last would decide when the work ended. A finished
 * entry is a record; an open one is still an action.
 */
function shareable(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => !isRunning(entry));
}

export function buildSyncPayload(
  device: string,
  entries: TimeEntry[],
  tombstones: Tombstone[],
  writtenAt: number = Date.now()
): string {
  const payload: SyncPayload = {
    version: 1,
    device,
    writtenAt,
    entries: shareable(entries),
    tombstones,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Reads one foreign file, or gives up on it.
 *
 * A file from the shared folder is untrusted input in exactly the way an
 * imported file is — written by another build, possibly half-copied by the sync
 * client — and it is merged straight into state and persisted. So every record
 * goes through the same normaliser the JSON import uses, and a file that makes
 * no sense at all comes back as `null` rather than as an empty set, which would
 * be indistinguishable from a device that has nothing to share.
 */
export function parseSyncPayload(
  raw: string
): { entries: TimeEntry[]; tombstones: Tombstone[] } | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.entries)) return null;

  const entries = shareable(
    record.entries.map(normalizeTimeEntry).filter((entry): entry is TimeEntry => entry !== null)
  );

  return { entries, tombstones: migrateTombstones(record.tombstones) };
}
