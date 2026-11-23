// Fertige Animationen für das 16x8-Raster. Reine Funktionen ohne Browser, damit sie testbar sind.
import { W, H, FRAME_BYTES } from './protocol.js';

export function hsv(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const blank = () => new Uint8Array(FRAME_BYTES);

function setMax(frame, x, y, rgb) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  frame[i] = Math.max(frame[i], rgb[0]);
  frame[i + 1] = Math.max(frame[i + 1], rgb[1]);
  frame[i + 2] = Math.max(frame[i + 2], rgb[2]);
}

function art(rows, ox, oy, rgb) {
  const f = blank();
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && setMax(f, x + ox, y + oy, rgb)));
  return f;
}

const HEART_BIG = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const HEART_SMALL = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];

function heart() {
  const pink = [255, 77, 157];
  const small = art(HEART_SMALL, 6, 1, pink);
  const big = art(HEART_BIG, 4, 0, pink);
  return [small, big, big, small];
}

function twinkle() {
  const rnd = mulberry32(7);
  const palette = [[255, 255, 255], [255, 170, 210], [205, 184, 245], [255, 225, 140]];
  const stars = Array.from({ length: 14 }, () => ({
    x: Math.floor(rnd() * W),
    y: Math.floor(rnd() * H),
    phase: rnd(),
    speed: 1 + Math.floor(rnd() * 2),
    color: palette[Math.floor(rnd() * palette.length)],
  }));
  const FRAMES = 20;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (const s of stars) {
      const b = Math.max(0, Math.sin(2 * Math.PI * ((f / FRAMES) * s.speed + s.phase))) ** 2;
      setMax(frame, s.x, s.y, s.color.map((c) => Math.round(c * b)));
    }
    return frame;
  });
}

function rainbow() {
  const FRAMES = 16;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) setMax(frame, x, y, hsv((x * 22.5 + f * 22.5 + y * 10) % 360, 1, 0.9));
    return frame;
  });
}

function rain() {
  const FRAMES = 16;
  const tail = [1, 0.5, 0.2];
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (let x = 0; x < W; x++) {
      const head = (f + ((x * 7) % 16)) % 16;
      tail.forEach((k, t) => setMax(frame, x, head - t, [Math.round(120 * k), Math.round(200 * k), Math.round(255 * k)]));
    }
    return frame;
  });
}

export const PRESETS = [
  { id: 'heart', name: 'Herz', fps: 4, make: heart },
  { id: 'twinkle', name: 'Funkeln', fps: 10, make: twinkle },
  { id: 'rainbow', name: 'Regenbogen', fps: 12, make: rainbow },
  { id: 'rain', name: 'Regen', fps: 8, make: rain },
];
