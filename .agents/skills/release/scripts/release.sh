#!/usr/bin/env bash
# Local git work for a kayman release.
# Does NOT push and does NOT publish to GitHub — those happen after review.
#
# Usage: scripts/release.sh <version>     e.g. 0.12.0
#
# Steps performed:
#   1. Pre-flight checks: on develop, main in sync with origin/main, and
#      develop fast-forwards from main; auto-stash unstaged work if needed
#   2. Bump versions in frontend/package.json, icon/package.json,
#      backend/pyproject.toml, backend/kayman/main.py; refresh backend/uv.lock
#   3. Commit `🔖 release: <version>` on develop
#   4. Fast-forward main to develop (no checkout, so files under .agents/ that
#      only exist on develop are never deleted and recreated)
#   5. Print follow-up commands (push + gh release create)
#
# The working tree stays on `develop` throughout. If a stash was created in
# step 1 the script pops it before exiting (success path only).

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

echo "→ fetching origin"
git fetch origin

if [[ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]]; then
  echo "error: main differs from origin/main; reconcile them before releasing" >&2
  exit 1
fi

if ! git merge-base --is-ancestor main develop; then
  echo "error: develop does not fast-forward from main (someone pushed to main directly?)" >&2
  exit 1
fi

STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "→ stashing unstaged/untracked changes"
  git stash push -u -m "release-skill: $VERSION"
  STASHED=1
fi

echo "→ bumping versions to $VERSION"
python3 "$SCRIPT_DIR/bump_package_json.py" "$VERSION"
python3 "$SCRIPT_DIR/bump_pyproject.py" "$VERSION"
python3 "$SCRIPT_DIR/bump_fastapi_main.py" "$VERSION"

echo "→ refreshing backend/uv.lock"
( cd backend && uv lock )

echo "→ committing release"
git add frontend/package.json icon/package.json backend/pyproject.toml backend/kayman/main.py backend/uv.lock
git commit -m "🔖 release: $VERSION"

echo "→ fast-forwarding main to develop"
git branch -f main develop

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
