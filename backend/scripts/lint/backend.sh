#!/usr/bin/env bash
set -euo pipefail
#MISE description="Lint backend"
#MISE dir="backend"

uv run mypy kayman
uv run ruff check kayman
uv run ruff format kayman --check
