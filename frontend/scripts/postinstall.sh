#!/usr/bin/env sh
set -eu

if [ "${VERCEL:-0}" -eq 1 ]; then
    # Download openapi.json
    ./scripts/download-schema.sh
fi

# Generate client
mise run build:openapi-client

# Generate router
mise run build:frontend-router
