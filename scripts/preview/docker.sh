#!/usr/bin/env bash
set -euo pipefail
#MISE description="Preview docker run by connecting to the development environment"

IMAGE_NAME="tomy0000000/kayman:latest"
ENV_FILE="instance/development.env"
CLIENTS_JSON="clients.json"
HOST_PATH="./backend/instance/${CLIENTS_JSON}"
MOUNT_PATH="/etc/secrets/${CLIENTS_JSON}"

docker run \
    --rm \
    --env-file "${ENV_FILE}" \
    --volume "${HOST_PATH}:${MOUNT_PATH}" \
    --publish 8000:8000 \
    "${IMAGE_NAME}"
