// Reine Pixel-Hilfsfunktionen ohne Browser, damit sie testbar sind.
import { W, H } from './protocol.js';

// Wandelt ein gross gezeichnetes Textbild (RGBA) in Spalten für das 8 Zeilen hohe Raster um.
// `cell` ist die Grösse eines Schriftpixels in Bildpixeln. Abgetastet wird die Mitte jeder Zelle,
// so bleiben die Buchstaben scharf, auch wenn die Ränder der Schrift weichgezeichnet sind.
// Ergebnis: ein Byte pro Spalte, Bit 0 = oberste Zeile, senkrecht mittig, leere Ränder abgeschnitten.
export function columnsFromImage(rgba, w, h, cell) {
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  const on = (cx, cy) => rgba[((cy * cell + (cell >> 1)) * w + cx * cell + (cell >> 1)) * 4 + 3] > 127;

  let top = rows;
  let bottom = -1;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (on(cx, cy)) {
        if (cy < top) top = cy;
        bottom = cy;
        break;
      }
    }
  }
  if (bottom < 0) return new Uint8Array(0);

  const inkRows = bottom - top + 1;
  const pad = Math.max(0, Math.floor((H - inkRows) / 2));
  const out = new Uint8Array(cols);
  for (let cx = 0; cx < cols; cx++) {
    let b = 0;
    for (let r = 0; r < H; r++) {
      const cy = top + r - pad;
      if (cy >= top && cy <= bottom && on(cx, cy)) b |= 1 << r;
    }
    out[cx] = b;
  }
  let a = 0;
  let z = out.length;
  while (a < z && out[a] === 0) a++;
  while (z > a && out[z - 1] === 0) z--;
  return out.slice(a, z);
}

// Alle Rasterzellen auf der Linie von (x0, y0) nach (x1, y1), Endpunkte eingeschlossen.
// Damit beim schnellen Wischen mit dem Finger keine Lücken entstehen.
export function cellsOnLine(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// Macht ein 16x8-Foto für die LED-Punkte kräftiger: Helligkeit auf den vollen Bereich strecken
// (dunkelste Stelle wird fast aus, hellste voll an) und Farben satter machen.
// Fotos wirken auf 128 Punkten sonst grau und flau.
export function enhanceFrame(frame, { saturation = 1.8, gamma = 1.3 } = {}) {
  const n = W * H;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.max(frame[i * 3], frame[i * 3 + 1], frame[i * 3 + 2]);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Uint8Array(frame.length);
  const range = hi - lo;
  for (let i = 0; i < n; i++) {
    const r = frame[i * 3];
    const g = frame[i * 3 + 1];
    const b = frame[i * 3 + 2];
    const max = Math.max(r, g, b);
    if (max === 0) continue;
    const v = range > 0 ? ((max - lo) / range) ** gamma : max / 255;
    // Sättigung erhöhen: Abstand jedes Kanals zum hellsten Kanal vergrössern.
    const scale = (v * 255) / max;
    for (let k = 0; k < 3; k++) {
      const c = frame[i * 3 + k];
      const boosted = max - (max - c) * saturation;
      out[i * 3 + k] = Math.round(Math.min(255, Math.max(0, boosted * scale)));
    }
  }
  return out;
}
