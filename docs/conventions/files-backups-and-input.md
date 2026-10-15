# Files, logging, backups and untrusted input

Moved out of `CLAUDE.md` verbatim. Read before touching logging, generated files, backups, IPC commands or imports.

## Log through `src/utils/logging/logger.ts`, not `console.*` directly

- **Log through `src/utils/logging/logger.ts`, not `console.*` directly.** The console does not
  exist in a shipped desktop build, so a bare `console.warn` about a failed save reaches nobody.
  `logInfo/logWarn/logError` write to the console _and_, on the desktop, to a log file. Anything
  worth a `console.warn` is worth a log line; anything the user is expected to act on needs the
  persistence banner as well, because nobody reads a log they have not been told about.

## A generated file goes through `src/utils/fileTarget.ts`, never through a download link

- **A generated file goes through `src/utils/fileTarget.ts`, never through a download link.** The
  `<a download>` click a browser understands is ignored by the Tauri WebView, so every export
  button did nothing at all on the desktop until 0.5.0 — and nothing said so, because the click
  itself does not fail. `deliverFile` is the one place that knows which build it is in: the browser
  downloads, the desktop writes into `exports/` and opens the folder. Calling `doc.save()` or
  building a link in an exporter brings the bug straight back.

## A snapshot is taken at both ends of a session

- **A snapshot is taken at both ends of a session.** `ensureDailyBackup` runs at startup over the
  state found on disk; `useBackupOnClose` runs as the window closes, over the state the session
  produced. Without the second one a whole day of work sits in no snapshot until the next launch.
  Closing is intercepted to write it, which is why `core:window:allow-destroy` is in the capability
  list — the app has to close the window itself afterwards, and the first build silently refused to
  close without it.

## A backup must be taken before the thing it protects against

- **A backup must be taken before the thing it protects against.** `backupBefore` in `src/App.tsx`
  runs ahead of clearing the history and ahead of an import, over the state that is about to be
  replaced — a snapshot of the already-cleared state is worthless. When the snapshot fails it asks
  rather than proceeding quietly, because that is the one moment where knowing there is no safety
  net can change the user's decision. Snapshots use `buildBackupPayload`, the same shape the JSON
  import reads, so there is no second restore path to keep correct.

## Anything crossing the IPC boundary is input

- **Anything crossing the IPC boundary is input.** The commands in `src-tauri/src/lib.rs` validate
  their arguments even though the only caller is our own front end — an unvalidated storage key
  turns a save into an arbitrary file write. Writes go through a temporary file and a rename;
  do not "simplify" that into a direct `fs::write`, which can truncate the only copy of the data.
  A log line is input too, and `one_line` is where that is dealt with: an entry title travels into
  it, and a newline in one forges a line that reads as the app's own. Nothing is executed — the
  damage is that a reader can no longer tell which lines Chronos wrote.

## Imported JSON is untrusted

- **Imported JSON is untrusted.** Anything read from a file goes through the normalizers in
  `src/utils/dataExporter.ts` before it reaches state — it is persisted immediately, so a bad
  record survives reloads.
