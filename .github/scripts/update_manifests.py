#!/usr/bin/env python3
"""Builds the two update manifests from what the release already holds.

`latest.json` is the file Tauri's updater fetches on the desktop; it names one
bundle per platform and carries the signature that proves the bundle is ours.
`latest-android.json` is the phone's counterpart, which Tauri knows nothing
about — its updater does not support Android, so the app carries its own.

Both are assembled here rather than by `tauri-action`, because this workflow
builds the platforms itself and uploads them one runner at a time. Running this
after the last upload is the only moment every signature exists.

The notes in both come from the same place the release notes do: the section of
CHANGELOG.md for this version. One text, no second copy to keep true.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

# Which bundle Tauri should fetch for which target, and where its signature is.
# The keys are Tauri's own platform names; anything not found is simply left
# out, so a matrix that lost a runner produces a manifest without that platform
# rather than one naming a file that was never uploaded.
DESKTOP = {
    # The NSIS installer, not the MSI: both are built and both are signed, but a
    # manifest names one bundle per target and NSIS is the one that installs
    # per-user without administrator rights, which is how Chronos is installed.
    "windows-x86_64": "-setup.exe",
    # Not the .dmg. macOS updates in place from an .app tarball; a disk image is
    # something a person mounts.
    "darwin-universal": ".app.tar.gz",
    # Not the .deb or .rpm either, for the same reason: those are handed to a
    # package manager, and the updater replaces files itself.
    "linux-x86_64": ".AppImage",
}


def assets(tag: str) -> list[dict]:
    """Everything attached to the release, as name plus browser URL."""
    out = subprocess.run(
        ["gh", "release", "view", tag, "--json", "assets"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)["assets"]


def find(names: list[dict], suffix: str) -> dict | None:
    for asset in names:
        if asset["name"].endswith(suffix):
            return asset
    return None


def main() -> int:
    tag = sys.argv[1]
    notes_file = Path(sys.argv[2])
    version = tag.lstrip("v")

    notes = notes_file.read_text(encoding="utf-8") if notes_file.exists() else ""
    published = os.environ.get("PUBLISHED_AT", "")

    found = assets(tag)

    # --- the desktop manifest ------------------------------------------------
    platforms: dict[str, dict[str, str]] = {}
    for target, bundle_suffix in DESKTOP.items():
        bundle = find(found, bundle_suffix)
        signature = find(found, bundle_suffix + ".sig")

        if not bundle or not signature:
            print(f"::warning::No signed bundle for {target}; leaving it out.")
            continue

        # The signature is small and lives in a file next to the bundle. It has
        # to be inlined here: the updater reads the manifest and nothing else.
        text = subprocess.run(
            ["gh", "release", "download", tag, "--pattern", signature["name"], "--output", "-"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        platforms[target] = {"signature": text, "url": bundle["url"]}

    if not platforms:
        print("::error::Not one signed desktop bundle was found; refusing to write a manifest.")
        return 1

    Path("latest.json").write_text(
        json.dumps(
            {"version": version, "notes": notes, "pub_date": published, "platforms": platforms},
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"latest.json covers: {', '.join(sorted(platforms))}")

    # --- the phone's manifest ------------------------------------------------
    apk = find(found, ".apk")
    if apk:
        Path("latest-android.json").write_text(
            json.dumps({"version": version, "notes": notes, "url": apk["url"]}, indent=2),
            encoding="utf-8",
        )
        print(f"latest-android.json points at {apk['name']}")
    else:
        # Not fatal: a desktop-only release is a real thing. But a phone would
        # then keep being offered the previous version, so say so loudly.
        print("::warning::No APK in this release; phones will not be offered it.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
