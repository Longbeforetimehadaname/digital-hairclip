// Smoke-Test der Oberfläche mit jsdom. Kein echter Browser: Zeichnen wird durch einen Dummy ersetzt,
// geprüft wird nur Verdrahtung (Tabs, Buttons, Zustand, Fehlermeldungen), nicht das Aussehen.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const html = fs
  .readFileSync(path.join(webDir, 'index.html'), 'utf8')
  .replace(/<script type="module".*<\/script>/, '')
  .replace(/<link[^>]*fonts[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

function fakeCtx(canvas) {
  let lastText = '';
  return {
    canvas, font: '', fillStyle: '', shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: true,
    imageSmoothingQuality: '', textBaseline: '',
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, drawImage() {},
    fillText(t) { lastText = t; },
    measureText(t) { return { width: t.length * 5 }; },
    getImageData(x, y, w, h) {
      const d = new Uint8ClampedArray(w * h * 4);
      const inkW = Math.min(w, 2 + lastText.length * 5);
      for (let yy = 11; yy <= 16 && yy < h; yy++) for (let xx = 2; xx < inkW; xx++) d[(yy * w + xx) * 4 + 3] = 255;
      for (let i = 0; i < w * h; i++) { d[i * 4] = 200; d[i * 4 + 1] = 100; d[i * 4 + 2] = 50; }
      return { data: d, width: w, height: h };
    },
  };
}
window.HTMLCanvasElement.prototype.getContext = function getContext() { return (this._ctx ||= fakeCtx(this)); };
window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
let stopped = false;
window.requestAnimationFrame = (cb) => {
  if (stopped) return 0;
  const t = setTimeout(() => cb(Date.now()), 16);
  t.unref(); // hält den Test-Prozess nicht am Leben
  return t;
};
window.document.fonts = { load: () => Promise.resolve([]) };

const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', window);
def('document', window.document);
def('HTMLCanvasElement', window.HTMLCanvasElement);
def('navigator', window.navigator);
def('requestAnimationFrame', window.requestAnimationFrame);
def('Image', window.Image);

await import(pathToFileURL(path.join(webDir, 'app.js')).href);
await new Promise((r) => setTimeout(r, 200));

const $ = (s) => window.document.querySelector(s);
const click = (s) => $(s).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const state = () => window.__hairclip.state;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Start: Presets, Farbfelder, Text-Spalten, Status', () => {
  assert.equal(window.document.querySelectorAll('#presets button').length, 4);
  assert.equal(window.document.querySelectorAll('#swatches button').length, 8);
  assert.ok(state().text.cols.length > 0);
  assert.equal($('#status').textContent, 'Nur Vorschau');
  assert.equal($('#support').hidden, false); // jsdom hat kein Web Bluetooth
});

test('Zeichnen: Bilder kopieren, abspielen, löschen', () => {
  click('#tab-draw');
  assert.equal($('#panel-draw').hidden, false);
  assert.equal($('#panel-text').hidden, true);
  click('#frame-add');
  assert.equal(state().draw.frames.length, 2);
  click('#frame-play');
  assert.equal(state().draw.playing, true);
  click('#frame-del');
  assert.equal(state().draw.frames.length, 1);
  assert.equal(state().draw.playing, false);
});

test('Tabs wechseln', () => {
  click('#tab-preset');
  click('#tab-photo');
  click('#tab-text');
  assert.equal($('#panel-text').hidden, false);
});

test('Senden ohne Web Bluetooth: verständliche Fehlermeldung statt Absturz', async () => {
  click('[data-send="text"]');
  await wait(50);
  assert.match($('#msg').textContent, /Bluetooth/);
  assert.ok($('#msg').classList.contains('error'));
});

test('Foto senden ohne Foto: Hinweis', async () => {
  click('[data-send="photo"]');
  await wait(50);
  assert.match($('#msg').textContent, /Foto/);
});

after(() => {
  stopped = true;
  window.close();
});
