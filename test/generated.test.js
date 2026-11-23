// Prüft, ob die erzeugten Dateien zu den Quellen passen. Wenn nicht: node tools/gen-firmware-data.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUTS } from '../tools/gen-firmware-data.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const [file, make] of Object.entries(OUTPUTS)) {
  test(`${file} ist aktuell`, () => {
    const actual = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, make(), 'Bitte node tools/gen-firmware-data.mjs ausführen');
  });
}
