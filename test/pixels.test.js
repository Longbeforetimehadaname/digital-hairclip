import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnsFromImage, cellsOnLine, enhanceFrame } from '../web/pixels.js';
import { W, H, FRAME_BYTES } from '../web/protocol.js';

// Baut ein RGBA-Bild aus Zeichen-Zeilen ('#' = Schriftpixel), jede Zelle `cell` × `cell` Bildpixel gross.
// `soft` setzt halbdurchsichtige Ränder um jede Zelle, wie beim Weichzeichnen im Browser.
function image(rows, cell, soft = false) {
  const w = rows[0].length * cell;
  const h = rows.length * cell;
  const d = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (ch !== '#') return;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const edge = x === 0 || y === 0 || x === cell - 1 || y === cell - 1;
      d[((cy * cell + y) * w + cx * cell + x) * 4 + 3] = soft && edge ? 100 : 255;
    }
  }));
  return { d, w, h };
}
const toRows = (cols) => Array.from({ length: H }, (_, r) => [...cols].map((b) => (b & (1 << r) ? '#' : '.')).join(''));

test('columnsFromImage: scharfe Buchstaben trotz weicher Ränder, senkrecht mittig', () => {
  const H_LETTER = ['......', '......', '.#..#.', '.#..#.', '.####.', '.#..#.', '.#..#.', '......', '......', '......'];
  const { d, w, h } = image(H_LETTER, 4, true);
  const rows = toRows(columnsFromImage(d, w, h, 4));
  // 5 Zeilen hoch in 8 Zeilen: oben 1 frei, unten 2 frei. Querstrich genau eine Zeile dick.
  assert.deepEqual(rows, ['....', '#..#', '#..#', '####', '#..#', '#..#', '....', '....']);
});

test('columnsFromImage: Leerzeichen zwischen Wörtern bleiben, leere Ränder fallen weg', () => {
  const { d, w, h } = image(['..#...#..'], 2);
  // Eine Zeile hoch: mittig in Zeile 4 (Bit 3).
  assert.deepEqual([...columnsFromImage(d, w, h, 2)], [8, 0, 0, 0, 8]);
});

test('columnsFromImage: leeres Bild ergibt keine Spalten', () => {
  const { d, w, h } = image(['....', '....'], 4);
  assert.equal(columnsFromImage(d, w, h, 4).length, 0);
});

test('cellsOnLine: lückenlose Linie inklusive Endpunkte', () => {
  const cells = cellsOnLine(0, 0, 15, 7);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells.at(-1), [15, 7]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(Math.abs(cells[i][0] - cells[i - 1][0]) <= 1 && Math.abs(cells[i][1] - cells[i - 1][1]) <= 1, 'Nachbarzellen');
  }
  assert.equal(new Set(cells.map(([x]) => x)).size, 16, 'jede Spalte getroffen');
  assert.deepEqual(cellsOnLine(3, 4, 3, 4), [[3, 4]]);
});

test('enhanceFrame: flaues Foto wird kräftiger', () => {
  const frame = new Uint8Array(FRAME_BYTES);
  for (let i = 0; i < W * H; i++) {
    const t = i / (W * H - 1);
    frame[i * 3] = Math.round(140 + 60 * t); // grau-rosa, wenig Kontrast
    frame[i * 3 + 1] = Math.round(120 + 50 * t);
    frame[i * 3 + 2] = Math.round(115 + 50 * t);
  }
  const out = enhanceFrame(frame);
  const value = (f, i) => Math.max(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
  const sat = (f, i) => { const v = value(f, i); return v ? (v - Math.min(f[i * 3], f[i * 3 + 1], f[i * 3 + 2])) / v : 0; };
  assert.equal(value(out, W * H - 1), 255, 'hellste Stelle voll an');
  assert.ok(value(out, 0) < 10, 'dunkelste Stelle fast aus');
  assert.ok(sat(out, W * H - 1) > sat(frame, W * H - 1) * 1.5, 'Farben satter');
});

test('enhanceFrame: schwarzes Bild bleibt schwarz, Grösse stimmt', () => {
  const out = enhanceFrame(new Uint8Array(FRAME_BYTES));
  assert.equal(out.length, FRAME_BYTES);
  assert.ok(out.every((v) => v === 0));
});
