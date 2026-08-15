/**
 * How this build learns that a newer one exists, and how it installs it.
 *
 * Two mechanisms, one seam — the same shape the sync transports have, and for
 * the same reason. A desktop install is replaced in place by Tauri's updater;
 * a phone cannot be, because Android reserves installing packages to the
 * system, so there the app downloads an APK and hands it over. Nothing above
 * this interface knows which of the two it got.
 *
 * The browser build has neither and is given none: a web page is already the
 * newest version of itself.
 */
export interface AvailableUpdate {
  /** The version on offer, as it appears in `package.json` — `1.1.0`. */
  version: string;
  /**
   * What changed, in the words of `CHANGELOG.md`.
   *
   * Markdown as written in that file rather than something rendered: the notes
   * are read out of the release, which is generated from the changelog
   * section, so there is exactly one text and no second copy to keep true.
   */
  notes: string;
  /** Installs it. Resolves when the app is about to be replaced or restarted. */
  install: (onProgress?: (fraction: number | null) => void) => Promise<void>;
}

export interface UpdateChannel {
  /**
   * Looks for a newer version. `null` means this one is current.
   *
   * Never throws for the ordinary failures — no network, an unreachable
   * release — because an update check is not something the user asked for and
   * must not interrupt them. It reports those through the logger and answers
   * `null`, which is also what "nothing to do" looks like.
   */
  check: () => Promise<AvailableUpdate | null>;
}
