#!/usr/bin/env bash
set -euo pipefail
#MISE description="Build icon deliverables (favicon, PWA icons, touch icon, avatar)"
#MISE dir="icon"

# Hard-coded spec (see icon/README.md):
#   ../frontend/public/favicon.svg            SVG, viewBox="0 0 32 32", no external fonts, under 5KB
#   ../frontend/public/favicon.ico            ICO, 3 layers: 16x16 + 32x32 + 48x48
#   ../frontend/public/apple-touch-icon.png   PNG-24, sRGB, opaque, no rounded corners, 180x180
#   ../frontend/public/icon-192.png           PNG-24, sRGB, opaque, 192x192
#   ../frontend/public/icon-512.png           PNG-24, sRGB, opaque, 512x512
#   ../frontend/public/icon-maskable-192.png  PNG-24, sRGB, opaque, content inside 80% safe circle, 192x192
#   ../frontend/public/icon-maskable-512.png  PNG-24, sRGB, opaque, content inside 80% safe circle, 512x512
#   dist/kayman-1024.png                      PNG-24, sRGB, opaque, 1024x1024
#   dist/avatar-512.png                       PNG, 512x512

PUBLIC_DIR="../frontend/public"
DIST_DIR="dist"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# Generate the SVG sources
node generate-icon.mjs
mkdir -p "${DIST_DIR}"

# Render an SVG at NxN and flatten to opaque PNG-24 in sRGB
png24() { # svg size dest
  node render.mjs -w "$2" -h "$2" "$1" "${TMP_DIR}/raw.png"
  magick "${TMP_DIR}/raw.png" -colorspace sRGB -alpha off -define png:exclude-chunks=date,time "PNG24:$3"
}

# favicon.svg: scalable, viewBox 0 0 32 32, under 5KB
cp "${DIST_DIR}/kayman-favicon.svg" "${PUBLIC_DIR}/favicon.svg"
favicon_bytes="$(wc -c < "${PUBLIC_DIR}/favicon.svg")"
if [ "${favicon_bytes}" -gt 5120 ]; then
  echo "error: favicon.svg is ${favicon_bytes}B, spec says under 5KB" >&2
  exit 1
fi

# favicon.ico: 16 + 32 + 48 layers
for size in 16 32 48; do
  node render.mjs -w "${size}" -h "${size}" "${DIST_DIR}/kayman.svg" "${TMP_DIR}/fav-${size}.png"
done
magick "${TMP_DIR}/fav-16.png" "${TMP_DIR}/fav-32.png" "${TMP_DIR}/fav-48.png" -define png:exclude-chunks=date,time "${PUBLIC_DIR}/favicon.ico"

png24 "$DIST_DIR/kayman.svg" 180 "${PUBLIC_DIR}/apple-touch-icon.png"
png24 "$DIST_DIR/kayman.svg" 192 "${PUBLIC_DIR}/icon-192.png"
png24 "$DIST_DIR/kayman.svg" 512 "${PUBLIC_DIR}/icon-512.png"
png24 "$DIST_DIR/kayman-maskable.svg" 192 "${PUBLIC_DIR}/icon-maskable-192.png"
png24 "$DIST_DIR/kayman-maskable.svg" 512 "${PUBLIC_DIR}/icon-maskable-512.png"
png24 "$DIST_DIR/kayman.svg" 1024 "${DIST_DIR}/kayman-1024.png"

# avatar: plain PNG
node render.mjs -w 512 -h 512 "$DIST_DIR/kayman.svg" "${DIST_DIR}/avatar-512.png"

echo "built ${PUBLIC_DIR}/favicon.svg"
echo "built ${PUBLIC_DIR}/favicon.ico"
echo "built ${PUBLIC_DIR}/apple-touch-icon.png"
echo "built ${PUBLIC_DIR}/icon-192.png"
echo "built ${PUBLIC_DIR}/icon-512.png"
echo "built ${PUBLIC_DIR}/icon-maskable-192.png"
echo "built ${PUBLIC_DIR}/icon-maskable-512.png"
echo "built ${DIST_DIR}/kayman-1024.png"
echo "built ${DIST_DIR}/avatar-512.png"
