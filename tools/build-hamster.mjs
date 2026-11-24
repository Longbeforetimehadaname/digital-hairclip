// Einmalig: das Hamster-Bild auf 170×170 rechnen und als drei Farben speichern.
import fs from 'fs';
import zlib from 'zlib';
import { rle565, W, H } from '../web/protocol.js';

const src = process.argv[2];
if (!src) {
  console.error('Aufruf: node tools/build-hamster.mjs pfad/zum/hamster.png');
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
const sw = 412;
const sh = 412;
const bpp = 3;
const pix = Buffer.alloc(sw * sh * 3);
let p = 0;
let prev = Buffer.alloc(sw * bpp);
for (let y = 0; y < sh; y++) {
  const filter = inflated[p++];
  const row = Buffer.alloc(sw * bpp);
  inflated.copy(row, 0, p, p + sw * bpp);
  p += sw * bpp;
  const out = Buffer.alloc(sw * bpp);
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
  out.copy(pix, y * sw * 3);
  prev = out;
}

const side = 170;
const idx = new Uint8Array(side * side);
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const sx0 = Math.floor(x * sw / side);
    const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * sw / side));
    const sy0 = Math.floor(y * sh / side);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * sh / side));
    let dark = 0;
    let pink = 0;
    let n = 0;
    for (let sy = sy0; sy < sy1; sy++) {
      for (let sx = sx0; sx < sx1; sx++) {
        const o = (sy * sw + sx) * 3;
        const r = pix[o];
        const g = pix[o + 1];
        const b = pix[o + 2];
        n += 1;
        if (r < 120 && g < 120 && b < 130) dark += 1;
        else if (r > 170 && (r - g) > 28 && g > 70 && b > 80) pink += 1;
      }
    }
    let v = 0;
    if (dark / n > 0.14) v = 1;
    else if (pink / n > 0.2) v = 2;
    idx[y * side + x] = v;
  }
}

const packed = new Uint8Array(Math.ceil(idx.length / 4));
for (let i = 0; i < idx.length; i++) packed[i >> 2] |= idx[i] << (6 - (i & 3) * 2);
const b64 = Buffer.from(packed).toString('base64');
const lines = b64.match(/.{1,96}/g).map((line) => `  '${line}'`).join(' +\n');
const body = `// Hamster, 170×170. Zwei Bit pro Punkt: 0 weiss, 1 schwarz, 2 rosa.
// Vom Originalbild auf das Display gerechnet. Erzeugt mit tools/build-hamster.mjs.
export const HAMSTER_SIDE = 170;
export const HAMSTER_BITS =
${lines};
`;
fs.writeFileSync(new URL('../web/hamster-data.js', import.meta.url), body);

const colors = [[255, 255, 255], [16, 14, 20], [255, 156, 186]];
const frame = new Uint8ClampedArray(W * H * 4);
const ox = Math.floor((W - side) / 2);
const oy = Math.floor((H - side) / 2);
for (let i = 0; i < W * H; i++) {
  frame[i * 4] = 255;
  frame[i * 4 + 1] = 255;
  frame[i * 4 + 2] = 255;
  frame[i * 4 + 3] = 255;
}
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const c = colors[idx[y * side + x]];
    const i = ((oy + y) * W + ox + x) * 4;
    frame[i] = c[0];
    frame[i + 1] = c[1];
    frame[i + 2] = c[2];
  }
}
console.log('rle', rle565(frame).length, 'bytes', packed.length);
