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

/**
 * Rotating snapshots kept beside the live data.
 *
 * Optional on purpose: the browser backend has no room for a second copy — the
 * quota that raises the persistence banner is the same one backups would eat —
 * so `localStorage` simply does not offer this, and the UI hides what it cannot
 * do rather than pretending the app is protected when it is not.
 */
export interface BackupSupport {
  /** Existing backup file names, oldest first. */
  list(): Promise<string[]>;
  /** Writes one snapshot and prunes the oldest beyond the retention limit. */
  write(name: string, contents: string): Promise<WriteResult>;
  /** Shows the folder to the user in their file manager. */
  reveal(): Promise<void>;
}

/**
 * Reading reports failure as a value, for the same reason writing does — and
 * for one more.
 *
 * A backend that cannot answer is not a key that was never written, and the two
 * used to arrive as the same `null`. That is how a single unreadable settings
 * file turned into a silent, permanent reset: the startup migration saw
 * "nothing stored", wrote the defaults back over it, and nobody was told. `ok:
 * true` with `value: null` means the key genuinely is not there; `ok: false`
 * means we do not know what is there and must touch nothing.
 */
export type ReadResult = { ok: true; value: string | null } | { ok: false; message: string };

export interface StorageAdapter {
  /** Identifies the backend in log output. */
  readonly name: string;
  read(key: string): Promise<ReadResult>;
  write(key: string, value: string): Promise<WriteResult>;
  /** Absent when the backend cannot keep snapshots. */
  readonly backups?: BackupSupport;
}
