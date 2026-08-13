import {
  STORAGE_KEYS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROJECTS,
} from '../../constants/defaultConfig';
import { AppSettings, Project, TimeEntry } from '../../types';
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
}

/** Copies, so a consumer putting this into state cannot mutate the defaults. */
export function defaultPersistedState(): PersistedState {
  return {
    settings: { ...DEFAULT_APP_SETTINGS },
    entries: [],
    projects: [...DEFAULT_PROJECTS],
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
async function readJson<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await adapter.read(key);
  if (raw === null) return defaultValue;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[Storage] Ignoring unparseable value for key "${key}":`, error);
    return defaultValue;
  }
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

/* -------------------------------------------------------------------------- */
/* Backups                                                                    */
/* -------------------------------------------------------------------------- */

/** Why a snapshot was taken. Ends up in the file name, so the user can tell. */
export type BackupReason = 'daily' | 'before-clear' | 'before-import';

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
  const [storedSettings, entries, projects] = await Promise.all([
    readJson<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {}),
    readJson<TimeEntry[]>(STORAGE_KEYS.TIME_ENTRIES, []),
    readJson<Project[]>(STORAGE_KEYS.PROJECTS, DEFAULT_PROJECTS),
  ]);

  const settings = migrateSettings(storedSettings);

  // Write the cleaned state back, otherwise the stale keys sit in storage until
  // the user happens to change a setting. This one write is not reported to the
  // UI: it loses no user input, so a banner on startup would only alarm.
  if (JSON.stringify(storedSettings) !== JSON.stringify(settings)) {
    const result = await saveSettings(settings);
    if (!result.ok) {
      console.warn(`[Storage] Could not write back migrated settings: ${result.message}`);
    }
  }

  return { settings, entries, projects };
}
