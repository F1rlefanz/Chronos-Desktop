import { TimeEntry, Project, Break } from '../types';
import { breakMs, netMs } from '../domain/timeEntry';
import { formatTimeDisplay, formatDateTime } from './timeFormatters';

/**
 * Hands a generated file to the browser as a download.
 *
 * Blob URLs are used instead of `data:` URIs because the latter must be
 * percent-encoded in full: an un-escaped `#` in a session title would
 * otherwise truncate the file at that point and silently drop every row
 * after it.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts time entries into CSV format and triggers browser download.
 */
export function exportToCsv(entries: TimeEntry[], projects: Project[]): void {
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));

  const headers = [
    'ID',
    'Title',
    'Project',
    'Start Time',
    'End Time',
    'Break (HH:MM:SS)',
    'Duration (HH:MM:SS.ms)',
    'Duration (Seconds)',
    'Notes',
  ];

  // One clock for the whole file, so a running entry cannot be counted with a
  // slightly different "now" on every row.
  const now = Date.now();

  const rows = entries.map((entry) => {
    const proj = projectMap.get(entry.project);
    const projName = proj ? proj.name : entry.project || 'General';
    const net = netMs(entry, now);
    const { mainTime, subTime } = formatTimeDisplay(net, {
      includeMilliseconds: true,
    });
    const durationSeconds = (net / 1000).toFixed(2);
    const pause = formatTimeDisplay(breakMs(entry, now), { alwaysShowHours: true }).mainTime;

    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    return [
      escapeCsv(entry.id),
      escapeCsv(entry.title || 'Untitled Session'),
      escapeCsv(projName),
      escapeCsv(formatDateTime(entry.startTime)),
      escapeCsv(entry.endTime === null ? 'running' : formatDateTime(entry.endTime)),
      escapeCsv(pause),
      escapeCsv(`${mainTime}${subTime}`),
      durationSeconds,
      escapeCsv(entry.notes || ''),
    ].join(',');
  });

  // Leading BOM so Excel picks up UTF-8 for umlauts and other non-ASCII text.
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  downloadBlob(
    new Blob([csvContent], { type: 'text/csv;charset=utf-8' }),
    `stopwatch_export_${Date.now()}.csv`
  );
}

/**
 * The complete app state in the shape `importFromJsonFile` reads back.
 *
 * Shared by the manual export and the automatic desktop snapshots on purpose:
 * a snapshot is then restored through the import the app already has, instead
 * of a second restore path that could have its own bugs.
 */
export function buildBackupPayload(
  entries: TimeEntry[],
  projects: Project[],
  settings: unknown
): string {
  const timestamp = Date.now();

  return JSON.stringify(
    {
      // Bumped when an entry stopped being a stopwatch readout (stored
      // duration, laps) and became start/end plus pauses. `normalizeTimeEntry`
      // still reads a `1.x` file, so this marks the shape rather than gating it.
      version: '2.0.0',
      exportTimestamp: timestamp,
      exportDateFormatted: formatDateTime(timestamp),
      settings,
      projects,
      entries,
    },
    null,
    2
  );
}

/**
 * Exports complete app state as JSON for backup and portability across PCs.
 */
export function exportToJsonBackup(
  entries: TimeEntry[],
  projects: Project[],
  settings: unknown
): void {
  downloadBlob(
    new Blob([buildBackupPayload(entries, projects, settings)], {
      type: 'application/json;charset=utf-8',
    }),
    `stopwatch_backup_${Date.now()}.json`
  );
}

/* -------------------------------------------------------------------------- */
/* Import normalization                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Imported files are untrusted input that gets persisted to localStorage
 * immediately, so a malformed entry would otherwise break the app on every
 * subsequent reload. Every record is coerced into a complete, well-typed
 * shape before it is handed to the app.
 */

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** A finite number, or `null` — the shape of an open end. */
function asOptionalTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBreak(raw: unknown): Break | null {
  if (!isRecord(raw)) return null;

  const startTime = asOptionalTimestamp(raw.startTime);
  if (startTime === null) return null;

  return {
    id: asString(raw.id) || generateId('break-imported'),
    startTime,
    endTime: asOptionalTimestamp(raw.endTime),
  };
}

