#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build frontend for production"
#MISE dir="frontend"

pnpm exec tsc -b
pnpm exec vite build
