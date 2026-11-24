// Einmalig: das Bild auf die echten Pixel rechnen und speichern.
// Aufruf: node tools/build-zatanna.mjs pfad/zum/bild.png
import fs from 'fs';
import zlib from 'zlib';

const src = process.argv[2];
if (!src) {
  console.error('Aufruf: node tools/build-zatanna.mjs pfad/zum/bild.png');
  process.exit(1);
}

const buf = fs.readFileSync(src);
let off = 8;
const chunks = {};
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.slice(off + 4, off + 8).toString();
  const data = buf.slice(off + 8, off + 8 + len);
  chunks[type] = chunks[type] ? Buffer.concat([chunks[type], data]) : data;
  off += 12 + len;
}

const pal = [];
for (let i = 0; i < chunks.PLTE.length; i += 3) {
  pal.push([chunks.PLTE[i], chunks.PLTE[i + 1], chunks.PLTE[i + 2]]);
}

const sw = 400;
const sh = 400;
const inflated = zlib.inflateSync(chunks.IDAT);
const rowBytes = Math.ceil(sw * 4 / 8);
const idx = new Uint8Array(sw * sh);
let p = 0;
let prev = Buffer.alloc(rowBytes);
for (let y = 0; y < sh; y++) {
  const filter = inflated[p++];
  const row = Buffer.from(inflated.subarray(p, p + rowBytes));
  p += rowBytes;
  const out = Buffer.alloc(rowBytes);
  for (let i = 0; i < row.length; i++) {
    const left = i > 0 ? out[i - 1] : 0;
    const up = prev[i];
    const ul = i > 0 ? prev[i - 1] : 0;
    let v = row[i];
    if (filter === 1) v = (v + left) & 255;
    else if (filter === 2) v = (v + up) & 255;
    else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
    else if (filter === 4) {
      const pp = left + up - ul;
      const pa = Math.abs(pp - left);
      const pb = Math.abs(pp - up);
      const pc = Math.abs(pp - ul);
      const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
      v = (v + pr) & 255;
    }
    out[i] = v;
  }
  for (let x = 0; x < sw; x++) {
    const byte = out[x >> 1];
    idx[y * sw + x] = (x & 1) ? (byte & 15) : (byte >> 4);
  }
  prev = out;
}

// Das Bild ist 10-fach vergrössert. Die Figur steht bei x 140, y 80.
const cell = 10;
const gw = 14;
const gh = 32;
const grid = new Uint8Array(gw * gh);
for (let y = 0; y < gh; y++) {
  for (let x = 0; x < gw; x++) {
    grid[y * gw + x] = idx[(80 + y * cell + 5) * sw + (140 + x * cell + 5)];
  }
}

const bytes = [];
for (let i = 0; i < grid.length; i += 2) bytes.push((grid[i] << 4) | grid[i + 1]);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let bits = '';
for (const b of bytes) bits += b.toString(2).padStart(8, '0');
let b64 = '';
for (let i = 0; i < bits.length; i += 6) {
  b64 += alphabet[parseInt(bits.slice(i, i + 6).padEnd(6, '0'), 2)];
}
while (b64.length % 4) b64 += '=';

const palette = pal.slice(1).map((c) => `  [${c.join(', ')}],`).join('\n');
const out = `// Die Figur, 14×32 Pixel. 0 ist leer, sonst eine Farbe aus der Liste.
// Erzeugt mit tools/build-zatanna.mjs.
export const ZATANNA_W = 14;
export const ZATANNA_H = 32;
export const ZATANNA_PALETTE = [
${palette}
];
export const ZATANNA_BITS = '${b64}';
`;
fs.writeFileSync(new URL('../web/zatanna-data.js', import.meta.url), out);
console.log('geschrieben, farben', pal.length, 'pixel', grid.length);
