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

The desktop app is a second track over the same code:

```bash
bun run desktop:dev     # Tauri window; starts the dev server itself
bun run desktop:build   # Windows installer

cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Touching `src-tauri/` means running those two cargo commands as well — `.github/workflows/
desktop.yml` enforces them, but only on demand and on tags, so a broken Rust side will not show
up in a pull request.

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
- **Log through `src/utils/logging/logger.ts`, not `console.*` directly.** The console does not
  exist in a shipped desktop build, so a bare `console.warn` about a failed save reaches nobody.
  `logInfo/logWarn/logError` write to the console _and_, on the desktop, to a log file. Anything
  worth a `console.warn` is worth a log line; anything the user is expected to act on needs the
  persistence banner as well, because nobody reads a log they have not been told about.
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
