import {
  W, H, TEXT_H,
  animPackets, textPacket, photoPackets, brightnessPacket, offPacket, concat,
} from './protocol.js';
import { PRESETS, blank } from './presets.js';
import { HairclipLink } from './ble.js';
import { textStrip, stripBit, cellsOnLine, stampDisc } from './pixels.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const MAX_DRAW_FRAMES = 8;
const SWATCHES = [
  ['#ff4d9d', 'Pink'], ['#ff9ac4', 'Rosa'], ['#ffd166', 'Gelb'], ['#7bf1a8', 'Grün'],
  ['#5ec8ff', 'Blau'], ['#b69cff', 'Lila'], ['#ffffff', 'Weiss'], ['#ff5a4d', 'Rot'],
];

const state = {
  tab: 'text',
  brightness: 200,
  text: { value: 'Hallo Schatz', color: '#ff5fa8', speed: 4, bits: new Uint8Array(0), w: 0 },
  draw: { frames: [blank()], cur: 0, fps: 5, playing: false, color: '#ff4d9d', tool: 'pen', size: 4 },
  preset: { id: PRESETS[0].id, frames: PRESETS[0].make(), fps: PRESETS[0].fps },
  photo: { rgba: null },
};

const link = new HairclipLink({ onChange: updateStatus });

/* ---------- Vorschau-Bildschirm: zeigt genau die 320 × 170 Pixel des Clips ---------- */

const screen = $('#screen');
const sctx = screen.getContext('2d');
const screenImg = sctx.createImageData(W, H);

function paintFrame(rgba) {
  screenImg.data.set(rgba);
  sctx.putImageData(screenImg, 0, 0);
}

// Text wie im Clip: Streifen senkrecht mittig, scrollt von rechts nach links (siehe docs/PROTOCOL.md).
let textCanvas = null;
function rebuildTextCanvas() {
  const { bits, w } = state.text;
  if (!w) { textCanvas = null; return; }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = TEXT_H;
  const x = c.getContext('2d');
  const img = x.createImageData(w, TEXT_H);
  const [r, g, b] = hexToRgb(state.text.color);
  for (let px = 0; px < w; px++) {
    for (let y = 0; y < TEXT_H; y++) {
      if (!stripBit(bits, TEXT_H, px, y)) continue;
      const i = (y * w + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  textCanvas = c;
}

function paintText(t) {
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, W, H);
  if (!textCanvas) return;
  const o = Math.floor(t * state.text.speed * 30) % (state.text.w + W);
  sctx.drawImage(textCanvas, W - o, Math.floor((H - TEXT_H) / 2));
}

function paint(t) {
  switch (state.tab) {
    case 'text':
      paintText(t);
      break;
    case 'draw': {
      const d = state.draw;
      const i = d.playing && d.frames.length > 1 ? Math.floor(t * d.fps) % d.frames.length : d.cur;
      paintFrame(d.frames[i]);
      break;
    }
    case 'preset': {
      const p = state.preset;
      paintFrame(p.frames[Math.floor(t * p.fps) % p.frames.length]);
      break;
    }
    case 'photo':
      if (state.photo.rgba) paintFrame(state.photo.rgba);
      else { sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W, H); }
      break;
    default:
      break;
  }
  const dim = 1 - state.brightness / 255; // Helligkeit wie die Hintergrundbeleuchtung
  if (dim > 0) {
    sctx.fillStyle = `rgba(0,0,0,${dim})`;
    sctx.fillRect(0, 0, W, H);
  }
}

function loop(ms) {
  paint(ms / 1000);
  requestAnimationFrame(loop);
}

/* ---------- Text ---------- */

// Zeichnet den Text gross mit der Schrift „Nunito“ (fett) und macht daraus einen Streifen
// aus gesetzten und leeren Pixeln (ohne Kantenglättung, genau so zeigt ihn der Clip).
const FONT = `800 80px "Nunito", system-ui, sans-serif`;
function buildStrip(text) {
  const t = text.trim() ? text : '';
  if (!t) return { bits: new Uint8Array(0), w: 0 };
  const work = document.createElement('canvas');
  const c = work.getContext('2d', { willReadFrequently: true });
  c.font = FONT;
  const w = Math.ceil(c.measureText(t).width) + 16;
  work.width = w; // setzt den Zeichenzustand zurück, darum danach Schrift neu setzen
  work.height = TEXT_H;
  c.font = FONT;
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff';
  c.fillText(t, 8, 86); // Grundlinie so, dass Umlaut-Punkte oben und Unterlängen (g, j) unten Platz haben
  return textStrip(c.getImageData(0, 0, w, TEXT_H).data, w, TEXT_H);
}

function refreshText() {
  const { bits, w } = buildStrip(state.text.value);
  state.text.bits = bits;
  state.text.w = w;
  rebuildTextCanvas();
}

$('#text-input').addEventListener('input', (e) => { state.text.value = e.target.value; refreshText(); });
$('#text-color').addEventListener('input', (e) => { state.text.color = e.target.value; rebuildTextCanvas(); });
$('#text-speed').addEventListener('input', (e) => { state.text.speed = Number(e.target.value); });

/* ---------- Zeichnen ---------- */

const editor = $('#editor');
const ectx = editor.getContext('2d');
const editorImg = ectx.createImageData(W, H);

function renderEditor() {
  editorImg.data.set(state.draw.frames[state.draw.cur]);
  ectx.putImageData(editorImg, 0, 0);
}

function renderThumbs() {
  const box = $('#frames');
  box.replaceChildren();
  state.draw.frames.forEach((f, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.setAttribute('aria-label', `Bild ${idx + 1}`);
    btn.setAttribute('aria-pressed', String(idx === state.draw.cur));
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(W, H);
    img.data.set(f);
    cx.putImageData(img, 0, 0);
    btn.append(cv);
    btn.addEventListener('click', () => { state.draw.cur = idx; state.draw.playing = false; syncDraw(); });
    box.append(btn);
  });
}

function syncDraw() {
  const d = state.draw;
  renderEditor();
  renderThumbs();
  const play = $('#frame-play');
  play.textContent = d.playing ? 'Stopp' : 'Abspielen';
  play.disabled = d.frames.length < 2;
  $('#frame-add').disabled = d.frames.length >= MAX_DRAW_FRAMES;
  $('#frame-del').disabled = d.frames.length < 2;
  $('#tool-pen').setAttribute('aria-pressed', String(d.tool === 'pen'));
  $('#tool-eraser').setAttribute('aria-pressed', String(d.tool === 'eraser'));
}

let painting = false;
let lastPoint = null; // letzter gemalter Punkt, damit schnelle Striche durchgehend werden

function paintAt(e) {
  const r = editor.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const x = Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H)));
  const f = state.draw.frames[state.draw.cur];
  const rgb = state.draw.tool === 'pen' ? hexToRgb(state.draw.color) : [0, 0, 0];
  const size = state.draw.tool === 'pen' ? state.draw.size : state.draw.size + 3; // Radierer etwas grösser
  const points = lastPoint ? cellsOnLine(lastPoint[0], lastPoint[1], x, y) : [[x, y]];
  for (const [px, py] of points) stampDisc(f, W, H, px, py, size, rgb);
  lastPoint = [x, y];
  renderEditor();
}

