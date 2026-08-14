import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  deliverFile,
  encodeText,
  revealExports,
  setFileSink,
  writesFilesItself,
} from './fileTarget';
import { FileSink } from './fileTarget';

function createSink() {
  const written: { name: string; bytes: Uint8Array }[] = [];
  let revealed = 0;
  let failure: Error | null = null;

  const sink: FileSink = {
    write: (name, bytes) => {
      if (failure) return Promise.reject(failure);
      written.push({ name, bytes });
      return Promise.resolve(`C:\\Chronos\\exports\\${name}`);
    },
    reveal: () => {
      revealed += 1;
      return Promise.resolve();
    },
  };

  return {
    sink,
    written,
    revealCount: () => revealed,
    breakWrites: (error: Error) => {
      failure = error;
    },
  };
}

describe('deliverFile without a sink (the browser build)', () => {
  beforeEach(() => {
    setFileSink(null);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports that it does not write files itself', () => {
    expect(writesFilesItself()).toBe(false);
  });

  it('hands the file to the browser as a download', async () => {
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this.download);
    });

    const result = await deliverFile('bericht.csv', encodeText('a;b'), 'text/csv');

    expect(result).toEqual({ ok: true, where: 'download' });
    expect(clicked).toEqual(['bericht.csv']);
  });
});

describe('deliverFile with a sink (the desktop build)', () => {
  let context: ReturnType<typeof createSink>;

  beforeEach(() => {
    context = createSink();
    setFileSink(context.sink);
  });

  afterEach(() => {
    setFileSink(null);
    vi.restoreAllMocks();
  });

  it('reports that it writes files itself', () => {
    expect(writesFilesItself()).toBe(true);
  });

  // The whole point: a Tauri WebView ignores the `<a download>` click, so an
  // export that takes the browser path there does nothing at all.
  it('writes through the sink instead of clicking a download link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = await deliverFile('bericht.csv', encodeText('a;b'), 'text/csv');

    expect(click).not.toHaveBeenCalled();
    expect(context.written).toHaveLength(1);
    expect(context.written[0].name).toBe('bericht.csv');
    expect(result).toEqual({ ok: true, where: 'file', path: 'C:\\Chronos\\exports\\bericht.csv' });
  });

  it('passes the bytes through untouched', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

    await deliverFile('bericht.pdf', bytes, 'application/pdf');

    expect(Array.from(context.written[0].bytes)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('reports a failed write rather than throwing', async () => {
    // An export nobody can find is the bug this replaced; failing silently
    // would recreate it in a different costume.
    context.breakWrites(Object.assign(new Error('nope'), { message: 'Die Platte ist voll.' }));

    const result = await deliverFile('bericht.csv', encodeText('a'), 'text/csv');

    expect(result).toEqual({ ok: false, message: 'Die Platte ist voll.' });
  });

  it('reveals the export folder', async () => {
    await revealExports();

    expect(context.revealCount()).toBe(1);
  });
});
