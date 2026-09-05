// Renders an SVG to a PNG at a fixed pixel size.
// Drop-in for the resvg CLI, which ships no linux/arm64 binary and so cannot be
// installed in the Docker build. @resvg/resvg-js is the same rendering engine
// with prebuilt binaries for every platform we build on.
// Run: node icon/render.mjs -w 512 -h 512 dist/kayman.svg dist/avatar-512.png

import { readFileSync, writeFileSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";

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

// resvg fits to a single dimension, so we fit by width and let the SVG's own
// aspect ratio produce the height. Every deliverable in the spec is rendered at
// its source aspect ratio, so a mismatch means the SVG changed shape.
const rendered = new Resvg(readFileSync(input, "utf8"), {
  fitTo: { mode: "width", value: width },
  // debian-slim ships no fontconfig, so resvg's system-font scan misses
  // /usr/share/fonts and silently drops <text> (the og-image wordmark).
  // Naming the directory finds it there; macOS still resolves its own fonts
  // through the normal system scan.
  font: { fontDirs: ["/usr/share/fonts"] },
}).render();

if (rendered.height !== height) {
  console.error(
    `error: ${input} rendered ${rendered.width}x${rendered.height}, expected ${width}x${height}`,
  );
  process.exit(1);
}

writeFileSync(output, rendered.asPng());
