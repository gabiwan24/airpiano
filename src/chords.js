// Pure music theory: key + gesture → chord (pitch classes, name, voicing). No DOM, testable in Node.

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // F B♭ E♭ A♭ D♭ G♭
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Total finger count 1–10 → scale degree (0-based) + octave: 1–7 = I…vii°, 8–10 = I ii iii one octave up. */
export const stepOf = (count) => (count >= 1 && count <= 10 ? { degree: (count - 1) % 7, octave: count > 7 ? 1 : 0 } : null);

/** Chord variants, chosen by click. */
export const MODIFIERS = ["", "7", "sus4", "sus2", "add9", "parallel"];

/**
 * Which degree tends to follow which in major (classical root-movement chart):
 * iii → vi → ii/IV → V/vii° → I, I goes anywhere; V may also go deceptively to vi.
 */
const NEXT = {
  0: { strong: [3, 4], good: [5, 1, 2] },
  1: { strong: [4], good: [6, 3] },
  2: { strong: [5], good: [3] },
  3: { strong: [4, 0], good: [1, 6] },
  4: { strong: [0], good: [5, 3] },
  5: { strong: [1, 3], good: [4, 2] },
  6: { strong: [0], good: [2, 4] },
};
export const nextDegrees = (degree) => NEXT[degree] ?? { strong: [], good: [] };

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
    degree,
    rootPc,
    intervals,
    name: (FLAT_KEYS.has(keyPc) ? FLAT : SHARP)[rootPc] + suffix,
    roman: roman + (suffix === "°" ? "°" : "") + (modifier && modifier !== "parallel" ? modifier : ""),
  };
}

/**
 * Classic scale chords in root position: each finger more = the chord on the next scale step,
 * stacked straight up from its root. Tonic is the one nearest C4 (C major → C4 E4 G4),
 * 8–10 are 1–3 one octave higher. Highest note (F key, step 10, add9) = 95, inside the organ range.
 */
const TONIC_LO = 54; // F♯3
export function voice(chord) {
  if (!chord) return { bass: null, upper: [], notes: [] };
  const tonicPc = (chord.rootPc - MAJOR[chord.degree] + 12) % 12;
  const tonic = TONIC_LO + ((tonicPc - (TONIC_LO % 12) + 12) % 12);
  const root = tonic + MAJOR[chord.degree] + 12 * (chord.octave ?? 0);
  const notes = chord.intervals.map((i) => root + i);
  return { bass: root, upper: notes, notes };
}

/** Total finger count (1–10) + clicked variant → chord. 0 → silence. Octave chords carry octave = 1. */
export function chordFromGesture(keyPc, count, modifier = "") {
  const step = stepOf(count);
  if (!step) return null;
  const chord = buildChord(keyPc, step.degree, modifier);
  chord.octave = step.octave;
  if (step.octave) { chord.name += "′"; chord.roman += "′"; }
  return chord;
}

/** Voicing for a gesture chord; the octave of 8–10 comes from chord.octave. */
export const voiceStep = voice;
