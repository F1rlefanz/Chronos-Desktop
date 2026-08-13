import { AppSettings, Project } from '../types';

export const TIME_CONSTANTS = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60,
  DEFAULT_TIMER_UPDATE_INTERVAL_MS: 10, // 100Hz smooth UI update
} as const;

/**
 * The ids stay as they are: entries reference them, and renaming a label must
 * not orphan recorded time. The names are what changed — "Sports & Fitness"
 * and "Creative Design" were hobby-stopwatch categories, not the things a
 * record of worked hours gets sorted into.
 */
export const DEFAULT_PROJECTS: Project[] = [
  { id: 'proj-general', name: 'Allgemein', color: '#64748b' },
  { id: 'proj-work', name: 'Arbeit', color: '#3b82f6' },
  { id: 'proj-study', name: 'Weiterbildung', color: '#8b5cf6' },
  { id: 'proj-sports', name: 'Ehrenamt', color: '#10b981' },
  { id: 'proj-creative', name: 'Projektarbeit', color: '#f59e0b' },
];

/**
 * Milliseconds off and a one-second tick by default.
 *
 * Both remain settings — a stopwatch is still in here — but 100 Hz updates and
 * hundredths of a second are the defaults of an app that measures laps, not one
 * that records working hours.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  showMilliseconds: false,
  soundEnabled: true,
  desktopWindowFrame: true,
  defaultProject: 'proj-work',
  keyShortcutsEnabled: true,
  timerIntervalMs: 1000,
};

/** Update intervals offered in the settings UI, in milliseconds. */
export const TIMER_INTERVAL_OPTIONS = [
  { value: 1000, label: 'Jede Sekunde (sparsam)' },
  { value: 100, label: 'Alle 100 ms' },
  { value: 10, label: 'Alle 10 ms (am flüssigsten)' },
] as const;

export const STORAGE_KEYS = {
  SETTINGS: 'chronos_settings_v2',
  TIME_ENTRIES: 'chronos_entries_v2',
  PROJECTS: 'chronos_projects_v2',
} as const;

/**
 * What builds up to 0.3.0 wrote, back when an entry was a stopwatch readout.
 *
 * Read once, on the first start after the upgrade, and converted to the current
 * shape (`migrateEntries`). The old values are left in place rather than
 * deleted: the adapter has no `remove`, and adding IPC surface to tidy up a key
 * nobody reads twice is not worth the extra thing that can fail.
 */
export const LEGACY_STORAGE_KEYS = {
  SETTINGS: 'stopwatch_app_settings_v1',
  TIME_ENTRIES: 'stopwatch_app_entries_v1',
  PROJECTS: 'stopwatch_app_projects_v1',
} as const;
