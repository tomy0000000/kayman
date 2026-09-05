// Renders an SVG to a PNG at a fixed pixel size.
// Drop-in for the resvg CLI, which ships no linux/arm64 binary and so cannot be
// installed in the Docker build. @resvg/resvg-js is the same rendering engine
// with prebuilt binaries for every platform we build on.
// Run: node icon/render.mjs -w 512 -h 512 dist/kayman.svg dist/avatar-512.png

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

// The one font every render uses. Vendored rather than taken from a system
// font directory: resvg resolves families against whatever the host happens to
// have installed, so a system scan renders the wordmark in Helvetica on macOS
// and Liberation Sans in Docker, from the same SVG. Loading exactly one file
// with loadSystemFonts disabled makes the output identical on every machine.
// Geist is the frontend's typeface (@fontsource-variable/geist), but those are
// .woff2, which resvg cannot read: it drops the text without an error. This is
// the same family as a .ttf. SIL OFL 1.1, see fonts/LICENSE.txt.
const FONT = join(dirname(fileURLToPath(import.meta.url)), "fonts", "Geist-Bold.ttf");

const args = process.argv.slice(2);
const positional = [];
let width;
let height;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-w") width = Number(args[++i]);
  else if (args[i] === "-h") height = Number(args[++i]);
  else positional.push(args[i]);
}

const [input, output] = positional;
if (!width || !height || !input || !output) {
  console.error("usage: render.mjs -w <width> -h <height> <input.svg> <output.png>");
  process.exit(1);
}

// resvg drops <text> silently when it cannot resolve a font, which is how a
// wordmark-less og-image shipped before. Fail loudly instead.
if (!existsSync(FONT)) {
  console.error(`error: missing ${FONT}`);
  process.exit(1);
}

// resvg fits to a single dimension, so we fit by width and let the SVG's own
// aspect ratio produce the height. Every deliverable in the spec is rendered at
// its source aspect ratio, so a mismatch means the SVG changed shape.
const rendered = new Resvg(readFileSync(input, "utf8"), {
  fitTo: { mode: "width", value: width },
  // With the system scan off and a single font loaded, resvg uses that font for
  // every <text> regardless of the family named in the SVG, so the render is
  // reproducible across machines and architectures.
  font: { loadSystemFonts: false, fontFiles: [FONT] },
}).render();

if (rendered.height !== height) {
  console.error(
    `error: ${input} rendered ${rendered.width}x${rendered.height}, expected ${width}x${height}`,
  );
  process.exit(1);
}

writeFileSync(output, rendered.asPng());
