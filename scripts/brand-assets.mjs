// Regenerates every brand asset from a single source of truth.
//   node scripts/brand-assets.mjs
// Requires rsvg-convert (brew install librsvg).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const YELLOW = '#F5C518'; // brand fill
const INK = '#231A00'; // the mark on yellow
const DARK = '#17140C'; // dark ground (dark splash)

/** The Watchline mark: a timeline, its watched portion filled, with a playhead.
 *  Drawn in a 0..100 box. */
const mark = (colour) => `
  <rect x="10" y="44" width="80" height="12" rx="6" fill="${colour}" fill-opacity="0.22"/>
  <rect x="10" y="44" width="48" height="12" rx="6" fill="${colour}"/>
  <rect x="53" y="32" width="10" height="36" rx="3" fill="${colour}"/>`;

/** Place the mark in a `size`-wide box centred on (cx, cy). */
const placed = (colour, size, cx, cy) =>
  `<g transform="translate(${cx - size / 2},${cy - size / 2}) scale(${size / 100})">${mark(colour)}</g>`;

const canvas = (w, h, bg, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '') +
  `${inner}\n</svg>\n`;

// Canonical sources kept in the repo.
const symbol = canvas(100, 100, YELLOW, mark(INK));
const logo = canvas(
  340,
  100,
  null,
  `<rect width="100" height="100" rx="22" fill="${YELLOW}"/>${mark(INK)}` +
    `<text x="118" y="62" font-family="Inter, Arial, Helvetica, sans-serif" font-size="34"` +
    ` font-weight="600" fill="#3D2F00">Watchline</text>`,
);
writeFileSync('assets/branding/watchline-symbol.svg', symbol);
writeFileSync('assets/branding/watchline-logo.svg', logo);

// name, width, height, background (null = transparent), mark colour, mark box
const targets = [
  ['icon.png', 1024, 1024, YELLOW, INK, 1024],
  // Android foreground: transparent, inside the adaptive safe zone.
  ['adaptive-icon.png', 1024, 1024, null, INK, 640],
  ['favicon.png', 64, 64, YELLOW, INK, 64],
  ['splash-light.png', 1170, 2532, YELLOW, INK, 480],
  ['splash-dark.png', 1170, 2532, DARK, YELLOW, 480],
];

const tmp = mkdtempSync(join(tmpdir(), 'watchline-brand-'));
for (const [name, w, h, bg, colour, size] of targets) {
  const src = join(tmp, name.replace('.png', '.svg'));
  writeFileSync(src, canvas(w, h, bg, placed(colour, size, w / 2, h / 2)));
  execFileSync('rsvg-convert', ['-w', String(w), '-h', String(h), src, '-o', `assets/${name}`]);
  console.log('rendered', name);
}
