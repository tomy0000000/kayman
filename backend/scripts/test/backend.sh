#!/usr/bin/env bash
set -euo pipefail
#MISE description="Test backend"
#MISE dir="backend"

POSTGRES_PASSWORD=dummy uv run pytest
echo "View in browser: file://${MISE_PROJECT_ROOT}/backend/htmlcov/index.html"
