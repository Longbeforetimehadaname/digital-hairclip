// Zeichnet die Bildschirme, die der Clip selbst erzeugt (Tarot, Uhr), Pixel für Pixel.
// Die Firmware (firmware/hairclip/render.cpp) setzt genau dieselben Regeln in C++ um.
// Wer hier etwas ändert, ändert es dort auch. Reine Funktionen ohne Browser, damit sie testbar sind.
import { FONT_DATA } from './clipfont.js';
import { DECK, SPREAD_LABELS, SUITS } from './tarot.js';
import { W, H } from './protocol.js';

export const COLORS = {
  bg: [14, 10, 18],
  paper: [244, 234, 216],
  ink: [42, 23, 48],
  gold: [217, 164, 65],
  text: [244, 234, 216],
  dim: [190, 178, 200],
  rose: [229, 138, 168],
  back: [46, 26, 62],
};

export const CARD = { x: 14, y: 10, w: 96, h: 150 };
const TEXT_X = 124;
const TEXT_W = W - TEXT_X - 8;

/* ---------- Schrift ---------- */

const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const FONTS = Object.fromEntries(Object.entries(FONT_DATA).map(([id, f]) => [id, {
  ascent: f.ascent,
  descent: f.descent,
  glyphs: new Map(f.glyphs.map(([code, adv, w, h, dx, dy, bits]) => [code, { adv, w, h, dx, dy, bits: decode(bits) }])),
}]));

const glyphOf = (font, code) => font.glyphs.get(code) || font.glyphs.get(63); // unbekannt → '?'

export function textWidth(font, s) {
  let w = 0;
  for (const ch of s) w += glyphOf(font, ch.codePointAt(0)).adv;
  return w;
}

// Bricht nach Wörtern um. Ein einzelnes zu langes Wort bleibt ganz (wird rechts abgeschnitten).
export function wrap(font, s, maxW) {
  const lines = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(font, next) > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- Zeichenfläche (RGBA-Bild W × H, wahlweise um 180° gedreht für umgekehrte Karten) ---------- */

export class Surface {
  constructor(rgba = new Uint8ClampedArray(W * H * 4)) {
    this.d = rgba;
    this.flip = null;
  }

  map(x, y) {
    if (!this.flip) return [x, y];
    const f = this.flip;
    return [2 * f.x + f.w - 1 - x, 2 * f.y + f.h - 1 - y];
  }

  set(x, y, c) {
    [x, y] = this.map(x, y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }

  // Deckung q von 0 bis 3: mischt die Farbe mit dem, was schon da ist
  blend(x, y, c, q) {
    if (q >= 3) { this.set(x, y, c); return; }
    [x, y] = this.map(x, y);
    if (q <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(this.d[i + k] + ((c[k] - this.d[i + k]) * q) / 3);
    this.d[i + 3] = 255;
  }

  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
  }

  text(font, s, x, baseline, c) {
    for (const ch of s) {
      const g = glyphOf(font, ch.codePointAt(0));
      for (let yy = 0; yy < g.h; yy++) {
        for (let xx = 0; xx < g.w; xx++) {
          const i = yy * g.w + xx;
          const q = (g.bits[i >> 2] >> ((i & 3) * 2)) & 3;
          if (q) this.blend(x + g.dx + xx, baseline + g.dy + yy, c, q);
        }
      }
      x += g.adv;
    }
  }

  textCentered(font, s, cx, baseline, c) {
    this.text(font, s, Math.round(cx - textWidth(font, s) / 2), baseline, c);
  }
}

/* ---------- Symbole: Formeln in Koordinaten u, v von −1 bis 1 (v nach unten) ---------- */

export function inShape(kind, u, v) {
  const au = Math.abs(u);
  switch (kind) {
    case 0: // Stab: Stange mit Raute oben
      return (au <= 0.18 && v >= -0.55 && v <= 1) || au + Math.abs(v + 0.72) <= 0.3;
    case 1: // Kelch: Schale, Stiel, Fuss
      return (v >= -0.85 && v <= -0.1 && (u / 0.8) ** 2 + ((v + 0.85) / 0.75) ** 2 <= 1)
        || (au <= 0.12 && v >= -0.15 && v <= 0.62) || (au <= 0.55 && v >= 0.6 && v <= 0.85);
    case 2: // Schwert: Klinge mit Spitze, Parierstange, Griff, Knauf
      return (au <= 0.16 && v >= -0.6 && v <= 0.45) || (v >= -1 && v < -0.6 && au <= (0.16 * (v + 1)) / 0.4)
        || (au <= 0.55 && v >= 0.45 && v <= 0.6) || (au <= 0.1 && v >= 0.6 && v <= 0.85) || u * u + (v - 0.92) ** 2 <= 0.0225;
    case 3: { // Münze: Ring mit Punkt
      const r = Math.sqrt(u * u + v * v);
      return (r >= 0.62 && r <= 0.95) || r <= 0.28;
    }
    default: // Stern (Grosse Arkana): Raute + Quadrat = acht Zacken, Mitte frei
      return (au + Math.abs(v) <= 1 || Math.max(au, Math.abs(v)) <= 0.68) && u * u + v * v > 0.04;
  }
}

export function shape(s, kind, cx, cy, half, c) {
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      if (inShape(kind, (x + 0.5) / half, (y + 0.5) / half)) s.set(cx + x, cy + y, c);
    }
  }
}

