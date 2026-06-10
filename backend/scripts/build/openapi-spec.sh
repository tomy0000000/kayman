#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build OpenAPI specification JSON"
#MISE dir="backend"
#USAGE arg "<json_path>" help="The output path for the OpenAPI JSON file"

POSTGRES_PASSWORD=dummy uv run python -m kayman.openapi "${1:-${usage_json_path?}}"
