import {
  W, H, TEXT_H, TYPE,
  animPackets, textPacket, photoPackets, brightnessPacket, offPacket, tarotPacket, clockPacket, parseTarot, concat,
} from './protocol.js';
import { PRESETS, blank } from './presets.js';
import { HairclipLink } from './ble.js';
import { textStrip, stripBit, cellsOnLine, stampDisc, floodFill, coverRect } from './pixels.js';
import { drawCards, reading } from './tarot.js';
import {
  Surface, tarotScene, shuffleScene, clockScene, clockFields, SHUFFLE_STEPS, SHUFFLE_MS, SPREAD_MS,
} from './scene.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const MAX_DRAW_FRAMES = 8;
const MAX_UNDO = 20;
const COLORS = [
  ['#ff2d87', 'Pink'], ['#ff9ac4', 'Rosa'], ['#ffd166', 'Gelb'], ['#7bf1a8', 'Grün'],
  ['#5ec8ff', 'Blau'], ['#b69cff', 'Lila'], ['#ffffff', 'Weiss'], ['#ff5a3c', 'Rot'],
];

const state = {
  tab: 'text',
  brightness: 200,
  text: { value: 'Hallo Schatz', color: '#ff2d87', speed: 4, bits: new Uint8Array(0), w: 0 },
  draw: { frames: [blank()], cur: 0, fps: 5, playing: false, color: '#ff2d87', tool: 'pen', size: 4, undo: [] },
  preset: { id: PRESETS[0].id, frames: PRESETS[0].make(), fps: PRESETS[0].fps },
  photo: { rgba: null, img: null, pos: 0.5 },
  tarot: { cards: null, start: 0 },
  clock: { style: 0, color: '#ffffff' },
};

const link = new HairclipLink({ onChange: updateStatus, onPacket: onClipPacket });

/* ---------- Vorschau: zeigt genau die 320 × 170 Pixel des Clips ---------- */

const screen = $('#screen');
const sctx = screen.getContext('2d');
const screenImg = sctx.createImageData(W, H);

function paintFrame(rgba) {
  screenImg.data.set(rgba);
  sctx.putImageData(screenImg, 0, 0);
}

// Szenen, die der Clip selbst zeichnet (Tarot, Uhr), nur neu berechnen, wenn sich etwas ändert
const sceneSurface = new Surface();
let sceneKey = '';
function paintScene(key, drawFn) {
  if (key !== sceneKey) {
    sceneKey = key;
    drawFn(sceneSurface);
  }
  paintFrame(sceneSurface.d);
}

// Lauftext wie im Clip: Streifen senkrecht mittig, scrollt von rechts nach links (siehe docs/PROTOCOL.md)
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

function paintTarot(now) {
  const { cards, start } = state.tarot;
  if (!cards) {
    paintScene('tarot-empty', (s) => shuffleScene(s, 0));
    return;
  }
  const t = now - start;
  const shuffleEnd = SHUFFLE_STEPS * SHUFFLE_MS;
  if (t < shuffleEnd) {
    const step = Math.floor(t / SHUFFLE_MS);
    paintScene(`shuffle-${start}-${step}`, (s) => shuffleScene(s, step));
  } else {
    const i = cards.length === 3 ? Math.floor((t - shuffleEnd) / SPREAD_MS) % 3 : 0;
    paintScene(`tarot-${start}-${i}`, (s) => tarotScene(s, cards, i));
  }
}

function paintClock() {
  const now = new Date();
  const local = Math.floor(now.getTime() / 1000) - now.getTimezoneOffset() * 60;
  const f = clockFields(local);
  const { style, color } = state.clock;
  paintScene(`clock-${local}-${style}-${color}`, (s) => clockScene(s, f, hexToRgb(color), style));
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
    case 'tarot':
      paintTarot(t * 1000);
      break;
    case 'clock':
      paintClock();
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

let clockMs = 0;
function loop(ms) {
  clockMs = ms;
  paint(ms / 1000);
  requestAnimationFrame(loop);
}

/* ---------- Farbfelder (mit eigener Farbe am Schluss) ---------- */

function swatches(box, get, set) {
  const sync = () => {
    $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === get())));
    custom.value = get();
  };
  COLORS.forEach(([hex, name]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = hex;
    b.dataset.color = hex;
    b.setAttribute('aria-label', name);
    b.addEventListener('click', () => { set(hex); sync(); });
    box.append(b);
  });
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.setAttribute('aria-label', 'Eigene Farbe');
  custom.addEventListener('input', () => { set(custom.value); sync(); });
  box.append(custom);
  sync();
}

/* ---------- Text ---------- */

// Zeichnet den Text gross mit der Schrift „Nunito“ (fett) und macht daraus einen Streifen
// aus gesetzten und leeren Pixeln (ohne Kantenglättung, genau so zeigt ihn der Clip).
// Zeichen, die Nunito nicht hat (♥ ★ …), nimmt der Browser aus einer Ersatzschrift.
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

