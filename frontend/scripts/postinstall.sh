#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/postinstall.sh

if [ "${VERCEL:-0}" -eq 1 ]; then
    # Download openapi.json
    ./scripts/download-schema.sh

    # Generate client
    pnpm run generate-client
else
    # Run local script at root
    (cd .. && ./scripts/build_client.sh)
fi
