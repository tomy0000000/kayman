#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build social preview images (og-image, GitHub social)"
#MISE dir="icon"

# Hard-coded spec (see icon/README.md):
#   ../frontend/public/og-image.png  PNG, under 1MB, 1200x630
#   dist/github-social.png          PNG, under 1MB, 1280x640
# resvg and magick (ImageMagick) are provisioned by mise ([tools] in mise.toml).

PUBLIC_DIR="../frontend/public"
DIST_DIR="dist"

# Generate the SVG source
node generate-og.mjs
mkdir -p "${DIST_DIR}"

# github-social: native 2:1 render
resvg -w 1280 -h 640 "${DIST_DIR}/kayman-og.svg" "${DIST_DIR}/github-social.png"

# og-image: 1200x630 (1.905:1), cover-scale the 2:1 render and center-crop
magick "${DIST_DIR}/github-social.png" -resize 1200x630^ -gravity center -extent 1200x630 "${PUBLIC_DIR}/og-image.png"

for f in "${DIST_DIR}/github-social.png" "${PUBLIC_DIR}/og-image.png"; do
  bytes="$(stat -f%z "${f}")"
  if [ "${bytes}" -gt 1048576 ]; then
    echo "error: ${f} is ${bytes}B, spec says under 1MB" >&2
    exit 1
  fi
done

echo "built ${PUBLIC_DIR}/og-image.png"
echo "built ${DIST_DIR}/github-social.png"
