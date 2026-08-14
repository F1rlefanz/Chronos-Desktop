import {
  STORAGE_KEYS,
  LEGACY_STORAGE_KEYS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROJECTS,
} from '../../constants/defaultConfig';
import { AppSettings, Project, TimeEntry, Tombstone } from '../../types';
import { normalizeTimeEntry } from '../dataExporter';
import { logInfo, logWarn } from '../logging/logger';
import { localStorageAdapter } from './localStorageAdapter';
import { StorageAdapter, WriteResult } from './types';

export type { StorageAdapter, BackupSupport, WriteResult, WriteFailureReason } from './types';

/**
 * Everything the app needs before it can render. Loading is a single up-front
 * step rather than three lazy `useState` initialisers, because a filesystem
 * backend cannot answer synchronously.
 */
export interface PersistedState {
  settings: AppSettings;
  entries: TimeEntry[];
  projects: Project[];
  /**
   * What has been deleted, kept so another device can be told.
   *
   * Stored beside the entries rather than inside them: every existing reader —
   * the history, the statistics, every export — would otherwise have to
   * remember to filter them out, and the one that forgot would quietly count
   * deleted time.
   */
  tombstones: Tombstone[];
}

/** Copies, so a consumer putting this into state cannot mutate the defaults. */
export function defaultPersistedState(): PersistedState {
  return {
    settings: { ...DEFAULT_APP_SETTINGS },
    entries: [],
    projects: [...DEFAULT_PROJECTS],
    tombstones: [],
  };
}

let adapter: StorageAdapter = localStorageAdapter;

/** Swaps the backend. The desktop build calls this before the first read. */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

/**
 * Reads and decodes one key. Anything unreadable — missing, or invalid JSON
 * left behind by an older build — falls back to the default rather than
 * propagating, so one bad key cannot stop the app from starting.
 */
