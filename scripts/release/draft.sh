#!/usr/bin/env bash
set -euo pipefail
#MISE description="Replace old draft releases with a new draft pre-release (release workflow only)"
#MISE hide=true

# Usage: draft.sh <version> <sha> <notes-file>

VERSION="$1"
SHA="$2"
NOTES="$3"

for tag in $(gh release list --json tagName,isDraft --jq '.[] | select(.isDraft) | .tagName'); do
  gh release delete "$tag" --yes
done

gh release create "$VERSION" --draft --prerelease --target "$SHA" --title "$VERSION" --notes-file "$NOTES"
