// Pure gesture logic: MediaPipe hand landmarks → extended fingers → stable count. No DOM, testable in Node.

// Landmark indices (MediaPipe hand model)
const WRIST = 0, THUMB_MCP = 2, THUMB_TIP = 4, PINKY_MCP = 17;
const FINGERS = [ // [mcp, tip] for index, middle, ring, pinky
  [5, 8], [9, 12], [13, 16], [17, 20],
];

// Hysteresis thresholds (scale-free ratios, measured on 3D world landmarks).
// Finger: |wrist→tip| / |wrist→mcp|. Straight ≈ 1.8–2.0, fist ≈ 0.8–1.1.
// Thumb: |thumbTip→pinkyMcp| / |thumbMcp→pinkyMcp|. Spread ≈ 1.5+, tucked ≈ 0.6–1.2.
export const TH = { fingerOn: 1.5, fingerOff: 1.35, thumbOn: 1.4, thumbOff: 1.25 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

/**
 * Extended state of [thumb, index, middle, ring, pinky].
 * `prev` (same shape) enables hysteresis so a finger on the edge does not flicker.
 */
export function extendedFingers(lm, prev = null) {
  const out = new Array(5);
  const tr = dist(lm[THUMB_TIP], lm[PINKY_MCP]) / dist(lm[THUMB_MCP], lm[PINKY_MCP]);
  out[0] = tr > (prev && prev[0] ? TH.thumbOff : TH.thumbOn);
  for (let i = 0; i < 4; i++) {
    const [mcp, tip] = FINGERS[i];
    const r = dist(lm[WRIST], lm[tip]) / dist(lm[WRIST], lm[mcp]);
    out[i + 1] = r > (prev && prev[i + 1] ? TH.fingerOff : TH.fingerOn);
  }
  return out;
}

export const countOf = (states) => states.reduce((n, s) => n + (s ? 1 : 0), 0);

/**
 * Order hands by image position (wrist x), so per-hand hysteresis state stays attached to the same hand
 * across frames. MediaPipe's own result order is not stable. hands: [{ landmarks, world }]
 */
export const sortByX = (hands) => [...hands].sort((a, b) => a.landmarks[WRIST].x - b.landmarks[WRIST].x);

/** Commits a value only after it was seen `frames` times in a row (frames = 1 → instant). */
export class Stabilizer {
  constructor(frames = 2) { this.frames = frames; this.value = undefined; this.cand = undefined; this.n = 0; }
  push(v) {
    if (v === this.value) { this.cand = v; this.n = 0; return this.value; }
    if (v === this.cand) this.n++; else { this.cand = v; this.n = 1; }
    if (this.n >= this.frames) { this.value = v; this.n = 0; }
    return this.value;
  }
}
