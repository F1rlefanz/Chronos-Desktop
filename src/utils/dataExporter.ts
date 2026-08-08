import { TimeEntry, Project } from '../types';
import { formatTimeDisplay, formatDateTime } from './timeFormatters';

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

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `stopwatch_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `stopwatch_backup_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Reads an uploaded JSON file to import data safely.
 */
export function importFromJsonFile(file: File): Promise<{ entries: TimeEntry[]; projects: Project[]; settings?: unknown }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.entries)) {
          resolve({
            entries: parsed.entries,
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            settings: parsed.settings,
          });
        } else if (Array.isArray(parsed)) {
          // Direct entries array format
          resolve({ entries: parsed as TimeEntry[], projects: [] });
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
