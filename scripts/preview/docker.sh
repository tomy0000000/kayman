#!/usr/bin/env bash
set -euo pipefail
#MISE description="Preview docker run by connecting to the development environment"

IMAGE_NAME="tomy0000000/kayman:latest"
ENV_FILE="instance/development.env"

docker run \
    --rm \
    --env-file "${ENV_FILE}" \
    -p 8000:8000 \
    "${IMAGE_NAME}"
