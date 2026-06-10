#!/usr/bin/env bash
set -euo pipefail
#MISE description="Restore PostgreSQL database from a dump file"
#MISE dir="backend"

# Validate file path
if [ $# -eq 0 ]; then
    echo "Usage: scripts/restore.sh path/to/data.dump"
    exit 1
fi
RESTORE_FILE="${1}"

# Load ENVs
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../instance/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
fi
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Restore Postgres Data
psql \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --file="${RESTORE_FILE}"
