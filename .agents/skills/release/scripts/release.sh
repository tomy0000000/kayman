#!/usr/bin/env bash
# Local git work for a kayman release.
# Does NOT push and does NOT publish to GitHub — those happen after review.
#
# Usage: scripts/release.sh <version>     e.g. 0.12.0
#
# Steps performed:
#   1. Pre-flight checks; auto-stash unstaged work if needed
#   2. Checkout main, fast-forward pull, merge develop
#   3. Bump versions in frontend/package.json, backend/pyproject.toml,
#      backend/kayman/main.py; refresh backend/uv.lock
#   4. Commit `🔖 release: <version>`
#   5. Checkout develop, fast-forward merge main
#   6. Print follow-up commands (push + gh release create)
#
# On exit, working tree is on `develop`. If a stash was created in step 1
# the script pops it before exiting (success path only).

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <version>" >&2
  exit 2
fi

VERSION="$1"

if ! [[ "$VERSION" =~ ^0\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must match 0.<minor>.<patch> (zero-ver); got '$VERSION'" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo '')"
if [[ -n "$PREV_TAG" && "$PREV_TAG" == "$VERSION" ]]; then
  echo "error: tag $VERSION already exists" >&2
  exit 1
fi

START_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$START_BRANCH" != "develop" ]]; then
  echo "error: must start from 'develop' branch (currently on '$START_BRANCH')" >&2
  exit 1
fi

STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "→ stashing unstaged/untracked changes"
  git stash push -u -m "release-skill: $VERSION"
  STASHED=1
fi

echo "→ fetching origin"
git fetch origin

echo "→ checking out main and fast-forwarding"
git checkout main
git pull --ff-only origin main

echo "→ merging develop into main"
# Expect fast-forward; if it can't FF, bail so user can investigate.
git merge --ff-only develop

echo "→ bumping versions to $VERSION"
python3 "$SCRIPT_DIR/bump_package_json.py" "$VERSION"
python3 "$SCRIPT_DIR/bump_pyproject.py" "$VERSION"
python3 "$SCRIPT_DIR/bump_fastapi_main.py" "$VERSION"

echo "→ refreshing backend/uv.lock"
( cd backend && uv lock )

echo "→ committing release"
git add frontend/package.json backend/pyproject.toml backend/kayman/main.py backend/uv.lock
git commit -m "🔖 release: $VERSION"

echo "→ checking out develop and fast-forwarding main into it"
git checkout develop
git merge --ff-only main

if [[ "$STASHED" -eq 1 ]]; then
  echo "→ restoring stash"
  git stash pop
fi

cat <<EOF

✓ Local release prepared for $VERSION

Previous tag: ${PREV_TAG:-<none>}
Release commit on main: $(git rev-parse main)

Next steps (run after reviewing):
  git push origin main
  git push origin develop
  gh release create $VERSION --target main --title $VERSION --notes-file <path-to-notes.md>
EOF
