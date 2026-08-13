/**
 * The seam between the app and wherever its data actually lives.
 *
 * The web build writes to `localStorage`; the desktop build will write to the
 * filesystem. Adapters deal in strings, not objects, so that JSON encoding and
 * the corrupt-data fallback stay in one place (`./index.ts`) instead of being
 * reimplemented — and diverging — per backend.
 */

export type WriteFailureReason =
  /** The backend is out of room (localStorage quota, disk full). */
  | 'quota'
  /** There is no backend to write to (storage disabled, no permission). */
  | 'unavailable'
  /** The write was attempted and rejected for some other reason. */
  | 'io';

/**
 * Writes report failure as a value rather than throwing: a rejected write is an
 * expected outcome the UI has to show, not an exception. `message` is written to
 * be read by a user — it ends up in the persistence banner.
 */
export type WriteResult = { ok: true } | { ok: false; reason: WriteFailureReason; message: string };

export interface StorageAdapter {
  /** Identifies the backend in log output. */
  readonly name: string;
  /** Resolves to `null` when the key was never written or cannot be read. */
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<WriteResult>;
}
