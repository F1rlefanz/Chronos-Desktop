# Working in this repository

## Commands

Bun is the package manager (`bun.lock` is the committed lockfile). npm works, but do not commit
a `package-lock.json` alongside it.

```bash
bun install
bun run typecheck   # tsc --noEmit, strict
bun run lint        # ESLint
bun run test        # Vitest
bun run build       # production build
```

Before pushing, all four should pass — that is exactly what CI runs, plus `format:check`.

The same code also ships as an app, on the desktop and on Android:

```bash
bun run desktop:dev     # Tauri window; starts the dev server itself
bun run desktop:build   # installer for the system you are on
bun run android:dev     # on a connected device or a running emulator
bun run android:build   # signed APK

cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings
```

`--workspace` matters: the Android plugin under `src-tauri/plugins/` is a member but not a
dependency on the desktop, so without it a broken plugin lints clean. Touching `src-tauri/` means
running those two cargo commands as well. `release.yml` runs them on
all three desktop systems, but only on a tag or a manual dispatch, so a broken Rust side does not
show up in a pull request.

**Android needs `JAVA_HOME` on a JDK that Gradle can read.** Android Studio ships its own Java 25,
and if `JAVA_HOME` points there the build dies with `Unsupported class file major version 69` —
before compiling a line. JDK 21 works. Signing details live in `src-tauri/gen/android/
keystore.properties`, which is ignored by git: the key and its passwords are credentials, and
without them a release APK cannot be installed by anyone.

## The changelog is part of the work, not paperwork

**Every change a user would notice gets an entry in `CHANGELOG.md`, in the same pull request as
the change itself.** Not afterwards, not at release time — reconstructing it later from `git log`
is how it silently stops matching reality.

That file is written for people who _use_ Chronos. It is not a second copy of the commit history,
and the difference is the whole point: git records every step, a changelog records what someone
would notice. The `StorageAdapter` refactor is the yardstick — a large body of work in the commit
log, one line in `CHANGELOG.md`, because "the warning now says why" is all a user ever saw of it.

| Belongs in `CHANGELOG.md`                     | Belongs only in the commit history        |
| --------------------------------------------- | ----------------------------------------- |
| New or changed features, new UI               | Refactors with no visible effect          |
| Fixed behaviour someone could have run into   | Tests, CI, tooling, dependency bumps      |
| Moved files or folders a user's data lives in | Internal renames and file moves in `src/` |
| Anything changing what the app does or where  | Comments, formatting, documentation       |

Rules of the form: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer, newest
version first, `Added` / `Changed` / `Fixed`, plain language, no jargon and no file paths the user
has no reason to know. Bump the version in `package.json` when a release goes out — that is the
only place a version number is written (see below).

If a change turns out to be invisible to users, that is a fine answer: leave the file alone and
say so in the pull request, rather than padding it with an entry nobody benefits from.

## Conventions

- **TypeScript is strict.** No `any`. If a browser API needs a feature-detect, write a narrow
  local type rather than casting through `any` (see `getAudioContext` in `src/App.tsx`).
- **Prettier owns formatting.** Do not hand-format; run `bun run format`. ESLint has
  `eslint-config-prettier` last, so it will not argue about style.
- **Do not add dependencies without a clear need.** Half of this project's original dependency
  list was never imported and had to be removed. Prefer the platform.
- **There is exactly one Vite, pinned by `overrides` in `package.json`.** Vitest resolves its own
  copy otherwise, and two copies mean two incompatible sets of Vite types: `vite.config.ts` takes
  `defineConfig` from `vitest/config` but the plugins from the top-level Vite, so `tsc` rejects a
  config that builds and tests perfectly well. Two traps come with it — bun keeps the old
  resolution until `bun install --force`, and `@vitejs/plugin-react` imports `vite/internal`, so it
  and Vite can only be bumped together.
- **A setting must have a writer, not only a reader.** `defaultProject` was read from the first
  version and set by nothing, so it stayed on its generated value forever — the same dead switch as
  a setting nobody reads, just from the other side. When adding a field to `AppSettings`, wire up
  both ends.
- **A setting must have a reader.** Adding a field to `AppSettings` without wiring it up recreates
  the dead-switch problem that `theme`, `timeFormat` and `autoSaveSession` used to be. If you
  remove a field, extend `migrateSettings` in `src/utils/storage/index.ts` so old stored states are
  cleaned up. The same holds for `STORAGE_KEYS`: a key nothing reads is dead weight.
- **Persistence goes through the adapter, never through `localStorage` directly.** The web and
  desktop builds share `src/utils/storage/index.ts`; only an adapter under `src/utils/storage/`
  may touch a concrete backend, and `main.tsx` is the only place that picks one. Writes return a
  `WriteResult` (`{ ok: true } | { ok: false; reason; message }`) instead of throwing, because a
  rejected write is an expected outcome the UI has to show — `persist()` in `src/App.tsx` turns it
  into a banner. Adapters deal in strings so that JSON encoding and the corrupt-data fallback live
  in one place.
