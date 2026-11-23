import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  packet, animPacket, textPacket, photoPacket, brightnessPacket, offPacket, rgb565Bytes, chunks,
  MAGIC, TYPE, FRAME_BYTES, MAX_ANIM_FRAMES,
} from '../web/protocol.js';

test('packet: Kopfzeile und Länge (little endian)', () => {
  const p = packet(TYPE.BRIGHTNESS, Uint8Array.of(7));
  assert.deepEqual([...p], [MAGIC, TYPE.BRIGHTNESS, 1, 0, 7]);
  const big = packet(TYPE.ANIM, new Uint8Array(300));
  assert.equal(big[2], 300 & 255);
  assert.equal(big[3], 300 >> 8);
});

test('animPacket: Grösse und Header-Felder', () => {
  const frames = [new Uint8Array(FRAME_BYTES), new Uint8Array(FRAME_BYTES)];
  frames[1][0] = 200;
  const p = animPacket(frames, 5);
  assert.equal(p.length, 4 + 2 + 2 * FRAME_BYTES);
  assert.equal(p[4], 5); // fps
  assert.equal(p[5], 2); // frames
  assert.equal(p[6 + FRAME_BYTES], 200);
});

test('animPacket: lehnt falsche Eingaben ab', () => {
  assert.throws(() => animPacket([], 5), RangeError);
  assert.throws(() => animPacket(Array(MAX_ANIM_FRAMES + 1).fill(new Uint8Array(FRAME_BYTES)), 5), RangeError);
  assert.throws(() => animPacket([new Uint8Array(10)], 5), RangeError);
});

test('animPacket: fps wird begrenzt', () => {
  const f = [new Uint8Array(FRAME_BYTES)];
  assert.equal(animPacket(f, 999)[4], 30);
  assert.equal(animPacket(f, 0)[4], 1);
});

test('textPacket: Farbe, Tempo, Breite, Spalten', () => {
  const cols = Uint8Array.of(1, 2, 3, 4);
  const p = textPacket(cols, [255, 0, 128], 4);
  assert.deepEqual([...p.subarray(4, 10)], [255, 0, 128, 4, 4, 0]);
  assert.deepEqual([...p.subarray(10)], [1, 2, 3, 4]);
  assert.throws(() => textPacket(new Uint8Array(0), [0, 0, 0], 1), RangeError);
});

test('rgb565Bytes: bekannte Farben (big endian)', () => {
  const rgba = Uint8Array.of(255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255);
  const b = rgb565Bytes(rgba, 4, 1);
  assert.deepEqual([...b], [0xf8, 0x00, 0x07, 0xe0, 0x00, 0x1f, 0xff, 0xff]);
});

test('photoPacket: 64x64 ergibt 8192 Pixel-Bytes plus Kopf', () => {
  const p = photoPacket(new Uint8Array(64 * 64 * 4), 64, 64);
  assert.equal(p.length, 4 + 2 + 64 * 64 * 2);
  assert.equal(p[4], 64);
  assert.equal(p[5], 64);
});

test('brightness und off', () => {
  assert.deepEqual([...brightnessPacket(999)], [MAGIC, TYPE.BRIGHTNESS, 1, 0, 255]);
  assert.deepEqual([...offPacket()], [MAGIC, TYPE.OFF, 0, 0]);
});

test('chunks: zerlegt in 20-Byte-Stücke ohne Verlust', () => {
  const data = Uint8Array.from({ length: 95 }, (_, i) => i);
  const parts = [...chunks(data, 20)];
  assert.equal(parts.length, 5);
  assert.equal(parts[4].length, 15);
  assert.deepEqual([...Uint8Array.from(parts.flatMap((p) => [...p]))], [...data]);
});