const textInput = $('#text-input');
textInput.addEventListener('input', () => { state.text.value = textInput.value; refreshText(); });
$('#text-speed').addEventListener('input', (e) => { state.text.speed = Number(e.target.value); });
swatches($('#text-swatches'), () => state.text.color, (c) => { state.text.color = c; rebuildTextCanvas(); });
$$('[data-symbol]').forEach((b) => b.addEventListener('click', () => {
  const s = b.dataset.symbol;
  const v = textInput.value;
  const a = textInput.selectionStart ?? v.length;
  const z = textInput.selectionEnd ?? v.length;
  if (v.length - (z - a) + s.length > textInput.maxLength) return;
  textInput.value = v.slice(0, a) + s + v.slice(z);
  textInput.setSelectionRange(a + s.length, a + s.length);
  textInput.focus();
  state.text.value = textInput.value;
  refreshText();
}));

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
  $('#undo').disabled = d.undo.length === 0;
  for (const tool of ['pen', 'fill', 'eraser']) $(`#tool-${tool}`).setAttribute('aria-pressed', String(d.tool === tool));
}

// Vor jeder Änderung den alten Zustand merken (für „Zurück“)
function remember() {
  const d = state.draw;
  d.undo.push({ frames: d.frames.map((f) => new Uint8ClampedArray(f)), cur: d.cur });
  if (d.undo.length > MAX_UNDO) d.undo.shift();
}

let painting = false;
let lastPoint = null; // letzter gemalter Punkt, damit schnelle Striche durchgehend werden

function pointFrom(e) {
  const r = editor.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return [
    Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W))),
    Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H))),
  ];
}

function paintAt(e) {
  const p = pointFrom(e);
  if (!p) return;
  const [x, y] = p;
  const f = state.draw.frames[state.draw.cur];
  const rgb = state.draw.tool === 'pen' ? hexToRgb(state.draw.color) : [0, 0, 0];
  const size = state.draw.tool === 'pen' ? state.draw.size : state.draw.size + 3; // Radierer etwas grösser
  const points = lastPoint ? cellsOnLine(lastPoint[0], lastPoint[1], x, y) : [[x, y]];
  for (const [px, py] of points) stampDisc(f, W, H, px, py, size, rgb);
  lastPoint = [x, y];
  renderEditor();
}

editor.addEventListener('pointerdown', (e) => {
  state.draw.playing = false;
  if (state.draw.tool === 'fill') {
    const p = pointFrom(e);
    if (!p) return;
    remember();
    if (!floodFill(state.draw.frames[state.draw.cur], W, H, p[0], p[1], hexToRgb(state.draw.color))) state.draw.undo.pop();
    syncDraw();
    return;
  }
  editor.setPointerCapture(e.pointerId);
  remember();
  painting = true;
  lastPoint = null;
  paintAt(e);
});
editor.addEventListener('pointermove', (e) => { if (painting) paintAt(e); });
['pointerup', 'pointercancel'].forEach((name) => editor.addEventListener(name, () => {
  if (!painting) return;
  painting = false;
  lastPoint = null;
  syncDraw();
}));

swatches($('#draw-swatches'), () => state.draw.color, (c) => {
  state.draw.color = c;
  if (state.draw.tool === 'eraser') state.draw.tool = 'pen';
  syncDraw();
});
for (const tool of ['pen', 'fill', 'eraser']) $(`#tool-${tool}`).addEventListener('click', () => { state.draw.tool = tool; syncDraw(); });
$('#undo').addEventListener('click', () => {
  const d = state.draw;
  const prev = d.undo.pop();
  if (!prev) return;
  d.frames = prev.frames;
  d.cur = Math.min(prev.cur, d.frames.length - 1);
  d.playing = false;
  syncDraw();
});
$('#brush').addEventListener('input', (e) => { state.draw.size = Number(e.target.value); });
$('#draw-fps').addEventListener('input', (e) => { state.draw.fps = Number(e.target.value); });

$('#frame-add').addEventListener('click', () => {
  const d = state.draw;
  if (d.frames.length >= MAX_DRAW_FRAMES) return;
  remember();
  d.frames.splice(d.cur + 1, 0, new Uint8ClampedArray(d.frames[d.cur]));
  d.cur += 1;
  syncDraw();
});
$('#frame-del').addEventListener('click', () => {
  const d = state.draw;
  if (d.frames.length < 2) return;
  remember();
  d.frames.splice(d.cur, 1);
  d.cur = Math.min(d.cur, d.frames.length - 1);
  if (d.frames.length < 2) d.playing = false;
  syncDraw();
});
$('#frame-clear').addEventListener('click', () => { remember(); state.draw.frames[state.draw.cur] = blank(); syncDraw(); });
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
    b.textContent = p.name;
    b.dataset.info = `${p.fps} Bilder/s`;
    b.setAttribute('aria-pressed', String(p.id === state.preset.id));
    b.addEventListener('click', () => {
      state.preset = { id: p.id, frames: p.make(), fps: p.fps };
      renderPresets();
    });
    box.append(b);
  });
}

/* ---------- Foto ---------- */

