#!/usr/bin/env bash
set -euo pipefail
#MISE description="Upgrade database schema"
#MISE dir="backend"

uv run alembic upgrade head
