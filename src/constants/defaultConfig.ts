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

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'proj-general', name: 'General', color: '#64748b' },
  { id: 'proj-work', name: 'Work Project', color: '#3b82f6' },
  { id: 'proj-study', name: 'Study & Learning', color: '#8b5cf6' },
  { id: 'proj-sports', name: 'Sports & Fitness', color: '#10b981' },
  { id: 'proj-creative', name: 'Creative Design', color: '#f59e0b' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showMilliseconds: true,
  soundEnabled: true,
  desktopWindowFrame: true,
  defaultProject: 'proj-work',
  keyShortcutsEnabled: true,
  timerIntervalMs: TIME_CONSTANTS.DEFAULT_TIMER_UPDATE_INTERVAL_MS,
};

/** Update intervals offered in the settings UI, in milliseconds. */
export const TIMER_INTERVAL_OPTIONS = [
  { value: 10, label: 'Every 10 ms (smoothest)' },
  { value: 100, label: 'Every 100 ms' },
  { value: 1000, label: 'Every second (lowest CPU)' },
] as const;

export const STORAGE_KEYS = {
  SETTINGS: 'stopwatch_app_settings_v1',
  TIME_ENTRIES: 'stopwatch_app_entries_v1',
  PROJECTS: 'stopwatch_app_projects_v1',
} as const;

export const UI_ANIMATION_DURATIONS = {
  MODAL_TRANSITION_MS: 200,
  BUTTON_PRESS_FEEDBACK_MS: 150,
} as const;
