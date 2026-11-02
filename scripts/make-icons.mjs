// Renders the Movement app icons to PNG with the pre-installed Chromium.
// Usage: npm run icons
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Uses the Playwright that ships with the environment (or a local install).
const { chromium } = require('playwright');
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const font = readFileSync(`${root}node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2`).toString('base64');

// Mark: "ooV" under the locked wordmark rules (style guide B7b) — two concrete o's under one bar
// sink 0.2em into the bottom edge; the orange capital V sinks 0.1em and overlaps by 0.13em.
// Geometry from Oswald 700 metrics (o advance .483em, V advance .526em, x-height .594em, cap .828em).
const F = 372; // font size in the 512 artboard (word ≈ 1.32F wide)
const floor = 512;
const ox1 = 0.012 * F; // no left bleed at icon size — legibility first
const ox2 = ox1 + 0.483 * F - 0.046 * F;
const vx = ox2 + 0.483 * F - 0.13 * F;
const grayBase = floor + 0.2 * F;
const orangeBase = floor + 0.1 * F;
const barTop = floor - 0.517 * F;
const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <style>@font-face{font-family:O;src:url(data:font/woff2;base64,${font}) format('woff2');}</style>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8d8b81"/><stop offset=".6" stop-color="#5f5e57"/><stop offset="1" stop-color="#4b4a45"/>
    </linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .08 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>
  <rect width="512" height="512" fill="#101110"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <text x="${ox1}" y="${grayBase}" font-family="O" font-weight="700" font-size="${F}" fill="url(#c)">o</text>
    <text x="${ox2}" y="${grayBase}" font-family="O" font-weight="700" font-size="${F}" fill="url(#c)">o</text>
    <text x="${ox1}" y="${grayBase}" font-family="O" font-weight="700" font-size="${F}" fill="#fff" filter="url(#n)">o</text>
    <text x="${ox2}" y="${grayBase}" font-family="O" font-weight="700" font-size="${F}" fill="#fff" filter="url(#n)">o</text>
    <rect x="${ox1 + 0.04 * F}" y="${barTop}" width="${ox2 + 0.483 * F - 0.04 * F - (ox1 + 0.04 * F)}" height="${0.085 * F}" fill="url(#c)"/>
    <text x="${vx}" y="${orangeBase}" font-family="O" font-weight="700" font-size="${F}" fill="#F05A24">V</text>
  </g>
</svg>`;

// [device px width, height, css width, css height, ratio] — portrait.
export const STARTUP_DEVICES = [
  [1320, 2868, 440, 956, 3],
  [1290, 2796, 430, 932, 3],
  [1260, 2736, 420, 912, 3],
  [1206, 2622, 402, 874, 3],
  [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3],
  [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3],
  [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2],
  [1080, 2340, 360, 780, 3],
  [750, 1334, 375, 667, 2],
  [1242, 2208, 414, 736, 3],
];
const ICON_VERSION = 'v4';
mkdirSync(`${root}public/icons`, { recursive: true });
const STARTUP = STARTUP_DEVICES.map(([w, h]) => [w, h]);
mkdirSync(`${root}public/splash`, { recursive: true });

const out = [
  // Versioned file names: iOS caches home-screen icons hard, so a new icon gets a new name.
  // Bump ICON_VERSION (here, index.html and vite.config.ts) whenever the artwork changes.
  [`public/icons/mov-${ICON_VERSION}-192.png`, 192, 0],
  [`public/icons/mov-${ICON_VERSION}-512.png`, 512, 0],
  [`public/icons/mov-${ICON_VERSION}-180.png`, 180, 0],
  [`public/icons/mov-${ICON_VERSION}-maskable-512.png`, 512, 56],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size, pad)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  writeFileSync(`${root}${file}`, await page.screenshot({ type: 'png' }));
  console.log('wrote', file);
}

// iOS launch images: plain Machine Black so launch goes black → animated splash, never white.
for (const [w, h] of STARTUP) {
  await page.setViewportSize({ width: 100, height: 100 });
  await page.setContent(`<html><body style="margin:0;background:#101110;width:${w}px;height:${h}px"></body></html>`);
  await page.setViewportSize({ width: w, height: h });
  writeFileSync(`${root}public/splash/launch-${w}x${h}.png`, await page.screenshot({ type: 'png' }));
}
console.log('wrote', STARTUP.length, 'launch images');
await browser.close();

// Favicon: the same mark as flat shapes — two concrete o's under one bar, orange V, cropped by the edge.
writeFileSync(
  `${root}public/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#101110"/><path d="M5 17c-3 0-4.5 2-4.5 5V32h9V22c0-3-1.5-5-4.5-5zm0 3c.7 0 1 .5 1 1.5V32H4V21.5c0-1 .3-1.5 1-1.5zM13.5 17c-3 0-4.5 2-4.5 5V32h9V22c0-3-1.5-5-4.5-5zm0 3c.7 0 1 .5 1 1.5V32h-2V21.5c0-1 .3-1.5 1-1.5z" fill="#77766D" fill-rule="evenodd"/><rect x="1" y="13" width="16" height="2.5" fill="#8d8b81"/><path d="M15.5 6h5l2.5 14 2.5-14h5L26 30h-6z" fill="#F05A24"/></svg>`,
);
console.log('wrote public/favicon.svg');
