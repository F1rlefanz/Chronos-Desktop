export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface Lap {
  id: string;
  lapNumber: number;
  lapTimeMs: number;
  splitTimeMs: number;
  timestamp: number;
}

export interface TimeEntry {
  id: string;
  title: string;
  project: string;
  tags: string[];
  startTime: number;
  endTime: number;
  durationMs: number;
  pauseDurationMs: number;
  notes?: string;
  laps: Lap[];
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

/**
 * Only settings that are actually wired up belong here. `theme`, `timeFormat`
 * and `autoSaveSession` used to sit in this interface without a single reader,
 * which made the type lie about what the app can do.
 */
export interface AppSettings {
  showMilliseconds: boolean;
  soundEnabled: boolean;
  desktopWindowFrame: boolean;
  defaultProject: string;
  keyShortcutsEnabled: boolean;
  timerIntervalMs: number;
}

export interface PdfExportOptions {
  title: string;
  author: string;
  includeLaps: boolean;
  includeNotes: boolean;
  includeSummary: boolean;
  dateRange: 'all' | 'today' | 'week' | 'month';
  selectedProject: string; // 'all' or project ID
}
