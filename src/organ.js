// Tonewheel-style organ on raw Web Audio. Built for minimum note-on latency:
// - every key has an oscillator that runs permanently (like a tonewheel); a note is only a gain change,
//   so note-on allocates nothing and starts in the next audio block
// - the dry signal path has no delay-based node; Leslie/reverb are parallel wet paths
// - no DynamicsCompressorNode (it adds a fixed look-ahead delay); a tanh WaveShaper limits instead

// Drawbar footages 16' 5⅓' 8' 4' 2⅔' 2' 1⅗' 1⅓' 1' as harmonics of the 16' sub-octave oscillator.
const HARMONIC = [1, 3, 2, 4, 6, 8, 10, 12, 16];
export const PRESETS = {
  jazz: [8, 8, 8, 0, 0, 0, 0, 0, 0],
  gospel: [8, 8, 8, 8, 0, 0, 0, 0, 0],
  church: [8, 0, 8, 8, 0, 8, 0, 0, 8],
  full: [8, 8, 8, 8, 8, 8, 8, 8, 8],
};
export const LESLIE = { off: 0, slow: 0.8, fast: 6.7 }; // rotor speed in Hz

const NOTE_LO = 36, NOTE_HI = 84;
const ATTACK_TC = 0.003; // time constant (s): ~10 ms to full level, no click
const RELEASE_TC = 0.012;

const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);

function tanhCurve(drive, size = 2048) {
  const c = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / norm;
  }
  return c;
}

function impulse(ctx, seconds = 1.8, decay = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

export class Organ {
  constructor() {
    // latencyHint 0 = smallest buffer the device allows (measured 8 ms less output latency than "interactive")
    const ctx = (this.ctx = new AudioContext({ latencyHint: 0 }));
    this.voices = new Map(); // midi → GainNode
    this.on = new Set();

    const bus = ctx.createGain();
    bus.gain.value = 0.16; // 5 notes × full drawbars stay below the limiter knee
    const drive = new WaveShaperNode(ctx, { curve: tanhCurve(1.6), oversample: "none" });
    this.expression = ctx.createGain();
    this.expression.gain.value = 0.8;
    const sum = ctx.createGain();
    const limiter = new WaveShaperNode(ctx, { curve: tanhCurve(1.2), oversample: "none" });
    bus.connect(drive).connect(this.expression);
    this.expression.connect(sum); // dry path: no delay
    this.mute = new GainNode(ctx, { gain: 1 });
    sum.connect(limiter).connect(this.mute).connect(ctx.destination);

    // Leslie: two modulated delay lines panned L/R, rotor LFO with realistic spin-up (setTargetAtTime)
    this.rotor = new OscillatorNode(ctx, { frequency: LESLIE.slow });
    this.leslieWet = new GainNode(ctx, { gain: 0 });
    for (const [pan, sign] of [[-0.7, 1], [0.7, -1]]) {
      const dl = new DelayNode(ctx, { delayTime: 0.004, maxDelayTime: 0.02 });
      const depth = new GainNode(ctx, { gain: 0.0012 * sign });
      this.rotor.connect(depth).connect(dl.delayTime);
      this.expression.connect(dl).connect(new StereoPannerNode(ctx, { pan })).connect(this.leslieWet);
    }
    this.leslieWet.connect(sum);
    this.rotor.start();

    const verb = new ConvolverNode(ctx, { buffer: impulse(ctx) });
    const verbSend = new GainNode(ctx, { gain: 0.14 });
    this.expression.connect(verbSend).connect(verb).connect(sum);

    // Permanent "tonewheels": one oscillator per key at half frequency (= 16' drawbar).
    this.oscs = [];
    for (let n = NOTE_LO; n <= NOTE_HI; n++) {
      const osc = new OscillatorNode(ctx, { frequency: midiHz(n) / 2 });
      const g = new GainNode(ctx, { gain: 0 });
      osc.connect(g).connect(bus);
      osc.start();
      this.oscs.push(osc);
      this.voices.set(n, g);
    }
    this.setPreset("jazz");
  }

  setPreset(name) {
    const bars = PRESETS[name];
    const size = 17;
    const real = new Float32Array(size), imag = new Float32Array(size);
    bars.forEach((lvl, i) => { if (lvl > 0) imag[HARMONIC[i]] += 10 ** (((lvl - 8) * 3) / 20); });
    const wave = this.ctx.createPeriodicWave(real, imag);
    for (const o of this.oscs) o.setPeriodicWave(wave);
  }

  setLeslie(mode) {
    const t = this.ctx.currentTime;
    this.leslieWet.gain.setTargetAtTime(mode === "off" ? 0 : 0.7, t, 0.05);
    if (mode !== "off") this.rotor.frequency.setTargetAtTime(LESLIE[mode], t, 0.6);
  }

  /** Sound exactly these MIDI notes. Notes shared with the previous chord keep sounding (legato). */
  setNotes(notes) {
    const t = this.ctx.currentTime;
    const next = new Set(notes.filter((n) => n >= NOTE_LO && n <= NOTE_HI));
    for (const n of this.on) if (!next.has(n)) this.voices.get(n).gain.setTargetAtTime(0, t, RELEASE_TC);
    for (const n of next) if (!this.on.has(n)) this.voices.get(n).gain.setTargetAtTime(1, t, ATTACK_TC);
    this.on = next;
  }

  /** Silences the output; notes keep tracking gestures so unmuting resumes the current chord. */
  setMuted(muted) {
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.005);
  }

  /** 0..1 swell pedal. */
  setExpression(v) {
    this.expression.gain.setTargetAtTime(0.15 + 0.85 * v, this.ctx.currentTime, 0.03);
  }

  /** Audio output latency in ms (block + device buffer), as reported by the browser. */
  latencyMs() {
    return ((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000;
  }
}
