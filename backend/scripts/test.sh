#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/test.sh

POSTGRES_PASSWORD=dummy uv run pytest
