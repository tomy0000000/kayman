#!/usr/bin/env bash
set -euo pipefail
#MISE description="Upgrade database schema"
#MISE dir="backend"

if [[ "${ENVIRONMENT:-production}" == "production" && "${1:-}" != "--force" ]]; then
    echo "Refusing to upgrade: ENVIRONMENT is production. Pass --force to override." >&2
    exit 1
fi

uv run alembic upgrade head
