import {
  W, H, FRAME_BYTES,
  animPacket, textPacket, photoPacket, brightnessPacket, offPacket,
} from './protocol.js';
import { PRESETS } from './presets.js';
import { HairclipLink } from './ble.js';
import { columnsFromImage, cellsOnLine, enhanceFrame } from './pixels.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const MAX_DRAW_FRAMES = 16;
const SWATCHES = [
  ['#ff4d9d', 'Pink'], ['#ff9ac4', 'Rosa'], ['#ffd166', 'Gelb'], ['#7bf1a8', 'Grün'],
  ['#5ec8ff', 'Blau'], ['#b69cff', 'Lila'], ['#ffffff', 'Weiss'], ['#ff5a4d', 'Rot'],
];

const state = {
  tab: 'text',
  brightness: 200,
  text: { value: 'Hallo Schatz', color: '#ff5fa8', speed: 4, cols: new Uint8Array(0) },
  draw: { frames: [new Uint8Array(FRAME_BYTES)], cur: 0, fps: 5, playing: false, color: '#ff4d9d', tool: 'pen' },
  preset: { id: PRESETS[0].id, frames: PRESETS[0].make(), fps: PRESETS[0].fps },
  photo: { mode: 'led', ledFrame: null, full: null },
};

const link = new HairclipLink({ onChange: updateStatus });

/* ---------- Vorschau-Bildschirm ---------- */

const screen = $('#screen');
const sctx = screen.getContext('2d');
const SIZE = screen.width;
const CELL = SIZE / W;
const scratch = new Uint8Array(FRAME_BYTES);

