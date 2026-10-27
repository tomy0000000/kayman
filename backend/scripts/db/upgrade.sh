#!/usr/bin/env bash
set -euo pipefail
#MISE description="Upgrade database schema"
#MISE dir="backend"

if [[ (",${MISE_ENV:-}," == *,production,* || "${ENVIRONMENT:-}" == "production") && "${1:-}" != "--force" ]]; then
    echo "Refusing to upgrade: targeting production. Pass --force to override." >&2
    exit 1
fi

uv run alembic upgrade head
