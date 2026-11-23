import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textStrip, stripBit, cellsOnLine, stampDisc } from '../web/pixels.js';

// Baut ein RGBA-Bild aus Zeichen-Zeilen ('#' = deckend, '+' = halb durchsichtig, '.' = leer).
function image(rows) {
  const w = rows[0].length;
  const h = rows.length;
  const d = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { d[(y * w + x) * 4 + 3] = ch === '#' ? 255 : ch === '+' ? 100 : 0; }));
  return { d, w, h };
}

test('textStrip: Spalten mit Bit 0 oben, über mehrere Bytes, Ränder abgeschnitten', () => {
  const rows = Array.from({ length: 10 }, () => '......');
  rows[0] = '..#...';
  rows[9] = '..+#..'; // halb durchsichtig zählt nicht
  const { d, w, h } = image(rows);
  const { bits, w: sw } = textStrip(d, w, h);
  assert.equal(sw, 2); // Spalten 2 und 3
  assert.equal(bits.length, 2 * 2); // 10 Zeilen = 2 Bytes pro Spalte
  assert.deepEqual([...bits], [0b1, 0b0, 0b0, 0b10]);
  assert.equal(stripBit(bits, h, 0, 0), 1);
  assert.equal(stripBit(bits, h, 1, 9), 1);
  assert.equal(stripBit(bits, h, 0, 9), 0);
});

test('textStrip: Lücken zwischen Wörtern bleiben', () => {
  const { d, w, h } = image(['.#...#.']);
  const { bits, w: sw } = textStrip(d, w, h);
  assert.equal(sw, 5);
  assert.deepEqual([...bits], [1, 0, 0, 0, 1]);
});

test('textStrip: leeres Bild ergibt Breite 0', () => {
  const { d, w, h } = image(['....', '....']);
  assert.equal(textStrip(d, w, h).w, 0);
});

test('cellsOnLine: lückenlose Linie inklusive Endpunkte', () => {
  const cells = cellsOnLine(0, 0, 15, 7);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells.at(-1), [15, 7]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(Math.abs(cells[i][0] - cells[i - 1][0]) <= 1 && Math.abs(cells[i][1] - cells[i - 1][1]) <= 1, 'Nachbarpunkte');
  }
  assert.equal(new Set(cells.map(([x]) => x)).size, 16, 'jede Spalte getroffen');
  assert.deepEqual(cellsOnLine(3, 4, 3, 4), [[3, 4]]);
});

test('stampDisc: runder Pinsel, nur volle Farben, bleibt im Bild', () => {
  const w = 9;
  const h = 9;
  const d = new Uint8ClampedArray(w * h * 4);
  stampDisc(d, w, h, 4, 4, 3, [10, 20, 30]);
  const at = (x, y) => [...d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
  assert.deepEqual(at(4, 4), [10, 20, 30, 255]);
  assert.deepEqual(at(4, 1), [10, 20, 30, 255]);
  assert.deepEqual(at(1, 1), [0, 0, 0, 0], 'Ecke bleibt leer: rund statt eckig');
  assert.doesNotThrow(() => stampDisc(d, w, h, 0, 0, 5, [1, 2, 3]));
});
