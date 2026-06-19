// One-shot: turn a single-color-background PNG into RGBA with that color
// alpha-keyed out. The background color is auto-detected from the four
// corners — whichever color dominates wins. Edge pixels are feathered for
// smooth anti-aliasing.
//
//   node scripts/strip-logo-bg.mjs <input.png> [output.png]
//
// If output is omitted, overwrites the input in place.

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const input = process.argv[2];
const output = process.argv[3] ?? input;
if (!input) {
  console.error('usage: node scripts/strip-logo-bg.mjs <input.png> [output.png]');
  process.exit(1);
}

const buf = fs.readFileSync(input);
const src = PNG.sync.read(buf);
const w = src.width;
const h = src.height;
const data = src.data; // RGBA bytes regardless of source color type

function pixelAt(x, y) {
  const i = (w * y + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

// Auto-detect bg by majority vote across corners + a few border samples.
const samples = [
  pixelAt(0, 0),
  pixelAt(w - 1, 0),
  pixelAt(0, h - 1),
  pixelAt(w - 1, h - 1),
  pixelAt(w >> 1, 0),
  pixelAt(0, h >> 1),
  pixelAt(w >> 1, h - 1),
  pixelAt(w - 1, h >> 1),
];

// Group nearby samples (Chebyshev dist < 12). Pick the largest group's centroid.
const groups = [];
for (const s of samples) {
  let placed = false;
  for (const g of groups) {
    const c = g.centroid;
    if (Math.max(Math.abs(c[0] - s[0]), Math.abs(c[1] - s[1]), Math.abs(c[2] - s[2])) < 12) {
      g.members.push(s);
      g.centroid = [
        Math.round((c[0] * (g.members.length - 1) + s[0]) / g.members.length),
        Math.round((c[1] * (g.members.length - 1) + s[1]) / g.members.length),
        Math.round((c[2] * (g.members.length - 1) + s[2]) / g.members.length),
      ];
      placed = true;
      break;
    }
  }
  if (!placed) groups.push({ centroid: s, members: [s] });
}
groups.sort((a, b) => b.members.length - a.members.length);
const bg = groups[0].centroid;
console.log(
  `detected bg color: rgb(${bg.join(', ')})  (${groups[0].members.length}/${samples.length} corners agree)`,
);

const out = new PNG({ width: w, height: h, colorType: 6 });

// Chebyshev distance from bg color. Threshold:
//   < 8       → fully transparent
//   8 – 40    → feathered alpha
//   ≥ 40      → opaque
const NEAR = 8;
const FAR = 40;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const d = Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));

  let alpha;
  if (d < NEAR) alpha = 0;
  else if (d < FAR) alpha = Math.round(((d - NEAR) / (FAR - NEAR)) * 255);
  else alpha = 255;

  out.data[i] = r;
  out.data[i + 1] = g;
  out.data[i + 2] = b;
  out.data[i + 3] = alpha;
}

fs.writeFileSync(output, PNG.sync.write(out));

const before = buf.length;
const after = fs.statSync(output).size;
const totalPx = w * h;
let transparentPx = 0;
for (let i = 3; i < out.data.length; i += 4) if (out.data[i] === 0) transparentPx++;
console.log(
  `wrote ${path.relative(process.cwd(), output)}  ${w}×${h}  RGB→RGBA  (${before} → ${after} bytes)`,
);
console.log(
  `  stripped ${transparentPx} bg pixels (${((transparentPx / totalPx) * 100).toFixed(1)}%)`,
);
