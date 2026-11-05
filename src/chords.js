// Pure music theory: key + gesture → chord (pitch classes, name, voicing). No DOM, testable in Node.

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // F B♭ E♭ A♭ D♭ G♭
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Play-hand finger count → scale degree (0-based). Ordered by how often the chord occurs in pop/gospel songs. */
export const DEGREE_BY_FINGERS = { 1: 0, 2: 3, 3: 4, 4: 5, 5: 1 }; // I IV V vi ii

/** Modifier-hand finger count → chord variant. */
export const MODIFIERS = ["", "7", "sus4", "sus2", "add9", "parallel"];

export const keyName = (pc) => (FLAT_KEYS.has(pc) ? FLAT : SHARP)[pc];

const SUFFIX = {
  "0,4,7": "", "0,3,7": "m", "0,3,6": "°",
  "0,4,7,11": "maj7", "0,4,7,10": "7", "0,3,7,10": "m7", "0,3,6,10": "m7♭5", "0,3,7,11": "m(maj7)", "0,3,6,9": "°7",
  "0,5,7": "sus4", "0,2,7": "sus2", "0,2,4,7": "add9", "0,2,3,7": "madd9", "0,2,3,6": "°(add9)",
};

/**
 * Build a chord. Returns null for degree === null (= silence).
 * intervals are semitones above the root (may exceed 11 for a 9th).
 */
export function buildChord(keyPc, degree, modifier = "") {
  if (degree == null) return null;
  const step = (n) => MAJOR[(degree + n) % 7] + 12 * Math.floor((degree + n) / 7) - MAJOR[degree];
  let third = step(2), fifth = step(4);
  let intervals;
  switch (modifier) {
    case "7": intervals = [0, third, fifth, step(6)]; break;
    case "sus4": intervals = [0, 5, 7]; break;
    case "sus2": intervals = [0, 2, 7]; break;
    case "add9": intervals = [0, third, fifth, 14]; break;
    case "parallel": // major ↔ minor; diminished becomes minor
      third = third === 4 ? 3 : 4;
      intervals = [0, third, 7];
      break;
    default: intervals = [0, third, fifth];
  }
  const rootPc = (keyPc + MAJOR[degree]) % 12;
  const pcsKey = [...new Set(intervals.map((i) => i % 12))].sort((a, b) => a - b).join(",");
  const suffix = SUFFIX[pcsKey] ?? "?";
  const isMinorish = third === 3;
  const roman = isMinorish ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  return {
    rootPc,
    intervals,
    name: (FLAT_KEYS.has(keyPc) ? FLAT : SHARP)[rootPc] + suffix,
    roman: roman + (suffix === "°" ? "°" : "") + (modifier && modifier !== "parallel" ? modifier : ""),
  };
}

/**
 * Organ voicing: bass = root in [BASS_LO, BASS_LO+11], upper structure in close position near the
 * previous upper voicing (smallest total movement = smooth voice leading, shared notes keep sounding).
 */
const BASS_LO = 40; // E2
const UPPER_LO = 55; // G3
export function voice(chord, prevUpper = null) {
  if (!chord) return { bass: null, upper: [], notes: [] };
  const bass = BASS_LO + ((chord.rootPc - (BASS_LO % 12) + 12) % 12);
  const pcs = [...new Set(chord.intervals.map((i) => (chord.rootPc + i) % 12))];
  const ref = prevUpper && prevUpper.length ? prevUpper : [60, 64, 67];
  const refMean = ref.reduce((a, b) => a + b, 0) / ref.length;
  let best = null, bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = pcs.slice(inv).concat(pcs.slice(0, inv));
    for (const startOct of [UPPER_LO, UPPER_LO + 12]) {
      const notes = [];
      let n = startOct + ((order[0] - (startOct % 12) + 12) % 12);
      notes.push(n);
      for (let k = 1; k < order.length; k++) {
        n = n + ((order[k] - (n % 12) + 12) % 12 || 12);
        notes.push(n);
      }
      if (notes[notes.length - 1] > 79) continue; // keep the top voice below G5
      const cost = movement(notes, ref) + Math.abs(notes.reduce((a, b) => a + b, 0) / notes.length - refMean) * 0.5;
      if (cost < bestCost) { bestCost = cost; best = notes; }
    }
  }
  return { bass, upper: best, notes: [bass, ...best] };
}

function movement(a, b) {
  // each note of a moves to the nearest note of b
  let sum = 0;
  for (const x of a) sum += Math.min(...b.map((y) => Math.abs(x - y)));
  return sum;
}

/** Map play-hand + modifier-hand finger counts to a chord. playCount 0 or null → silence. */
export function chordFromGesture(keyPc, playCount, modCount = 0) {
  const degree = DEGREE_BY_FINGERS[playCount];
  if (degree === undefined) return null;
  return buildChord(keyPc, degree, MODIFIERS[modCount] ?? "");
}
