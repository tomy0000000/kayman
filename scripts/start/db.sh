#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start PostgreSQL container for local development, DO NOT use this in production, data will NOT persist!"

CONTAINER_NAME="kayman-db"
ENV_FILE="instance/local.env"

# Start docker daemon if it's not running
if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not running, starting Docker..."
    open -a Docker
    until docker info >/dev/null 2>&1; do
        sleep 1
    done
fi

# Remove any existing container with the same name (running or stopped)
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

# Start container
docker run \
    -d \
    --name "${CONTAINER_NAME}" \
    --env-file "${ENV_FILE}" \
    -p 5432:5432 \
    postgres:17

# Wait until the db is ready before script terminate
until docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; do
    sleep 1
done
echo "${CONTAINER_NAME} is ready"
