import { TimeEntry, Project, Lap } from '../types';
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

  const headers = ['ID', 'Title', 'Project', 'Start Time', 'End Time', 'Duration (HH:MM:SS.ms)', 'Duration (Seconds)', 'Laps Count', 'Notes'];

  const rows = entries.map((entry) => {
    const proj = projectMap.get(entry.project);
    const projName = proj ? proj.name : entry.project || 'General';
    const { mainTime, subTime } = formatTimeDisplay(entry.durationMs, { includeMilliseconds: true });
    const durationSeconds = (entry.durationMs / 1000).toFixed(2);

    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    return [
      escapeCsv(entry.id),
      escapeCsv(entry.title || 'Untitled Session'),
      escapeCsv(projName),
      escapeCsv(formatDateTime(entry.startTime)),
      escapeCsv(formatDateTime(entry.endTime)),
      escapeCsv(`${mainTime}${subTime}`),
      durationSeconds,
      entry.laps.length,
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
 * Exports complete app state as JSON for backup and portability across PCs.
 */
export function exportToJsonBackup(entries: TimeEntry[], projects: Project[], settings: unknown): void {
  const exportPayload = {
    version: '1.0.0',
    exportTimestamp: Date.now(),
    exportDateFormatted: formatDateTime(Date.now()),
    settings,
    projects,
    entries,
  };

  downloadBlob(
    new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json;charset=utf-8' }),
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

function normalizeLap(raw: unknown, index: number): Lap {
  const lap = isRecord(raw) ? raw : {};
  return {
    id: asString(lap.id) || generateId('lap-imported'),
    lapNumber: asNumber(lap.lapNumber, index + 1),
    lapTimeMs: asNumber(lap.lapTimeMs),
    splitTimeMs: asNumber(lap.splitTimeMs),
    timestamp: asNumber(lap.timestamp),
  };
}

function normalizeTimeEntry(raw: unknown): TimeEntry | null {
  if (!isRecord(raw)) return null;

  const startTime = asNumber(raw.startTime);
  const endTime = asNumber(raw.endTime);
  const laps = Array.isArray(raw.laps) ? raw.laps.map(normalizeLap) : [];

  return {
    id: asString(raw.id) || generateId('entry-imported'),
    title: asString(raw.title) || 'Untitled Session',
    project: asString(raw.project),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    startTime,
    endTime,
    durationMs: asNumber(raw.durationMs, Math.max(0, endTime - startTime)),
    pauseDurationMs: asNumber(raw.pauseDurationMs),
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    laps,
    createdAt: asNumber(raw.createdAt, Date.now()),
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

function normalizeImportPayload(rawEntries: unknown[], rawProjects: unknown[], settings: unknown): ImportedData {
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
