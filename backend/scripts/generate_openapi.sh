#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/generate_openapi.sh <path_to_openapi.json>

POSTGRES_PASSWORD=dummy uv run python -m kayman.openapi "${1}"