// Lage der Zeichen auf Zahlenkarten (Spalte 0–2, Zeile 0–4), wie bei Spielkarten
const PIPS = {
  2: [[1, 0], [1, 4]],
  3: [[1, 0], [1, 2], [1, 4]],
  4: [[0, 0], [2, 0], [0, 4], [2, 4]],
  5: [[0, 0], [2, 0], [1, 2], [0, 4], [2, 4]],
  6: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4]],
  7: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4]],
  8: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4]],
  9: [[0, 0], [2, 0], [0, 1.33], [2, 1.33], [1, 2], [0, 2.67], [2, 2.67], [0, 4], [2, 4]],
  10: [[0, 0], [2, 0], [1, 0.67], [0, 1.33], [2, 1.33], [0, 2.67], [2, 2.67], [1, 3.33], [0, 4], [2, 4]],
};
export const PIP_LAYOUT = PIPS;

/* ---------- Karten ---------- */

export function cardFace(s, id, reversed, x = CARD.x, y = CARD.y) {
  const c = DECK[id];
  if (reversed) s.flip = { x, y, w: CARD.w, h: CARD.h };
  s.rect(x, y, CARD.w, CARD.h, COLORS.gold);
  s.rect(x + 2, y + 2, CARD.w - 4, CARD.h - 4, COLORS.paper);
  s.frame(x + 5, y + 5, CARD.w - 10, CARD.h - 10, COLORS.ink);
  s.textCentered(FONTS.M, c.mark, x + CARD.w / 2, y + 28, COLORS.ink);
  const count = c.suit >= 0 ? c.rank + 1 : 0;
  if (count >= 2 && count <= 10) {
    for (const [col, row] of PIPS[count]) shape(s, c.suit, x + 22 + col * 26, y + 45 + Math.round(row * 15), 7, COLORS.ink);
  } else {
    shape(s, c.suit >= 0 ? c.suit : 4, x + CARD.w / 2, y + 75, 24, COLORS.ink);
  }
  // unten nochmals die Zahl, wie bei Spielkarten (bei umgekehrten Karten steht dann oben eine Zahl auf dem Kopf)
  s.textCentered(FONTS.M, c.mark, x + CARD.w / 2, y + CARD.h - 14, COLORS.ink);
  s.flip = null;
}

export function cardBack(s, x, y) {
  s.rect(x, y, CARD.w, CARD.h, COLORS.gold);
  for (let yy = 2; yy < CARD.h - 2; yy++) {
    for (let xx = 2; xx < CARD.w - 2; xx++) {
      const lattice = (xx + yy) % 12 === 0 || (xx - yy + 1200) % 12 === 0;
      s.set(x + xx, y + yy, lattice ? COLORS.gold : COLORS.back);
    }
  }
  s.frame(x + 5, y + 5, CARD.w - 10, CARD.h - 10, COLORS.gold);
}

