#!/usr/bin/env bash
set -euo pipefail
#MISE depends=["build:frontend"]
#MISE description="Preview production build locally"
#MISE dir="frontend"

pnpm exec vite preview
