#!/usr/bin/env bash
set -euo pipefail
#MISE description="Format backend with ruff"
#MISE dir="backend"

uv run ruff format kayman
