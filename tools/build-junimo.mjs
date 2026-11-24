// Einmalig: die grünen Junimo-Bilder (16×16) aus dem Sprite-Blatt nehmen.
// Aufruf: node tools/build-junimo.mjs pfad/zum/blatt.png
import fs from 'fs';
import zlib from 'zlib';

const src = process.argv[2];
if (!src) {
  console.error('Aufruf: node tools/build-junimo.mjs pfad/zum/blatt.png');
  process.exit(1);
}
const buf = fs.readFileSync(src);
let off = 8;
const idats = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.slice(off + 4, off + 8).toString();
  const data = buf.slice(off + 8, off + 8 + len);
  if (type === 'IDAT') idats.push(data);
  off += 12 + len;
}
const inflated = zlib.inflateSync(Buffer.concat(idats));
const w = 512;
const bpp = 4;
const pix = Buffer.alloc(512 * 288 * 4);
let p = 0;
let prev = Buffer.alloc(w * bpp);
for (let y = 0; y < 288; y++) {
  const filter = inflated[p++];
  const row = Buffer.alloc(w * bpp);
  inflated.copy(row, 0, p, p + w * bpp);
  p += w * bpp;
  const out = Buffer.alloc(w * bpp);
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? out[i - bpp] : 0;
    const up = prev[i];
    const ul = i >= bpp ? prev[i - bpp] : 0;
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
  out.copy(pix, y * w * 4);
  prev = out;
}

// Grün, von vorne, acht Bilder. Reihe 6, Spalten 24–31 im Blatt.
const SHEET_ROW = 6;
const SHEET_COL = 24;
const COUNT = 8;
const colors = [];
const keyOf = (r, g, b) => `${r},${g},${b}`;
const frames = [];
for (let f = 0; f < COUNT; f++) {
  const idx = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const si = (((SHEET_ROW * 16) + y) * w + ((SHEET_COL + f) * 16 + x)) * 4;
      if (pix[si + 3] < 128) {
        idx.push(0);
        continue;
      }
      const key = keyOf(pix[si], pix[si + 1], pix[si + 2]);
      let id = colors.findIndex((c) => keyOf(c[0], c[1], c[2]) === key);
      if (id < 0) {
        colors.push([pix[si], pix[si + 1], pix[si + 2]]);
        id = colors.length - 1;
      }
      idx.push(id + 1);
    }
  }
  frames.push(idx);
}
console.log('colors', colors.length, colors);

const packed = [];
for (const frame of frames) {
  for (let i = 0; i < frame.length; i += 2) packed.push((frame[i] << 4) | frame[i + 1]);
}
const b64 = Buffer.from(packed).toString('base64');
const lines = b64.match(/.{1,96}/g).map((line) => `  '${line}'`).join(' +\n');
const pal = colors.map((c) => `  [${c.join(', ')}]`).join(',\n');
const body = `// Acht Junimo-Bilder, 16×16. 0 ist leer, sonst eine Farbe aus der Liste.
// Vom Sprite-Blatt, grüner Junimo von vorne. Erzeugt mit tools/build-junimo.mjs.
export const JUNIMO_PALETTE = [
${pal},
];
export const JUNIMO_BITS =
${lines};
`;
fs.writeFileSync(new URL('../web/junimo-data.js', import.meta.url), body);
console.log('bytes', packed.length);
