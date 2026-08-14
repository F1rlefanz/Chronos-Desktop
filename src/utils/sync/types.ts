/**
 * The seam between syncing and the folder it happens in.
 *
 * Only the desktop build installs one. A browser tab cannot read a folder at
 * all, and on Android an arbitrary folder is not writable — so there, the
 * transport is simply absent and the settings hide what cannot work, rather
 * than offering a switch that fails when it is used.
 *
 * The folder itself is set once, through `configure`, and every later call
 * names only a file inside it. That is deliberate: it leaves exactly one place
 * where a path crosses into the Rust side, and everything after it is confined
 * to the folder the user picked.
 */
export interface SyncTransport {
  /** Points the transport at a folder, and fails if it cannot be used. */
  configure(folder: string): Promise<void>;
  /** File names directly in the folder. */
  list(): Promise<string[]>;
  /** `null` when the file is not there — a device that has not written yet. */
  read(name: string): Promise<string | null>;
  write(name: string, contents: string): Promise<void>;
  /** Opens the system's folder picker; `null` when the user cancels. */
  pickFolder(): Promise<string | null>;
}
