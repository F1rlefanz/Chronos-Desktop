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

## Conventions

- **TypeScript is strict.** No `any`. If a browser API needs a feature-detect, write a narrow
  local type rather than casting through `any` (see `getAudioContext` in `src/App.tsx`).
- **Prettier owns formatting.** Do not hand-format; run `bun run format`. ESLint has
  `eslint-config-prettier` last, so it will not argue about style.
- **Do not add dependencies without a clear need.** Half of this project's original dependency
  list was never imported and had to be removed. Prefer the platform.
- **A setting must have a reader.** Adding a field to `AppSettings` without wiring it up recreates
  the dead-switch problem that `theme`, `timeFormat` and `autoSaveSession` used to be. If you
  remove a field, extend `migrateSettings` in `src/utils/storage.ts` so old stored states are
  cleaned up.
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
