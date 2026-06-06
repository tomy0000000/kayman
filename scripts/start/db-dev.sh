#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start PostgreSQL database for development, DO NOT use this in production, data will NOT persist!"

CONTAINER_NAME="kayman-db"
ENV_FILE="instance/.env"

# Start docker daemon if it's not running
if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not running, starting Docker..."
    open -a Docker
    until docker info >/dev/null 2>&1; do
        sleep 1
    done
fi

# Check if db is already running
if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    echo "${CONTAINER_NAME} is already running"
    exit 0
fi

# Remove stopped container with the same name, if any
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    docker rm "${CONTAINER_NAME}" >/dev/null
fi

# Start container
docker run \
    -d \
    --name "${CONTAINER_NAME}" \
    --env-file "${ENV_FILE}" \
    -p 5432:5432 \
    postgres:17
