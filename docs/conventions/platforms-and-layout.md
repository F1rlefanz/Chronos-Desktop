# Platforms and layout

Moved out of `CLAUDE.md` verbatim. Read before touching dialogs, platform detection, the mobile layout, widths or type scales.

## Never `window.confirm`, `alert` or `prompt`. They do not work here

- **Never `window.confirm`, `alert` or `prompt`. They do not work here.** In the Android WebView
  they draw **nothing at all**, and `confirm` returns `true` on top of that, so every guard written with it silently
  answered yes: discarding a running measurement, clearing the whole history, saving over a
  validation warning, and continuing after a backup had failed. Verified on a Fairphone 6 — the
  running measurement was gone 500 ms after the tap, no dialog in between, and it had been that way
  since Android shipped. Ask through `ConfirmPrompt` and the `ask()` helper in `src/App.tsx`, which
  returns a promise the dialog settles. Two things it gets right on purpose: the **cancelling**
  button comes first and carries the visual weight, because someone tapping past a dialog on a
  phone should land on the side that changes nothing; and the reason a backup failed is shown in
  the question, since "something went wrong" cannot inform a decision. Note that a React modal is
  fine on Android — `RecoveryPrompt` and the settings have always rendered there. It is the
  _browser's own_ dialogs that are absent. `alert` cost three messages the same way: an import that
  failed looked exactly like one that never started, on the app's most destructive operation. A
  message rather than a question belongs next to the control it is about, as a `<p role="status">`
  — the shape the sync status already had — not in a modal.

## `isMobilePlatform()` picks a backend in `main.tsx`, and hides doors that lead nowhere

- **`isMobilePlatform()` picks a backend in `main.tsx`, and hides doors that lead nowhere.** It may
  not decide anything about how data is kept: storage, backups, the log and the sync rules are
  identical everywhere, and only the way a folder is reached differs. A door is hidden by asking
  whether there is something behind it — `onRevealBackups` is absent when no folder has been
  chosen, not because this is a phone — and `reveal_folder` in Rust still refuses on Android as a
  second line of defence.

## A phone draws the webview edge to edge

- **A phone draws the webview edge to edge.** `index.html` carries `viewport-fit=cover` and the
  header and footer pad themselves with `env(safe-area-inset-*)`; without both, the status bar sits
  on top of the tab bar. A row of label-plus-control needs a stacked fallback below `sm`, or the
  description text wraps around the control and interleaves with it.

## A phone is narrower than the emulator, and a row that cannot fit must wrap, not overflow

- **A phone is narrower than the emulator, and a row that cannot fit must wrap, not overflow.** The
  emulator reports 360 CSS px; a Fairphone 6 reports **320** (1116 physical pixels at density 558),
  and at that width the header ran its two right-hand buttons off the screen — including the one
  that opens the settings, which is to say the whole app was unreachable from there. It had been
  like that since Android shipped, and no test could have seen it: jsdom does not lay anything out.
  Any row of fixed-size controls gets `flex-wrap` so the worst case is a second line, never a
  missing button — and check a change at 320 px, not at the emulator's 360.

## `shrink-0` next to `min-w-0` is how text ends up underneath other text

- **`shrink-0` next to `min-w-0` is how text ends up underneath other text.** This bit three
  separate rows before anyone named it: the header, the history's three buttons, and every entry in
  the list. The shape is always the same — a fixed group that refuses to shrink beside a flexible
  one that shrinks past its content — and the flexible side then overflows _sideways_, sliding its
  second line under the fixed group. Truncating the first line hides it: `truncate` on a heading
  does nothing for the `project • date` row below it. On a phone the answer is not a cleverer
  single line but **two**: stack with `flex-col`, and go back to `sm:flex-row` where the width
  exists. Anything staying on one line needs `flex-wrap` or `truncate` on _every_ line, not the
  first.

## The width scale and the type scale are each one lever, in `src/index.css`

- **The width scale and the type scale are each one lever, in `src/index.css`.** `.app-shell` is
  how wide the app may get, in four steps, and the header and `main` both use it — if they drift
  apart the header stops lining up with the content. The root font size ramps above 1600 px, which
  moves type, padding, gaps and corners together because every Tailwind size is in `rem`; setting
  those individually at four breakpoints is the version that drifts. Breakpoints are unaffected —
  `rem` inside a media query resolves against the browser's initial 16 px, not against this. Do not
  reintroduce a `max-w-*` on a page container, and do not write a font size in `px`: a `text-[11px]`
  is a size that refuses to grow on the one screen that needed it to.

## A component sized against the viewport is wrong as soon as it shares a row

- **A component sized against the viewport is wrong as soon as it shares a row.** The readout in
  `StopwatchDisplay` uses `cqi` against its own card, not `vw`, because from `xl` up that card is a
  column beside the history rather than the width of the screen. Its `clamp()` slope is set so the
  widest thing it can ever show — `HH:MM:SS` with hundredths — still fits at 320 px; the fixed
  `text-7xl` it replaced needed 303 px of a 224 px card, and nobody saw it because the readout only
  gets that wide after an hour.

## Check a layout at a real viewport, not a window size

- **Check a layout at a real viewport, not a window size.** Chrome's `--window-size` is clamped to a
  platform minimum and the screenshot is then a crop of a wider layout — which is exactly how you
  convince yourself a 320 px bug is fixed when it is not. Drive
  `Emulation.setDeviceMetricsOverride` over the DevTools protocol instead, and assert
  `document.documentElement.scrollWidth === clientWidth` rather than judging by eye.
