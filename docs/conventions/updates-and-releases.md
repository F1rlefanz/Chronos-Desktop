# Updates and releases

Moved out of `CLAUDE.md` verbatim. Read before touching the updater, the update banner, version handling or `release.yml`.

## The updater is the third pair of backends behind one interface

- **The updater is the third pair of backends behind one interface, and the only one Tauri does
  not cover.** `UpdateChannel` in `src/utils/update/` is the seam; the desktop half is
  `tauri-plugin-updater`, the phone half is `src-tauri/plugins/chronos-update/`, and `main.tsx`
  picks. Tauri's documentation site shows Android with a tick in the updater's platform table —
  the plugin's own README says `Android: x` and its install snippet excludes mobile by target, and
  the README is right. Do not "simplify" the Android half away on the strength of that table.
  Nothing about the Android path can be made silent: installing a package is Android's to
  authorise, and the plugin ends at the system installer on purpose.

## What is fetched over the network is input, and a signature is the only thing that says it is ours

- **What is fetched over the network is input, and a signature is the only thing that says it is
  ours.** The updater sends no credentials — that is what lets a public release be a feed — so the
  pubkey in `tauri.conf.json` is the whole trust story on the desktop, and the APK signature is on
  Android. `readManifest` still validates shape, scheme, host and extension before a URL reaches
  the installer, for the same reason imported JSON goes through the normalisers: a mangled file
  must be refused, not followed. That check covers the address it is given and nothing after it,
  so `open()` in `ChronosUpdatePlugin.kt` applies the same host rule to **every** redirect hop —
  which is only possible with `instanceFollowRedirects` off, because the JDK otherwise follows a
  redirect to another host itself as long as the protocol holds, and that hop is exactly the one
  worth seeing. **CI signs Android with the same key every earlier build used** —
  Android refuses an update signed by a different one, and switching means uninstalling, which
  takes the user's recorded time with it.

## The update check runs on a timer; syncing still must not

- **The update check runs on a timer; syncing still must not.** They look like the same rule and
  are not. A sync writes into a user's folder, so doing it at a moment nobody asked for is the
  thing to avoid; an update check reads one small file and changes nothing. `useUpdateCheck` asks
  at startup, every six hours, and when the window comes back — the last of those because a laptop
  that was asleep ran no timers, and the copy opened on Monday would otherwise still believe what
  it learned on Friday. Nothing pushes to this app and nothing should: a server to push from is
  exactly what "no account, no server" rules out.

## Dismissal is remembered by version, not for the session

- **Dismissal is remembered by version, not for the session.** With a single check at startup the
  two were the same thing. With several they are not, and getting it wrong means dismissing 1.2.0
  silently hides 1.3.0 as well.

## The update banner reads `CHANGELOG.md`, and that file wraps at a hundred characters

- **The update banner reads `CHANGELOG.md`, and that file wraps at a hundred characters.** A bullet
  in it is not a line: most entries run over two or three, with the rest indented underneath, so
  `bulletsFrom` joins continuations onto the entry above. Filtering for lines starting with `- `
  cut every entry off mid-sentence, and no test caught it because every fixture was one line long
  — the fixtures now include a real release's notes verbatim.

## A version comparison is `isNewer`, never a string comparison

- **A version comparison is `isNewer`, never a string comparison.** `1.10.0` sorts before `1.9.0`
  as text, which would make a tenth minor release look like a downgrade and silently strand
  everyone on it. Anything that is not three integers counts as _not newer_, so a broken manifest
  fails towards "no update" rather than towards offering one.

## Bumping `package.json` on `main` _is_ the release

- **Bumping `package.json` on `main` _is_ the release.** `release.yml` watches the branch, reads the
  version, and if that tag has no release yet it creates the tag, the release and everything under
  it. Do not tag by hand any more — the same release simply builds twice. A merge that leaves the
  version alone stops in `prepare` and costs nothing. This exists because forgetting the tag is the
  failure that looks exactly like success: merged, CI green, and the change reachable by nobody. It
  happened twice in one afternoon.

## A release is not finished when the installers are uploaded

- **A release is not finished when the installers are uploaded.** `latest.json` and
  `latest-android.json` are written by the `manifests` job _after_ every build has uploaded,
  because a manifest can only name bundles that already exist — and until it exists, every
  installed copy keeps reporting itself current. Six secrets make that run:
  `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) for the desktop bundles, and
  `ANDROID_KEYSTORE_BASE64` / `ANDROID_STORE_PASSWORD` / `ANDROID_KEY_ALIAS` /
  `ANDROID_KEY_PASSWORD` for the APK. The Tauri private key lives outside the repository and is
  backed up; do not treat it as replaceable anyway — losing it means never shipping an update that
  existing installs will accept, and no amount of rebuilding gets that back.

## The version lives in `package.json` and nowhere else

- **The version lives in `package.json` and nowhere else.** `tauri.conf.json` points at it, Vite
  stamps it into `__APP_VERSION__` for the header badge, and `src-tauri/Cargo.toml` is pinned to
  `0.0.0` because Cargo demands a value but Tauri ignores it. Bumping a release means editing one
  line. The badge used to be a hardcoded `v1.2.0` that had drifted three minor versions from the
  real number — do not reintroduce a second copy.
