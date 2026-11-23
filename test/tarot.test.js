import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, drawCards, reading, SUITS, REVERSED_CHANCE } from '../web/tarot.js';
import { tarotPacket, parseTarot, TYPE, TAROT_CARDS, clockPacket, PacketReader, packet, MAGIC } from '../web/protocol.js';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('Deck: 78 Karten, IDs 0–77 in Reihenfolge, je drei Stichworte', () => {
  assert.equal(DECK.length, 78);
  assert.equal(TAROT_CARDS, 78);
  DECK.forEach((c, i) => {
    assert.equal(c.id, i);
    assert.equal(c.up.length, 3, c.name);
    assert.equal(c.down.length, 3, c.name);
    assert.ok(!/ß/.test(c.name + c.up + c.down), 'Schweizer Schreibweise ohne ß');
  });
  assert.equal(DECK[0].name, 'Der Narr');
  assert.equal(DECK[21].name, 'Die Welt');
  assert.equal(DECK[22].name, 'Ass der Stäbe');
  assert.equal(DECK[77].name, 'König der Münzen');
  assert.equal(new Set(DECK.map((c) => c.name)).size, 78, 'Namen eindeutig');
  assert.equal(SUITS.length, 4);
});

test('drawCards: verschiedene Karten, gültige IDs, ungefähr 30 % umgekehrt', () => {
  const rnd = seeded(1);
  let reversed = 0;
  for (let n = 0; n < 2000; n++) {
    const cards = drawCards(3, rnd);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.id)).size, 3);
    for (const c of cards) {
      assert.ok(c.id >= 0 && c.id < 78);
      if (c.reversed) reversed += 1;
    }
  }
  const share = reversed / 6000;
  assert.ok(Math.abs(share - REVERSED_CHANCE) < 0.03, `Anteil umgekehrt ${share}`);
});

test('drawCards: jede Karte kann vorkommen', () => {
  const rnd = seeded(5);
  const seen = new Set();
  for (let n = 0; n < 3000; n++) seen.add(drawCards(1, rnd)[0].id);
  assert.equal(seen.size, 78);
});

test('reading: Positionen bei drei Karten, Stichworte je nach Lage', () => {
  const r = reading([{ id: 0, reversed: false }, { id: 13, reversed: true }, { id: 77, reversed: false }]);
  assert.deepEqual(r.map((x) => x.label), ['Vergangenheit', 'Gegenwart', 'Zukunft']);
  assert.deepEqual(r[1].words, DECK[13].down);
  assert.equal(reading([{ id: 5, reversed: false }])[0].label, 'Deine Karte');
});

test('tarotPacket und parseTarot: Hin und zurück', () => {
  const cards = [{ id: 0, reversed: false }, { id: 77, reversed: true }, { id: 40, reversed: false }];
  const p = tarotPacket(cards);
  assert.deepEqual([...p.subarray(0, 4)], [MAGIC, TYPE.TAROT, 7, 0]);
  assert.deepEqual([...p.subarray(4)], [3, 0, 0, 77, 1, 40, 0]);
  assert.deepEqual(parseTarot(p.subarray(4)), cards);
  assert.throws(() => tarotPacket([]), RangeError);
  assert.throws(() => tarotPacket([{ id: 78, reversed: false }]), RangeError);
  assert.equal(parseTarot(Uint8Array.of(2, 1, 0, 2, 0)), null);
  assert.equal(parseTarot(Uint8Array.of(1, 99, 0)), null);
});

test('clockPacket: Ortszeit, Stil und Farbe', () => {
  const d = new Date(Date.UTC(2026, 11, 24, 18, 30, 0));
  const p = clockPacket(d, [255, 128, 0], 1);
  assert.equal(p[1], TYPE.CLOCK);
  const secs = new DataView(p.buffer, 4, 4).getUint32(0, true);
  assert.equal(secs, d.getTime() / 1000 - d.getTimezoneOffset() * 60);
  assert.deepEqual([...p.subarray(8)], [1, 255, 128, 0]);
});

test('PacketReader: Pakete aus Stücken, Müll davor, mehrere hintereinander', () => {
  const got = [];
  const r = new PacketReader((type, payload) => got.push([type, [...payload]]));
  const a = packet(4, Uint8Array.of(9));
  const b = tarotPacket([{ id: 3, reversed: true }]);
  const stream = Uint8Array.from([1, 2, 3, ...a, 0x00, ...b]);
  for (let i = 0; i < stream.length; i += 2) r.push(stream.subarray(i, i + 2));
  assert.deepEqual(got, [[4, [9]], [6, [1, 3, 1]]]);
});

test('PacketReader: zu lange Pakete werden übersprungen', () => {
  const got = [];
  const r = new PacketReader((type) => got.push(type), 10);
  r.push(Uint8Array.of(MAGIC, 1, 200, 0, ...packet(5)));
  assert.deepEqual(got, [5]);
});
