import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  packet, animPackets, textPacket, photoPackets, brightnessPacket, offPacket, rle565, unrle565, rgb565,
  chunks, concat, MAGIC, TYPE, W, H, FRAME_BYTES, MAX_ANIM_FRAMES, MAX_PAYLOAD, PHOTO_ROWS, CHUNK,
} from '../web/protocol.js';

const solid = (r, g, b) => {
  const f = new Uint8ClampedArray(FRAME_BYTES);
  for (let i = 0; i < W * H; i++) { f[i * 4] = r; f[i * 4 + 1] = g; f[i * 4 + 2] = b; f[i * 4 + 3] = 255; }
  return f;
};

test('Display: 320 × 170 im Querformat', () => {
  assert.equal(W, 320);
  assert.equal(H, 170);
});

test('packet: Kopfzeile und Länge (little endian)', () => {
  const p = packet(TYPE.BRIGHTNESS, Uint8Array.of(7));
  assert.deepEqual([...p], [MAGIC, TYPE.BRIGHTNESS, 1, 0, 7]);
  const big = packet(TYPE.FRAME, new Uint8Array(30000));
  assert.equal(big[2] | (big[3] << 8), 30000);
  assert.throws(() => packet(TYPE.FRAME, new Uint8Array(MAX_PAYLOAD + 1)), RangeError);
});

test('rgb565: bekannte Farben', () => {
  assert.equal(rgb565(255, 0, 0), 0xf800);
  assert.equal(rgb565(0, 255, 0), 0x07e0);
  assert.equal(rgb565(0, 0, 255), 0x001f);
  assert.equal(rgb565(255, 255, 255), 0xffff);
});

test('rle565: einfarbiges Bild wird winzig und lässt sich zurückrechnen', () => {
  const runs = rle565(solid(255, 0, 0));
  assert.equal(runs.length, Math.ceil((W * H) / 255) * 3);
  assert.deepEqual([...runs.subarray(0, 3)], [255, 0xf8, 0x00]);
  const px = unrle565(runs);
  assert.equal(px.length, W * H);
  assert.ok(px.every((c) => c === 0xf800));
});

test('rle565: Rundreise mit gemischtem Bild', () => {
  const f = solid(0, 0, 0);
  for (let i = 0; i < W * H; i += 7) { f[i * 4] = (i * 13) & 255; f[i * 4 + 2] = 200; }
  const px = unrle565(rle565(f));
  for (let i = 0; i < W * H; i++) assert.equal(px[i], rgb565(f[i * 4], f[i * 4 + 1], f[i * 4 + 2]));
});

test('unrle565: erkennt kaputte Daten', () => {
  assert.throws(() => unrle565(Uint8Array.of(10, 0, 0)), RangeError);
});

test('animPackets: ein Paket pro Bild mit index, count, fps', () => {
  const ps = animPackets([solid(0, 0, 0), solid(255, 255, 255)], 5);
  assert.equal(ps.length, 2);
  for (const [i, p] of ps.entries()) {
    assert.equal(p[0], MAGIC);
    assert.equal(p[1], TYPE.FRAME);
    assert.deepEqual([...p.subarray(4, 7)], [i, 2, 5]);
    assert.equal(p[2] | (p[3] << 8), p.length - 4);
  }
  assert.equal(animPackets([solid(0, 0, 0)], 999)[0][6], 30);
  assert.equal(animPackets([solid(0, 0, 0)], 0)[0][6], 1);
});

test('animPackets: lehnt falsche oder zu aufwendige Eingaben ab', () => {
  assert.throws(() => animPackets([], 5), RangeError);
  assert.throws(() => animPackets(Array(MAX_ANIM_FRAMES + 1).fill(solid(0, 0, 0)), 5), RangeError);
  assert.throws(() => animPackets([new Uint8ClampedArray(10)], 5), RangeError);
  const noisy = solid(0, 0, 0);
  for (let i = 0; i < W * H; i++) noisy[i * 4] = i & 1 ? 255 : 0; // jedes Pixel anders: schlecht komprimierbar
  assert.throws(() => animPackets([noisy], 5), /zu aufwendig/);
});

test('textPacket: Farbe, Tempo, Höhe, Breite, Streifen', () => {
  const bits = Uint8Array.from({ length: 3 * 14 }, (_, i) => i);
  const p = textPacket(bits, 3, 112, [255, 0, 128], 4);
  assert.deepEqual([...p.subarray(4, 11)], [255, 0, 128, 4, 112, 3, 0]);
  assert.deepEqual([...p.subarray(11)], [...bits]);
  assert.throws(() => textPacket(new Uint8Array(0), 0, 112, [0, 0, 0], 1), RangeError);
  assert.throws(() => textPacket(new Uint8Array(5), 3, 112, [0, 0, 0], 1), RangeError);
  assert.throws(() => textPacket(new Uint8Array(4000 * 14), 4000, 112, [0, 0, 0], 1), /zu lang/);
});

test('photoPackets: ganzes Bild in Zeilen-Paketen', () => {
  const ps = photoPackets(solid(0, 0, 255));
  assert.equal(ps.length, Math.ceil(H / PHOTO_ROWS));
  let rows = 0;
  for (const p of ps) {
    assert.equal(p[1], TYPE.PHOTO);
    const y = p[4] | (p[5] << 8);
    assert.equal(y, rows);
    rows += p[6];
    assert.equal(p.length, 4 + 3 + p[6] * W * 2);
    assert.deepEqual([...p.subarray(7, 9)], [0x00, 0x1f]);
  }
  assert.equal(rows, H);
});

test('brightness und off', () => {
  assert.deepEqual([...brightnessPacket(999)], [MAGIC, TYPE.BRIGHTNESS, 1, 0, 255]);
  assert.deepEqual([...offPacket()], [MAGIC, TYPE.OFF, 0, 0]);
});

test('concat und chunks: zerlegen ohne Verlust', () => {
  const data = concat([Uint8Array.of(1, 2), Uint8Array.of(3), Uint8Array.from({ length: 400 }, (_, i) => i & 255)]);
  assert.equal(data.length, 403);
  const parts = [...chunks(data)];
  assert.equal(parts.length, Math.ceil(403 / CHUNK));
  assert.ok(parts.every((p) => p.length <= CHUNK));
  assert.deepEqual([...Uint8Array.from(parts.flatMap((p) => [...p]))], [...data]);
});
