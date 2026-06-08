#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build Docker image"

IMAGE_NAME="tomy0000000/kayman:latest"

docker build \
    -t ${IMAGE_NAME} \
    .
