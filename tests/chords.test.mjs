import { test } from "node:test";
import assert from "node:assert/strict";
import { chordFromGesture, voice, MODIFIERS } from "../src/chords.js";

const name = (key, p, m = 0) => chordFromGesture(key, p, m)?.name;

test("C major: finger counts map to I IV V vi ii", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => name(0, p)), ["C", "F", "G", "Am", "Dm"]);
});

test("other keys and flat spelling", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => name(7, p)), ["G", "C", "D", "Em", "Am"]);
  assert.equal(name(5, 2), "B♭");
  assert.equal(name(3, 1), "E♭");
});

test("modifiers", () => {
  assert.equal(name(0, 3, 1), "G7");
  assert.equal(name(0, 1, 1), "Cmaj7");
  assert.equal(name(0, 4, 1), "Am7");
  assert.equal(name(0, 1, 2), "Csus4");
  assert.equal(name(0, 1, 3), "Csus2");
  assert.equal(name(0, 1, 4), "Cadd9");
  assert.equal(name(0, 4, 4), "Amadd9");
  assert.equal(name(0, 1, 5), "Cm");
  assert.equal(name(0, 4, 5), "A");
});

test("silence for fist / no hand", () => {
  assert.equal(chordFromGesture(0, 0, 3), null);
  assert.deepEqual(voice(null).notes, []);
});

test("every key × gesture has a known name and a playable voicing", () => {
  for (let key = 0; key < 12; key++)
    for (let p = 1; p <= 5; p++)
      for (let m = 0; m < MODIFIERS.length; m++) {
        const c = chordFromGesture(key, p, m);
        assert.ok(!c.name.includes("?"), `${key}/${p}/${m} → ${c.name}`);
        const v = voice(c, [60, 64, 67]);
        assert.ok(v.notes.every((n) => n >= 36 && n <= 84), `range ${v.notes}`);
        assert.equal(v.bass % 12, c.rootPc);
        const pcs = new Set(c.intervals.map((i) => (c.rootPc + i) % 12));
        assert.deepEqual(new Set(v.upper.map((n) => n % 12)), pcs);
      }
});

test("voice leading C → F moves the upper voices by at most 4 semitones in total", () => {
  const c = voice(chordFromGesture(0, 1), null);
  const f = voice(chordFromGesture(0, 2), c.upper);
  const moved = f.upper.reduce((s, n) => s + Math.min(...c.upper.map((x) => Math.abs(x - n))), 0);
  assert.ok(moved <= 4, `moved ${moved}: ${c.upper} → ${f.upper}`);
});
