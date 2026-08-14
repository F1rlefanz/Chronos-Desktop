export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

/**
 * A pause inside an entry, as two points on the wall clock.
 *
 * Stored as events rather than as one summed `pauseDurationMs`, because the
 * summary cannot answer "when": a pause that has to be corrected afterwards,
 * or one that is still running, needs its own start and end.
 */
export interface Break {
  id: string;
  startTime: number;
  /** `null` while the pause is still running. */
  endTime: number | null;
}

/**
 * One recorded stretch of work.
 *
 * The entry stores *when* work happened and derives *how long* it took; there
 * is deliberately no `durationMs` field. Storing both invites the two to
 * disagree — the previous model kept a duration accumulated from animation
 * frames next to wall-clock timestamps, so a minimised window made them drift
 * apart and the JSON import had to guess which one to believe. Every duration
 * in the app now comes from `src/domain/timeEntry.ts`.
 */
export interface TimeEntry {
  id: string;
  title: string;
  project: string;
  tags: string[];
  startTime: number;
  /** `null` while the entry is still running — the crash-safe open session. */
  endTime: number | null;
  breaks: Break[];
  notes?: string;
  createdAt: number;
  /** How the entry came into being; a manual entry never saw a stopwatch. */
  source: 'stopwatch' | 'manual';
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
  defaultProject: string;
  keyShortcutsEnabled: boolean;
  timerIntervalMs: number;
}

/**
 * How the PDF should look. What it *contains* is decided before it gets here,
 * by `selectEntriesForExport`, so that every format covers the same period.
 */
export interface PdfExportOptions {
  title: string;
  author: string;
  includeNotes: boolean;
  includeSummary: boolean;
}
