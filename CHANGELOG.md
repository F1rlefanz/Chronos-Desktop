# Changelog

What changed in Chronos, written for people who use it. Purely internal work —
refactoring, tests, tooling — is left out; that is what the commit history is for.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] — 2026-08-14

### Fixed

- The log's last line before the app closes — the one saying whether the closing backup was
  written — could be lost, because the process exited before the entry reached the file. The backup
  itself was never affected.

## [0.6.0] — 2026-08-14

### Added

- **Chronos runs on Android.** The same app, on a phone, from the same code — the stopwatch, manual
  entries, the calendar, the charts and the exports all work. Installing it is a matter of building
  and copying the APK across; there is no store listing.
- **Builds for macOS and Linux.** Tagging a version now produces installers for Windows, macOS and
  Linux at once, alongside the Windows build that already existed.

### Changed

- **The interface adapts to a phone screen.** Rows that pair a label with a control stack instead of
  wrapping their description around it, and the app keeps clear of the status bar and the gesture
  bar. On a phone the two _Ordner öffnen_ buttons are hidden — Android has no file manager to send
  you to — and an export reports the path it was written to instead.
- The last English label in the Settings dialog is now German.

### Note

Entries now record when they last changed, and deleting one leaves a small record behind. Neither
is visible, and nothing about your data changes — it is what a future version needs to be able to
reconcile two devices without resurrecting entries you deleted or silently reverting an edit. How
two devices would actually exchange their records is still an open question.

## [0.5.1] — 2026-08-14

### Changed

- **Start, pause, stop and discard sit inside the stopwatch card**, with the time they act on,
  instead of floating below it.

## [0.5.0] — 2026-08-14

### Fixed

- **Exports work in the desktop app.** The PDF, CSV and JSON buttons appeared to do nothing at all:
  they asked the browser to download a file, and the desktop app has no browser to ask. Exports are
  now written to `%LOCALAPPDATA%\Chronos\exports\`, the folder opens by itself afterwards, and the
  dialog says where the file went — or why it could not be written.
- **Scrolling in a dialog no longer scrolls the app behind it.**
- **A day's work is backed up the same day.** The automatic snapshot was taken when the app started,
  over the state it found there — so everything recorded during a session only reached a snapshot
  the next time Chronos was opened. There is now also one when the window closes, and the number
  kept went from ten to twenty so that the second snapshot per day does not halve how far back the
  folder reaches. The Settings dialog now says plainly when snapshots are taken.

### Changed

- **The main window is split into two views, _Erfassen_ and _Auswertung_.** Recording, the stopwatch
  and the list of entries on one; totals, calendar and charts on the other. Everything was on a
  single page before, which meant scrolling past a calendar and three charts to reach the entries.
- **The title bar is gone.** It repeated the window title Windows already draws, and carried three
  coloured circles that looked like close, minimise and maximise buttons but were decoration — they
  had never done anything. The version number moved to the strip at the bottom of the window.
- **The project is chosen in the stopwatch card**, where it used to only be displayed. The separate
  bar above it, which offered the same choice and the note "Wird lokal gespeichert — ohne Cloud",
  is gone.
- The footer no longer says "lokal gespeichert, ohne Cloud", and the export button no longer carries
  a count of all entries — the export dialog shows the count for the period you actually picked.

### Removed

- The setting for a custom window frame, which controlled the title bar that no longer exists.

## [0.4.1] — 2026-08-14

### Fixed

- **The default project can finally be chosen.** Settings → _Projekte_ → **Standardprojekt** decides
  which project the app starts on. The setting existed and was being used since the very first
  version, but there was no way to change it, so it stayed on "Work Project" forever. Deleting the
  project that is set as the default now moves the setting to another one instead of leaving it
  pointing at something that no longer exists.

## [0.4.0] — 2026-08-13

Chronos was built as a stopwatch. This release makes it a time tracker, which
changed things a stopwatch never had to get right.

### Added

- **Enter and correct times by hand.** Until now an entry could only come from the stopwatch:
  forget to start it and the time was gone, stop it too late and the only remedy was deleting the
  entry. There is now an **Eintrag hinzufügen** button, and every entry has a pencil icon. Start
  and end each carry their own date, so a stretch of work from 22:00 to 01:00 can be entered — and,
  more to the point, edited afterwards.
- **A running measurement survives a crash.** The measurement is written to disk the moment you
  start it. If the app closes while it is running — a crash, a reboot, a closed window — the next
  start asks whether to keep it running, stop it now, or correct the times. Nothing is lost while
  you decide. Previously the whole measurement lived in memory and simply vanished.
- **Breaks are recorded individually**, each with its own start and end, and can be moved or
  removed afterwards. They replace the single summed pause figure, which could not say _when_ you
  paused.
- **Totals, a calendar and trends.** Today, this week, this month, this year and overall; a month
  calendar shaded by daily total whose days open their entries; charts for the last twelve weeks,
  by weekday, and by month.
- **Export a real period.** A specific month, a specific year, or a free from–to range, alongside
  today / this week / this month / this year / everything.

### Changed

- **The interface is in German**, including dates, times and durations. Durations are shown to the
  minute ("2 Std. 35 Min.") — seconds are noise in a record of worked hours.
- **Milliseconds are off by default** and the readout updates once a second. Both are still
  settings.
- **CSV uses semicolons** and adds a minutes column, so a German Excel opens it in columns instead
  of dumping everything into column A.
- **Lap splits are gone**, replaced by the break list. A lap time says something about a stopwatch
  run and nothing about worked hours.
- **Stopping no longer risks the recording.** The dialog that asks for a title appears _after_ the
  entry is saved, so dismissing it costs a title rather than the hours.

### Fixed

- **A minimised window no longer loses time.** The recorded duration was accumulated per animation
  frame, and frames stop arriving when the window is hidden — so minimising the app for half an
  hour recorded far less than half an hour. Durations are now read from the clock.
- **Exports are reproducible.** A running measurement is left out of PDF and CSV exports, and the
  dialog says how many were skipped. Its duration keeps growing, so including it made the same
  report for the same month come out differently an hour later.

### Note

The first start converts existing entries to the new format automatically; the recorded net time
is preserved exactly. Export a JSON backup first if you would like a copy of the old shape.

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

[0.6.1]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/F1rlefanz/Chronos-Desktop/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/F1rlefanz/Chronos-Desktop/releases/tag/v0.1.0
