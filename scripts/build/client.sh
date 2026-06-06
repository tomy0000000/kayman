#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build OpenAPI client for the frontend"

# Remove a tmp file and remove on exit
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

# Convert openapi.json
cd "backend"
scripts/generate-openapi.sh "${TMP_FILE}"

# Generate client
cd "../frontend"
pnpm run generate-client --input "${TMP_FILE}"
