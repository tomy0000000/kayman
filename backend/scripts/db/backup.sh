#!/usr/bin/env bash
set -euo pipefail
#MISE description="Backup PostgreSQL database to a local dump file"
#MISE dir="backend"

# Load ENVs
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../instance/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
fi
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Generate filename
BACKUP_FILE="kayman_$(date +'%Y-%m-%dT%H_%M_%S').dump"

# Dump Postgres Data
pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-owner \
    --disable-triggers \
    >"${BACKUP_FILE}"
