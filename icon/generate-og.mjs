// Generates icon/dist/kayman-og.svg — 1280x640 Open Graph / social preview image.
// Same island-bank scene as icon/generate-icon.mjs (scaled and shifted right)
// with a "kayman" wordmark on the left.
// Run: node icon/generate-og.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1280;
const H = 640;

// Scene group transform: icon coordinates (1024 canvas) → right side
const SCENE_SCALE = 0.68;
const SCENE_TX = 572;
const SCENE_TY = 48;

// Wordmark. One family, no fallbacks: render.mjs loads a single vendored
// Geist-Bold.ttf and disables the system font scan, so the wordmark renders
// identically everywhere. A fallback stack would reintroduce the host-dependent
// resolution that made this image differ between macOS and Docker.
const WORD = "Kayman";
const WORD_X = 96;
const WORD_Y = 372;
const WORD_SIZE = 150;

// Bank geometry (identical to generate-icon.mjs)
const BANK_CX = 384;
const BASE_BOTTOM = 776;
const STEP_H = 22;
const COL_W = 34;
const COL_H = 170;
const COL_OFFSETS = [-110, -37, 37, 110];
const LINTEL_H = 26;
const LINTEL_HALF_W = 140;
const PED_HALF_W = 132;
const PED_RISE = 72;

const STEP2_Y = BASE_BOTTOM - STEP_H;
const STEP1_Y = STEP2_Y - STEP_H;
const COL_TOP = STEP1_Y - COL_H;
const LINTEL_Y = COL_TOP - LINTEL_H;
const PED_APEX_Y = LINTEL_Y - 4 - PED_RISE;

const PALM_CROWN = [672, 392];

// Dune: full-bleed slab across the wide canvas
const DUNE_EDGE_Y = 520;
const DUNE_CTRL_Y = 440;

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
  .join("\n      ");

const columns = COL_OFFSETS.map(
  (dx) =>
    `<rect x="${BANK_CX + dx - COL_W / 2}" y="${COL_TOP}" width="${COL_W}" height="${COL_H}" rx="6" fill="url(#white)"/>`,
).join("\n      ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
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
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <path id="dune" d="M 0 ${DUNE_EDGE_Y} C 360 ${DUNE_CTRL_Y}, 920 ${DUNE_CTRL_Y}, ${W} ${DUNE_EDGE_Y} L ${W} ${H} L 0 ${H} Z" fill="url(#sand)"/>
  <g id="scene" transform="translate(${SCENE_TX} ${SCENE_TY}) scale(${SCENE_SCALE})">
    <ellipse cx="${BANK_CX}" cy="782" rx="165" ry="16" fill="#D89A4E" opacity="0.4"/>
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
    </g>
  </g>
  <text id="wordmark" x="${WORD_X}" y="${WORD_Y}" font-family="Geist" font-size="${WORD_SIZE}" font-weight="700" fill="#FFFFFF">${WORD}</text>
</svg>
`;

const dir = join(dirname(fileURLToPath(import.meta.url)), "dist");
mkdirSync(dir, { recursive: true });
const out = join(dir, "kayman-og.svg");
writeFileSync(out, svg);
console.log(`wrote ${out}`);
