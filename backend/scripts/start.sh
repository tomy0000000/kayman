#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/start.sh

uv run uvicorn kayman.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level trace
