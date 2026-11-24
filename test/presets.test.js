import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createDvd, hsv } from '../web/presets.js';
import { FRAME_BYTES, MAX_ANIM_FRAMES, animPackets } from '../web/protocol.js';

for (const preset of PRESETS.filter((p) => !p.live)) {
  test(`Preset "${preset.name}": gültige, sichtbare, sendbare Bilder`, () => {
    const frames = preset.make();
    assert.ok(frames.length >= 1 && frames.length <= MAX_ANIM_FRAMES);
    for (const f of frames) assert.equal(f.length, FRAME_BYTES);
    const lit = (f) => { for (let i = 0; i < f.length; i += 4) if (f[i] + f[i + 1] + f[i + 2] > 0) return true; return false; };
    assert.ok(frames.some(lit), 'mindestens ein Pixel leuchtet');
    assert.doesNotThrow(() => animPackets(frames, preset.fps), 'passt in den Speicher des Clips');
  });
}

test('Preset-IDs sind eindeutig', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
});

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colorsOf(frame) {
  const found = new Set();
  for (let i = 0; i < frame.length; i += 4) {
    if (frame[i] + frame[i + 1] + frame[i + 2] === 0) continue;
    found.add(`${frame[i]},${frame[i + 1]},${frame[i + 2]}`);
  }
  return found;
}

test('Herz ist rot und schlägt', () => {
  const frames = PRESETS.find((p) => p.id === 'heart').make();
  const count = (f) => {
    let n = 0;
    for (let i = 0; i < f.length; i += 4) {
      if (f[i] === 255 && f[i + 1] === 0 && f[i + 2] === 0) n += 1;
      else if (f[i] + f[i + 1] + f[i + 2] > 0) throw new Error('Herz hat eine andere Farbe');
    }
    return n;
  };
  const small = count(frames[0]);
  const big = count(frames[1]);
  assert.ok(small > 1500);
  assert.ok(big > small);
  assert.equal(count(frames[2]), big);
  assert.equal(count(frames[3]), small);
});

test('Seelen: rote Mitte, die anderen Farben kreisen', () => {
  const frames = PRESETS.find((p) => p.id === 'souls').make();
  const px = (160 + 85 * 320) * 4;
  for (const f of frames) assert.deepEqual([f[px], f[px + 1], f[px + 2]], [255, 0, 0]);
  assert.ok(colorsOf(frames[0]).size >= 7);
  assert.notDeepEqual(frames[0], frames[4]);
});

test('DVD: prallt gerade ab und bleibt im Bild', () => {
  const sim = createDvd(rng(4));
  const speed = Math.hypot(sim.vx, sim.vy);
  let bouncedX = false;
  let bouncedY = false;
  for (let i = 0; i < 400; i++) {
    const vx = sim.vx;
    const vy = sim.vy;
    sim.step(0.05);
    assert.ok(sim.x >= 0 && sim.x <= sim.maxX);
    assert.ok(sim.y >= 0 && sim.y <= sim.maxY);
    assert.ok(Math.abs(Math.hypot(sim.vx, sim.vy) - speed) < 0.001);
    if (sim.vx === -vx && sim.vy === vy) bouncedX = true;
    if (sim.vy === -vy && sim.vx === vx) bouncedY = true;
  }
  assert.ok(bouncedX, 'am linken oder rechten Rand umdrehen');
  assert.ok(bouncedY, 'am oberen oder unteren Rand umdrehen');
  const again = createDvd(rng(4));
  again.step(0.2);
  const sim2 = createDvd(rng(4));
  sim2.step(0.2);
  assert.equal(sim2.x, again.x);
  assert.notEqual(createDvd(rng(9)).x, again.x);
});

test('Funkeln ist deterministisch (gleicher Seed)', () => {
  const twinkle = PRESETS.find((p) => p.id === 'twinkle');
  assert.deepEqual([...twinkle.make()[3]], [...twinkle.make()[3]]);
});

test('hsv: Grundfarben', () => {
  assert.deepEqual(hsv(0, 1, 1), [255, 0, 0]);
  assert.deepEqual(hsv(120, 1, 1), [0, 255, 0]);
  assert.deepEqual(hsv(240, 1, 1), [0, 0, 255]);
});
