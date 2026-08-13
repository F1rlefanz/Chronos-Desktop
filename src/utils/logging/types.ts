export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Where log lines go beyond the console.
 *
 * The console is invisible in a shipped desktop build — there are no devtools
 * to open — so everything the app knows about a failure would otherwise be
 * written to nobody. Only the desktop build has a sink; in the browser the
 * console is genuinely reachable and a second copy would be noise.
 */
export interface LogSink {
  write(line: string): Promise<void>;
  /** Shows the folder holding the log files. */
  reveal(): Promise<void>;
}
