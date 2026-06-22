#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start backend server with hot reload"
#MISE dir="backend"

# TODO: try to achieve these
# 1. integrated fastapi CLI logging with loguru
# 2. Mise task support colorful output for backend + frontend start task
uv run fastapi dev kayman/main.py \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