editor.addEventListener('pointerdown', (e) => {
  editor.setPointerCapture(e.pointerId);
  painting = true;
  lastPoint = null;
  state.draw.playing = false;
  paintAt(e);
});
editor.addEventListener('pointermove', (e) => { if (painting) paintAt(e); });
['pointerup', 'pointercancel'].forEach((name) =>
  editor.addEventListener(name, () => { painting = false; lastPoint = null; syncDraw(); }));

SWATCHES.forEach(([hex, name]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = hex;
  b.setAttribute('aria-label', name);
  b.addEventListener('click', () => {
    state.draw.color = hex;
    state.draw.tool = 'pen';
    $('#draw-color').value = hex;
    syncDraw();
  });
  $('#swatches').append(b);
});

$('#draw-color').addEventListener('input', (e) => { state.draw.color = e.target.value; state.draw.tool = 'pen'; syncDraw(); });
$('#tool-pen').addEventListener('click', () => { state.draw.tool = 'pen'; syncDraw(); });
$('#tool-eraser').addEventListener('click', () => { state.draw.tool = 'eraser'; syncDraw(); });
$('#brush').addEventListener('input', (e) => { state.draw.size = Number(e.target.value); });
$('#draw-fps').addEventListener('input', (e) => { state.draw.fps = Number(e.target.value); });

$('#frame-add').addEventListener('click', () => {
  const d = state.draw;
  if (d.frames.length >= MAX_DRAW_FRAMES) return;
  d.frames.splice(d.cur + 1, 0, new Uint8ClampedArray(d.frames[d.cur]));
  d.cur += 1;
  syncDraw();
});
$('#frame-del').addEventListener('click', () => {
  const d = state.draw;
  if (d.frames.length < 2) return;
  d.frames.splice(d.cur, 1);
  d.cur = Math.min(d.cur, d.frames.length - 1);
  if (d.frames.length < 2) d.playing = false;
  syncDraw();
});
$('#frame-clear').addEventListener('click', () => { state.draw.frames[state.draw.cur] = blank(); syncDraw(); });
$('#frame-play').addEventListener('click', () => {
  if (state.draw.frames.length < 2) return;
  state.draw.playing = !state.draw.playing;
  syncDraw();
});

/* ---------- Animationen ---------- */

function renderPresets() {
  const box = $('#presets');
  box.replaceChildren();
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = p.name;
    b.setAttribute('aria-pressed', String(p.id === state.preset.id));
    b.addEventListener('click', () => {
      state.preset = { id: p.id, frames: p.make(), fps: p.fps };
      renderPresets();
    });
    box.append(b);
  });
}

