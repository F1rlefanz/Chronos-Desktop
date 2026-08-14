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
  /**
   * When this entry last changed.
   *
   * The field that makes two devices reconcilable: without it a merge can see
   * that two copies differ but not which one is newer, and picking wrong
   * silently reverts an edit.
   */
  updatedAt: number;
  /** How the entry came into being; a manual entry never saw a stopwatch. */
  source: 'stopwatch' | 'manual';
}

/**
 * The record a deletion leaves behind.
 *
 * Deleting by simply dropping the entry is what makes merging impossible: the
 * other device cannot tell "deleted here" from "not seen here yet", so a merge
 * would faithfully resurrect everything ever deleted. A tombstone is an id and
 * a time, which is small enough to keep indefinitely.
 */
export interface Tombstone {
  id: string;
  deletedAt: number;
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
  /**
   * The folder two devices exchange their records through — empty when off.
   *
   * A path, not an account: whatever keeps that folder in step (OneDrive,
   * Syncthing, a network drive) is the user's business, and Chronos only reads
   * and writes in it. Deliberately *not* carried over by an import: a path from
   * another machine points nowhere on this one.
   */
  syncFolder: string;
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
