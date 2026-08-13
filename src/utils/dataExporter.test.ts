import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCsv, importFromJsonFile } from './dataExporter';
import { breakMs, netMs } from '../domain/timeEntry';
import type { TimeEntry, Project } from '../types';

/**
 * Captures what exportToCsv hands to the browser, so tests can assert on the
 * actual file content instead of on implementation details.
 */
function captureDownload() {
  const captured: { blob?: Blob; filename?: string } = {};
  const clicked = vi.fn();

  vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
    captured.blob = obj as Blob;
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clicked);

  return {
    captured,
    clicked,
    text: async () => {
      if (!captured.blob) throw new Error('no download was triggered');
      return captured.blob.text();
    },
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    title: 'Session',
    project: 'proj-work',
    tags: [],
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_060_000,
    breaks: [],
    createdAt: 1_700_000_060_000,
    source: 'stopwatch',
    ...overrides,
  };
}

const PROJECTS: Project[] = [{ id: 'proj-work', name: 'Work', color: '#3b82f6' }];

describe('exportToCsv', () => {
  beforeEach(() => {
    // jsdom has no Blob.text() in some versions and no createObjectURL at all.
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', { value: () => '', writable: true });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps every row when a title contains "#"', async () => {
    // Regression: the export used to build a data: URI with encodeURI, which
    // leaves "#" unescaped — everything after it was silently dropped.
    const download = captureDownload();

    exportToCsv(
      [
        makeEntry({ id: 'entry-1', title: 'Ticket #42 rollout' }),
        makeEntry({ id: 'entry-2', title: 'Second session' }),
      ],
      PROJECTS,
      'test'
    );

    const csv = await download.text();
    expect(csv).toContain('Ticket #42 rollout');
    expect(csv).toContain('Second session');
    // header + two rows
    expect(csv.trim().split('\n')).toHaveLength(3);
  });

  it('escapes quotes and keeps commas inside a single field', async () => {
    const download = captureDownload();

    exportToCsv([makeEntry({ title: 'He said "go", then left' })], PROJECTS, 'test');

    const csv = await download.text();
    expect(csv).toContain('"He said ""go"", then left"');
  });

  it('starts with a UTF-8 BOM so Excel reads non-ASCII text correctly', async () => {
    const download = captureDownload();

    exportToCsv([makeEntry({ title: 'Übung' })], PROJECTS, 'test');

    // Blob.text() decodes UTF-8 and strips a leading BOM per spec, so the BOM
    // has to be asserted on the raw bytes.
    const bytes = new Uint8Array(await download.captured.blob!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await download.text()).toContain('Übung');
  });
});

/** Builds a File whose text() resolves to the given payload. */
function jsonFile(payload: unknown): File {
  return new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
}

describe('importFromJsonFile', () => {
  it('fills in missing fields instead of passing a broken entry through', async () => {
    // Regression: an entry without title/tags was persisted as-is and then
    // crashed SessionHistory on entry.title.toLowerCase() — on every reload.
    const result = await importFromJsonFile(
      jsonFile({ entries: [{ id: 'e1', durationMs: 1000 }] })
    );

    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0];
    expect(typeof entry.title).toBe('string');
    expect(entry.title).not.toBe('');
    expect(Array.isArray(entry.tags)).toBe(true);
    expect(Array.isArray(entry.breaks)).toBe(true);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('drops junk values rather than trusting their type', async () => {
    const result = await importFromJsonFile(
      jsonFile({
        entries: [
          {
            id: 'e1',
            title: 42,
            tags: ['keep', 7, null],
            breaks: ['nonsense'],
            startTime: 'yesterday',
          },
        ],
      })
    );

    const entry = result.entries[0];
    expect(entry.title).toBe('Ohne Titel');
    expect(entry.tags).toEqual(['keep']);
    expect(entry.startTime).toBe(0);
    expect(entry.breaks).toEqual([]);
  });

  it('reads a 0.3.0 record and keeps its net time exactly', async () => {
    // The old model stored durationMs (already net of pauses) next to
    // wall-clock timestamps. The converted entry must report the same net
    // time, which means the reconstructed break has to absorb the difference.
    const result = await importFromJsonFile(
      jsonFile({
        entries: [
          {
            id: 'legacy-1',
            title: 'Old session',
            startTime: 1_700_000_000_000,
            endTime: 1_700_000_600_000, // 10 minutes on the wall clock
            durationMs: 400_000, // but only 6:40 actually ran
            pauseDurationMs: 200_000,
            laps: [{ id: 'lap-1', lapNumber: 1, lapTimeMs: 1000, splitTimeMs: 1000 }],
          },
        ],
      })
    );

    const entry = result.entries[0];
    expect(netMs(entry)).toBe(400_000);
    expect(breakMs(entry)).toBe(200_000);
    expect(entry.breaks).toHaveLength(1);
    // Laps are not part of the model any more and are dropped, not smuggled in.
    expect(entry).not.toHaveProperty('laps');
  });

  it('treats an explicit null end as a running entry', async () => {
    const result = await importFromJsonFile(
      jsonFile({ entries: [{ id: 'e1', startTime: 1_700_000_000_000, endTime: null }] })
    );

    expect(result.entries[0].endTime).toBeNull();
  });

  it('accepts a bare array of entries', async () => {
    const result = await importFromJsonFile(jsonFile([{ id: 'e1', title: 'From array' }]));
    expect(result.entries[0].title).toBe('From array');
    expect(result.projects).toEqual([]);
  });

  it('rejects a file whose entries are all unreadable', async () => {
    await expect(importFromJsonFile(jsonFile({ entries: [1, 'two', null] }))).rejects.toThrow(
      /no readable time entries/i
    );
  });

  it('rejects JSON that is not an import payload at all', async () => {
    await expect(importFromJsonFile(jsonFile({ hello: 'world' }))).rejects.toThrow(
      /invalid json format/i
    );
  });

  it('skips projects without a usable name', async () => {
    const result = await importFromJsonFile(
      jsonFile({
        entries: [],
        projects: [{ id: 'p1', name: 'Real' }, { id: 'p2', name: '   ' }, 'junk'],
      })
    );

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({ id: 'p1', name: 'Real' });
    expect(result.projects[0].color).toBeTruthy();
  });
});
