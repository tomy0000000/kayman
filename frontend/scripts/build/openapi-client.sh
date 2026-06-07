#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build OpenAPI client for the frontend"
#MISE dir="frontend"

# Create a tmp file to receive the OpenAPI JSON and remove on exit
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

# Generate openapi.json
mise run build:openapi-spec -- "${TMP_FILE}"

# Generate client
pnpm exec openapi-ts --input "${TMP_FILE}"
