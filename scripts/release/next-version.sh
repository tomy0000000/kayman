#!/usr/bin/env bash
set -euo pipefail
#MISE description="Print the next release version and commit (release workflow only)"
#MISE hide=true

# Usage: next-version.sh [version]     defaults to the next minor of the latest tag
# Prints `version=` and `sha=` lines, or nothing when develop has no new commits.

prev="$(git describe --tags --abbrev=0)"
if [[ "$(git rev-list --count "$prev"..HEAD)" -eq 0 ]]; then
  echo "No commits since $prev, nothing to release." >&2
  exit 0
fi

IFS=. read -r major minor _ <<< "$prev"
echo "version=${1:-$major.$((minor + 1)).0}"
echo "sha=$(git rev-parse HEAD)"