/**
 * Rebuilds the pauses of a record written before pauses were events.
 *
 * The old model stored `durationMs` (time the stopwatch actually ran, so
 * already net of pauses) beside wall-clock timestamps. Reconstructing the
 * pause from `span - durationMs` therefore preserves the net time exactly,
 * which `pauseDurationMs` — measured on a different clock — only approximates;
 * it is the fallback for records that lack a usable duration. The result is one
 * pause anchored at the end of the entry: the old record never knew *when* the
 * breaks were, and inventing plausible positions would be worse than admitting
 * that.
 */
function breaksFromLegacy(raw: Record<string, unknown>, span: number): Break[] {
  const legacyDuration = raw.durationMs;
  const legacyPause = raw.pauseDurationMs;

  let pauseTotal: number;
  if (typeof legacyDuration === 'number' && Number.isFinite(legacyDuration)) {
    pauseTotal = span - Math.max(0, legacyDuration);
  } else if (typeof legacyPause === 'number' && Number.isFinite(legacyPause)) {
    pauseTotal = legacyPause;
  } else {
    return [];
  }

  const clamped = Math.min(Math.max(0, pauseTotal), span);
  if (clamped <= 0) return [];

  return [{ id: generateId('break-migrated'), startTime: -clamped, endTime: 0 }];
}

/**
 * Coerces one record — from a file or from storage — into a complete entry.
 *
 * Exported because stored data deserves the same suspicion as an imported
 * file: it was written by an older build, possibly a different model, and it
 * is read straight into state on every start.
 */
export function normalizeTimeEntry(raw: unknown): TimeEntry | null {
  if (!isRecord(raw)) return null;

  const startTime = asNumber(raw.startTime);

  // `null` is a real value now — a running entry — so an absent or unusable
  // end falls back to the legacy duration before giving up and calling it open.
  let endTime = asOptionalTimestamp(raw.endTime);
  if (endTime === null && raw.endTime !== null) {
    const legacyDuration = raw.durationMs;
    endTime =
      typeof legacyDuration === 'number' && Number.isFinite(legacyDuration)
        ? startTime + Math.max(0, legacyDuration)
        : null;
  }

  const span = endTime === null ? 0 : Math.max(0, endTime - startTime);
  const breaks = Array.isArray(raw.breaks)
    ? raw.breaks.map(normalizeBreak).filter((b): b is Break => b !== null)
    : // Offsets from the entry's end, resolved here where `endTime` is known.
      breaksFromLegacy(raw, span).map((pause) => ({
        ...pause,
        startTime: (endTime ?? startTime) + pause.startTime,
        endTime: (endTime ?? startTime) + (pause.endTime ?? 0),
      }));

  return {
    id: asString(raw.id) || generateId('entry-imported'),
    title: asString(raw.title) || 'Untitled Session',
    project: asString(raw.project),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    startTime,
    endTime,
    breaks,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    createdAt: asNumber(raw.createdAt, Date.now()),
    source: raw.source === 'manual' ? 'manual' : 'stopwatch',
  };
}

function normalizeProject(raw: unknown): Project | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name).trim();
  if (!name) return null;

  return {
    id: asString(raw.id) || generateId('proj-imported'),
    name,
    color: asString(raw.color) || '#64748b',
  };
}

export interface ImportedData {
  entries: TimeEntry[];
  projects: Project[];
  settings?: unknown;
}

function normalizeImportPayload(
  rawEntries: unknown[],
  rawProjects: unknown[],
  settings: unknown
): ImportedData {
  const entries = rawEntries.map(normalizeTimeEntry).filter((e): e is TimeEntry => e !== null);

  if (rawEntries.length > 0 && entries.length === 0) {
    throw new Error('No readable time entries found in this file');
  }

  return {
    entries,
    projects: rawProjects.map(normalizeProject).filter((p): p is Project => p !== null),
    settings: isRecord(settings) ? settings : undefined,
  };
}

/**
 * Reads an uploaded JSON file to import data safely.
 */
export function importFromJsonFile(file: File): Promise<ImportedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (isRecord(parsed) && Array.isArray(parsed.entries)) {
          resolve(
            normalizeImportPayload(
              parsed.entries,
              Array.isArray(parsed.projects) ? parsed.projects : [],
              parsed.settings
            )
          );
        } else if (Array.isArray(parsed)) {
          // Direct entries array format
          resolve(normalizeImportPayload(parsed, [], undefined));
        } else {
          reject(new Error('Invalid JSON format for Stopwatch import'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
