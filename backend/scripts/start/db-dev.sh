#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start PostgreSQL, upgrade schema, and seed mock data for local development"
#MISE depends=["setup:db"]
#MISE dir="backend"

uv run python -m kayman.mock_data.seed "$@"
