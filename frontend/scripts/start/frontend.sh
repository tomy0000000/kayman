#!/usr/bin/env bash
set -euo pipefail
#MISE description="Start frontend server with hot reload"
#MISE dir="frontend"

trap 'exit 0' INT TERM

pnpm exec vite --host
