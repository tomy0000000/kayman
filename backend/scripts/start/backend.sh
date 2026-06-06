#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start backend server with hot reload"
#MISE dir="backend"

uv run uvicorn kayman.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level trace
