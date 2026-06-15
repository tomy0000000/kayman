#!/usr/bin/env bash
set -euo pipefail
#MISE description="Seed dev database with mock data"
#MISE dir="backend"

uv run python -m kayman.mock_data.seed "$@"
