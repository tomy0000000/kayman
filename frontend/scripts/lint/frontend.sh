#!/usr/bin/env bash
set -euo pipefail
#MISE description="Lint frontend"
#MISE dir="frontend"

# Typescript lint
pnpm exec tsc --build --noEmit

# ESLint
if [ -n "${CI:-}" ]; then
  # SARIF report for GitHub code scanning, failures are reported by the run below
  pnpm exec eslint . --format @microsoft/eslint-formatter-sarif --output-file eslint-results.sarif || true
fi
pnpm exec eslint .

# Format lint
pnpm exec prettier --check .
