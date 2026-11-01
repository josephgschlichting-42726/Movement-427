// Renders the Movement app icons to PNG with the pre-installed Chromium.
// Usage: npm run icons
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Uses the Playwright that ships with the environment (or a local install).
const { chromium } = require('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const font = readFileSync(`${root}node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2`).toString('base64');

// Mark: an oversized, cropped "M" in brushed concrete with a signal-orange bar — after the "25" mural.
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
    <text x="-30" y="560" font-family="O" font-weight="700" font-size="620" fill="url(#c)">M</text>
    <text x="-30" y="560" font-family="O" font-weight="700" font-size="620" fill="#fff" filter="url(#n)">M</text>
    <rect x="300" y="300" width="212" height="70" fill="#F05A24"/>
  </g>
</svg>`;

const out = [
  ['public/icon-192.png', 192, 0],
  ['public/icon-512.png', 512, 0],
  ['public/apple-touch-icon.png', 180, 0],
  ['public/icon-maskable-512.png', 512, 56],
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
await browser.close();

writeFileSync(
  `${root}public/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#101110"/><path d="M5 26V6h5l6 11 6-11h5v20h-5V15l-6 10-6-10v11z" fill="#77766D"/><rect x="18" y="19" width="14" height="4" fill="#F05A24"/></svg>`,
);
console.log('wrote public/favicon.svg');
