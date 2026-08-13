# Chronos Desktop

A precision stopwatch and time tracker. Sessions are timed at animation-frame resolution, tagged
to a project, and exported as PDF, CSV or a portable JSON backup.

It ships as a **Windows desktop app** built with Tauri, and the same code still runs as a plain
web app in the browser. There is no backend and no account: everything lives on the machine it
was recorded on, and the JSON backup is how you move data between machines.

Persistence sits behind a `StorageAdapter` interface, chosen at startup:

| Build   | Backend                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Desktop | `%LOCALAPPDATA%\Chronos Desktop\data\*.json`, written by Rust, with rotating snapshots in `..\backups\` |
| Browser | `localStorage`, no snapshots — the quota has no room for a second copy                                  |

Nothing above that interface knows which one is in use.

The desktop data folder is deliberately **not** named after the bundle
identifier, which is what Tauri would do by default. Where the user's data lives
and how Windows identifies the installation are separate concerns: tying them
together would mean that renaming the identifier later orphans every existing
recording. It also keeps the folder findable in Explorer.

## Features

- Stopwatch with start / pause / resume / stop and lap splits, showing lap time and total split
  side by side, with the fastest and slowest lap highlighted.
- Sessions saved with a title, project, tags and notes, plus the time actually spent paused.
- Searchable history filtered by project, with a running total.
- Exports: PDF report (filterable by project and date range), CSV for spreadsheets, JSON backup
  and restore.
- Keyboard shortcuts: `Space` start/pause, `L` lap, `S` stop and save, `R` reset. Modified
  combinations such as `Cmd/Ctrl+R` are left to the browser.
- Configurable display refresh rate, so the readout can be slowed down without affecting timing
  accuracy.
- Automatic backups (desktop only): a snapshot once a day, and one immediately before clearing the
  history or importing a file. The last ten are kept.

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

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `bun run dev`           | Vite dev server on port 3000                              |
| `bun run build`         | Production build into `dist/`                             |
| `bun run preview`       | Serve the production build locally                        |
| `bun run desktop:dev`   | Tauri dev window over the dev server                      |
| `bun run desktop:build` | Windows installer into `src-tauri/target/release/bundle/` |
| `bun run typecheck`     | `tsc --noEmit` (strict)                                   |
| `bun run lint`          | ESLint over the project                                   |
| `bun run lint:fix`      | ESLint with autofix                                       |
| `bun run format`        | Prettier, writing changes                                 |
| `bun run format:check`  | Prettier in check mode (what CI runs)                     |
| `bun run test`          | Vitest, single run                                        |
| `bun run test:watch`    | Vitest in watch mode                                      |
| `bun run test:coverage` | Vitest with a coverage report                             |
| `bun run clean`         | Remove `dist/` and `coverage/`                            |

## Architecture

```
src/
  App.tsx              Root container: owns settings, entries and projects; modal orchestration
  hooks/useStopwatch   Timer state machine (IDLE/RUNNING/PAUSED/STOPPED), laps, pause accounting
  components/          Presentational components — header, display, controls, laps, modals
  utils/
    timeFormatters     Pure ms → display/duration/date formatting
    storage/           Persistence behind an adapter interface
      types              StorageAdapter and the WriteResult a failed write returns
      localStorageAdapter  The browser backend (default)
      tauriAdapter         The desktop backend, over IPC to Rust
      memoryAdapter        In-memory backend used by the tests
      index                Domain layer: loadPersistedState, the save* functions,
                           settings migration, setStorageAdapter, the backup rules
    dataExporter       CSV and JSON export, and validated JSON import
    pdfExporter        jsPDF report generation
  constants/           Defaults, storage keys, time constants
  types/               Shared types

src-tauri/
  src/lib.rs           The storage_* and backup_* commands, and the window setup
  src/main.rs          Desktop entry point over lib.rs
  tauri.conf.json      Window, bundle and CSP configuration
  capabilities/        Permission scopes granted to the window
```

Things worth knowing before changing code here:

- **The timer never trusts React state for measurement.** Elapsed time accumulates in refs at
  full animation-frame resolution; `timerIntervalMs` only throttles how often that value is
  pushed into state. Changing the setting changes render frequency, never accuracy.
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
  the front end write anywhere on disk.

## Testing

```bash
bun run test
```

Vitest with jsdom and Testing Library. The suite covers the time formatters, the stopwatch state
machine (over a controlled clock with hand-pumped animation frames), the settings migration, both
storage adapters and the export/import layer — including regression tests for previously fixed
bugs. Coverage is reported but no threshold is enforced.

The Rust side has no unit tests; it is verified by building and running the desktop app.

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
