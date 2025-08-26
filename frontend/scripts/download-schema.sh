#!/usr/bin/env bash
set -euxo pipefail
# Usage: scripts/download-schema.sh

# Read API_HOST env exit if failed
api_host="${API_HOST:-}"

# Download to tmp dir
curl -fsSL "https://${api_host}/openapi.json" -o /tmp/openapi.json