// Ein Bild der Mischen-Animation (step zählt hoch, 8 Schritte à 150 ms)
export const SHUFFLE_STEPS = 8;
export const SHUFFLE_MS = 150;
export function shuffleScene(s, step) {
  s.rect(0, 0, W, H, COLORS.bg);
  for (let k = 0; k < 3; k++) {
    const slot = (k + step) % 3;
    cardBack(s, CARD.x + slot * 22, CARD.y + (slot === 1 ? 0 : 4) - (k === step % 3 ? 4 : 0));
  }
  s.text(FONTS.L, 'Die Karten', TEXT_X + 10, 74, COLORS.text);
  s.text(FONTS.L, 'werden gemischt', TEXT_X + 10, 100, COLORS.text);
  s.text(FONTS.M, '.'.repeat(1 + (step % 3)), TEXT_X + 10, 124, COLORS.gold);
}

// Eine gezogene Karte mit Deutung. Bei drei Karten zeigt index, welche gerade dran ist.
export const SPREAD_MS = 6000; // so lange bleibt jede der drei Karten stehen
export function tarotScene(s, cards, index) {
  const { id, reversed } = cards[index];
  const c = DECK[id];
  s.rect(0, 0, W, H, COLORS.bg);
  cardFace(s, id, reversed);
  let y = 30;
  const label = cards.length === 3 ? `${index + 1} · ${SPREAD_LABELS[index]}` : 'Deine Karte';
  s.text(FONTS.S, label, TEXT_X, y, COLORS.gold);
  if (cards.length === 3) {
    for (let k = 0; k < 3; k++) {
      const dx = W - 36 + k * 10;
      s.rect(dx, y - 8, 6, 6, k === index ? COLORS.gold : COLORS.back);
    }
  }
  y += 26;
  for (const line of wrap(FONTS.L, c.name, TEXT_W).slice(0, 2)) {
    s.text(FONTS.L, line, TEXT_X, y, COLORS.text);
    y += 25;
  }
  y -= 3;
  if (reversed) {
    s.text(FONTS.S, 'umgekehrt', TEXT_X, y, COLORS.rose);
    y += 19;
  }
  for (const word of reversed ? c.down : c.up) {
    s.text(FONTS.S, word, TEXT_X, y, COLORS.dim);
    y += 18;
  }
}

/* ---------- Uhr ---------- */

export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const two = (n) => String(n).padStart(2, '0');

// t: { h, m, s, wd, d, mo, y } (Ortszeit). style 0: nur Uhrzeit, 1: mit Datum. Doppelpunkt blinkt.
export function clockScene(s, t, color, style) {
  s.rect(0, 0, W, H, COLORS.bg);
  const xl = FONTS.XL;
  const zero = glyphOf(xl, 48);
  const center = style === 1 ? 72 : 85;
  const base = Math.round(center - (zero.dy + zero.h / 2));
  const str = `${two(t.h)}:${two(t.m)}`;
  let x = Math.round(W / 2 - textWidth(xl, str) / 2);
  for (const ch of str) {
    const blink = ch === ':' && t.s % 2 === 1;
    s.text(xl, ch, x, base, blink ? COLORS.bg : color);
    x += glyphOf(xl, ch.codePointAt(0)).adv;
  }
  if (style === 1) {
    s.textCentered(FONTS.M, `${WEEKDAYS[t.wd]}, ${t.d}.${t.mo}.${t.y}`, W / 2, 142, COLORS.dim);
  }
}

// Wandelt Sekunden (Ortszeit seit 1.1.1970) in Uhr-Felder um, so wie die Firmware es mit gmtime tut.
export function clockFields(localSeconds) {
  const d = new Date(localSeconds * 1000);
  return {
    h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(),
    wd: d.getUTCDay(), d: d.getUTCDate(), mo: d.getUTCMonth() + 1, y: d.getUTCFullYear(),
  };
}
