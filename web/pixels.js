// Reine Pixel-Hilfsfunktionen ohne Browser, damit sie testbar sind.

// Wandelt ein Textbild (RGBA, w × h) in einen Textstreifen für das TEXT-Paket um:
// Spalte für Spalte, je ceil(h/8) Bytes, Bit 0 = oberste Zeile. Ein Pixel gilt als gesetzt,
// wenn er mehr als halb deckend ist. Leere Spalten links und rechts werden abgeschnitten.
// Ergebnis: { bits, w } (w = neue Breite, 0 wenn nichts zu sehen ist).
export function textStrip(rgba, w, h) {
  const per = Math.ceil(h / 8);
  const on = (x, y) => rgba[(y * w + x) * 4 + 3] > 127;
  const colEmpty = (x) => { for (let y = 0; y < h; y++) if (on(x, y)) return false; return true; };
  let a = 0;
  let z = w;
  while (a < z && colEmpty(a)) a++;
  while (z > a && colEmpty(z - 1)) z--;
  const out = new Uint8Array((z - a) * per);
  for (let x = a; x < z; x++) {
    for (let y = 0; y < h; y++) {
      if (on(x, y)) out[(x - a) * per + (y >> 3)] |= 1 << (y & 7);
    }
  }
  return { bits: out, w: z - a };
}

// Ist im Textstreifen das Pixel (x, y) gesetzt?
export const stripBit = (bits, h, x, y) => (bits[x * Math.ceil(h / 8) + (y >> 3)] >> (y & 7)) & 1;

// Alle Punkte auf der Linie von (x0, y0) nach (x1, y1), Endpunkte eingeschlossen.
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

// Füllt die zusammenhängende Fläche gleicher Farbe ab (x, y) mit rgb (Farbeimer). Gibt die Anzahl Pixel zurück.
export function floodFill(rgba, w, h, x, y, rgb) {
  const at = (i) => (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
  const start = y * w + x;
  const from = at(start);
  const to = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
  if (from === to) return 0;
  const stack = [start];
  let n = 0;
  while (stack.length) {
    const i = stack.pop();
    if (at(i) !== from) continue;
    rgba[i * 4] = rgb[0]; rgba[i * 4 + 1] = rgb[1]; rgba[i * 4 + 2] = rgb[2]; rgba[i * 4 + 3] = 255;
    n++;
    const px = i % w;
    if (px > 0) stack.push(i - 1);
    if (px < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  return n;
}

// Ausschnitt für ein Foto: füllt w × h ganz aus (wie „cover“). pos von 0 bis 1 verschiebt den Ausschnitt
// entlang der Richtung, in der das Foto übersteht (0 = links/oben, 0.5 = Mitte, 1 = rechts/unten).
export function coverRect(imgW, imgH, w, h, pos = 0.5) {
  const s = Math.max(w / imgW, h / imgH);
  const dw = imgW * s;
  const dh = imgH * s;
  return { x: (w - dw) * pos, y: (h - dh) * pos, w: dw, h: dh };
}

// Malt einen gefüllten Kreis (Pinsel) mit Radius r in ein RGBA-Bild. Ohne Kantenglättung,
// damit nur echte Farben entstehen und das Bild sich gut komprimieren lässt.
export function stampDisc(rgba, w, h, cx, cy, r, rgb) {
  const r2 = r * r + r; // etwas runder als r*r bei kleinen Radien
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const i = (y * w + x) * 4;
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = 255;
    }
  }
}
