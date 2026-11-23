// Fertige Animationen für das Display 320 × 170. Reine Funktionen ohne Browser, damit sie testbar sind.
// Die Bilder nutzen wenige, flache Farben ohne Verläufe: So bleiben sie nach der Lauflängen-Kodierung
// klein genug für den Speicher im Clip (siehe MAX_ANIM_BYTES).
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

// Schwarzes, deckendes Bild
export function blank() {
  const f = new Uint8ClampedArray(FRAME_BYTES);
  for (let i = 3; i < f.length; i += 4) f[i] = 255;
  return f;
}

function set(frame, x, y, rgb) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  frame[i] = rgb[0];
  frame[i + 1] = rgb[1];
  frame[i + 2] = rgb[2];
}

function rect(frame, x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(frame, x, y, rgb);
}

// Herz-Kurve (x² + y² − 1)³ − x²·y³ ≤ 0, Grösse s Pixel pro Einheit
function heartFrame(s, rgb) {
  const f = blank();
  const cx = W / 2;
  const cy = H / 2 - 0.12 * s;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - cx) / s;
      const Y = -(y + 0.5 - cy) / s;
      const a = X * X + Y * Y - 1;
      if (a * a * a - X * X * Y * Y * Y <= 0) set(f, x, y, rgb);
    }
  }
  return f;
}

function heart() {
  const pink = [255, 77, 157];
  const small = heartFrame(48, pink);
  const big = heartFrame(62, pink);
  return [small, big, big, small];
}

function twinkle() {
  const rnd = mulberry32(7);
  const palette = [[255, 255, 255], [255, 170, 210], [205, 184, 245], [255, 225, 140]];
  const stars = Array.from({ length: 14 }, () => ({
    x: 12 + Math.floor(rnd() * (W - 24)),
    y: 12 + Math.floor(rnd() * (H - 24)),
    phase: rnd(),
    speed: 1 + Math.floor(rnd() * 2),
    color: palette[Math.floor(rnd() * palette.length)],
  }));
  const FRAMES = 16;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (const s of stars) {
      // Helligkeit in 4 Stufen, damit es wenige Farben bleiben
      const level = Math.round(Math.max(0, Math.sin(2 * Math.PI * ((f / FRAMES) * s.speed + s.phase))) ** 2 * 3);
      if (!level) continue;
      const k = 0.4 + 0.2 * level;
      const rgb = s.color.map((c) => Math.round(c * k));
      const arm = 2 + 4 * level;
      rect(frame, s.x - arm, s.y - 1, 2 * arm + 1, 3, rgb); // waagrechter Strahl
      rect(frame, s.x - 1, s.y - arm, 3, 2 * arm + 1, rgb); // senkrechter Strahl
      rect(frame, s.x - level, s.y - level, 2 * level + 1, 2 * level + 1, rgb); // Mitte
    }
    return frame;
  });
}

function rainbow() {
  const FRAMES = 16;
  const BAND = 10;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (let y = 0; y < H; y++) {
      const band = (((Math.floor(y / BAND) - f) % FRAMES) + FRAMES) % FRAMES;
      const rgb = hsv(band * (360 / FRAMES), 1, 0.9);
      rect(frame, 0, y, W, 1, rgb);
    }
    return frame;
  });
}

function rain() {
  const FRAMES = 12;
  const SEG = 6;
  const tail = [1, 0.55, 0.25];
  const loop = H + SEG * tail.length;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    for (let k = 0; k < 16; k++) {
      const x = 9 + k * 20;
      const head = Math.round((((f + ((k * 7) % FRAMES)) % FRAMES) / FRAMES) * loop);
      tail.forEach((b, t) => {
        const rgb = [Math.round(120 * b), Math.round(200 * b), Math.round(255 * b)];
        rect(frame, x, head - SEG * (t + 1) + 1, 3, SEG, rgb);
      });
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
