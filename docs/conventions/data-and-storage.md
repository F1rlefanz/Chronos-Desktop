# Data model and storage

Moved out of `CLAUDE.md` verbatim. Read before touching `AppSettings`, `TimeEntry`, the storage adapter, migrations or anything that computes a duration.

## A setting must have a writer, not only a reader

- **A setting must have a writer, not only a reader.** `defaultProject` was read from the first
  version and set by nothing, so it stayed on its generated value forever — the same dead switch as
  a setting nobody reads, just from the other side. When adding a field to `AppSettings`, wire up
  both ends.

## A setting must have a reader

- **A setting must have a reader.** Adding a field to `AppSettings` without wiring it up recreates
  the dead-switch problem that `theme`, `timeFormat` and `autoSaveSession` used to be. If you
  remove a field, extend `migrateSettings` in `src/utils/storage/index.ts` so old stored states are
  cleaned up. The same holds for `STORAGE_KEYS`: a key nothing reads is dead weight.

## Persistence goes through the adapter, never through `localStorage` directly

- **Persistence goes through the adapter, never through `localStorage` directly.** The web and
  desktop builds share `src/utils/storage/index.ts`; only an adapter under `src/utils/storage/`
  may touch a concrete backend, and `main.tsx` is the only place that picks one. Writes return a
  `WriteResult` (`{ ok: true } | { ok: false; reason; message }`) instead of throwing, because a
  rejected write is an expected outcome the UI has to show — `persist()` in `src/App.tsx` turns it
  into a banner. Adapters deal in strings so that JSON encoding and the corrupt-data fallback live
  in one place.

## Reading reports failure the same way, and for one reason more

- **Reading reports failure the same way, and for one reason more.** `read` returns a `ReadResult`
  (`{ ok: true; value: string | null } | { ok: false; message }`), because "the key is not there"
  and "the backend could not answer" are different facts and used to arrive as the same `null`.
  That conflation was a data-loss bug, not an inelegance: `loadPersistedState` saw "nothing
  stored", wrote its defaults back over settings it had merely failed to open, and said nothing.
  A start that cannot read now writes **nothing** and reports what it could not read through
  `PersistedState.unreadable`, which `src/App.tsx` turns into a banner that cannot be dismissed —
  the screen is not the truth, and the next thing recorded would overwrite the truth.

## Two devices can only be reconciled because every entry says when it changed

- **Two devices can only be reconciled because every entry says when it changed.** `updatedAt` is
  stamped where entries are created and edited; `patchRunningEntry` is the single place every
  change to a running measurement passes through, which is what keeps a new handler from silently
  forgetting. Deleting writes a tombstone under its own storage key — without one, "deleted here"
  and "never seen here" are indistinguishable and a merge resurrects everything ever deleted. The
  rule itself is `src/domain/merge.ts`, a pure function over two sets, and its two load-bearing
  tests are that merging gives the same answer whichever side asks and that running it twice
  changes nothing.

## A duration is derived, never stored

- **A duration is derived, never stored.** A `TimeEntry` records `startTime`, `endTime` (`null`
  while it runs) and `breaks`; every length comes from `src/domain/timeEntry.ts`. Do not add a
  `durationMs` field back. The old model stored one next to the timestamps, filled from an
  animation-frame accumulator that stopped advancing while the window was minimised, so the same
  entry carried two disagreeing answers and the JSON import had to guess between them.

## Frames set the repaint rate; the wall clock sets the number

- **Frames set the repaint rate; the wall clock sets the number.** `useLiveDuration` runs a
  `requestAnimationFrame` loop because a `setInterval` stutters against the refresh rate — but it
  reads `Date.now()` each time rather than accumulating frame deltas, which are not a measure of
  elapsed time. `intervalMs` throttles the state push only. Anything that needs a shared "now"
  across a render takes it from `useNow`, never by calling `Date.now()` during render.

## A setting must have a reader — and so must an entry field

- **A setting must have a reader** — and so must an entry field. `migrateEntries` in
  `src/utils/storage/index.ts` is the counterpart to `migrateSettings`: stored entries were written
  by older builds and go through the same normaliser as an imported file, so a shape change needs a
  conversion there and a test against a real old record.
