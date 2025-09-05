#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/build_client.sh

# Remove a tmp file and remove on exit
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

# Convert openapi.json
cd "backend"
scripts/generate_openapi.sh "${TMP_FILE}"

# Generate client
cd "../frontend"
pnpm run generate-client --input "${TMP_FILE}"
