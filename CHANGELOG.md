# Changelog

What changed in Chronos, written for people who use it. Purely internal work —
refactoring, tests, tooling — is left out; that is what the commit history is for.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-08-13

### Added

- **A log file.** The desktop app records what it did and, more usefully, what went wrong: when it
  started, whether a backup ran, and the reason behind every save it could not complete. Settings →
  _Application Log_ → **Open Folder**. Previously this information existed only in a developer
  console that a normal installation has no way to open, which meant it existed for nobody.

### Fixed

- **Your data no longer lives in the application folder.** The installer put the program in
  `%LOCALAPPDATA%\Chronos Desktop`, which is exactly where recordings were being written. Nothing
  was lost — uninstalling always left the data alone — but anyone who removes an app by deleting
  its folder would have taken their recordings with it. Data now lives one folder over, in
  `%LOCALAPPDATA%\Chronos`.

## [0.2.0] — 2026-08-13

### Added

- **Chronos is now a Windows desktop app.** Same application, installed and launched like any
  other program, with recordings kept in files on your machine instead of inside a browser. The web
  version continues to work exactly as before.
- **Automatic backups.** A snapshot of everything is kept once a day, and another is taken
  immediately before you clear the history or import a file — the two moments where data actually
  disappears. The last ten are kept, and older ones are removed on their own. Settings →
  _Automatic Backups_ → **Open Folder**.

  A backup is an ordinary export file, so restoring one needs nothing new: pick it with
  **Import File**, which you already have.

  If a backup cannot be written, the app says so before it clears or imports, and lets you decide
  whether to go ahead — rather than telling you afterwards, when it no longer helps.

### Changed

- The desktop app keeps its data outside its own installation folder, so uninstalling never
  removes your recordings.

## [0.1.1] — 2026-08-13

### Fixed

- **The version shown in the title bar is now the real one.** It had been fixed at `v1.2.0` since
  the project was generated, while the actual version was `0.1.0`.
- **The "could not save" warning now says why.** It used to guess at the cause; it now repeats what
  the storage layer actually reported, such as the browser being out of space.

## [0.1.0] — 2026-08-13

The first version worth naming: a precision stopwatch that runs in the browser.

### Added

- Stopwatch with start, pause, resume and stop, plus lap splits showing lap time and total side by
  side, with the fastest and slowest lap highlighted.
- Sessions saved with a title, project, tags and notes, including the time actually spent paused.
- Searchable history filtered by project, with a running total.
- Exports: a PDF report filterable by project and date range, CSV for spreadsheets, and a JSON
  backup that can be imported again.
- Keyboard shortcuts — `Space` start/pause, `L` lap, `S` stop and save, `R` reset.
- A configurable display refresh rate, so the readout can be slowed down without affecting the
  accuracy of the measurement.
- A visible warning when a save fails, because browser storage is the only copy of the data and a
  silent failure means the entry is gone after a reload.
- A recovery screen instead of a blank page when something in the interface breaks.

[0.3.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/F1rlefanz/Chronos-Desktop/releases/tag/v0.1.0
