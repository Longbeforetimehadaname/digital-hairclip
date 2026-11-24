// Fertige Animationen für das Display 320 × 170. Reine Funktionen ohne Browser, damit sie testbar sind.
// Die Bilder nutzen wenige, flache Farben ohne Verläufe: So bleiben sie nach der Lauflängen-Kodierung
// klein genug für den Speicher im Clip (siehe MAX_ANIM_BYTES).
import { W, H, FRAME_BYTES } from './protocol.js';
import { HAMSTER_BITS, HAMSTER_SIDE } from './hamster-data.js';
import { JUNIMO_BITS, JUNIMO_PALETTE } from './junimo-data.js';
import { ZATANNA_BITS, ZATANNA_H, ZATANNA_PALETTE, ZATANNA_W } from './zatanna-data.js';

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

// Grobes Pixel-Herz, eine Farbe, ohne Verlauf. Sieht aus wie die rote Seele aus Undertale.
const RED = [255, 0, 0];
const HEART = [
  '..####..####..',
  '.#####..#####.',
  '##############',
  '##############',
  '##############',
  '.############.',
  '..##########..',
  '...########...',
  '....######....',
  '.....####.....',
  '......##......',
];

// Die sechs anderen Seelen, in der üblichen Reihenfolge um die rote herum.
const SOULS = [
  [255, 163, 0],
  [255, 255, 0],
  [0, 210, 0],
  [0, 255, 255],
  [20, 60, 255],
  [200, 0, 255],
];

function blit(frame, rows, x, y, scale, rgb) {
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== '#') continue;
      rect(frame, x + col * scale, y + row * scale, scale, scale, rgb);
    }
  }
}

function placeHeart(frame, scale, rgb, cx, cy) {
  const w = HEART[0].length * scale;
  const h = HEART.length * scale;
  blit(frame, HEART, Math.round(cx - w / 2), Math.round(cy - h / 2), scale, rgb);
}

function heart() {
  // Zwei Grössen, wie ein Schlag: klein, gross, gross, klein
  return [8, 9, 9, 8].map((scale) => {
    const f = blank();
    placeHeart(f, scale, RED, W / 2, H / 2);
    return f;
  });
}

function souls() {
  const FRAMES = 16;
  const radius = 64;
  return Array.from({ length: FRAMES }, (_, f) => {
    const frame = blank();
    SOULS.forEach((rgb, i) => {
      const ang = 2 * Math.PI * (i / SOULS.length + f / FRAMES) - Math.PI / 2;
      placeHeart(
        frame,
        3,
        rgb,
        W / 2 + Math.cos(ang) * radius,
        H / 2 + Math.sin(ang) * radius,
      );
    });
    placeHeart(frame, 5, RED, W / 2, H / 2);
    return frame;
  });
}

