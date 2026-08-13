import { STORAGE_KEYS, DEFAULT_APP_SETTINGS, DEFAULT_PROJECTS } from '../constants/defaultConfig';
import { AppSettings, Project, TimeEntry } from '../types';

/**
 * Safely loads data from localStorage with error fallback.
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[Storage] Error reading key "${key}" from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Safely saves data to localStorage.
 */
export function saveToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[Storage] Error writing key "${key}" to localStorage:`, error);
    return false;
  }
}

/**
 * Loads settings and reconciles them with the current shape.
 *
 * Stored settings outlive the code that wrote them: an older build may be
 * missing keys added since, and will carry keys that have been removed
 * (`theme`, `timeFormat`, `autoSaveSession`). Reading the raw JSON straight
 * into state would keep both problems alive across every reload, so the stored
 * value is merged onto the defaults and narrowed to the keys that still exist.
 */
export function loadSettings(): AppSettings {
  const stored = loadFromStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  return migrateSettings(stored);
}

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

export function saveSettings(settings: AppSettings): boolean {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
}

export function loadTimeEntries(): TimeEntry[] {
  return loadFromStorage<TimeEntry[]>(STORAGE_KEYS.TIME_ENTRIES, []);
}

export function saveTimeEntries(entries: TimeEntry[]): boolean {
  return saveToStorage(STORAGE_KEYS.TIME_ENTRIES, entries);
}

export function loadProjects(): Project[] {
  return loadFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, DEFAULT_PROJECTS);
}

export function saveProjects(projects: Project[]): boolean {
  return saveToStorage(STORAGE_KEYS.PROJECTS, projects);
}
