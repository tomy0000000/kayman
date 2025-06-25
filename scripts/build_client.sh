#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/build_client.sh

# Remove a tmp file and remove on exit
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

# Convert openapi.json
cd "backend"
POSTGRES_PASSWORD=dummy poetry run python -m kayman.openapi "${TMP_FILE}"

# Generate client
cd "../frontend"
pnpm run generate-client --input "${TMP_FILE}"
