#!/usr/bin/env bash
set -euo pipefail
#MISE description="Lint frontend"
#MISE dir="frontend"

# Typescript lint
pnpm exec tsc --build --noEmit

# ESLint
pnpm exec eslint .

# Format lint
pnpm exec prettier --check .
