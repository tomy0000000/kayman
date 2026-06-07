#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start frontend server with hot reload"
#MISE dir="frontend"

pnpm exec vite
