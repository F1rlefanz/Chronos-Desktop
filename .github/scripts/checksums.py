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

import json
import subprocess
import sys
from pathlib import Path

# Not worth a line each: these exist for the updater and nobody fetches them by
# hand. Listing them would bury the four files a person actually wants.
MACHINE_ONLY = (".sig", ".json")


def main() -> int:
    tag = sys.argv[1]
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "SHA256SUMS.txt")

    release = json.loads(
        subprocess.run(
            ["gh", "api", f"repos/{{owner}}/{{repo}}/releases/tags/{tag}"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )

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
    for asset in sorted(release["assets"], key=lambda a: a["name"]):
        name = asset["name"]
        digest = asset.get("digest") or ""

        if name.endswith(MACHINE_ONLY) or name == out.name:
            continue
        if not digest.startswith("sha256:"):
            print(f"::warning::{name} has no SHA-256 from GitHub; left out.")
            continue

        lines.append(f"{digest.removeprefix('sha256:')}  {name}")
        counted += 1

    if counted == 0:
        print("::error::Not one asset had a digest; refusing to write an empty list.")
        return 1

    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{out} covers {counted} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
