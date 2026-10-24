#!/usr/bin/env bash
# Stop hook: block the hand-back once per new code diff until the reviewer subagent has run.
set -euo pipefail

input=$(cat)
state="$(git rev-parse --absolute-git-dir)/claude-reviewed-diff"
untracked=$(git ls-files --others --exclude-standard -- backend frontend)

diff_hash() {
  git diff HEAD -- backend frontend
  printf '%s\n' "$untracked"
  while IFS= read -r file; do
    if [ -n "$file" ]; then cat "$file"; fi
  done <<<"$untracked"
}

hash=$(diff_hash | shasum | cut -d' ' -f1)

# The review turn itself: record the post-fix diff so the fixes don't retrigger a review.
if [ "$(jq -r '.stop_hook_active' <<<"$input")" = "true" ]; then
  echo "$hash" >"$state"
  exit 0
fi

# A release version bump is not code: skip when nothing else changed.
non_release=$(git diff HEAD --name-only -- backend frontend |
  grep -vxF -e backend/kayman/main.py -e backend/pyproject.toml -e backend/uv.lock -e frontend/package.json || true)
if [ -z "$non_release" ] && [ -z "$untracked" ]; then
  exit 0
fi

if [ -f "$state" ] && [ "$(cat "$state")" = "$hash" ]; then
  exit 0
fi

jq -n '{
  decision: "block",
  reason: "Code under backend/ or frontend/ changed since the last review. Before handing back: run the `reviewer` subagent on the uncommitted changes, verify each finding against the code, and fix the confirmed ones. Then tell the user what the reviewer found and what you fixed, or that it found nothing."
}'
