#!/usr/bin/env bash
set -euo pipefail
#MISE description="Format frontend with Prettier"
#MISE dir="frontend"

pnpm exec prettier -w .
