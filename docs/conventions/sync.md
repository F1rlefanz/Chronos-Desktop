# Sync between devices

Moved out of `CLAUDE.md` verbatim. Read before touching the merge, the shared folder, the Android folder plugin, the network transport or when a sync runs.

## A merge may add and update on its own; it may not delete on its own

- **A merge may add and update on its own; it may not delete on its own.** Every other outcome of
  an exchange gives the user something, and only this one takes recorded time away — reporting it
  afterwards, as "11 gelöscht" once they were gone, is telling someone what they lost rather than
  asking. `adopt` in `src/App.tsx` merges into a preview first, and if anything would go it
  suspends on a promise that `DeletionPrompt` settles. Three things make that work and are easy to
  break: the question is asked with `entriesLostBy`, **not** `summary.deleted` — that count
  includes deletions for entries only the other device still had, and confirming the loss of
  records you have never seen is how a warning trains people to dismiss it; declining cancels the
  whole exchange, because keeping the entries would mean either dropping tombstones the other
  device re-sends anyway or stamping `updatedAt` on records nobody touched, and this app derives
  everything from those timestamps; and the state is merged **again** afterwards, since a person
  reading a dialog takes long enough for a measurement to end behind it. Anything that calls
  `adopt` in a loop needs an in-flight guard — `LanSyncModal` polls every second, and without one
  the second merge orphans the first one's question.

## The shared folder holds one file per device, and that is the whole conflict story

- **The shared folder holds one file per device, and that is the whole conflict story.** Two
  devices never write the same file, so the sync client behind the folder cannot produce a
  conflicting copy Chronos would have to resolve; reading merges every foreign file in any order,
  which is safe only because `mergeEntries` is idempotent and symmetric. The device id lives under
  its own storage key, never in `AppSettings`: settings travel in a backup, and an import that gave
  this machine another one's id would make two devices write one file. `syncFolder` is a setting,
  but `handleImportData` keeps the local one for the same reason — a path from another machine
  points nowhere here. Only finished entries are shared; a running measurement belongs to the
  device it runs on, or two devices show the same stopwatch and neither knows when work ended.

## Exactly one command takes a path from the front end

- **Exactly one command takes a path from the front end.** `sync_configure` validates it and keeps
  it; `sync_list`/`sync_read`/`sync_write` name a file that is resolved against that and nothing
  else. Every other command in `src-tauri/src/lib.rs` builds its own path and only validates a key
  or a file name — do not add a second command that accepts a directory. `ChronosSafPlugin` on
  Android follows the same shape with `configure` and its `roots` map.

## Android reaches a folder through `src-tauri/plugins/chronos-saf/`, not through `std::fs`

- **Android reaches a folder through `src-tauri/plugins/chronos-saf/`, not through `std::fs`.**
  There is no path to be had: the picker grants a permission on a document tree and everything
  inside goes through a content provider. The plugin is a workspace member and an Android-only
  dependency, so a desktop build compiles none of it while `cargo clippy --workspace` still lints
  its desktop half. Two things there are not like a filesystem and must stay commented as such:
  SAF cannot replace a file in one move (write to `…-part.json`, delete, rename — and the
  temporary name keeps the real extension, or the provider appends one), and a grant can be
  withdrawn between two calls, which is why `configure` runs before every operation rather than
  once. Registering a new command means adding it in four places: `build.rs`, `commands.rs`,
  `mobile.rs`/`desktop.rs`, and `permissions/default.toml`.

## No file operation in that plugin runs on the thread it arrived on

- **No file operation in that plugin runs on the thread it arrived on.** Everything goes through
  `background()` onto one worker. A content provider is not a disk — answering can mean waiting on
  another app, and on a cloud provider on a network — and a folder deleted underneath the app froze
  the interface for seven seconds before this existed. Only `pickFolder` and the `startActivity` in
  `openDocument` stay on the main thread, because that is where a launcher belongs.

## A phone's own files need a folder before anyone can reach them

- **A phone's own files need a folder before anyone can reach them.** `deviceFilesFolder` is where
  exports and backups go on Android; with it empty they stay in app-private storage exactly as
  before, and `androidFileSink`/`androidBackupSupport` wrap the app-private originals rather than
  replacing them. A snapshot is never dropped because a folder went away — it falls back. The
  twenty-snapshot limit is written twice on purpose (Rust for the desktop, `androidFiles.ts` for
  the phone), because the Rust side cannot open that folder at all.

## There are two transports and exactly one merge

- **There are two transports and exactly one merge.** A folder and a direct network connection
  differ in how records arrive and in nothing about what happens to them: both build the same
  payload, both take a backup before adopting anything foreign, both go through `adopt` in
  `src/App.tsx`, which merges against `liveRef` and persists. A second copy of that sequence is how
  the two transports start disagreeing about what a sync means. `lan.rs` is reachable from a test
  without Tauri's state — `answer` and `lan_exchange` are plain functions — so a change to the
  framing does not need two devices and a WiFi to check.

## The network listener lives exactly as long as its dialog

- **The network listener lives exactly as long as its dialog.** Opening starts it, closing stops it,
  and nothing on the machine is reachable while nobody is looking. Do not "improve" this into a
  background service — the whole safety argument is that it is not one. Six digits are not a
  password, and what makes them a barrier is not their length but `MAX_REFUSALS`: answering a wrong
  code forever turns a million possibilities into a few minutes of guessing for a machine on the
  same WiFi, and a guessed code hands over every recorded hour. The tenth refusal closes the
  listener, so a further guess costs a person walking over and reopening the dialog. It is not
  silent about it — `lan_received` answers with `Incoming { payload, exhausted }` so the dialog can
  take the address off the screen; a listener that gave up otherwise looks exactly like a quiet one.

## Syncing happens at the two moments something is already written, and on request

- **Syncing happens at the two moments something is already written, and on request.** Startup and
  window close, next to `ensureDailyBackup` and `useBackupOnClose`, plus the button. No timer and
  no file watcher: both write into a user's folder at moments nobody asked for. Closing only
  _pushes_ — a merge as the app disappears changes data nobody can see, and the incoming half is
  worthless with no UI left to show it.

## A sync applies its result against the state as it is when the answer arrives

- **A sync applies its result against the state as it is when the answer arrives**, not against the
  copy it started from (`liveRef` in `src/App.tsx`). A sync is not instant, and an entry created
  while it ran must not be dropped by the reply; the second merge is free because merging twice
  changes nothing.
