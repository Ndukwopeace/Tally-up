/**
 * Draws the Tally-Up app icons as PNG files in public/.
 *
 * WHY:  The PWA manifest needs PNG icons (192, 512, maskable 512) and iPhones
 *       need a 180px apple-touch-icon. Drawing them from code keeps them identical
 *       to the SVG logo (src/components/common/AppLogo.tsx, public/favicon.svg)
 *       without adding an image package (W-3).
 * HOW:  For each pixel, tests 3×3 sample points against the logo shapes (blue
 *       rounded square, five white tally strokes) and averages them for smooth
 *       edges, then writes a PNG with Node's built-in zlib.
 * WHEN: Run by hand (`node scripts/generate-icons.mjs`) only when the logo changes.
 *       The PNGs are committed; builds do not run this script.
 * SECURITY: Writes only to public/; reads nothing.
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Logo geometry in a 32×32 design grid, matching the SVG.
const BRAND = [0x1d, 0x4e, 0xd8];
const WHITE = [0xff, 0xff, 0xff];
const STROKE_HALF_WIDTH = 1.3;
const SEGMENTS = [
  [9, 9, 9, 23],
  [13.5, 9, 13.5, 23],
  [18, 9, 18, 23],
  [22.5, 9, 22.5, 23],
  [6.5, 21.5, 25, 10.5],
];

// Distance from point (px, py) to the line segment (x1, y1)–(x2, y2).
function distanceToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// True if (x, y) in the 32-grid lies inside a square with corner radius r.
function insideRoundedSquare(x, y, r) {
  if (x < 0 || y < 0 || x > 32 || y > 32) return false;
  const cx = Math.min(Math.max(x, r), 32 - r);
  const cy = Math.min(Math.max(y, r), 32 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * Renders one icon.
 * @param size      output width/height in pixels
 * @param radius    corner radius in the 32-grid (0 = square, for maskable / iOS)
 * @param scale     how large the tally strokes are relative to the canvas (maskable needs a safe zone)
 */
function render(size, radius, scale) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = [0]; // PNG filter byte: none
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const x = ((px + (sx + 0.5) / 3) / size) * 32;
          const y = ((py + (sy + 0.5) / 3) / size) * 32;
          if (!insideRoundedSquare(x, y, radius)) continue;
          bg++;
          // Map the point back into the unscaled design grid around the centre.
          const ux = 16 + (x - 16) / scale;
          const uy = 16 + (y - 16) / scale;
          if (SEGMENTS.some((segment) => distanceToSegment(ux, uy, segment) <= STROKE_HALF_WIDTH)) fg++;
        }
      }
      const alpha = Math.round((bg / 9) * 255);
      const mix = bg === 0 ? 0 : fg / bg;
      const rgb = BRAND.map((c, i) => Math.round(c + (WHITE[i] - c) * mix));
      row.push(...rgb, alpha);
    }
    rows.push(Buffer.from(row));
  }
  return encodePng(size, Buffer.concat(rows));
}

// CRC-32 as required by the PNG format for each chunk.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(size, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputs = [
  ["public/pwa-192x192.png", render(192, 8, 1)],
  ["public/pwa-512x512.png", render(512, 8, 1)],
  // Maskable: full-bleed square, strokes shrunk to sit inside the 80% safe zone.
  ["public/maskable-512x512.png", render(512, 0, 0.7)],
  // iOS rounds corners itself, so the square is full-bleed.
  ["public/apple-touch-icon.png", render(180, 0, 0.85)],
];
for (const [path, png] of outputs) {
  writeFileSync(path, png);
  process.stdout.write(`wrote ${path} (${png.length} bytes)\n`);
}
