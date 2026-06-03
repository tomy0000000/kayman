#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/start-dev-db.sh
#
# DO NOT use this in production, data will NOT persist!

# Generate client
docker run \
    -d \
    --name kayman-db \
    --env-file instance/.env \
    -p 5432:5432 \
    postgres:17
