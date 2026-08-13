import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  flushLogs,
  formatLine,
  logError,
  logInfo,
  logWarn,
  loggingToFile,
  revealLogs,
  setLogSink,
} from './logger';
import { LogSink } from './types';

const at = new Date(Date.UTC(2026, 7, 13, 14, 5, 6));

function createSink() {
  const lines: string[] = [];
  let revealed = 0;
  let rejectWrites = false;

  const sink: LogSink = {
    write: (line) => {
      if (rejectWrites) return Promise.reject(new Error('disk on fire'));
      lines.push(line);
      return Promise.resolve();
    },
    reveal: () => {
      revealed += 1;
      return Promise.resolve();
    },
  };

  return {
    sink,
    lines,
    revealCount: () => revealed,
    breakWrites: () => {
      rejectWrites = true;
    },
  };
}

describe('formatLine', () => {
  it('leads with a sortable timestamp and a padded level', () => {
    expect(formatLine('warn', ['something happened'], at)).toBe(
      '2026-08-13T14:05:06.000Z WARN  something happened'
    );
  });

  it('keeps the stack of an error rather than flattening it to [object Object]', () => {
    const error = new Error('kaboom');
    error.stack = 'Error: kaboom\n    at somewhere';

    expect(formatLine('error', ['[Storage] failed:', error], at)).toContain('at somewhere');
  });

  it('serialises plain objects', () => {
    expect(formatLine('info', [{ reason: 'quota' }], at)).toContain('{"reason":"quota"}');
  });

  it('survives a value that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => formatLine('info', [circular], at)).not.toThrow();
  });
});

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setLogSink(null);
    vi.restoreAllMocks();
  });

  it('writes to the console even without a sink', () => {
    setLogSink(null);

    logWarn('no sink here');

    expect(console.warn).toHaveBeenCalledWith('no sink here');
    expect(loggingToFile()).toBe(false);
  });

  it('mirrors to the sink once one is installed', async () => {
    const context = createSink();
    setLogSink(context.sink);

    logInfo('started');
    logWarn('careful');
    logError('broken');
    await flushLogs();

    expect(loggingToFile()).toBe(true);
    expect(context.lines).toHaveLength(3);
    expect(context.lines[0]).toContain('INFO  started');
    expect(context.lines[1]).toContain('WARN  careful');
    expect(context.lines[2]).toContain('ERROR broken');
  });

  it('routes each level to the matching console method', () => {
    setLogSink(null);

    logInfo('i');
    logWarn('w');
    logError('e');

    expect(console.info).toHaveBeenCalledWith('i');
    expect(console.warn).toHaveBeenCalledWith('w');
    expect(console.error).toHaveBeenCalledWith('e');
  });

  it('does not let a failing sink break the caller', async () => {
    // A logger that can throw is worse than no logger: it would take down the
    // very code paths that are already handling a failure.
    const context = createSink();
    context.breakWrites();
    setLogSink(context.sink);

    expect(() => logError('while handling another error')).not.toThrow();
    await expect(flushLogs()).resolves.toBeUndefined();
  });

  it('keeps lines in the order they were logged', async () => {
    // A slow first write must not let a later line overtake it: a log you have
    // to re-sort before reading is a log you stop trusting.
    const lines: string[] = [];
    let releaseFirst: () => void = () => {};
    let first = true;

    setLogSink({
      write: (line) => {
        if (first) {
          first = false;
          return new Promise<void>((resolve) => {
            releaseFirst = () => {
              lines.push(line);
              resolve();
            };
          });
        }
        lines.push(line);
        return Promise.resolve();
      },
      reveal: () => Promise.resolve(),
    });

    logInfo('first');
    logInfo('second');
    // Let the chain reach the first write before releasing it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseFirst();
    await flushLogs();

    expect(lines[0]).toContain('first');
    expect(lines[1]).toContain('second');
  });

  it('reveals the log folder through the sink', async () => {
    const context = createSink();
    setLogSink(context.sink);

    await revealLogs();

    expect(context.revealCount()).toBe(1);
  });

  it('does nothing when asked to reveal without a sink', async () => {
    setLogSink(null);

    await expect(revealLogs()).resolves.toBeUndefined();
  });
});
