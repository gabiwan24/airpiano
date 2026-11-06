import { test } from "node:test";
import assert from "node:assert/strict";
import { chordFromGesture, voiceStep, nextDegrees, stepOf, MODIFIERS } from "../src/chords.js";

const name = (key, n, mod = "") => chordFromGesture(key, n, mod)?.name;
const names = (key, mod = "") => Array.from({ length: 10 }, (_, i) => name(key, i + 1, mod));

test("1–10 fingers walk the full scale, 8–10 one octave up", () => {
  assert.deepEqual(names(0), ["C", "Dm", "Em", "F", "G", "Am", "B°", "C′", "Dm′", "Em′"]);
  assert.deepEqual(names(7).slice(0, 7), ["G", "Am", "Bm", "C", "D", "Em", "F♯°"]);
  assert.equal(name(5, 4), "B♭");
  assert.equal(chordFromGesture(0, 7).roman, "vii°");
});

test("silence outside 1–10", () => {
  assert.equal(chordFromGesture(0, 0), null);
  assert.equal(chordFromGesture(0, 11), null);
  assert.equal(stepOf(0), null);
  assert.deepEqual(voiceStep(null).notes, []);
});

test("clicked variants", () => {
  assert.equal(name(0, 5, "7"), "G7");
  assert.equal(name(0, 1, "7"), "Cmaj7");
  assert.equal(name(0, 6, "7"), "Am7");
  assert.equal(name(0, 7, "7"), "Bm7♭5");
  assert.equal(name(0, 1, "sus4"), "Csus4");
  assert.equal(name(0, 1, "sus2"), "Csus2");
  assert.equal(name(0, 1, "add9"), "Cadd9");
  assert.equal(name(0, 6, "add9"), "Amadd9");
  assert.equal(name(0, 1, "parallel"), "Cm");
  assert.equal(name(0, 6, "parallel"), "A");
  assert.equal(name(0, 8, "7"), "Cmaj7′");
});

test("1–10 is a ladder: bass climbs one scale step per finger, no leap at 7 → 8", () => {
  const mean = (a) => a.reduce((x, y) => x + y) / a.length;
  for (let key = 0; key < 12; key++)
    for (const mod of MODIFIERS) {
      let prev = null;
      const bass = [];
      for (let n = 1; n <= 10; n++) {
        const v = voiceStep(chordFromGesture(key, n, mod), prev?.upper);
        bass.push(v.bass);
        assert.ok(v.upper[0] > v.bass, `${key}/${n}/${mod}: upper ${v.upper} above bass ${v.bass}`);
        if (prev) {
          const step = v.bass - prev.bass;
          assert.ok(step === 1 || step === 2, `${key}/${n}/${mod}: bass step ${step}`);
          assert.ok(Math.abs(mean(v.upper) - mean(prev.upper)) <= 5, `${key}/${n}/${mod}: upper jump ${prev.upper} → ${v.upper}`);
        }
        prev = v;
      }
      assert.equal(bass[7], bass[0] + 12, "8 = tonic one octave above 1");
    }
});

test("every key × count × variant has a known name and a voicing in the organ range", () => {
  for (let key = 0; key < 12; key++)
    for (let n = 1; n <= 10; n++)
      for (const mod of MODIFIERS) {
        const c = chordFromGesture(key, n, mod);
        assert.ok(!c.name.includes("?"), `${key}/${n}/${mod} → ${c.name}`);
        const v = voiceStep(c, [60, 64, 67]);
        assert.ok(v.notes.every((x) => x >= 36 && x <= 96), `range ${v.notes}`);
        assert.equal(v.bass % 12, c.rootPc);
        const pcs = new Set(c.intervals.map((i) => (c.rootPc + i) % 12));
        assert.deepEqual(new Set(v.upper.map((x) => x % 12)), pcs);
      }
});

test("voice leading C → F moves the upper voices by at most 4 semitones in total", () => {
  const c = voiceStep(chordFromGesture(0, 1), null);
  const f = voiceStep(chordFromGesture(0, 4), c.upper);
  const moved = f.upper.reduce((s, n) => s + Math.min(...c.upper.map((x) => Math.abs(x - n))), 0);
  assert.ok(moved <= 4, `moved ${moved}: ${c.upper} → ${f.upper}`);
});

test("next-chord suggestions follow functional harmony", () => {
  assert.deepEqual(nextDegrees(4).strong, [0]); // V → I
  assert.ok(nextDegrees(4).good.includes(5)); // V → vi (deceptive)
  assert.deepEqual(nextDegrees(1).strong, [4]); // ii → V
  assert.deepEqual(nextDegrees(6).strong, [0]); // vii° → I
  for (let d = 0; d < 7; d++) {
    const { strong, good } = nextDegrees(d);
    assert.ok(strong.length > 0, `degree ${d} has a strong follow-up`);
    assert.ok(![...strong, ...good].includes(d), `degree ${d} does not suggest itself`);
  }
});
