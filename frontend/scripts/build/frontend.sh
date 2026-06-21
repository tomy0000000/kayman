#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build frontend for production"
#MISE dir="frontend"

# Compile Typescript to Javascript
pnpm exec tsc --build

# Bundling with Vite
pnpm exec vite build
