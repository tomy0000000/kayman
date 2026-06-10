#!/usr/bin/env bash
set -euo pipefail
#MISE description="Test backend"
#MISE dir="backend"

POSTGRES_PASSWORD=dummy uv run pytest
if [[ -n "${MISE_PROJECT_ROOT:-}" ]]; then
  echo "View in browser: file://${MISE_PROJECT_ROOT}/backend/htmlcov/index.html"
fi
