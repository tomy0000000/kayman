#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start backend server with hot reload"
#MISE dir="backend"

# TODO: when we upgrade to use FastAPI CLI, check
# 1. if logging can be integrated with loguru
# 2. Mise task support colorful output for backend + frontend start task
uv run uvicorn kayman.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level trace
