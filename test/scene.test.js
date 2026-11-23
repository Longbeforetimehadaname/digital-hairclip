import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Surface, FONTS, textWidth, wrap, tarotScene, shuffleScene, clockScene, clockFields, cardFace,
  COLORS, CARD, SHUFFLE_STEPS, inShape, PIP_LAYOUT,
} from '../web/scene.js';
import { DECK } from '../web/tarot.js';
import { W, H } from '../web/protocol.js';

const TEXT_W = W - 124 - 8;
const px = (s, x, y) => [...s.d.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)];

test('Schriften: alle nötigen Zeichen da, auch Umlaute', () => {
  for (const id of ['S', 'M', 'L']) {
    for (const ch of 'AZaz09 äöüÄÖÜ·,.') assert.ok(FONTS[id].glyphs.has(ch.codePointAt(0)), `${id} ${ch}`);
  }
  for (const ch of '0123456789:') assert.ok(FONTS.XL.glyphs.has(ch.codePointAt(0)));
});

test('Tarot-Texte passen aufs Display: Namen höchstens 2 Zeilen, Stichworte eine Zeile', () => {
  for (const c of DECK) {
    assert.ok(wrap(FONTS.L, c.name, TEXT_W).length <= 2, c.name);
    for (const w of [...c.up, ...c.down]) assert.ok(textWidth(FONTS.S, w) <= TEXT_W, `${c.name}: ${w}`);
  }
});

test('wrap: bricht nach Wörtern um', () => {
  const lines = wrap(FONTS.L, 'Königin der Schwerter', 120);
  assert.ok(lines.length >= 2);
  assert.equal(lines.join(' '), 'Königin der Schwerter');
});

test('tarotScene: jede Karte aufrecht und umgekehrt, Text bleibt im Bild', () => {
  for (const c of DECK) {
    for (const reversed of [false, true]) {
      const s = new Surface();
      tarotScene(s, [{ id: c.id, reversed }], 0);
      assert.deepEqual(px(s, CARD.x, CARD.y), COLORS.gold, 'Kartenrand');
      assert.deepEqual(px(s, 0, 0), COLORS.bg, 'Hintergrund');
    }
  }
  const s = new Surface();
  assert.doesNotThrow(() => tarotScene(s, [{ id: 1, reversed: false }, { id: 13, reversed: true }, { id: 70, reversed: false }], 2));
});

test('umgekehrte Karte ist genau um 180° gedreht', () => {
  const a = new Surface();
  const b = new Surface();
  cardFace(a, 30, false);
  cardFace(b, 30, true);
  for (let y = 0; y < CARD.h; y++) {
    for (let x = 0; x < CARD.w; x++) {
      assert.deepEqual(px(b, CARD.x + CARD.w - 1 - x, CARD.y + CARD.h - 1 - y), px(a, CARD.x + x, CARD.y + y));
    }
  }
});

test('Symbole: alle Formen haben Fläche, Zahlenkarten richtige Anzahl', () => {
  for (let k = 0; k <= 4; k++) {
    let n = 0;
    for (let v = -1; v <= 1; v += 0.05) for (let u = -1; u <= 1; u += 0.05) if (inShape(k, u, v)) n++;
    assert.ok(n > 100, `Form ${k}`);
  }
  for (let count = 2; count <= 10; count++) assert.equal(PIP_LAYOUT[count].length, count);
});

test('shuffleScene und clockScene zeichnen ohne Fehler', () => {
  const s = new Surface();
  for (let i = 0; i < SHUFFLE_STEPS; i++) shuffleScene(s, i);
  const t = clockFields(Date.UTC(2026, 11, 24, 18, 5, 7) / 1000);
  assert.deepEqual([t.h, t.m, t.s, t.wd, t.d, t.mo, t.y], [18, 5, 7, 4, 24, 12, 2026]);
  clockScene(s, t, [255, 80, 160], 1);
  let lit = 0;
  for (let i = 0; i < W * H; i++) if (s.d[i * 4] === 255) lit++;
  assert.ok(lit > 500, 'Ziffern sichtbar');
});
