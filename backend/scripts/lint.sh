#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/lint.sh

uv run mypy kayman
uv run ruff check kayman
uv run ruff format kayman --check
