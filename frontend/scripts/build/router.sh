#!/usr/bin/env bash
set -euo pipefail
#MISE description="Generate frontend TanStack router"
#MISE dir="frontend"

pnpm exec tsr generate
