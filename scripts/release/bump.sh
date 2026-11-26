#!/usr/bin/env bash
set -euo pipefail
#MISE description="Commit the version bump on develop and fast-forward main (release workflow only)"
#MISE hide=true

# Usage: bump.sh <version> <sha>     <sha> is the develop commit the draft was made from

VERSION="$1"
SHA="$2"
cd "$(git rev-parse --show-toplevel)"

if [[ "$(git rev-parse HEAD)" != "$SHA" ]]; then
  echo "::error::develop moved since the draft. Re-run the workflow to redraft."
  exit 1
fi
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "::error::main has commits that develop lacks."
  exit 1
fi

python3 scripts/release/bump_versions.py "$VERSION"
(cd backend && uv lock)

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add frontend/package.json icon/package.json backend/pyproject.toml backend/kayman/main.py backend/uv.lock
git commit -m "🔖 release: $VERSION"
git branch -f main HEAD
