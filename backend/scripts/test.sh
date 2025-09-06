#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/test.sh

POSTGRES_PASSWORD=dummy poetry run pytest
