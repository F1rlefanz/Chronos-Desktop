# Chronos Desktop

A time tracker with a stopwatch in it. An entry records when work happened — a start, an end and
the breaks between them — and every duration is derived from that, never stored alongside it.
Entries can be typed in by hand as readily as measured, corrected afterwards, and exported for a
named month as PDF, CSV or a portable JSON backup.

The interface is in German; the code is in English.

It ships as a **Windows desktop app** built with Tauri, and the same code still runs as a plain
web app in the browser. There is no backend and no account: everything lives on the machine it
was recorded on, and the JSON backup is how you move data between machines.

Persistence sits behind a `StorageAdapter` interface, chosen at startup:

| Build   | Backend                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- |
| Desktop | `%LOCALAPPDATA%\Chronos\data\*.json`, written by Rust, with rotating snapshots in `..\backups\` |
| Browser | `localStorage`, no snapshots — the quota has no room for a second copy                          |

Nothing above that interface knows which one is in use.

## Features

- Stopwatch with start / pause / resume / stop. A running measurement is written to disk as it
  starts, so closing the window does not lose it — the next launch asks whether to continue it,
  stop it, or correct its times.
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
- Automatic backups (desktop only): a snapshot at startup (at most once a day), one when the window
  closes, and one immediately before clearing the history or importing a file. The last twenty are
  kept. All of them happen while the app runs, which is also the only time the data can change.
- A log file (desktop only) recording startup, backup outcomes and every failed save, with both
  folders reachable from the Settings dialog.

What changed between versions is in [CHANGELOG.md](CHANGELOG.md).

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

Both data folders are reachable from **Settings**, at the bottom of the dialog. Installing is
per-user and needs no administrator rights, an installer of a newer version updates the existing
installation rather than adding a second one, and uninstalling leaves `%LOCALAPPDATA%\Chronos`
untouched — deleting your recordings has to be something you do on purpose.

## Requirements

For the web build: Node.js 20 or newer. [Bun](https://bun.sh) 1.3+ is the project's package
manager — `bun.lock` is the committed lockfile — but npm works too.

For the desktop build, additionally:

- A [Rust](https://rustup.rs) toolchain (stable).
- Microsoft Visual Studio Build Tools with the C++ workload.
- WebView2, which is preinstalled on Windows 11 and current Windows 10.

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
    logging/           Console plus, on the desktop, a log file
      logger             logInfo/logWarn/logError, level routing, write ordering
      tauriLogSink       Appends through IPC to logs/chronos.log
    fileTarget         Where a generated export goes: download or written file
    tauriFileSink      Writes exports through IPC into exports/
    dataExporter       CSV and JSON export, and validated JSON import
    pdfExporter        jsPDF report generation
  constants/           Defaults, storage keys, time constants
  types/               Shared types

src-tauri/
  src/lib.rs           The storage_*, backup_*, export_write, log_append and
                       reveal_folder commands
  src/main.rs          Desktop entry point over lib.rs
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

`.github/workflows/desktop.yml` checks Rust formatting, runs Clippy, builds the Windows installer
and uploads it as an artefact. It runs on demand (Actions → Desktop build → Run workflow) and on
`v*` tags.

To require CI before merging (needs admin rights on the repository):
Settings → Branches → Add rule for `main` → enable _Require a pull request before merging_ and
_Require status checks to pass_, selecting the `Typecheck, lint, test, build` check.

## License

Proprietary — copyright the repository owner, all rights reserved. This is private software; no
license to use, copy or distribute it is granted. There is deliberately no `LICENSE` file: absent
one, default copyright already reserves every right, which is the intent here.
