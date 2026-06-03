#!/bin/bash
set -euo pipefail

IMAGE_NAME="tomy0000000/kayman:latest"

docker build \
    -t ${IMAGE_NAME} \
    .
