// Generates the icon SVGs:
//   icon/dist/kayman.svg          1024x1024 full-bleed square (no rounded
//                                 corners / no mask: the OS applies its own
//                                 corner mask)
//   icon/dist/kayman-maskable.svg same, scene shrunk so content sits inside
//                                 the 80% safe circle (PWA maskable icons)
//   icon/dist/kayman-favicon.svg  same drawing, viewBox="0 0 32 32"
//   icon/dist/kayman-grid.svg     icon with the design-check grid drawn on top
// Island-bank scene laid out on the 1024 app-icon grid (circles d=820/512/204
// centered at 512,512; gridlines every 128).
// Run: node icon/generate-icon.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;

// Maskable variant: scene scaled about the ground point so it stays planted
// on the dune; 0.92 brings the widest frond tip from radius ~409 to ~382,
// inside the 80% safe circle (radius 409.6) with real margin.
const MASKABLE_SCALE = 0.92;
const GROUND = [512, 790];

// Bank left of center, centered on vertical gridline x=384 (3 * 128)
const BANK_CX = 384;
const BASE_BOTTOM = 776; // bottom of the stepped base, buried in the dune
const STEP_H = 22; // each of the two base steps
const COL_W = 34;
const COL_H = 170;
const COL_OFFSETS = [-110, -37, 37, 110];
const LINTEL_H = 26;
const LINTEL_HALF_W = 140;
const PED_HALF_W = 132;
const PED_RISE = 72; // lintel top to pediment apex

// Derived bank rows (stacked bottom-up from BASE_BOTTOM)
const STEP2_Y = BASE_BOTTOM - STEP_H; // wide lower step
const STEP1_Y = STEP2_Y - STEP_H; // narrow upper step
const COL_TOP = STEP1_Y - COL_H;
const LINTEL_Y = COL_TOP - LINTEL_H;
const PED_APEX_Y = LINTEL_Y - 4 - PED_RISE;

// Palm crown upper right; fronds reach ~the 820 grid circle, clear air
// between crown and pediment apex
const PALM_CROWN = [672, 392];

// Dune: full-bleed slab, crest ~y=746 at center, bleeds to bottom/side edges
const DUNE_EDGE_Y = 848; // where the crest curve meets the canvas sides
const DUNE_CTRL_Y = 712; // bezier control height for the crest

const fronds = [
  // [angle, length, flip, fill]
  [-58, 190, false, "url(#frondMid)"],
  [-36, 210, false, "url(#frondLight)"],
  [8, 205, false, "url(#frondMid)"],
  [40, 185, false, "url(#frondDark)"],
  [-40, 175, true, "url(#frondLight)"],
  [5, 195, true, "url(#frondMid)"],
  [38, 170, true, "url(#frondDark)"],
];

function frondPath(L) {
  const w = 0.45 * L;
  return [
    `M 0 0`,
    `C ${0.35 * L} ${-w}, ${0.8 * L} ${-w}, ${L} ${-0.15 * L}`,
    `C ${0.75 * L} ${-0.2 * L}, ${0.35 * L} ${-0.1 * L}, 0 0`,
    `Z`,
  ].join(" ");
}

const frondEls = fronds
  .map(([angle, len, flip, fill]) => {
    const t = `translate(${PALM_CROWN[0]} ${PALM_CROWN[1]})${flip ? " scale(-1 1)" : ""} rotate(${angle})`;
    return `<path d="${frondPath(len)}" fill="${fill}" transform="${t}"/>`;
  })
  .join("\n    ");

const columns = COL_OFFSETS.map(
  (dx) =>
    `<rect x="${BANK_CX + dx - COL_W / 2}" y="${COL_TOP}" width="${COL_W}" height="${COL_H}" rx="6" fill="url(#white)"/>`,
).join("\n    ");

