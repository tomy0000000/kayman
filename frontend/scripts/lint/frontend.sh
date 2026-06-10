#!/usr/bin/env bash
set -euo pipefail
#MISE description="Lint frontend"
#MISE dir="frontend"

pnpm exec eslint .
