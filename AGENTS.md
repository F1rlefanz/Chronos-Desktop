# Agent instructions

The working instructions for this repository live in **[CLAUDE.md](CLAUDE.md)** — commands,
conventions, and the reasoning behind the parts of this codebase that look unusual on purpose.
They are not Claude-specific; read that file first, whichever agent you are.

Kept as a pointer rather than a copy on purpose: two files stating the same rules drift, and the
one you happened to read is then the wrong one.

The single rule worth repeating here, because it is the one most easily forgotten:

> **A change a user would notice needs an entry in [CHANGELOG.md](CHANGELOG.md), written in the
> same pull request as the change.** Not at release time. `CHANGELOG.md` is curated for people who
> use Chronos — features and fixed behaviour in plain language — and is deliberately not a second
> copy of the commit history. Refactors, tests, tooling and dependency bumps do not belong in it.

See the section _"The changelog is part of the work, not paperwork"_ in CLAUDE.md for what counts
as user-visible and what does not.
