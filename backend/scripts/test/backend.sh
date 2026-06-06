#!/usr/bin/env bash
set -euo pipefail
#MISE description="Test backend"
#MISE dir="backend"

POSTGRES_PASSWORD=dummy uv run pytest
