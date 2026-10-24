#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build the kayman CLI binary"
#MISE dir="cli"

# go:embed only reads files inside the package, so generate the spec here and remove on exit
SPEC_FILE="${PWD}/openapi.json"
trap 'rm -f "${SPEC_FILE}"' EXIT

# Generate openapi.json
mise run build:openapi-spec -- "${SPEC_FILE}"

# Build the binary with the spec embedded and the version stamped in
go build -ldflags "-X main.version=$(git describe --tags --always --dirty)" -o kayman .