function coverPixels(img, pos) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  const r = coverRect(img.width, img.height, W, H, pos);
  x.drawImage(img, r.x, r.y, r.w, r.h);
  const data = new Uint8ClampedArray(x.getImageData(0, 0, W, H).data);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return data;
}

const photoPos = $('#photo-pos');
$('#photo-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    state.photo.img = img;
    state.photo.rgba = coverPixels(img, state.photo.pos);
    photoPos.disabled = false;
    setMsg('Foto geladen. Mit „Ausschnitt“ verschieben.');
  } catch {
    setMsg('Dieses Bild konnte nicht gelesen werden. Probier ein JPG oder PNG.', true);
  } finally {
    URL.revokeObjectURL(url);
  }
});
photoPos.addEventListener('input', () => {
  state.photo.pos = Number(photoPos.value) / 100;
  if (state.photo.img) state.photo.rgba = coverPixels(state.photo.img, state.photo.pos);
});

/* ---------- Tarot ---------- */

const HISTORY_KEY = 'hairclip.tarot';
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* privat: ohne Verlauf */ }
  },
};

function renderReading() {
  const box = $('#tarot-reading');
  box.replaceChildren();
  if (!state.tarot.cards) return;
  for (const r of reading(state.tarot.cards)) {
    const li = document.createElement('li');
    const pos = Object.assign(document.createElement('span'), { className: 'pos', textContent: r.label });
    const name = Object.assign(document.createElement('span'), { className: 'name', textContent: r.name });
    li.append(pos, name);
    if (r.reversed) li.append(Object.assign(document.createElement('span'), { className: 'rev', textContent: 'umgekehrt' }));
    li.append(Object.assign(document.createElement('span'), { className: 'words', textContent: r.words.join(' · ') }));
    box.append(li);
  }
}

function renderHistory() {
  const box = $('#tarot-history');
  box.replaceChildren();
  for (const entry of store.load()) {
    const li = document.createElement('li');
    const when = new Date(entry.t);
    const time = Object.assign(document.createElement('time'), {
      dateTime: entry.t,
      textContent: `${when.toLocaleDateString('de-CH')} ${when.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`,
    });
    const names = reading(entry.cards).map((r) => (r.reversed ? `${r.name} (umgekehrt)` : r.name)).join(', ');
    li.append(time, document.createTextNode(` – ${names}`));
    box.append(li);
  }
  $('#tarot-clear').hidden = !box.children.length;
}

function showTarot(cards, from) {
  state.tarot = { cards, start: clockMs };
  sceneKey = '';
  renderReading();
  store.save([{ t: new Date().toISOString(), cards, from }, ...store.load()]);
  renderHistory();
}

async function drawTarot(count) {
  const cards = drawCards(count);
  showTarot(cards, 'web');
  if (!link.connected) { setMsg('Nur Vorschau. Verbunden legt der Clip die Karten mit.'); return; }
  try {
    await link.send(tarotPacket(cards));
    setMsg('Karten liegen auch auf dem Clip.');
  } catch (e) {
    setMsg(errorText(e), true);
  }
}

$('#tarot-one').addEventListener('click', () => drawTarot(1));
$('#tarot-three').addEventListener('click', () => drawTarot(3));
$('#tarot-clear').addEventListener('click', () => { store.save([]); renderHistory(); });

// Meldungen vom Clip (über Bluetooth)
function onClipPacket(type, payload) {
  if (type !== TYPE.TAROT) return;
  const cards = parseTarot(payload);
  if (!cards) return;
  selectTab('tarot');
  showTarot(cards, 'clip');
  setMsg(cards.length === 3 ? 'Am Clip wurden drei Karten gezogen.' : 'Am Clip wurde eine Karte gezogen.');
}

/* ---------- Uhr ---------- */

$$('input[name="clock-style"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) state.clock.style = Number(r.value); }));
swatches($('#clock-swatches'), () => state.clock.color, (c) => { state.clock.color = c; });

/* ---------- Verbindung und Senden ---------- */

const msgEl = $('#msg');
const progressEl = $('#progress');

function setMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.classList.toggle('error', isError);
}

function updateStatus() {
  $('#status').textContent = link.connected ? 'verbunden' : 'offline';
  $('#dot').classList.toggle('on', link.connected);
  $('#connect').textContent = link.connected ? 'Trennen' : 'Verbinden';
  $('#connect').classList.toggle('on', link.connected);
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
  clock: () => clockPacket(new Date(), hexToRgb(state.clock.color), state.clock.style),
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

/* ---------- Moduswahl ---------- */

const tabs = $$('[role="tab"]');
function selectTab(name, focus = false) {
  if (state.tab !== name) setMsg(''); // alte Meldung (z. B. „Foto geladen.“) gehört nicht zum neuen Bereich
  state.tab = name;
  sceneKey = '';
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
renderHistory();
state.text.value = textInput.value;
refreshText();
if (document.fonts && document.fonts.load) {
  document.fonts.load(FONT, 'Hallo ÄÖÜ').then(refreshText).catch(() => {});
}
requestAnimationFrame(loop);

// Zugriff für den Smoke-Test (test/app.smoke.test.js)
window.__hairclip = { state, onClipPacket };