// Eigene Blockbuchstaben, nicht das geschützte DVD-Zeichen. Eine Farbe pro Bild.
const GLYPH = {
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..', '..#..'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};
const DVD_COLORS = [
  [255, 40, 40],
  [40, 90, 255],
  [40, 210, 70],
  [255, 220, 40],
];
const DVD_SCALE = 4;
const DVD_GAP = 10;
const VID_SCALE = 2;
const VID_GAP = 2;
// Gleiche Regeln wie in der Firmware (hairclip.ino, dvdStep): kein gespeicherter Film.
// Am Rand wird die Richtung gespiegelt, wie beim richtigen Bildschirmschoner. Nur die Farbe wechselt.

function wordWidth(word, scale, gap) {
  return word.length * 5 * scale + (word.length - 1) * gap;
}

const DVD_W = wordWidth('DVD', DVD_SCALE, DVD_GAP);
const DVD_H = 7 * DVD_SCALE + 7 * VID_SCALE;

function drawWord(frame, word, x, y, scale, gap, rgb) {
  let cursor = x;
  for (const ch of word) {
    blit(frame, GLYPH[ch], cursor, y, scale, rgb);
    cursor += 5 * scale + gap;
  }
}

function drawDvd(frame, x, y, rgb) {
  drawWord(frame, 'DVD', x, y, DVD_SCALE, DVD_GAP, rgb);
  const vidW = wordWidth('VIDEO', VID_SCALE, VID_GAP);
  drawWord(frame, 'VIDEO', x + Math.round((DVD_W - vidW) / 2), y + 7 * DVD_SCALE, VID_SCALE, VID_GAP, rgb);
}

// Läuft endlos weiter. rand macht den Weg nachvollziehbar für Tests; ohne Argument würfelt der Browser.
export function createDvd(rand = Math.random) {
  const spanX = W - DVD_W;
  const spanY = H - DVD_H;
  const speed = 80 + rand() * 50;
  const angle = rand() * Math.PI * 2;
  const sim = {
    x: rand() * spanX,
    y: rand() * spanY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color: DVD_COLORS[Math.floor(rand() * DVD_COLORS.length)],
    maxX: spanX,
    maxY: spanY,
  };
  if (Math.abs(sim.vx) < 28) sim.vx = 28 * Math.sign(sim.vx || 1);
  if (Math.abs(sim.vy) < 22) sim.vy = 22 * Math.sign(sim.vy || 1);
  sim.step = (dt) => {
    let nx = sim.x + sim.vx * dt;
    let ny = sim.y + sim.vy * dt;
    let hit = false;
    if (nx < 0) { nx = 0; sim.vx = Math.abs(sim.vx); hit = true; }
    else if (nx > spanX) { nx = spanX; sim.vx = -Math.abs(sim.vx); hit = true; }
    if (ny < 0) { ny = 0; sim.vy = Math.abs(sim.vy); hit = true; }
    else if (ny > spanY) { ny = spanY; sim.vy = -Math.abs(sim.vy); hit = true; }
    sim.x = nx;
    sim.y = ny;
    if (!hit) return;
    let i = Math.floor(rand() * (DVD_COLORS.length - 1));
    if (DVD_COLORS[i] === sim.color) i = DVD_COLORS.length - 1;
    sim.color = DVD_COLORS[i];
  };
  sim.render = (frame) => {
    frame.fill(0);
    for (let i = 3; i < frame.length; i += 4) frame[i] = 255;
    drawDvd(frame, Math.round(sim.x), Math.round(sim.y), sim.color);
  };
  return sim;
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

const HAMSTER_COLOR = [[255, 255, 255], [16, 14, 20], [255, 156, 186]];

function decodeHamster() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out = [];
  let buf = 0;
  let bits = 0;
  for (const ch of HAMSTER_BITS) {
    if (ch === '=' || ch === ' ' || ch === '\n') continue;
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  const idx = new Uint8Array(HAMSTER_SIDE * HAMSTER_SIDE);
  for (let i = 0; i < idx.length; i++) idx[i] = (out[i >> 2] >> (6 - (i & 3) * 2)) & 3;
  return idx;
}

const hamsterIdx = decodeHamster();

// Das Originalbild, auf 170×170 gerechnet. Es wippt hin und her, die Form bleibt.
function hamsterAt(dx, dy) {
  const frame = blank();
  for (let i = 0; i < W * H; i++) {
    frame[i * 4] = 255;
    frame[i * 4 + 1] = 255;
    frame[i * 4 + 2] = 255;
    frame[i * 4 + 3] = 255;
  }
  const ox = Math.floor((W - HAMSTER_SIDE) / 2) + dx;
  const oy = Math.floor((H - HAMSTER_SIDE) / 2) + dy;
  for (let y = 0; y < HAMSTER_SIDE; y++) {
    const Y = oy + y;
    if (Y < 0 || Y >= H) continue;
    for (let x = 0; x < HAMSTER_SIDE; x++) {
      const X = ox + x;
      if (X < 0 || X >= W) continue;
      const c = HAMSTER_COLOR[hamsterIdx[y * HAMSTER_SIDE + x]];
      const i = (Y * W + X) * 4;
      frame[i] = c[0];
      frame[i + 1] = c[1];
      frame[i + 2] = c[2];
    }
  }
  return frame;
}

function hamster() {
  const FRAMES = 8;
  return Array.from({ length: FRAMES }, (_, i) => {
    const t = (i / FRAMES) * Math.PI * 2;
    const dx = Math.round(Math.sin(t) * 14);
    const dy = Math.round(-Math.abs(Math.sin(t * 2)) * 8);
    return hamsterAt(dx, dy);
  });
}

function decodeJunimo() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  let buf = 0;
  let bits = 0;
  for (const ch of JUNIMO_BITS) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 255);
    }
  }
  const frames = [];
  let n = 0;
  for (let f = 0; f < 8; f++) {
    const idx = new Uint8Array(256);
    for (let i = 0; i < 256; i += 2) {
      const byte = bytes[n++];
      idx[i] = byte >> 4;
      idx[i + 1] = byte & 15;
    }
    frames.push(idx);
  }
  return frames;
}

