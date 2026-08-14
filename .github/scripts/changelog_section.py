#!/usr/bin/env python3
"""Extract one version's section from CHANGELOG.md.

The release notes and the changelog are the same text by construction: writing
them twice is how they start disagreeing, and the changelog is the copy that
gets reviewed in a pull request.
"""

import re
import sys
from pathlib import Path


def section_for(changelog: str, version: str) -> str:
    heading = re.compile(r"^## \[" + re.escape(version) + r"\]", re.MULTILINE)
    start = heading.search(changelog)
    if start is None:
        raise SystemExit(f"CHANGELOG.md has no section for {version}.")

    following = re.compile(r"^## \[", re.MULTILINE).search(changelog, start.end())
    body = changelog[start.end() : following.start() if following else len(changelog)]

    # Drop the rest of the heading line, then the link definitions at the foot.
    body = body.split("\n", 1)[1] if "\n" in body else ""
    body = re.sub(r"^\[[^\]]+\]:.*$", "", body, flags=re.MULTILINE)

    text = body.strip()
    if not text:
        raise SystemExit(f"The section for {version} in CHANGELOG.md is empty.")
    return text


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: changelog_section.py <tag|version> <output file>")

    version = sys.argv[1].removeprefix("v")
    changelog = Path("CHANGELOG.md").read_text(encoding="utf-8")
    Path(sys.argv[2]).write_text(section_for(changelog, version) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