/* ---------- Foto ---------- */

// Füllt das ganze Display, schneidet überstehende Ränder ab (wie „cover“).
function coverPixels(img) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  const s = Math.max(W / img.width, H / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const data = new Uint8ClampedArray(x.getImageData(0, 0, W, H).data);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return data;
}

$('#photo-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    state.photo.rgba = coverPixels(img);
    setMsg('Foto geladen.');
  } catch {
    setMsg('Dieses Bild konnte nicht gelesen werden. Probier ein JPG oder PNG.', true);
  } finally {
    URL.revokeObjectURL(url);
  }
});

/* ---------- Verbindung und Senden ---------- */

const msgEl = $('#msg');
const progressEl = $('#progress');

function setMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.classList.toggle('error', isError);
}

function updateStatus() {
  $('#status').textContent = link.connected ? 'Mit Clip verbunden' : 'Nur Vorschau';
  $('#dot').classList.toggle('on', link.connected);
  $('#connect').textContent = link.connected ? 'Trennen' : 'Mit Clip verbinden';
}

function errorText(e) {
  if (e.message === 'NO_WEB_BLUETOOTH') {
    return 'Dieser Browser kann kein Bluetooth. Android: Chrome benutzen. iPhone: die App „Bluefy“ benutzen.';
  }
  if (e.name === 'NotFoundError') return 'Kein Clip ausgewählt. Ist er eingeschaltet und in der Nähe?';
  if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
    return 'Bluetooth ist blockiert. Erlaube Bluetooth für den Browser in den Einstellungen.';
  }
  if (e.message === 'BUSY') return 'Der Clip bekommt noch Daten. Kurz warten.';
  if (e.message === 'NOT_CONNECTED') return 'Die Verbindung zum Clip ist weg. Bitte neu verbinden.';
  return `Das hat nicht geklappt: ${e.message}`;
}

async function ensureConnected() {
  if (link.connected) return;
  setMsg('Verbinde …');
  await link.connect();
  await link.send(brightnessPacket(state.brightness));
}

async function transmit(buildBytes) {
  try {
    const bytes = buildBytes(); // zuerst prüfen, damit Fehler vor dem Verbinden auffallen
    await ensureConnected();
    setMsg('Sende …');
    progressEl.hidden = false;
    progressEl.value = 0;
    await link.send(bytes, (p) => { progressEl.value = p; });
    setMsg('Gesendet.');
  } catch (e) {
    setMsg(e instanceof RangeError ? e.message : errorText(e), true);
  } finally {
    progressEl.hidden = true;
  }
}

const senders = {
  text: () => {
    if (!state.text.w) throw new RangeError('Gib zuerst einen Text ein.');
    return textPacket(state.text.bits, state.text.w, TEXT_H, hexToRgb(state.text.color), state.text.speed);
  },
  draw: () => concat(animPackets(state.draw.frames, state.draw.frames.length > 1 ? state.draw.fps : 1)),
  preset: () => concat(animPackets(state.preset.frames, state.preset.fps)),
  photo: () => {
    if (!state.photo.rgba) throw new RangeError('Wähle zuerst ein Foto aus.');
    return concat(photoPackets(state.photo.rgba));
  },
};

$$('[data-send]').forEach((b) => b.addEventListener('click', () => transmit(senders[b.dataset.send])));

$('#connect').addEventListener('click', async () => {
  if (link.connected) { link.disconnect(); setMsg(''); return; }
  try {
    await ensureConnected();
    setMsg('Verbunden.');
  } catch (e) {
    setMsg(errorText(e), true);
  }
});

$('#off').addEventListener('click', () => transmit(offPacket));

const bright = $('#bright');
bright.addEventListener('input', () => { state.brightness = Number(bright.value); });
bright.addEventListener('change', async () => {
  if (!link.connected) return;
  try { await link.send(brightnessPacket(state.brightness)); } catch { /* beim nächsten Senden erneut */ }
});

/* ---------- Tabs ---------- */

const tabs = $$('[role="tab"]');
function selectTab(name, focus = false) {
  if (state.tab !== name) setMsg(''); // alte Meldung (z. B. „Foto geladen.“) gehört nicht zum neuen Tab
  state.tab = name;
  tabs.forEach((t) => {
    const on = t.id === `tab-${name}`;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    if (on && focus) t.focus();
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t.id.replace('tab-', '')));
  t.addEventListener('keydown', (e) => {
    const target = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    selectTab(tabs[target].id.replace('tab-', ''), true);
  });
});

/* ---------- Start ---------- */

if (!HairclipLink.supported) $('#support').hidden = false;
renderPresets();
syncDraw();
updateStatus();
refreshText();
if (document.fonts && document.fonts.load) {
  document.fonts.load(FONT, 'Hallo ÄÖÜ').then(refreshText).catch(() => {});
}
requestAnimationFrame(loop);

// Zugriff für den Smoke-Test (test/app.smoke.test.js)
window.__hairclip = { state };
