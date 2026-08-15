#!/usr/bin/env python3
"""Writes SHA256SUMS.txt for a release, so a human download can be checked.

Every bundle the updater fetches is signed, and the updater refuses one that is
not — but that only protects the automatic path. Someone who downloads the
installer from the releases page by hand has nothing to compare against, and
"it came from GitHub" is not a check.

The values are GitHub's own: it computes a SHA-256 for every asset as it is
uploaded and returns it as `digest`. Taking them from there rather than
re-downloading eighty megabytes to hash it again is both faster and closer to
the truth — a hash computed here would only prove that this script downloaded
what it downloaded.

The file is written in the format `sha256sum -c` reads, so checking is one
command rather than comparing forty characters by eye.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

# Not worth a line each: these exist for the updater and nobody fetches them by
# hand. Listing them would bury the four files a person actually wants.
MACHINE_ONLY = (".sig", ".json")

# GitHub computes an asset's digest after the upload finishes, not during it, so
# a file uploaded moments ago can still answer without one.
ATTEMPTS = 6
PAUSE = 5


def assets_of(tag: str) -> list[dict]:
    return json.loads(
        subprocess.run(
            ["gh", "api", f"repos/{{owner}}/{{repo}}/releases/tags/{tag}"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )["assets"]


def wanted(asset: dict, out_name: str) -> bool:
    """Whether a person would ever download this by hand.

    A previous list is excluded by its published name rather than by whatever
    this run happens to write to: hashing the old list into the new one is
    meaningless, and tying that to the output path means a differently named
    output silently starts including it.
    """
    name = asset["name"]
    return not name.endswith(MACHINE_ONLY) and name not in {out_name, "SHA256SUMS.txt"}


def hash_of(asset: dict) -> str:
    """Downloads one asset and hashes it. The fallback, not the normal path."""
    print(f"::warning::{asset['name']} still has no digest from GitHub; hashing it here.")
    digest = hashlib.sha256()
    with urllib.request.urlopen(asset["browser_download_url"]) as response:
        for chunk in iter(lambda: response.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    tag = sys.argv[1]
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "SHA256SUMS.txt")

    # Wait for the stragglers rather than leaving them out. A checksum list that
    # silently skips a file is worse than none: it reads as complete, and the
    # one file somebody cannot verify is the one they were suspicious about.
    assets = assets_of(tag)
    for attempt in range(ATTEMPTS):
        missing = [a for a in assets if wanted(a, out.name) and not a.get("digest")]
        if not missing:
            break
        print(f"Waiting for a digest on: {', '.join(a['name'] for a in missing)}")
        time.sleep(PAUSE)
        assets = assets_of(tag)

    lines = [
        f"# Chronos Desktop {tag.lstrip('v')} — SHA-256 der Dateien in dieser Veröffentlichung.",
        "#",
        "# Prüfen unter Linux und macOS:   sha256sum -c SHA256SUMS.txt",
        "# Prüfen unter Windows:           certutil -hashfile <Datei> SHA256",
        "#",
        "# Die Werte stammen von GitHub selbst, berechnet beim Hochladen.",
        "",
    ]

    counted = 0
    for asset in sorted(assets, key=lambda a: a["name"]):
        if not wanted(asset, out.name):
            continue

        digest = asset.get("digest") or ""
        value = digest.removeprefix("sha256:") if digest.startswith("sha256:") else hash_of(asset)

        lines.append(f"{value}  {asset['name']}")
        counted += 1

    if counted == 0:
        print("::error::There was nothing to list; refusing to write an empty file.")
        return 1

    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{out} covers {counted} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