function parseJson<T>(raw: string, key: string, defaultValue: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logWarn(`[Storage] Ignoring unparseable value for key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Reads a key, falling back to what an older build wrote under its own name.
 *
 * Reports whether the value came from the old key, because that is the signal
 * to write the converted result forward — otherwise the conversion would run
 * again on every single start.
 */
async function readJsonWithLegacy<T>(
  key: string,
  legacyKey: string,
  defaultValue: T
): Promise<{ value: T; fromLegacy: boolean }> {
  const current = await adapter.read(key);
  if (current !== null) {
    return { value: parseJson(current, key, defaultValue), fromLegacy: false };
  }

  const legacy = await adapter.read(legacyKey);
  if (legacy === null) return { value: defaultValue, fromLegacy: false };

  return { value: parseJson(legacy, legacyKey, defaultValue), fromLegacy: true };
}

function writeJson<T>(key: string, value: T): Promise<WriteResult> {
  return adapter.write(key, JSON.stringify(value));
}

export function saveSettings(settings: AppSettings): Promise<WriteResult> {
  return writeJson(STORAGE_KEYS.SETTINGS, settings);
}

export function saveTimeEntries(entries: TimeEntry[]): Promise<WriteResult> {
  return writeJson(STORAGE_KEYS.TIME_ENTRIES, entries);
}

export function saveProjects(projects: Project[]): Promise<WriteResult> {
  return writeJson(STORAGE_KEYS.PROJECTS, projects);
}

export function saveTombstones(tombstones: Tombstone[]): Promise<WriteResult> {
  return writeJson(STORAGE_KEYS.TOMBSTONES, tombstones);
}

/** Anything that is not an id plus a time is not a deletion record. */
export function migrateTombstones(stored: unknown): Tombstone[] {
  if (!Array.isArray(stored)) return [];

  return stored.filter(
    (value): value is Tombstone =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Tombstone).id === 'string' &&
      Number.isFinite((value as Tombstone).deletedAt)
  );
}

/**
 * Reconciles stored settings with the current shape.
 *
 * Stored settings outlive the code that wrote them: an older build may be
 * missing keys added since, and will carry keys that have been removed
 * (`theme`, `timeFormat`, `autoSaveSession`). Reading the raw JSON straight
 * into state would keep both problems alive across every reload, so the stored
 * value is merged onto the defaults and narrowed to the keys that still exist.
 */
export function migrateSettings(stored: unknown): AppSettings {
  if (typeof stored !== 'object' || stored === null) return { ...DEFAULT_APP_SETTINGS };

  const raw = stored as Record<string, unknown>;
  const migrated = { ...DEFAULT_APP_SETTINGS };

  for (const key of Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[]) {
    const value = raw[key];
    // Only adopt a stored value when its type still matches the default's.
    if (typeof value === typeof DEFAULT_APP_SETTINGS[key]) {
      migrated[key] = value as never;
    }
  }

  return migrated;
}

/**
 * Reconciles stored entries with the current shape.
 *
 * The counterpart to `migrateSettings`, and just as necessary: stored entries
 * outlive the code that wrote them, and up to 0.3.0 an entry was the readout of
 * a stopwatch run — a stored `durationMs`, a summed `pauseDurationMs`, a list
 * of laps. Every record goes through the same normaliser an imported file does,
 * so a value that no longer fits the model cannot reach state; unreadable
 * records are dropped rather than kept as half-entries that break every
 * aggregate that touches them.
 */
export function migrateEntries(stored: unknown): TimeEntry[] {
  if (!Array.isArray(stored)) return [];

  const entries = stored
    .map(normalizeTimeEntry)
    .filter((entry): entry is TimeEntry => entry !== null);

  const dropped = stored.length - entries.length;
  if (dropped > 0) {
    logWarn(`[Storage] Dropped ${dropped} unreadable time ${dropped === 1 ? 'entry' : 'entries'}.`);
  }

  return entries;
}

/* -------------------------------------------------------------------------- */
/* Backups                                                                    */
/* -------------------------------------------------------------------------- */

/** Why a snapshot was taken. Ends up in the file name, so the user can tell. */
export type BackupReason = 'daily' | 'on-close' | 'before-clear' | 'before-import';

/** True when the active backend can keep snapshots — false in the browser. */
export function backupsAvailable(): boolean {
  return adapter.backups !== undefined;
}

/**
 * Builds the file name, starting with a sortable local timestamp so that
 * lexicographic order is chronological and the retention pass can prune the
 * oldest without reading a single file.
 */
const pad = (value: number): string => String(value).padStart(2, '0');

/** `chronos-backup-2026-08-13` — everything a same-day snapshot shares. */
function dayPrefix(at: Date): string {
  return `chronos-backup-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function backupName(reason: BackupReason, at: Date): string {
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${dayPrefix(at)}-${time}-${reason}.json`;
}

/**
 * Writes a snapshot. Resolves to `{ ok: true }` when the backend keeps no
 * backups at all — the caller asked for protection that does not exist here,
 * which is not a failure it can do anything about.
 */
export function writeBackup(
  reason: BackupReason,
  contents: string,
  at: Date = new Date()
): Promise<WriteResult> {
  if (!adapter.backups) return Promise.resolve({ ok: true });
  return adapter.backups.write(backupName(reason, at), contents);
}

/**
 * Takes the first snapshot of the day, if there is not one already.
 *
 * The payload is built lazily: on every start after the first, this walks away
 * without serialising the whole history.
 */
export async function ensureDailyBackup(
  buildContents: () => string,
  at: Date = new Date()
): Promise<WriteResult | null> {
  if (!adapter.backups) return null;

  const today = dayPrefix(at);
  const existing = await adapter.backups.list();

  if (existing.some((name) => name.startsWith(today) && name.endsWith('-daily.json'))) {
    return null;
  }

  return adapter.backups.write(backupName('daily', at), buildContents());
}

/** Shows the backup folder in the user's file manager. */
export async function revealBackups(): Promise<void> {
  if (!adapter.backups) return;
  await adapter.backups.reveal();
}

/** Loads the full application state through the active adapter. */
export async function loadPersistedState(): Promise<PersistedState> {
  const [storedSettings, storedEntries, storedProjects, storedTombstones] = await Promise.all([
    readJsonWithLegacy<Partial<AppSettings>>(
      STORAGE_KEYS.SETTINGS,
      LEGACY_STORAGE_KEYS.SETTINGS,
      {}
    ),
    readJsonWithLegacy<unknown>(STORAGE_KEYS.TIME_ENTRIES, LEGACY_STORAGE_KEYS.TIME_ENTRIES, []),
    readJsonWithLegacy<Project[]>(
      STORAGE_KEYS.PROJECTS,
      LEGACY_STORAGE_KEYS.PROJECTS,
      DEFAULT_PROJECTS
    ),
    // No legacy counterpart: deletions were not recorded before this existed,
    // and there is nothing to reconstruct them from.
    adapter.read(STORAGE_KEYS.TOMBSTONES),
  ]);

  const settings = migrateSettings(storedSettings.value);
  const entries = migrateEntries(storedEntries.value);
  const projects = storedProjects.value;
  const tombstones = migrateTombstones(
    storedTombstones === null ? [] : parseJson(storedTombstones, STORAGE_KEYS.TOMBSTONES, [])
  );

  if (storedEntries.fromLegacy) {
    logInfo(`[Storage] Converted ${entries.length} entries from the pre-0.4.0 stopwatch format.`);
  }

  // Write the cleaned state back, otherwise the stale shape sits in storage
  // until the user happens to change something — and a conversion that is not
  // written forward runs again on every start. These writes are not reported to
  // the UI: they lose no user input, so a banner on startup would only alarm.
  const writeBacks: Promise<[string, WriteResult]>[] = [];

  if (
    storedSettings.fromLegacy ||
    JSON.stringify(storedSettings.value) !== JSON.stringify(settings)
  ) {
    writeBacks.push(saveSettings(settings).then((r) => ['settings', r]));
  }
  if (storedEntries.fromLegacy) {
    writeBacks.push(saveTimeEntries(entries).then((r) => ['entries', r]));
  }
  if (storedProjects.fromLegacy) {
    writeBacks.push(saveProjects(projects).then((r) => ['projects', r]));
  }

  for (const [what, result] of await Promise.all(writeBacks)) {
    if (!result.ok) {
      logWarn(`[Storage] Could not write back migrated ${what}: ${result.message}`);
    }
  }

  return { settings, entries, projects, tombstones };
}
