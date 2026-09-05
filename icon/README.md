# Kayman Icon

Island-bank icon (Cayman Islands pun): white classical bank on a sand dune,
palm to the right, teal-to-blue sky.

## Files

| File                                     | What                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-icon.mjs`                      | **Final icon source.** Emits into `dist/`: `kayman.svg` (1024×1024 full-bleed, no baked corner mask, approved by a build/review agent loop on 2026-09-04), `kayman-maskable.svg` (scene shrunk inside the 80% safe circle), `kayman-favicon.svg` (`viewBox="0 0 32 32"`), and `kayman-grid.svg` (icon with the design-check grid on top: circles d=820/512/204, 128px gridlines). |
| `generate-og.mjs` → `dist/kayman-og.svg` | 1280×640 social image: the same scene plus a "Kayman" wordmark.                                                                                                                                                                                                                                                                                                                   |
| `render.mjs`                             | SVG → PNG renderer (`-w W -h H in.svg out.png`), wrapping `@resvg/resvg-js`.                                                                                                                                                                                                                                                                                                       |
| `fonts/Geist-Bold.ttf`                   | The only font `render.mjs` loads, vendored so the wordmark renders identically on every machine (SIL OFL 1.1, `fonts/LICENSE.txt`). Same family as the frontend's `@fontsource-variable/geist`, as a `.ttf` because resvg cannot read `.woff2`.                                                                                                                                     |
| `dist/`                                  | All build output (SVGs and PNGs), gitignored.                                                                                                                                                                                                                                                                                                                                     |

## Build

`mise run build:icon` and `mise run build:og-image` build every deliverable
(scripts live in `icon/scripts/build/`). `magick` comes from mise's `[tools]`,
so `mise install` provisions it. SVG rendering goes through `render.mjs`, which
wraps `@resvg/resvg-js`, so `pnpm -C icon install` is required too: the resvg
CLI is not used because it ships no linux/arm64 build and cannot be installed
in the Docker image. Hard-coded spec:

| Path                                    | Format                                                   | Dimension             |
| --------------------------------------- | -------------------------------------------------------- | --------------------- |
| `frontend/public/favicon.svg`           | SVG, `viewBox="0 0 32 32"`, no external fonts, under 5KB | scalable              |
| `frontend/public/favicon.ico`           | ICO, 3 layers                                            | 16×16 + 32×32 + 48×48 |
| `frontend/public/apple-touch-icon.png`  | PNG-24, sRGB, opaque, no rounded corners                 | 180×180               |
| `frontend/public/icon-192.png`          | PNG-24, sRGB, opaque                                     | 192×192               |
| `frontend/public/icon-512.png`          | PNG-24, sRGB, opaque                                     | 512×512               |
| `frontend/public/icon-maskable-192.png` | PNG-24, sRGB, opaque, content inside 80% safe circle     | 192×192               |
| `frontend/public/icon-maskable-512.png` | PNG-24, sRGB, opaque, content inside 80% safe circle     | 512×512               |
| `frontend/public/og-image.png`          | PNG, under 1MB                                           | 1200×630              |
| `icon/dist/kayman-1024.png`             | PNG-24, sRGB, opaque                                     | 1024×1024             |
| `icon/dist/github-social.png`           | PNG, under 1MB                                           | 1280×640              |
| `icon/dist/avatar-512.png`              | PNG                                                      | 512×512               |

All rows come from `icon.sh` except `og-image.png` and `github-social.png`,
which come from `og-image.sh`.

## Regenerate manually

```
node icon/generate-icon.mjs
```

Grid overlay and squircle-mask checks (`kayman-1024.png` comes from `mise run build:icon`):

```
node icon/render.mjs -w 1024 -h 1024 icon/dist/kayman-grid.svg icon/dist/grid-overlay.png
magick icon/dist/kayman-1024.png \( -size 1024x1024 xc:none -draw "roundrectangle 0,0,1023,1023,228,228" \) -compose DstIn -composite icon/dist/masked.png
```
