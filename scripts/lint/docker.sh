#!/usr/bin/env bash
set -euo pipefail
#MISE description="Lint Dockerfile"

hadolint Dockerfile