const backdrop = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#41C8DE"/>
      <stop offset="1" stop-color="#1C7EC2"/>
    </linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFDA90"/>
      <stop offset="1" stop-color="#EFB05C"/>
    </linearGradient>
    <linearGradient id="white" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#E9EDF1"/>
    </linearGradient>
    <linearGradient id="trunk" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#7BBF3C"/>
      <stop offset="1" stop-color="#B5DC4B"/>
    </linearGradient>
    <linearGradient id="frondLight" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8FCF3F"/>
      <stop offset="1" stop-color="#C0E455"/>
    </linearGradient>
    <linearGradient id="frondMid" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6DBB3B"/>
      <stop offset="1" stop-color="#9AD246"/>
    </linearGradient>
    <linearGradient id="frondDark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#57AF37"/>
      <stop offset="1" stop-color="#7FC53F"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  <path id="dune" d="M 0 ${DUNE_EDGE_Y} C 288 ${DUNE_CTRL_Y}, 736 ${DUNE_CTRL_Y}, ${SIZE} ${DUNE_EDGE_Y} L ${SIZE} ${SIZE} L 0 ${SIZE} Z" fill="url(#sand)"/>`;

const scene = `<ellipse cx="${BANK_CX}" cy="782" rx="165" ry="16" fill="#D89A4E" opacity="0.4"/>
  <ellipse cx="634" cy="792" rx="55" ry="11" fill="#D89A4E" opacity="0.4"/>
  <g id="palm">
    <path d="M 604 790 C 632 680, 634 500, 660 404 L 688 408 C 670 500, 684 680, 666 790 Z" fill="url(#trunk)"/>
    ${frondEls}
    <circle cx="659" cy="400" r="14" fill="#57AF37"/>
    <circle cx="684" cy="395" r="11" fill="#6DBB3B"/>
  </g>
  <g id="bank" transform="translate(${BANK_CX} ${BASE_BOTTOM}) scale(1.09) translate(${-BANK_CX} ${-BASE_BOTTOM})">
    <path d="M ${BANK_CX - PED_HALF_W} ${LINTEL_Y - 4} L ${BANK_CX} ${PED_APEX_Y} L ${BANK_CX + PED_HALF_W} ${LINTEL_Y - 4} Z"
      fill="url(#white)" stroke="url(#white)" stroke-width="20" stroke-linejoin="round"/>
    <rect x="${BANK_CX - LINTEL_HALF_W}" y="${LINTEL_Y}" width="${2 * LINTEL_HALF_W}" height="${LINTEL_H}" rx="8" fill="url(#white)"/>
    ${columns}
    <rect x="${BANK_CX - 116}" y="${STEP1_Y}" width="232" height="${STEP_H}" rx="6" fill="url(#white)"/>
    <rect x="${BANK_CX - 134}" y="${STEP2_Y}" width="268" height="${STEP_H}" rx="6" fill="url(#white)"/>
  </g>`;

function doc(viewBox, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n  ${body}\n</svg>\n`;
}

// Design-check grid: 128px gridlines, center diagonals, and the d=820/512/204
// circles centered at (512,512)
function gridMarkup() {
  const s = `stroke="#1B66C9" stroke-width="2" fill="none" opacity="0.5"`;
  const els = [];
  for (let i = 128; i < SIZE; i += 128) {
    els.push(`<line x1="${i}" y1="0" x2="${i}" y2="${SIZE}" ${s}/>`);
    els.push(`<line x1="0" y1="${i}" x2="${SIZE}" y2="${i}" ${s}/>`);
  }
  els.push(`<line x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" ${s}/>`);
  els.push(`<line x1="${SIZE}" y1="0" x2="0" y2="${SIZE}" ${s}/>`);
  for (const d of [820, 512, 204]) {
    els.push(`<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${d / 2}" ${s}/>`);
  }
  return els.join("\n  ");
}

const maskableScene = `<g transform="translate(${GROUND[0]} ${GROUND[1]}) scale(${MASKABLE_SCALE}) translate(${-GROUND[0]} ${-GROUND[1]})">
  ${scene}
  </g>`;

const outputs = {
  "kayman.svg": doc(`0 0 ${SIZE} ${SIZE}`, `${backdrop}\n  ${scene}`),
  "kayman-maskable.svg": doc(`0 0 ${SIZE} ${SIZE}`, `${backdrop}\n  ${maskableScene}`),
  "kayman-favicon.svg": doc(
    "0 0 32 32",
    `<g transform="scale(${32 / SIZE})">\n  ${backdrop}\n  ${scene}\n  </g>`,
  ),
  "kayman-grid.svg": doc(
    `0 0 ${SIZE} ${SIZE}`,
    `${backdrop}\n  ${scene}\n  ${gridMarkup()}`,
  ),
};

const dir = join(dirname(fileURLToPath(import.meta.url)), "dist");
mkdirSync(dir, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const out = join(dir, name);
  writeFileSync(out, content);
  console.log(`wrote ${out}`);
}