- **Reading reports failure the same way, and for one reason more.** `read` returns a `ReadResult`
  (`{ ok: true; value: string | null } | { ok: false; message }`), because "the key is not there"
  and "the backend could not answer" are different facts and used to arrive as the same `null`.
  That conflation was a data-loss bug, not an inelegance: `loadPersistedState` saw "nothing
  stored", wrote its defaults back over settings it had merely failed to open, and said nothing.
  A start that cannot read now writes **nothing** and reports what it could not read through
  `PersistedState.unreadable`, which `src/App.tsx` turns into a banner that cannot be dismissed —
  the screen is not the truth, and the next thing recorded would overwrite the truth.
- **Two devices can only be reconciled because every entry says when it changed.** `updatedAt` is
  stamped where entries are created and edited; `patchRunningEntry` is the single place every
  change to a running measurement passes through, which is what keeps a new handler from silently
  forgetting. Deleting writes a tombstone under its own storage key — without one, "deleted here"
  and "never seen here" are indistinguishable and a merge resurrects everything ever deleted. The
  rule itself is `src/domain/merge.ts`, a pure function over two sets, and its two load-bearing
  tests are that merging gives the same answer whichever side asks and that running it twice
  changes nothing.
- **The shared folder holds one file per device, and that is the whole conflict story.** Two
  devices never write the same file, so the sync client behind the folder cannot produce a
  conflicting copy Chronos would have to resolve; reading merges every foreign file in any order,
  which is safe only because `mergeEntries` is idempotent and symmetric. The device id lives under
  its own storage key, never in `AppSettings`: settings travel in a backup, and an import that gave
  this machine another one's id would make two devices write one file. `syncFolder` is a setting,
  but `handleImportData` keeps the local one for the same reason — a path from another machine
  points nowhere here. Only finished entries are shared; a running measurement belongs to the
  device it runs on, or two devices show the same stopwatch and neither knows when work ended.
- **Exactly one command takes a path from the front end.** `sync_configure` validates it and keeps
  it; `sync_list`/`sync_read`/`sync_write` name a file that is resolved against that and nothing
  else. Every other command in `src-tauri/src/lib.rs` builds its own path and only validates a key
  or a file name — do not add a second command that accepts a directory. `ChronosSafPlugin` on
  Android follows the same shape with `configure` and its `roots` map.
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
- **No file operation in that plugin runs on the thread it arrived on.** Everything goes through
  `background()` onto one worker. A content provider is not a disk — answering can mean waiting on
  another app, and on a cloud provider on a network — and a folder deleted underneath the app froze
  the interface for seven seconds before this existed. Only `pickFolder` and the `startActivity` in
  `openDocument` stay on the main thread, because that is where a launcher belongs.
- **A phone's own files need a folder before anyone can reach them.** `deviceFilesFolder` is where
  exports and backups go on Android; with it empty they stay in app-private storage exactly as
  before, and `androidFileSink`/`androidBackupSupport` wrap the app-private originals rather than
  replacing them. A snapshot is never dropped because a folder went away — it falls back. The
  twenty-snapshot limit is written twice on purpose (Rust for the desktop, `androidFiles.ts` for
  the phone), because the Rust side cannot open that folder at all.
- **Syncing happens at the two moments something is already written, and on request.** Startup and
  window close, next to `ensureDailyBackup` and `useBackupOnClose`, plus the button. No timer and
  no file watcher: both write into a user's folder at moments nobody asked for. Closing only
  _pushes_ — a merge as the app disappears changes data nobody can see, and the incoming half is
  worthless with no UI left to show it.
- **A sync applies its result against the state as it is when the answer arrives**, not against the
  copy it started from (`liveRef` in `src/App.tsx`). A sync is not instant, and an entry created
  while it ran must not be dropped by the reply; the second merge is free because merging twice
  changes nothing.
- **`isMobilePlatform()` picks a backend in `main.tsx`, and hides doors that lead nowhere.** It may
  not decide anything about how data is kept: storage, backups, the log and the sync rules are
  identical everywhere, and only the way a folder is reached differs. A door is hidden by asking
  whether there is something behind it — `onRevealBackups` is absent when no folder has been
  chosen, not because this is a phone — and `reveal_folder` in Rust still refuses on Android as a
  second line of defence.
- **A phone draws the webview edge to edge.** `index.html` carries `viewport-fit=cover` and the
  header and footer pad themselves with `env(safe-area-inset-*)`; without both, the status bar sits
  on top of the tab bar. A row of label-plus-control needs a stacked fallback below `sm`, or the
  description text wraps around the control and interleaves with it.
