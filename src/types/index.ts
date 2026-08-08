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

export interface AppSettings {
  showMilliseconds: boolean;
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  desktopWindowFrame: boolean;
  autoSaveSession: boolean;
  defaultProject: string;
  timeFormat: '12h' | '24h';
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

export type ExportFormat = 'pdf' | 'csv' | 'json';
