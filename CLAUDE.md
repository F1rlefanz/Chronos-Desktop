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

### Where the rest lives

Every other convention — the rule **and** the bug or measurement that forced it — lives in
`docs/conventions/`, one file per area. **Read the file for an area before changing code in it**;
without the reason, the same trap gets rebuilt in a new shape.

| Area                           | File                                          | Covers, among other things                                                                                                              |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Data model and storage         | `docs/conventions/data-and-storage.md`        | settings need a writer and a reader, the storage adapter, `ReadResult`, `updatedAt`, derived durations, migrations                      |
| Sync between devices           | `docs/conventions/sync.md`                    | a merge never deletes on its own, one file per device, the single path command, the Android folder plugin, transports, when a sync runs |
| Updates and releases           | `docs/conventions/updates-and-releases.md`    | the updater seam, signatures, update timer, dismissal, `isNewer`, bumping `package.json` is the release, `latest.json`                  |
| Platforms and layout           | `docs/conventions/platforms-and-layout.md`    | no `window.confirm`, `isMobilePlatform()`, edge-to-edge, wrapping rows, `shrink-0` vs `min-w-0`, width and type scales, real viewports  |
| Files, logging, backups, input | `docs/conventions/files-backups-and-input.md` | the logger, `fileTarget.ts`, daily snapshots, `backupBefore`, IPC and imported JSON are input                                           |

The short form of the rules whose breach costs a user's data or a working build:

- **Never `window.confirm`, `alert` or `prompt`** — they do not work in the Android WebView.
- **Persistence goes through the storage adapter**, never `localStorage` directly.
- **A merge may add and update on its own; it may not delete on its own.**
- **Anything crossing the IPC boundary, and any imported JSON, is untrusted input.**
- **The version lives in `package.json` and nowhere else**, and bumping it on `main` is the release.
- **A duration is derived, never stored.**

## Keeping this file small

This file is loaded in full in every session, so it stays a signpost.

- A new convention goes into the matching file under `docs/conventions/`, with the reason that
  forced it. Here, at most a line — and only if breaking it costs data or a working build.
- A new area gets a new file **and** a row in the table above.
- `src/claudeMd.test.ts` caps this file's size and checks that every file under
  `docs/conventions/` is linked here and every link resolves. If it gets tight, move text out
  rather than raising the limit.

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
