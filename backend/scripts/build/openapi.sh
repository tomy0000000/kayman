#!/usr/bin/env bash
set -euo pipefail
#MISE description="Generate OpenAPI schema JSON"
#MISE dir="backend"
# Usage: scripts/generate-openapi.sh <path_to_openapi.json>

POSTGRES_PASSWORD=dummy uv run python -m kayman.openapi "${1}"