- **A phone is narrower than the emulator, and a row that cannot fit must wrap, not overflow.** The
  emulator reports 360 CSS px; a Fairphone 6 reports **320** (1116 physical pixels at density 558),
  and at that width the header ran its two right-hand buttons off the screen — including the one
  that opens the settings, which is to say the whole app was unreachable from there. It had been
  like that since Android shipped, and no test could have seen it: jsdom does not lay anything out.
  Any row of fixed-size controls gets `flex-wrap` so the worst case is a second line, never a
  missing button — and check a change at 320 px, not at the emulator's 360.
- **Log through `src/utils/logging/logger.ts`, not `console.*` directly.** The console does not
  exist in a shipped desktop build, so a bare `console.warn` about a failed save reaches nobody.
  `logInfo/logWarn/logError` write to the console _and_, on the desktop, to a log file. Anything
  worth a `console.warn` is worth a log line; anything the user is expected to act on needs the
  persistence banner as well, because nobody reads a log they have not been told about.
- **A generated file goes through `src/utils/fileTarget.ts`, never through a download link.** The
  `<a download>` click a browser understands is ignored by the Tauri WebView, so every export
  button did nothing at all on the desktop until 0.5.0 — and nothing said so, because the click
  itself does not fail. `deliverFile` is the one place that knows which build it is in: the browser
  downloads, the desktop writes into `exports/` and opens the folder. Calling `doc.save()` or
  building a link in an exporter brings the bug straight back.
- **A snapshot is taken at both ends of a session.** `ensureDailyBackup` runs at startup over the
  state found on disk; `useBackupOnClose` runs as the window closes, over the state the session
  produced. Without the second one a whole day of work sits in no snapshot until the next launch.
  Closing is intercepted to write it, which is why `core:window:allow-destroy` is in the capability
  list — the app has to close the window itself afterwards, and the first build silently refused to
  close without it.
- **A backup must be taken before the thing it protects against.** `backupBefore` in `src/App.tsx`
  runs ahead of clearing the history and ahead of an import, over the state that is about to be
  replaced — a snapshot of the already-cleared state is worthless. When the snapshot fails it asks
  rather than proceeding quietly, because that is the one moment where knowing there is no safety
  net can change the user's decision. Snapshots use `buildBackupPayload`, the same shape the JSON
  import reads, so there is no second restore path to keep correct.
- **Anything crossing the IPC boundary is input.** The commands in `src-tauri/src/lib.rs` validate
  their arguments even though the only caller is our own front end — an unvalidated storage key
  turns a save into an arbitrary file write. Writes go through a temporary file and a rename;
  do not "simplify" that into a direct `fs::write`, which can truncate the only copy of the data.
- **Imported JSON is untrusted.** Anything read from a file goes through the normalizers in
  `src/utils/dataExporter.ts` before it reaches state — it is persisted immediately, so a bad
  record survives reloads.
- **The version lives in `package.json` and nowhere else.** `tauri.conf.json` points at it, Vite
  stamps it into `__APP_VERSION__` for the header badge, and `src-tauri/Cargo.toml` is pinned to
  `0.0.0` because Cargo demands a value but Tauri ignores it. Bumping a release means editing one
  line. The badge used to be a hardcoded `v1.2.0` that had drifted three minor versions from the
  real number — do not reintroduce a second copy.
- **A duration is derived, never stored.** A `TimeEntry` records `startTime`, `endTime` (`null`
  while it runs) and `breaks`; every length comes from `src/domain/timeEntry.ts`. Do not add a
  `durationMs` field back. The old model stored one next to the timestamps, filled from an
  animation-frame accumulator that stopped advancing while the window was minimised, so the same
  entry carried two disagreeing answers and the JSON import had to guess between them.
- **Frames set the repaint rate; the wall clock sets the number.** `useLiveDuration` runs a
  `requestAnimationFrame` loop because a `setInterval` stutters against the refresh rate — but it
  reads `Date.now()` each time rather than accumulating frame deltas, which are not a measure of
  elapsed time. `intervalMs` throttles the state push only. Anything that needs a shared "now"
  across a render takes it from `useNow`, never by calling `Date.now()` during render.
- **A setting must have a reader** — and so must an entry field. `migrateEntries` in
  `src/utils/storage/index.ts` is the counterpart to `migrateSettings`: stored entries were written
  by older builds and go through the same normaliser as an imported file, so a shape change needs a
  conversion there and a test against a real old record.

## Tests

Vitest + jsdom + Testing Library, files as `*.test.ts(x)` next to the code they cover. When
fixing a bug, add the test that fails without the fix — the export and lap-badge tests exist for
exactly that reason.

For hook tests, mock `performance.now` and `requestAnimationFrame` and pump frames manually; see
`src/hooks/useStopwatch.test.ts`. Real timers make those assertions flaky.

## Git

- Branch off `main`, one topic per pull request.
- Conventional commit prefixes (`fix:`, `feat:`, `chore:`, `test:`, `refactor:`, `ci:`).
- Keep pure reformatting in its own commit so it does not bury reviewable changes.
