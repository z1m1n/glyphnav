// Rasterizes demo/og.svg → demo/public/og.png (the 1200×630 social card).
//
// `og:image` must be a raster format (PNG/JPEG) — most social and AI link
// unfurlers won't render an SVG — so the committed card is a PNG generated from
// the SVG source. sharp is only present transitively under pnpm's store, so
// resolve it from there rather than assuming it's hoisted. Run with WSL node:
//   node demo/render-og.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  const store = fileURLToPath(new URL('../node_modules/.pnpm/', import.meta.url));
  const dir = readdirSync(store).find((d) => d.startsWith('sharp@'));
  sharp = require(`${store}${dir}/node_modules/sharp`);
}

const svg = readFileSync(new URL('./og.svg', import.meta.url));
const out = fileURLToPath(new URL('./public/og.png', import.meta.url));
const info = await sharp(svg).resize(1200, 630).png().toFile(out);
console.log(`wrote ${out} — ${info.width}x${info.height}`);
