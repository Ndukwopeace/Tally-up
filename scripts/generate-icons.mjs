/**
 * Draws the Tally-Up app icons (PNG) and favicon (SVG) in public/.
 *
 * WHY:  The PWA manifest needs PNG icons (192, 512, maskable 512) and iPhones
 *       need a 180px apple-touch-icon. Drawing them from src/assets/logo-shapes.json
 *       (the same data AppLogo.tsx renders) keeps every icon identical to the
 *       on-screen logo (Q-45) without adding an image package (W-3).
 * HOW:  Places the 48×32 truck mark in the centre of a white square, tests 3×3
 *       sample points per pixel against each shape in drawing order (later shapes
 *       paint over earlier ones), averages for smooth edges, and writes a PNG with
 *       Node's built-in zlib. The favicon is written as SVG from the same shapes.
 * WHEN: Run by hand (`node scripts/generate-icons.mjs`) only when the logo changes.
 *       The output files are committed; builds do not run this script.
 * SECURITY: Reads one JSON file from the repository; writes only to public/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const logo = JSON.parse(readFileSync("src/assets/logo-shapes.json", "utf8"));
const WHITE = [0xff, 0xff, 0xff];
// Corner radius of the white tile as a fraction of its size (regular icons only).
const TILE_RADIUS = 0.22;

// "#1d4ed8" → [29, 78, 216]
function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Distance from point (px, py) to the line segment (x1, y1)–(x2, y2).
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// True if (x, y) lies inside a rectangle with rounded corners of radius r.
function insideRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// True if logo-space point (x, y) is inside one shape from logo-shapes.json.
function insideShape(shape, x, y) {
  switch (shape.type) {
    case "circle":
      return Math.hypot(x - shape.cx, y - shape.cy) <= shape.r;
    case "roundRect":
      return insideRoundRect(x, y, shape.x, shape.y, shape.w, shape.h, shape.r);
    default:
      return distanceToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= shape.width / 2;
  }
}

/**
 * Renders one square icon.
 * @param size     output width/height in pixels
 * @param rounded  true: white tile with rounded corners on transparency; false: full-bleed white
 *                 (maskable icons and iOS, which crop the corners themselves)
 * @param markWidth width of the truck mark as a fraction of the icon (smaller = more margin)
 */
function render(size, rounded, markWidth) {
  const scale = (size * markWidth) / logo.width;
  const offsetX = (size - logo.width * scale) / 2;
  const offsetY = (size - logo.height * scale) / 2;
  const colours = logo.shapes.map((shape) => hexToRgb(shape.fill));
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = [0]; // PNG filter byte: none
    for (let px = 0; px < size; px++) {
      let covered = 0;
      const sum = [0, 0, 0];
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const x = px + (sx + 0.5) / 3;
          const y = py + (sy + 0.5) / 3;
          if (rounded && !insideRoundRect(x, y, 0, 0, size, size, size * TILE_RADIUS)) continue;
          covered++;
          // Topmost shape wins (painter's order); white tile underneath.
          let colour = WHITE;
          const lx = (x - offsetX) / scale;
          const ly = (y - offsetY) / scale;
          logo.shapes.forEach((shape, i) => {
            if (insideShape(shape, lx, ly)) colour = colours[i];
          });
          for (let c = 0; c < 3; c++) sum[c] += colour[c];
        }
      }
      const rgb = covered === 0 ? WHITE : sum.map((v) => Math.round(v / covered));
      row.push(...rgb, Math.round((covered / 9) * 255));
    }
    rows.push(Buffer.from(row));
  }
  return encodePng(size, Buffer.concat(rows));
}

// SVG favicon: white rounded tile with the truck mark, from the same shapes.
function faviconSvg() {
  const pad = 4;
  const side = logo.width + pad * 2;
  const top = (side - logo.height) / 2;
  const parts = logo.shapes.map((s) => {
    if (s.type === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}"/>`;
    if (s.type === "roundRect")
      return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`;
    return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.fill}" stroke-width="${s.width}" stroke-linecap="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" rx="${side * TILE_RADIUS}" fill="#fff"/><g transform="translate(${pad} ${top})">${parts.join("")}</g></svg>\n`;
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
  ["public/pwa-192x192.png", render(192, true, 0.8)],
  ["public/pwa-512x512.png", render(512, true, 0.8)],
  // Maskable: Android may crop to a circle, so the mark stays inside the central safe zone.
  ["public/maskable-512x512.png", render(512, false, 0.62)],
  ["public/apple-touch-icon.png", render(180, false, 0.78)],
  ["public/favicon.svg", Buffer.from(faviconSvg())],
];
for (const [path, data] of outputs) {
  writeFileSync(path, data);
  process.stdout.write(`wrote ${path} (${data.length} bytes)\n`);
}
