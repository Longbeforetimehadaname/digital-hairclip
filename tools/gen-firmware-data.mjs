// Erzeugt aus den Webseiten-Daten die Dateien für Firmware und Webseite, damit beide gleich bleiben:
//   tools/fonts.json  →  web/clipfont.js  und  firmware/hairclip/font_data.h
//   web/tarot.js      →  firmware/hairclip/tarot_data.h
// Aufruf: node tools/gen-firmware-data.mjs   (test/generated.test.js prüft, ob alles aktuell ist)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECK, SUITS, SPREAD_LABELS, REVERSED_CHANCE } from '../web/tarot.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADER = '// Automatisch erzeugt von tools/gen-firmware-data.mjs. Nicht von Hand ändern.\n';

// C-Zeichenkette mit UTF-8. Nicht-ASCII-Bytes als Oktal-Escape (genau 3 Ziffern, kann nicht mit Folgezeichen verschmelzen).
function cstr(s) {
  let out = '"';
  for (const b of Buffer.from(s, 'utf8')) {
    if (b === 0x22 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `${out}"`;
}

function bytesC(bytes, perLine = 24) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += perLine) {
    parts.push(`  ${[...bytes.subarray(i, i + perLine)].map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')},`);
  }
  return parts.join('\n');
}

export function loadFonts() {
  return JSON.parse(fs.readFileSync(path.join(root, 'tools', 'fonts.json'), 'utf8'));
}

export function fontHeader(fonts) {
  let out = `${HEADER}// Schrift: ${fonts.source}. 2 Bit pro Pixel (Deckung 0–3), Zeile für Zeile, niedrigste Bits zuerst.\n#pragma once\n#include "font.h"\n\n`;
  for (const f of fonts.fonts) {
    const glyphs = [...f.glyphs].sort((a, b) => a.ch.codePointAt(0) - b.ch.codePointAt(0));
    const chunks = [];
    let off = 0;
    const rows = glyphs.map((g) => {
      const bytes = Buffer.from(g.bits, 'base64');
      chunks.push(bytes);
      const row = `  {${g.ch.codePointAt(0)}, ${g.adv}, ${g.w}, ${g.h}, ${g.dx}, ${g.dy}, ${off}},`;
      off += bytes.length;
      return row;
    });
    const all = Buffer.concat(chunks);
    out += `static const uint8_t FONT_${f.id}_BITS[] PROGMEM = {\n${bytesC(all)}\n};\n`;
    out += `static const Glyph FONT_${f.id}_GLYPHS[] = {\n${rows.join('\n')}\n};\n`;
    out += `static const Font FONT_${f.id} = {FONT_${f.id}_GLYPHS, ${glyphs.length}, FONT_${f.id}_BITS, ${f.ascent}, ${f.descent}};\n\n`;
  }
  return out;
}

export function fontModule(fonts) {
  const data = Object.fromEntries(fonts.fonts.map((f) => [f.id, {
    ascent: f.ascent,
    descent: f.descent,
    glyphs: f.glyphs.map((g) => [g.ch.codePointAt(0), g.adv, g.w, g.h, g.dx, g.dy, g.bits]),
  }]));
  return `${HEADER}// Schrift: ${fonts.source}. Gleiche Daten wie firmware/hairclip/font_data.h.\nexport const FONT_DATA = ${JSON.stringify(data)};\n`;
}

export function tarotHeader() {
  const list = (arr) => arr.map((s) => `  ${cstr(s)},`).join('\n');
  return `${HEADER}#pragma once
#include <stdint.h>

#define TAROT_COUNT ${DECK.length}
#define TAROT_REVERSED_PERCENT ${Math.round(REVERSED_CHANCE * 100)}

static const char *const TAROT_NAME[TAROT_COUNT] = {
${list(DECK.map((c) => c.name))}
};
static const char *const TAROT_MARK[TAROT_COUNT] = {
${list(DECK.map((c) => c.mark))}
};
// -1 = Grosse Arkana, sonst Farbe 0–3 (SUIT_NAME)
static const int8_t TAROT_SUIT[TAROT_COUNT] = {${DECK.map((c) => c.suit).join(', ')}};
static const uint8_t TAROT_RANK[TAROT_COUNT] = {${DECK.map((c) => c.rank).join(', ')}};
static const char *const TAROT_UP[TAROT_COUNT][3] = {
${DECK.map((c) => `  {${c.up.map(cstr).join(', ')}},`).join('\n')}
};
static const char *const TAROT_DOWN[TAROT_COUNT][3] = {
${DECK.map((c) => `  {${c.down.map(cstr).join(', ')}},`).join('\n')}
};
static const char *const SUIT_NAME[4] = {${SUITS.map(cstr).join(', ')}};
static const char *const SPREAD_LABEL[3] = {${SPREAD_LABELS.map(cstr).join(', ')}};
`;
}

export const OUTPUTS = {
  'web/clipfont.js': () => fontModule(loadFonts()),
  'firmware/hairclip/font_data.h': () => fontHeader(loadFonts()),
  'firmware/hairclip/tarot_data.h': () => tarotHeader(),
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [file, make] of Object.entries(OUTPUTS)) {
    const p = path.join(root, file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, make());
    console.log(`geschrieben: ${file}`);
  }
}
