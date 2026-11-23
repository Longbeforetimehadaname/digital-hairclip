import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, hsv } from '../web/presets.js';
import { FRAME_BYTES, MAX_ANIM_FRAMES, animPackets } from '../web/protocol.js';

for (const preset of PRESETS) {
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

test('Funkeln ist deterministisch (gleicher Seed)', () => {
  const twinkle = PRESETS.find((p) => p.id === 'twinkle');
  assert.deepEqual([...twinkle.make()[3]], [...twinkle.make()[3]]);
});

test('hsv: Grundfarben', () => {
  assert.deepEqual(hsv(0, 1, 1), [255, 0, 0]);
  assert.deepEqual(hsv(120, 1, 1), [0, 255, 0]);
  assert.deepEqual(hsv(240, 1, 1), [0, 0, 255]);
});
