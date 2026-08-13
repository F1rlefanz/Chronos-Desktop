#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web; local devs manage their own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# bun.lock is the repo's only lockfile, so bun is the faithful installer.
# Plain install (not --frozen-lockfile / npm ci) keeps this idempotent and
# lets it reuse an already-populated node_modules from the cached container.
if command -v bun >/dev/null 2>&1; then
  bun install
else
  echo "bun not found, falling back to npm install" >&2
  npm install
fi
