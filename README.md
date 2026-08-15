# Chronos Desktop

A time tracker with a stopwatch in it. An entry records when work happened — a start, an end and
the breaks between them — and every duration is derived from that, never stored alongside it.
Entries can be typed in by hand as readily as measured, corrected afterwards, and exported for a
named month as PDF, CSV or a portable JSON backup.

The interface is in German; the code is in English.

It ships as an app for **Windows, macOS, Linux and Android**, built with Tauri from one codebase,
and the same code still runs as a plain web app in the browser. iOS is not built — see
[Platforms](#platforms). There is no backend and no account: everything lives on the machine it
was recorded on. Two devices — a phone included — can nonetheless be kept in step, either through a
folder the user already syncs by other means ([one folder](#two-devices-one-folder)) or directly
over the local network ([no folder](#two-devices-no-folder)). Installed copies keep themselves up to
date from the GitHub releases, see [Updating itself](#updating-itself).

Persistence sits behind a `StorageAdapter` interface, chosen at startup:

| Build   | Backend                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- |
| Desktop | `%LOCALAPPDATA%\Chronos\data\*.json`, written by Rust, with rotating snapshots in `..\backups\` |
| Browser | `localStorage`, no snapshots — the quota has no room for a second copy                          |

Nothing above that interface knows which one is in use.

## Features

The window has two views: **Erfassen**, with the stopwatch and the entries, and **Auswertung**,
with the totals, the calendar and the charts.

- Stopwatch with start / pause / resume / stop, its controls in the card that shows the time. A
  running measurement is written to disk as it starts, so closing the window does not lose it — the
  next launch asks whether to continue it, stop it, or correct its times.
- Entries can also be typed in from scratch, and any entry can be edited: start, end, breaks,
  title, project, tags and notes. Start and end each carry their own date, so an entry that runs
  past midnight is ordinary rather than impossible.
- Breaks are recorded as individual periods with their own start and end, and are editable.
- Totals for today, the week, the month, the year and overall; a month calendar shaded by daily
  total; charts by week, weekday and month.
- Searchable history filtered by project, with a running total.
- Exports: PDF and CSV for a chosen period — a specific month or year, a free from–to range, or
  everything — plus a JSON backup for moving between machines. A measurement still running is left
  out and reported, so the same report is reproducible.
- Keyboard shortcuts: `Space` start/pause, `S` stop, `R` discard. Modified combinations such as
  `Cmd/Ctrl+R` are left to the browser.
- Configurable display refresh rate, which changes how often the readout is redrawn and not what
  is recorded.
- Automatic backups (app builds only): a snapshot at startup (at most once a day), one when the
  window closes, and one immediately before clearing the history or importing a file. The last
  twenty are kept. All of them happen while the app runs, which is also the only time the data can change.
- A log file (desktop only) recording startup, backup outcomes, exports and every failed save. The
  backup and log folders open from the Settings dialog; the export folder opens by itself after an
  export.
- Syncing between two devices, either through a folder they both see or directly over the local
  network — see below.
- One layout from a 320-pixel phone to a 55-inch television: the content area widens in steps, the
  stopwatch and the history sit side by side from tablet width up, and above 1600 pixels the whole
  scale grows with the screen rather than staying laptop-sized in the middle of it.

What changed between versions is in [CHANGELOG.md](CHANGELOG.md).

## Two devices, one folder

Pick a folder in the Settings dialog that something else already keeps in step — OneDrive,
Syncthing, a network drive — and Chronos exchanges its records through it. There is no server, no
account and nothing to pay for; the transport is whatever the user already trusts with their files.

- **One file per device**, `chronos-<id>.json`, holding the finished entries and the record of what
  was deleted. Two devices never write the same file, so the sync client cannot produce a
  conflicting copy that would then have to be resolved. Reading is the opposite: every foreign file
  is merged in, in any order, because `mergeEntries` is idempotent and gives the same answer
  whichever side asks.
- The id is twelve random hex characters, generated once per installation. No device name, nothing
  about the person, and it is deliberately not kept in the settings — a backup restored onto a
  second machine would otherwise hand it the first one's identity.
- **Synced at startup, on closing the window, and on request.** No timer and no file watcher: both
  write into a user's folder at moments nobody asked for. Closing only _writes_ — merging as the
  app disappears would change data nobody can see.
- **A backup is taken before the first merge**, exactly as before clearing the history or importing.
- **Last write wins per entry**, deletions included. Two devices editing the same entry keep the
  newer edit; fields are never blended, because a half-merged entry is one nobody typed in.
- **A running measurement stays on its device.** What is shared is a record, not an action.
- **Android syncs through the same folder**, but reaches it differently — see below.

## Two devices, no folder

A folder is the patient transport: it works between devices that are never awake at the same time,
and it needs something else — OneDrive, Syncthing — to carry it. When both devices _are_ awake and
on the same WiFi, that is one program too many, so they can also simply talk to each other.

One side waits and shows an address and a six-digit code; the other types them and presses the
button. One round trip, both ends merge, done.

- **Everything below the surface is the folder's.** The same payload, the same `mergeEntries`, the
  same backup before anything foreign is adopted. Only the transport differs, which is the reason
  that seam exists at all.
- **No mDNS, no HTTP, no new dependency.** We own both ends, so the wire format is a greeting, a
  code, a length and a body over raw TCP — about 150 lines of `std::net`. Discovery would have cost
  a second implementation on Android, where multicast needs its own lock and its own API, to save
  typing twelve characters.
- **The same Rust runs on the desktop and on the phone.** No Kotlin and no new permission: `INTERNET`
  was already in the manifest.
- **Reachable only while the dialog is open**, only on the local network, and only to someone who
  read the code off the other screen. Closing the dialog stops the listener.
- **The honest limit:** both devices have to be on and in the same network at the same time. If that
  is not your situation, the folder is the answer.

## The phone, and the folders it cannot see

Android gives an app no path to a folder a user picked. The system picker hands back a _permission
on a document tree_ (`content://…/tree/…`) and everything inside it goes through a content
provider, so `std::fs` is of no use there. That is what `src-tauri/plugins/chronos-saf/` is: a
small Kotlin plugin speaking the Storage Access Framework, behind the same `SyncTransport`
interface the desktop implements with a path and a rename. Nothing above that interface knows
which of the two it got.

Two folders, because they are two different things:

| Setting             | What it is                                      | Chosen by         |
| ------------------- | ----------------------------------------------- | ----------------- |
| `syncFolder`        | shared with another device, one file per device | picker, or a path |
| `deviceFilesFolder` | this phone's own exports and backups (Android)  | picker            |

- **Nothing is lost by not choosing one.** With `deviceFilesFolder` empty, exports and backups go
  where they always did — into app-private storage, which is real but has no file manager leading
  to it. That was the whole problem: an export you could not have.
- **A snapshot never fails because a folder is gone.** If the grant was withdrawn or the folder
  deleted, the backup goes to app-private storage rather than being dropped.
- **SAF cannot replace a file in one move.** The plugin writes to `…-part.json`, deletes the old
  file and renames — the temporary name keeps the real extension, because a provider derives the
  extension from the MIME type and would otherwise leave `chronos-x.json.part.json` behind. No
  other device ever reads it: `isSyncFileName` accepts only a bare device id.
- **No permission in the manifest.** SAF needs none — that is its point over
  `MANAGE_EXTERNAL_STORAGE`, which asks for the whole device to reach one folder.

## Where the desktop app keeps things

```
%LOCALAPPDATA%\Chronos\           your data — nothing else writes here
  data\                           the live state: sessions, projects, settings
  backups\                        the last twenty snapshots
  logs\                           chronos.log, plus one rolled-over generation
  exports\                        generated PDF, CSV and JSON files

%LOCALAPPDATA%\Chronos Desktop\   the program, put there by the installer
```

The two are deliberately separate, so removing the program never removes the recordings — see
[Architecture](#architecture) for why that is worth a paragraph of its own.

The backup and log folders open from **Settings**, at the bottom of the dialog, and the export
folder opens itself once a file has been written there. Installing is
per-user and needs no administrator rights, an installer of a newer version updates the existing
installation rather than adding a second one, and uninstalling leaves `%LOCALAPPDATA%\Chronos`
untouched — deleting your recordings has to be something you do on purpose.

## Platforms

| Target  | Built by               | Notes                                                                                                        |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Windows | `release.yml` on a tag | NSIS installer and MSI                                                                                       |
| macOS   | `release.yml` on a tag | One universal binary for both chips                                                                          |
| Linux   | `release.yml` on a tag | AppImage, deb, rpm                                                                                           |
| Android | `release.yml` on a tag | A signed universal APK, attached to the release so a phone can update itself                                 |
| iOS     | **Not built**          | Xcode is macOS-only, and installing on a device needs an Apple Developer account. Neither is a code decision |
| Browser | `bun run build`        | No app to install, and no automatic backups — the quota has no room for a second copy                        |

### Updating itself

A tag is still the whole trigger. `release.yml` builds the installers, signs them, publishes them
and then writes two manifests into the release — and an installed copy of Chronos finds them by
itself, offers the update with the changelog section for that version, and installs it on a button
press.

**When it looks.** At startup, every six hours while it stays open, and when the window comes back
after an hour away — that last one because a sleeping laptop runs no timers, and the copy opened on
Monday would otherwise still believe what it learned on Friday. Nothing pushes to the app, and
nothing should: a server to push from is precisely what "no account, no server" rules out, so a
rhythm is the closest a release can get to a copy that is already running. Dismissing the banner
hides that version and only that one.

**Two mechanisms, because the platforms are not the same thing.**

|           | Desktop                             | Android                                                    |
| --------- | ----------------------------------- | ---------------------------------------------------------- |
| Fetches   | `latest.json`                       | `latest-android.json`                                      |
| Mechanism | `tauri-plugin-updater`              | `src-tauri/plugins/chronos-update/` — our own              |
| Ends with | files replaced, app restarts itself | Android's installer screen, which the user has to agree to |

Tauri's updater does not support Android — its documentation site shows a tick in the platform
table, but the plugin's own README says `Android: x` and its install instructions exclude mobile by
target. So the phone carries its own: a Kotlin plugin that downloads the APK and hands it to the
system installer. **It cannot be made silent, and should not be** — installing packages is
Android's to authorise, and an app that could install software unasked is a worse thing than a
manual tap.

**What makes it safe to fetch over plain HTTP.** The updater sends no credentials, which is why a
public release works as a feed at all — and therefore nothing about the transport says a bundle is
ours. The signature does: `tauri.conf.json` carries the public half of a keypair, the private half
exists only in the `TAURI_SIGNING_PRIVATE_KEY` secret and on its owner's machine, and a bundle
signed with anything else is refused before a byte of it runs. On Android the same job is done by
the APK signature, which is why CI signs with **the same key every earlier build used**: Android
refuses an update signed by a different one, and switching keys would mean uninstalling first —
taking the recorded time with it.

**Two things that follow from this and surprise people.** A copy installed before 0.6.0 has no
updater in it and never will; it has to be replaced by hand once. And losing the private key means
never being able to ship an update that existing installs accept — it is worth a backup somewhere
that is not one laptop.

iOS would update through the App Store, if it were built.

## Requirements

For the web build: Node.js 20 or newer. [Bun](https://bun.sh) 1.3+ is the project's package
manager — `bun.lock` is the committed lockfile — but npm works too.

For the desktop build, additionally:

- A [Rust](https://rustup.rs) toolchain (stable).
- Microsoft Visual Studio Build Tools with the C++ workload.
- WebView2, which is preinstalled on Windows 11 and current Windows 10.

For Android, additionally:

- The Android SDK and NDK, and the Rust targets: `rustup target add aarch64-linux-android
armv7-linux-androideabi i686-linux-android x86_64-linux-android`.
- `NDK_HOME` pointing at the installed NDK.
- **`JAVA_HOME` on a JDK Gradle can read.** Android Studio ships its own Java 25; pointed there,
  the build fails with `Unsupported class file major version 69` before compiling anything. JDK 21
  works.
- A signing key. `src-tauri/gen/android/keystore.properties` names the keystore and its passwords
  and is ignored by git — an unsigned APK cannot be installed by anyone.

## Setup

```bash
bun install          # or: npm install
bun run dev          # web app on http://localhost:3000
bun run desktop:dev  # desktop app; starts the dev server itself
```

## Scripts

| Script                  | What it does                                                             |
| ----------------------- | ------------------------------------------------------------------------ |
| `bun run dev`           | Vite dev server on port 3000                                             |
| `bun run build`         | Production build into `dist/`                                            |
| `bun run preview`       | Serve the production build locally                                       |
| `bun run desktop:dev`   | Tauri dev window over the dev server                                     |
| `bun run desktop:build` | Windows installer into `src-tauri/target/release/bundle/`                |
| `bun run typecheck`     | `tsc --noEmit` (strict)                                                  |
| `bun run lint`          | ESLint over the project                                                  |
| `bun run lint:fix`      | ESLint with autofix                                                      |
| `bun run format`        | Prettier, writing changes                                                |
| `bun run format:check`  | Prettier in check mode (what CI runs)                                    |
| `bun run test`          | Vitest, single run                                                       |
| `bun run test:watch`    | Vitest in watch mode                                                     |
| `bun run test:coverage` | Vitest with a coverage report                                            |
| `bun run clean`         | Remove `dist/` and `coverage/`                                           |
| `bun run clean:desktop` | Remove `src-tauri/target/` — gigabytes, but a cold rebuild takes minutes |

## Architecture

```
src/
  App.tsx              Root container: owns settings, entries and projects; modal orchestration
  domain/              Pure rules, no React and no persistence
    merge                Reconciling two devices' records: last write wins, deletions included
    timeEntry            Durations derived from start/end/breaks, plus entry validation
    stats                Totals, calendar grids and chart series, none of them cached
    exportRange          Calendar periods for exports, and which entries they select
  hooks/
    useLiveDuration      The running readout: frames set the repaint rate, the clock sets the value
    useNow               A shared "now" for anything that has to look live
  components/          Presentational components — header, display, controls, modals
  utils/
    timeFormatters     Pure ms → display/duration/date formatting
    storage/           Persistence behind an adapter interface
      types              StorageAdapter and the WriteResult a failed write returns
      localStorageAdapter  The browser backend (default)
      tauriAdapter         The desktop backend, over IPC to Rust
      memoryAdapter        In-memory backend used by the tests
      index                Domain layer: loadPersistedState, the save* functions,
                           settings migration, setStorageAdapter, the backup rules
    sync/              Exchanging records through a folder the user chose
      types                SyncTransport: configure once, then read and write by file name
      deviceId             The id this installation writes under, generated once
      payload              The file format, and reading a foreign one as untrusted input
      folderLabel          What to show for a folder Android only names as a URI
      tauriSyncTransport   The desktop transport, over IPC to Rust
      androidSyncTransport The phone's, over IPC to the Kotlin plugin
      index                runSync and pushToSyncFolder — which files to read, when to give up
    androidFiles       Exports and backups into a folder the phone's user picked
    logging/           Console plus, on the desktop, a log file
      logger             logInfo/logWarn/logError, level routing, write ordering
      tauriLogSink       Appends through IPC to logs/chronos.log
    platform           Whether this is a phone — used to hide doors, never to decide about data
    fileTarget         Where a generated export goes: download or written file
    tauriFileSink      Writes exports through IPC into exports/
    dataExporter       CSV and JSON export, and validated JSON import
    pdfExporter        jsPDF report generation
  constants/           Defaults, storage keys, time constants
  types/               Shared types

src-tauri/
  src/lib.rs           The storage_*, backup_*, sync_*, export_write, log_append
                       and reveal_folder commands
  src/main.rs          Desktop entry point over lib.rs
  plugins/chronos-saf/ Android-only plugin: one folder, read and written through
                       the Storage Access Framework (Kotlin), behind a thin Rust API
  tauri.conf.json      Window, bundle and CSP configuration
  capabilities/        Permission scopes granted to the window
```

Things worth knowing before changing code here:

- **A duration is derived, never stored.** An entry holds `startTime`, `endTime` (`null` while it
  runs) and `breaks`; every length comes from `domain/timeEntry`. An earlier version stored a
  `durationMs` beside the timestamps, filled from an animation-frame accumulator that stopped
  advancing while the window was minimised — so the two disagreed and the JSON import had to guess
  between them. Do not add the field back.
- **The running measurement is a stored entry.** Starting the stopwatch writes an entry with no
  end; pause and resume append and close a break; stop sets the end. The timer state is read back
  out of that entry rather than tracked beside it, which is why a crash cannot desynchronise the
  two — and why there is a recovery prompt at startup instead of silent resumption.
- **Frames set the repaint rate; the wall clock sets the number.** `useLiveDuration` runs a
  `requestAnimationFrame` loop, because `setInterval` stutters against the refresh rate, but reads
  `Date.now()` rather than accumulating frame deltas. `timerIntervalMs` throttles the state push
  only: changing it changes render frequency, never what is recorded.
- **A failed write has to be visible.** Storage is the only copy of the data, so when a write is
  rejected — a full quota, or storage disabled — the change is gone on the next reload. Writes
  return a `WriteResult` rather than throwing, and every save in `App.tsx` routes that result
  through `persist()`, which raises a banner carrying the backend's own explanation. Adding a new
  save means routing it the same way. `persist()` also ignores any result that is not from the
  most recent write, because writes are asynchronous now: a slow failure must not overwrite a
  later success. An `ErrorBoundary` around the app covers the other failure mode, so a render
  error shows a recovery screen rather than a white page.
- **State is read once, before the first render.** `main.tsx` awaits `loadPersistedState()` and
  passes the result into `App` as a prop, so the component tree itself stays synchronous — no
  loading state in every component, and no flash of defaults. A backend that cannot be read at
  all falls back to defaults rather than leaving a blank page.
- **Imported data is untrusted.** `dataExporter` normalizes every record from a JSON file before
  it reaches the app, because the import is persisted immediately — a malformed entry would
  otherwise break the app on every subsequent reload.
- **`console.*` is invisible in a shipped desktop build.** There are no devtools to open, so
  anything logged only to the console is written to nobody — which is why the app logs through
  `src/utils/logging/logger.ts` instead. On the desktop that also appends to
  `%LOCALAPPDATA%\Chronos\logs\chronos.log`, rolled over at a megabyte and kept one generation
  deep. Log writes are chained rather than concurrent, because a log whose lines are out of order
  is one you stop trusting, and failures are swallowed: a logger that can break the code it is
  meant to diagnose is worse than no logger.
- **A desktop build cannot hand the user a file the way a browser can.** The `<a download>` click
  the web build relies on is ignored by the WebView, which is why every export button silently did
  nothing until 0.5.0. `src/utils/fileTarget.ts` is the single place that knows the difference:
  the browser gets its download, the desktop writes the file and opens the folder. An exporter that
  calls `doc.save()` or builds its own link has reintroduced the bug.
- **A backup is just an export file.** Snapshots are written in the exact shape
  `importFromJsonFile` reads, so restoring one goes through the import the app already has instead
  of a second restore path with its own bugs. `buildBackupPayload` in `dataExporter.ts` is shared
  by both. The Settings dialog only opens the folder; the user picks the file.
- **There is one version number.** `package.json` holds it; `tauri.conf.json` reads it via
  `"version": "../package.json"`, and Vite stamps it into `__APP_VERSION__` for the badge in the
  header. `src-tauri/Cargo.toml` sits at `0.0.0` on purpose — Cargo needs a value there, Tauri
  ignores it.
- **The desktop write is atomic.** `storage_write` in `src-tauri/src/lib.rs` writes a temporary
  file, syncs it and renames it into place, so a crash mid-write leaves either the old file or the
  new one, never a truncated one. The command also validates the storage key rather than trusting
  it: values crossing the IPC boundary are input, and a key containing `..` would otherwise let
  the front end write anywhere on disk. `reveal_folder` follows the same rule: it takes the name
  `backups` or `logs`, never a path.
- **User data lives outside the installation folder.** The installer puts the program in
  `%LOCALAPPDATA%\Chronos Desktop`, so the data folder is `%LOCALAPPDATA%\Chronos` — one folder
  over, not inside it. Naming it after the product would have dropped recordings into the
  application directory, where anyone uninstalling by deleting the folder takes their data with
  them. It is not named after the bundle identifier either, so the identifier stays free to change
  without orphaning anything.

## Testing

```bash
bun run test
```

Vitest with jsdom and Testing Library. The suite covers the time formatters, the stopwatch state
machine (over a controlled clock with hand-pumped animation frames), the settings migration, all
three storage adapters, the backup rules, the logger and the export/import layer — including
regression tests for previously fixed bugs. Coverage is reported but no threshold is enforced.

The Rust side has no unit tests. It is verified by building the installer and exercising the app,
which is not a formality: the collision between the data folder and the installation folder was
found that way and by nothing else. What a release should cover, beyond the suite:

- Install, launch, record and save a session, restart — the session is still there.
- Install a newer version over an older one: one entry in Programs and Features, data intact.
- Uninstall: the program is gone, `%LOCALAPPDATA%\Chronos` is not.
- Both **Open Folder** buttons in Settings.
- A rejected write, which is easiest to force by denying write permission on `data\` — the banner
  appears and the reason lands in `logs\chronos.log`.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, format check, tests and build on every push to
`main` and every pull request. It does not build the desktop app: a cold Rust build takes minutes,
and this is the check that gates merging.

`.github/workflows/release.yml` does the shipping. Push a `v*` tag and it takes the notes from
`CHANGELOG.md`, creates the release, builds on Linux, Windows and macOS, and uploads every
installer to it. It also checks Rust formatting and runs Clippy on each system, which is the only
way a warning that appears solely on Linux would ever be seen here.

Run it by hand **without** a tag (Actions → Release → Run workflow, leaving the tag empty) and it
builds everything and attaches the results to the run instead of publishing — how to find out that
something stopped compiling on Linux without cutting a release to discover it. A separate job
builds the Android APK — signed, and published on a tag.

Releases are tag-triggered rather than running on every push, because a full matrix build takes
tens of minutes of runner time and most pushes do not need one. The repository is public, so those
runners are free; the argument is about wall-clock and noise rather than money.

`main` is behind a ruleset: changes go through a pull request, which the `Typecheck, lint, test,
build` check gates. Worth knowing if this was ever private — **rulesets only take effect on public
repositories**, so the rule can sit there configured and unenforced, and then start rejecting
direct pushes with `GH013` the moment the repository is published.

## License

Proprietary — copyright the repository owner, all rights reserved. No license to use, copy or
distribute it is granted, whether or not the repository itself is publicly readable: being able to
read source is not permission to use it. There is deliberately no `LICENSE` file: absent
one, default copyright already reserves every right, which is the intent here.