const junimoFrames = decodeJunimo();

// Die echten 16×16-Bilder, gross gezeichnet, damit die Pixel bleiben.
function junimo() {
  const scale = 8;
  const ox = Math.floor((W - 16 * scale) / 2);
  const oy = Math.floor((H - 16 * scale) / 2);
  return junimoFrames.map((idx) => {
    const frame = blank();
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const id = idx[y * 16 + x];
        if (!id) continue;
        rect(frame, ox + x * scale, oy + y * scale, scale, scale, JUNIMO_PALETTE[id - 1]);
      }
    }
    return frame;
  });
}

function decodeNibbles(bits, count) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  let buf = 0;
  let nbits = 0;
  for (const ch of bits) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      bytes.push((buf >> nbits) & 255);
    }
  }
  const idx = new Uint8Array(count);
  for (let i = 0; i < count; i += 2) {
    const byte = bytes[i >> 1];
    idx[i] = byte >> 4;
    if (i + 1 < count) idx[i + 1] = byte & 15;
  }
  return idx;
}

const zatannaIdx = decodeNibbles(ZATANNA_BITS, ZATANNA_W * ZATANNA_H);

// Dieselben Pixel, in 16 Schritten einmal ganz herumgedreht. Danach fängt es wieder oben an.
function zatanna() {
  const scale = 4;
  const frames = 16;
  const cx = W / 2;
  const cy = H / 2;
  return Array.from({ length: frames }, (_, i) => {
    const frame = blank();
    const ang = (i / frames) * Math.PI * 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    for (let y = 0; y < H; y++) {
      const dy = (y + 0.5 - cy) / scale;
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - cx) / scale;
        const sx = dx * cos + dy * sin;
        const sy = -dx * sin + dy * cos;
        const px = Math.floor(sx + ZATANNA_W / 2);
        const py = Math.floor(sy + ZATANNA_H / 2);
        if (px < 0 || py < 0 || px >= ZATANNA_W || py >= ZATANNA_H) continue;
        const id = zatannaIdx[py * ZATANNA_W + px];
        if (!id) continue;
        const rgb = ZATANNA_PALETTE[id - 1];
        const o = (y * W + x) * 4;
        frame[o] = rgb[0];
        frame[o + 1] = rgb[1];
        frame[o + 2] = rgb[2];
      }
    }
    return frame;
  });
}

// Wenige flache Rotstufen. Zusammen sehen sie aus wie eine runde, beleuchtete Kugel.
const APPLE_BAND = [
  [110, 16, 22],
  [196, 36, 40],
  [232, 78, 62],
  [255, 228, 214],
];
const APPLE_STEM = [118, 74, 36];
const APPLE_LEAF = [40, 150, 48];
const APPLE_LEAF_DARK = [22, 96, 32];

