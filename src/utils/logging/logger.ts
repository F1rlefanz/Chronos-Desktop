import { LogLevel, LogSink } from './types';

export type { LogLevel, LogSink } from './types';

let sink: LogSink | null = null;

/**
 * Writes are chained rather than fired off in parallel.
 *
 * Two concurrent appends finish in whichever order the filesystem grants, which
 * produces a log whose lines are not in the order they happened — and a log you
 * have to re-sort before reading is a log you stop trusting. The timestamp is
 * taken when the call is made, not when the write lands.
 */
let pendingWrites: Promise<void> = Promise.resolve();

/** Installed by `main.tsx` for the desktop build; the browser has none. */
export function setLogSink(next: LogSink | null): void {
  sink = next;
  pendingWrites = Promise.resolve();
}

/** Resolves once every line logged so far has been written. */
export function flushLogs(): Promise<void> {
  return pendingWrites;
}

export function loggingToFile(): boolean {
  return sink !== null;
}

/** Shows the log folder. Does nothing when logs only go to the console. */
export async function revealLogs(): Promise<void> {
  await sink?.reveal();
}

/**
 * Renders one detail argument as text.
 *
 * Errors are the common case and the one `String(value)` handles worst — a
 * bare `[object Object]` in a log is exactly the line you end up staring at
 * when something has gone wrong.
 */
function describe(detail: unknown): string {
  if (detail instanceof Error) {
    return detail.stack ?? `${detail.name}: ${detail.message}`;
  }
  if (typeof detail === 'string') return detail;

  try {
    return JSON.stringify(detail) ?? String(detail);
  } catch {
    // Circular structures and the like.
    return String(detail);
  }
}

export function formatLine(level: LogLevel, parts: unknown[], at: Date): string {
  const message = parts.map(describe).join(' ');
  return `${at.toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
}

function emit(level: LogLevel, parts: unknown[]): void {
  const toConsole =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  toConsole(...parts);

  if (!sink) return;

  const line = formatLine(level, parts, new Date());
  const target = sink;

  // Failures are swallowed: a logger that can break the app it is meant to
  // diagnose is worse than no logger.
  pendingWrites = pendingWrites.then(() => target.write(line)).catch(() => {});
}

export function logInfo(...parts: unknown[]): void {
  emit('info', parts);
}

export function logWarn(...parts: unknown[]): void {
  emit('warn', parts);
}

export function logError(...parts: unknown[]): void {
  emit('error', parts);
}
