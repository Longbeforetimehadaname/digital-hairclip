import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, hsv } from '../web/presets.js';
import { FRAME_BYTES, MAX_ANIM_FRAMES, animPacket } from '../web/protocol.js';

for (const preset of PRESETS) {
  test(`Preset "${preset.name}": gültige, sichtbare, sendbare Bilder`, () => {
    const frames = preset.make();
    assert.ok(frames.length >= 1 && frames.length <= MAX_ANIM_FRAMES);
    for (const f of frames) assert.equal(f.length, FRAME_BYTES);
    assert.ok(frames.some((f) => f.some((v) => v > 0)), 'mindestens ein Pixel leuchtet');
    assert.doesNotThrow(() => animPacket(frames, preset.fps));
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