function paintStemLeaf(frame, cx, cy, ry, side) {
  const stemX = Math.round(cx + side * 8);
  const top = Math.round(cy - ry - 5);
  const bot = Math.round(cy - ry + 2);
  for (let y = top; y <= bot; y++) {
    set(frame, stemX, y, APPLE_STEM);
    set(frame, stemX + 1, y, APPLE_STEM);
  }
  const dir = side >= 0 ? 1 : -1;
  const leaf = ['01110', '11111', '01111', '00110'];
  const ox = stemX + (dir > 0 ? 2 : -1);
  for (let y = 0; y < leaf.length; y++) {
    for (let x = 0; x < leaf[y].length; x++) {
      if (leaf[y][x] === '0') continue;
      const edge = y === 0 || x === 0 || x === leaf[y].length - 1;
      set(frame, ox + dir * x, top + y, edge ? APPLE_LEAF_DARK : APPLE_LEAF);
    }
  }
}

// Eine Kugel mit Licht von oben. Das Licht und das Blatt wandern seitlich um den Apfel.
function paintApple(frame, cx, cy, angle) {
  const rx = 17;
  const ry = 18;
  const lx = Math.sin(angle);
  const ly = -0.62;
  const lz = Math.cos(angle);
  const len = Math.hypot(lx, ly, lz);
  const Lx = lx / len;
  const Ly = ly / len;
  const Lz = lz / len;
  const side = Math.sin(angle);
  const inFront = Math.cos(angle) > 0;
  if (!inFront) paintStemLeaf(frame, cx, cy, ry, side);

  const x0 = Math.round(cx - rx);
  const x1 = Math.round(cx + rx);
  const y0 = Math.round(cy - ry);
  const y1 = Math.round(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const ny = (y + 0.5 - cy) / ry;
    // Oben etwas schmaler, damit es ein Apfel ist und keine reine Kugel.
    const pinch = ny < -0.25 ? 1 - (-0.25 - ny) * 0.22 : 1;
    const limit = pinch * pinch;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      if (nx * nx + ny * ny > limit) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let key = nx * Lx + ny * Ly + nz * Lz;
      if (key < 0) key = 0;
      // nz hält die Kugel auch dann rund, wenn das Licht gerade hinten ist.
      const light = Math.min(1, key * 0.78 + nz * 0.34);
      const band = light < 0.32 ? 0 : light < 0.58 ? 1 : light < 0.84 ? 2 : 3;
      set(frame, x, y, APPLE_BAND[band]);
    }
  }
  if (inFront) paintStemLeaf(frame, cx, cy, ry, side);
}

// Neun runde Äpfel. Licht und Blatt drehen einmal seitlich herum, dann von vorn.
function apples() {
  const frames = 12;
  const spots = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) spots.push([(col + 0.5) * W / 3, (row + 0.5) * H / 3]);
  }
  return Array.from({ length: frames }, (_, i) => {
    const frame = blank();
    const angle = (i / frames) * Math.PI * 2;
    for (const [x, y] of spots) paintApple(frame, x, y, angle);
    return frame;
  });
}

export const PRESETS = [
  { id: 'heart', name: 'Herz', fps: 4, make: heart },
  { id: 'souls', name: 'Seelen', fps: 6, make: souls },
  { id: 'hamster', name: 'Hamster', fps: 10, make: hamster },
  { id: 'junimo', name: 'Junimo', fps: 8, make: junimo },
  { id: 'zatanna', name: 'Zatanna', fps: 12, make: zatanna },
  { id: 'apples', name: 'Äpfel', fps: 10, make: apples },
  { id: 'dvd', name: 'DVD', live: true, info: 'zufällig' },
  { id: 'twinkle', name: 'Funkeln', fps: 10, make: twinkle },
  { id: 'rainbow', name: 'Regenbogen', fps: 12, make: rainbow },
  { id: 'rain', name: 'Regen', fps: 8, make: rain },
];