function paintLed(pixels) {
  sctx.fillStyle = '#07050a';
  sctx.fillRect(0, 0, SIZE, SIZE);
  const k = state.brightness / 255;
  const top = (SIZE - H * CELL) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const cx = x * CELL + CELL / 2;
      const cy = top + y * CELL + CELL / 2;
      sctx.beginPath();
      if (r + g + b > 0) {
        const c = `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
        sctx.shadowColor = c;
        sctx.shadowBlur = 14;
        sctx.fillStyle = c;
        sctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2);
      } else {
        sctx.shadowBlur = 0;
        sctx.fillStyle = 'rgba(255,255,255,0.06)';
        sctx.arc(cx, cy, CELL * 0.25, 0, Math.PI * 2);
      }
      sctx.fill();
    }
  }
  sctx.shadowBlur = 0;
}

function paintPhoto(canvas) {
  sctx.fillStyle = '#07050a';
  sctx.fillRect(0, 0, SIZE, SIZE);
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(canvas, 0, 0, SIZE, SIZE);
  const dim = 1 - state.brightness / 255;
  if (dim > 0) {
    sctx.fillStyle = `rgba(0,0,0,${dim})`;
    sctx.fillRect(0, 0, SIZE, SIZE);
  }
}

function previewSource(t) {
  switch (state.tab) {
    case 'text': {
      scratch.fill(0);
      const cols = state.text.cols;
      if (!cols.length) return scratch;
      const offset = Math.floor(t * state.text.speed * 3) % (cols.length + W);
      const [r, g, b] = hexToRgb(state.text.color);
      for (let x = 0; x < W; x++) {
        const sx = offset - W + x;
        if (sx < 0 || sx >= cols.length) continue;
        for (let y = 0; y < H; y++) {
          if (cols[sx] & (1 << y)) {
            const i = (y * W + x) * 3;
            scratch[i] = r; scratch[i + 1] = g; scratch[i + 2] = b;
          }
        }
      }
      return scratch;
    }
    case 'draw': {
      const d = state.draw;
      if (d.playing && d.frames.length > 1) return d.frames[Math.floor(t * d.fps) % d.frames.length];
      return d.frames[d.cur];
    }
    case 'preset': {
      const p = state.preset;
      return p.frames[Math.floor(t * p.fps) % p.frames.length];
    }
    case 'photo': {
      if (state.photo.mode === 'full' && state.photo.full) return state.photo.full;
      if (state.photo.mode === 'led' && state.photo.ledFrame) return state.photo.ledFrame;
      return scratch.fill(0);
    }
    default:
      return scratch.fill(0);
  }
}

function loop(ms) {
  const src = previewSource(ms / 1000);
  if (src instanceof HTMLCanvasElement) paintPhoto(src);
  else paintLed(src);
  requestAnimationFrame(loop);
}

/* ---------- Text ---------- */

// Rendert Text mit der Pixelschrift „Silkscreen“ in ein 8 Zeilen hohes Spalten-Raster
// (ein Byte pro Spalte, Bit 0 = oben). Silkscreen hat ein Raster von Schriftgrösse/8.
// Direkt bei 8 px gezeichnet verschmieren die Buchstaben (doppelte Querstriche bei H, A, E).
// Darum wird gross gezeichnet (1 Schriftpixel = FONT_CELL Bildpixel) und pro Zelle die Mitte abgetastet.
const FONT_CELL = 4;
async function buildColumns(text) {
  const t = text.trim() ? text : ' ';
  const work = document.createElement('canvas');
  const c = work.getContext('2d', { willReadFrequently: true });
  const font = `${FONT_CELL * 8}px "Silkscreen", monospace`;
  c.font = font;
  const w = (Math.ceil(c.measureText(t).width / FONT_CELL) + 4) * FONT_CELL;
  const h = 16 * FONT_CELL;
  work.width = w; // setzt den Zeichenzustand zurück, darum danach Schrift neu setzen
  work.height = h;
  c.font = font;
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff';
  c.fillText(t, 2 * FONT_CELL, 11 * FONT_CELL); // Grundlinie auf einer Zellgrenze: Platz für Umlaut-Punkte und Unterlängen
  return columnsFromImage(c.getImageData(0, 0, w, h).data, w, h, FONT_CELL);
}

let textToken = 0;
async function refreshText() {
  const token = ++textToken;
  const cols = await buildColumns(state.text.value);
  if (token === textToken) state.text.cols = cols;
}

$('#text-input').addEventListener('input', (e) => { state.text.value = e.target.value; refreshText(); });
$('#text-color').addEventListener('input', (e) => { state.text.color = e.target.value; });
$('#text-speed').addEventListener('input', (e) => { state.text.speed = Number(e.target.value); });

/* ---------- Zeichnen ---------- */

const editor = $('#editor');
const ectx = editor.getContext('2d');

function renderEditor() {
  const f = state.draw.frames[state.draw.cur];
  const cw = editor.width / W;
  const ch = editor.height / H;
  ectx.fillStyle = '#07050a';
  ectx.fillRect(0, 0, editor.width, editor.height);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const on = f[i] + f[i + 1] + f[i + 2] > 0;
      ectx.fillStyle = on ? `rgb(${f[i]},${f[i + 1]},${f[i + 2]})` : 'rgba(255,255,255,0.07)';
      ectx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
    }
  }
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
    cv.width = W * 2;
    cv.height = H * 2;
    const cx = cv.getContext('2d');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        cx.fillStyle = `rgb(${f[i]},${f[i + 1]},${f[i + 2]})`;
        cx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
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
let lastCell = null; // letzte gemalte Zelle, damit schnelle Striche durchgehend werden

function paintAt(e) {
  const r = editor.getBoundingClientRect();
  const x = Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H)));
  const f = state.draw.frames[state.draw.cur];
  const [cr, cg, cb] = state.draw.tool === 'pen' ? hexToRgb(state.draw.color) : [0, 0, 0];
  const cells = lastCell ? cellsOnLine(lastCell[0], lastCell[1], x, y) : [[x, y]];
  for (const [cx, cy] of cells) {
    const i = (cy * W + cx) * 3;
    f[i] = cr; f[i + 1] = cg; f[i + 2] = cb;
  }
  lastCell = [x, y];
  renderEditor();
}

editor.addEventListener('pointerdown', (e) => {
  editor.setPointerCapture(e.pointerId);
  painting = true;
  lastCell = null;
  state.draw.playing = false;
  paintAt(e);
});
editor.addEventListener('pointermove', (e) => { if (painting) paintAt(e); });
['pointerup', 'pointercancel'].forEach((name) =>
  editor.addEventListener(name, () => { painting = false; lastCell = null; syncDraw(); }));

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
$('#draw-fps').addEventListener('input', (e) => { state.draw.fps = Number(e.target.value); });

$('#frame-add').addEventListener('click', () => {
  const d = state.draw;
  if (d.frames.length >= MAX_DRAW_FRAMES) return;
  d.frames.splice(d.cur + 1, 0, new Uint8Array(d.frames[d.cur]));
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
$('#frame-clear').addEventListener('click', () => { state.draw.frames[state.draw.cur].fill(0); syncDraw(); });
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

function coverCanvas(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

$('#photo-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const full = coverCanvas(img, 64, 64);
    const led = coverCanvas(img, W, H);
    const data = led.getContext('2d').getImageData(0, 0, W, H).data;
    const frame = new Uint8Array(FRAME_BYTES);
    for (let i = 0; i < W * H; i++) {
      frame[i * 3] = data[i * 4];
      frame[i * 3 + 1] = data[i * 4 + 1];
      frame[i * 3 + 2] = data[i * 4 + 2];
    }
    state.photo.full = full;
    state.photo.ledFrame = enhanceFrame(frame);
    setMsg('Foto geladen.');
  } catch {
    setMsg('Dieses Bild konnte nicht gelesen werden. Probier ein JPG oder PNG.', true);
  } finally {
    URL.revokeObjectURL(url);
  }
});

$$('input[name="photo-mode"]').forEach((r) =>
  r.addEventListener('change', () => { if (r.checked) state.photo.mode = r.value; }));

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
    if (!state.text.cols.length) throw new RangeError('Gib zuerst einen Text ein.');
    return textPacket(state.text.cols, hexToRgb(state.text.color), state.text.speed);
  },
  draw: () => animPacket(state.draw.frames, state.draw.frames.length > 1 ? state.draw.fps : 1),
  preset: () => animPacket(state.preset.frames, state.preset.fps),
  photo: () => {
    if (state.photo.mode === 'led') {
      if (!state.photo.ledFrame) throw new RangeError('Wähle zuerst ein Foto aus.');
      return animPacket([state.photo.ledFrame], 1);
    }
    if (!state.photo.full) throw new RangeError('Wähle zuerst ein Foto aus.');
    const rgba = state.photo.full.getContext('2d').getImageData(0, 0, 64, 64).data;
    return photoPacket(rgba, 64, 64);
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
  document.fonts.load('8px "Silkscreen"').then(refreshText).catch(() => {});
}
requestAnimationFrame(loop);

// Zugriff für den Smoke-Test (test/app.smoke.test.js)
window.__hairclip = { state };
