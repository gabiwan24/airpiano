import { test } from "node:test";
import assert from "node:assert/strict";
import { extendedFingers, countOf, sortByX, Stabilizer, TH } from "../src/gesture.js";

// Synthetic hand in world coordinates (metres), wrist at origin, fingers pointing up (-y).
const MCP = { 5: [-0.03, -0.09], 9: [-0.01, -0.095], 13: [0.01, -0.09], 17: [0.03, -0.08] };
const THUMB_MCP = [-0.05, -0.04];
const p = (x, y, z = 0) => ({ x, y, z });

/** ratios: [thumb, index, middle, ring, pinky] as the measured ratio each finger should produce */
function hand(ratios) {
  const lm = Array.from({ length: 21 }, () => p(0, 0));
  lm[2] = p(...THUMB_MCP);
  for (const k of [5, 9, 13, 17]) lm[k] = p(...MCP[k]);
  const p17 = lm[17];
  // thumb tip on the line pinkyMcp → thumbMcp, so |tip−p17| / |thumbMcp−p17| = ratio
  lm[4] = p(p17.x + (lm[2].x - p17.x) * ratios[0], p17.y + (lm[2].y - p17.y) * ratios[0]);
  [[5, 8], [9, 12], [13, 16], [17, 20]].forEach(([mcp, tip], i) => {
    lm[tip] = p(lm[mcp].x * ratios[i + 1], lm[mcp].y * ratios[i + 1]); // wrist at origin
  });
  return lm;
}
const OPEN = 1.9, FIST = 0.9;

test("counts extended fingers", () => {
  assert.equal(countOf(extendedFingers(hand([FIST, FIST, FIST, FIST, FIST]))), 0);
  assert.equal(countOf(extendedFingers(hand([FIST, OPEN, FIST, FIST, FIST]))), 1);
  assert.equal(countOf(extendedFingers(hand([FIST, OPEN, OPEN, FIST, FIST]))), 2);
  assert.equal(countOf(extendedFingers(hand([FIST, OPEN, OPEN, OPEN, FIST]))), 3);
  assert.equal(countOf(extendedFingers(hand([FIST, OPEN, OPEN, OPEN, OPEN]))), 4);
  assert.equal(countOf(extendedFingers(hand([1.7, OPEN, OPEN, OPEN, OPEN]))), 5);
  assert.deepEqual(extendedFingers(hand([1.7, FIST, FIST, FIST, OPEN])), [true, false, false, false, true]);
});

test("hysteresis: a finger between the thresholds keeps its previous state", () => {
  const mid = (TH.fingerOn + TH.fingerOff) / 2;
  const lm = hand([FIST, mid, FIST, FIST, FIST]);
  assert.equal(extendedFingers(lm, [false, false, false, false, false])[1], false);
  assert.equal(extendedFingers(lm, [false, true, false, false, false])[1], true);
});

test("hands are ordered by image position so hysteresis state follows the same hand", () => {
  const a = { landmarks: [p(0.3, 0.5)] }, b = { landmarks: [p(0.7, 0.5)] };
  assert.deepEqual(sortByX([b, a]), [a, b]);
  assert.deepEqual(sortByX([a, b]), [a, b]);
  assert.deepEqual(sortByX([]), []);
});

test("two hands add up to 10", () => {
  const open = hand([1.7, OPEN, OPEN, OPEN, OPEN]);
  const three = hand([FIST, OPEN, OPEN, OPEN, FIST]);
  assert.equal(countOf(extendedFingers(open)) * 2, 10);
  assert.equal(countOf(extendedFingers(open)) + countOf(extendedFingers(three)), 8);
});

test("stabilizer commits after N identical frames and ignores single-frame flicker", () => {
  const s = new Stabilizer(2);
  assert.equal(s.push("a"), undefined);
  assert.equal(s.push("a"), "a");
  assert.equal(s.push("b"), "a");
  assert.equal(s.push("a"), "a");
  assert.equal(s.push("b"), "a");
  assert.equal(s.push("b"), "b");
  const fast = new Stabilizer(1);
  assert.equal(fast.push("x"), "x");
});
