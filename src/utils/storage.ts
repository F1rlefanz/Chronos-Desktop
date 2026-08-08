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

export function loadSettings(): AppSettings {
  return loadFromStorage<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_APP_SETTINGS);
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
