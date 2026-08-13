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

## Conventions

- **TypeScript is strict.** No `any`. If a browser API needs a feature-detect, write a narrow
  local type rather than casting through `any` (see `getAudioContext` in `src/App.tsx`).
- **Prettier owns formatting.** Do not hand-format; run `bun run format`. ESLint has
  `eslint-config-prettier` last, so it will not argue about style.
- **Do not add dependencies without a clear need.** Half of this project's original dependency
  list was never imported and had to be removed. Prefer the platform.
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
- **Anything crossing the IPC boundary is input.** The commands in `src-tauri/src/lib.rs` validate
  their arguments even though the only caller is our own front end — an unvalidated storage key
  turns a save into an arbitrary file write. Writes go through a temporary file and a rename;
  do not "simplify" that into a direct `fs::write`, which can truncate the only copy of the data.
- **Imported JSON is untrusted.** Anything read from a file goes through the normalizers in
  `src/utils/dataExporter.ts` before it reaches state — it is persisted immediately, so a bad
  record survives reloads.
- **Timing accuracy lives in refs, not state.** `src/hooks/useStopwatch.ts` accumulates elapsed
  time per animation frame and only throttles the state push. Do not "simplify" it into a
  `setInterval` that stores time in state.

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
