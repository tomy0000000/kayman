#!/usr/bin/env sh
set -eu
# Usage: scripts/postinstall.sh

if [ "${VERCEL:-0}" -eq 1 ]; then
    # Download openapi.json
    ./scripts/download-schema.sh
fi

# Generate client
pnpm run generate-client

# Generate router
pnpm run generate-router
