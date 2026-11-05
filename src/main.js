import { chordFromGesture, voice, keyName, DEGREE_BY_FINGERS, MODIFIERS, buildChord } from "./chords.js";
import { extendedFingers, countOf, assignRoles, Stabilizer } from "./gesture.js";
import { Organ } from "./organ.js";
import { slideMarker } from "./motion.js";

const $ = (id) => document.getElementById(id);
const settings = { key: 0, preset: "jazz", leslie: "slow", playSide: "right", frames: 2, swell: true };

let organ = null;
let upper = null; // previous upper voicing for voice leading
let lastGesture = "0|0";
const stab = new Stabilizer(settings.frames);

// ---------- chord output ----------
const NOTE = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
function play(playCount, modCount) {
  const chord = chordFromGesture(settings.key, playCount, modCount);
  const v = voice(chord, upper);
  if (chord) upper = v.upper;
  organ?.setNotes(v.notes);
  $("chord-name").textContent = chord ? chord.name : "–";
  $("chord-name").classList.toggle("live", !!chord);
  $("chord-roman").textContent = chord ? chord.roman : "";
  $("chord-notes").textContent = chord ? v.notes.map((n) => NOTE[n % 12]).join(" ") : "";
  markLegend(playCount, chord ? modCount : -1);
}

function applyGesture(playCount, modCount) {
  const g = stab.push(`${playCount}|${modCount}`);
  if (g === undefined || g === lastGesture) return;
  lastGesture = g;
  const [p, m] = g.split("|").map(Number);
  play(p, m);
}

// ---------- camera loop ----------
const canvas = $("overlay");
const ctx2d = canvas.getContext("2d");
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const TIPS = [4, 8, 12, 16, 20];
let colors;
const prevStates = { play: null, mod: null };

function drawHand(lm, states, color) {
  const w = canvas.width, h = canvas.height;
  ctx2d.strokeStyle = "rgba(255,255,255,0.55)";
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  for (const [a, b] of BONES) { ctx2d.moveTo(lm[a].x * w, lm[a].y * h); ctx2d.lineTo(lm[b].x * w, lm[b].y * h); }
  ctx2d.stroke();
  TIPS.forEach((t, i) => {
    ctx2d.fillStyle = states[i] ? color : "rgba(255,255,255,0.35)";
    ctx2d.fillRect(lm[t].x * w - 6, lm[t].y * h - 6, 12, 12);
  });
}

function onResult(result, detectMs) {
  const hands = result.landmarks.map((landmarks, i) => ({ landmarks, world: result.worldLandmarks[i] }));
  const { play: ph, mod: mh } = assignRoles(hands, settings.playSide);
  const ps = ph ? extendedFingers(ph.world, prevStates.play) : null;
  const ms = mh ? extendedFingers(mh.world, prevStates.mod) : null;
  prevStates.play = ps; prevStates.mod = ms;

  applyGesture(ps ? countOf(ps) : 0, ms ? countOf(ms) : 0);

  if (ph && settings.swell && organ) {
    const y = ph.landmarks[9].y; // middle-finger knuckle: stable while fingers change
    organ.setExpression(Math.min(1, Math.max(0, (0.85 - y) / 0.6)));
  }

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  if (ph) drawHand(ph.landmarks, ps, colors.play);
  if (mh) drawHand(mh.landmarks, ms, colors.mod);
  stats(detectMs);
}

// ---------- HUD (updated 4×/s, never per frame) ----------
let frames = 0, detectSum = 0, lastHud = performance.now();
function stats(detectMs) {
  frames++; detectSum += detectMs;
  const now = performance.now();
  if (now - lastHud < 250) return;
  $("hud-fps").textContent = `${Math.round((frames * 1000) / (now - lastHud))} fps`;
  $("hud-detect").textContent = `${(detectSum / frames).toFixed(1)} ms`;
  frames = 0; detectSum = 0; lastHud = now;
}

function setStatus(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("live", !error && text === "Live");
  $("status").classList.toggle("error", error);
}

function ensureOrgan() {
  if (organ) return organ;
  organ = new Organ();
  organ.setPreset(settings.preset);
  organ.setLeslie(settings.leslie);
  organ.setMuted(muted);
  // outputLatency is only known once the device runs and can change with the output device
  const showLatency = () => ($("hud-audio").textContent = `${organ.latencyMs().toFixed(1)} ms`);
  showLatency();
  setInterval(showLatency, 1000);
  return organ;
}

async function start() {
  const btn = $("start-btn");
  btn.disabled = true;
  btn.dataset.loading = "";
  ensureOrgan();
  setStatus("Lädt");
  try {
    const { startCamera, runLoop, warmUp } = await trackerModule;
    const [{ landmarker, delegate }, cam] = await Promise.all([landmarkerReady, startCamera($("video"))]);
    warmUp(landmarker);
    canvas.width = cam.width || $("video").videoWidth;
    canvas.height = cam.height || $("video").videoHeight;
    runLoop($("video"), landmarker, onResult);
    setStatus("Live");
    $("start").classList.add("gone");
    console.info(`Hand tracking on ${delegate}, camera ${canvas.width}×${canvas.height} @ ${cam.frameRate} fps`);
  } catch (err) {
    console.error(err);
    const msg = err?.name === "NotAllowedError" ? "Kamerazugriff wurde abgelehnt. Bitte in der Adressleiste erlauben."
      : err?.name === "NotFoundError" ? "Keine Kamera gefunden. Tasten 1–5 spielen trotzdem."
      : `Start fehlgeschlagen: ${err?.message || err}`;
    $("start-hint").textContent = msg;
    $("start-hint").classList.add("error");
    setStatus("Fehler", true);
    btn.disabled = false;
    delete btn.dataset.loading;
  }
}

// ---------- mute: Space toggles ----------
let muted = false;
function toggleMute() {
  muted = !muted;
  organ?.setMuted(muted);
  $("mute").classList.toggle("on", muted);
  document.querySelector(".chord").classList.toggle("muted", muted);
}
addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault(); // no page scroll, no click on a focused button
  if (!e.repeat) toggleMute();
});
addEventListener("keyup", (e) => { if (e.code === "Space") e.preventDefault(); });

// ---------- keyboard fallback: 1–5 play while held ----------
const held = new Set();
addEventListener("keydown", (e) => {
  if (e.repeat || !/^[1-5]$/.test(e.key) || e.target.closest?.("input")) return;
  ensureOrgan();
  held.add(+e.key);
  play(+e.key, 0);
});
addEventListener("keyup", (e) => {
  if (!held.delete(+e.key)) return;
  if (held.size) play([...held].pop(), 0); else play(0, 0);
});

// ---------- settings UI ----------
function buildKeys() {
  const box = $("keys");
  for (let pc = 0; pc < 12; pc++) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.textContent = keyName(pc);
    b.dataset.pc = pc;
    b.addEventListener("click", () => setKey(pc));
    box.append(b);
  }
}

function setKey(pc) {
  settings.key = pc;
  for (const b of $("keys").children) b.setAttribute("aria-checked", String(+b.dataset.pc === pc));
  buildLegend();
  const [p, m] = lastGesture.split("|").map(Number);
  if (p) play(p, m);
}

function buildLegend() {
  const playList = $("legend-play"), modList = $("legend-mod");
  playList.replaceChildren(...[1, 2, 3, 4, 5].map((n) => li(n, buildChord(settings.key, DEGREE_BY_FINGERS[n]).name)));
  const label = { "": "Dreiklang", "7": "7", sus4: "sus4", sus2: "sus2", add9: "add9", parallel: "Dur↔Moll" };
  modList.replaceChildren(...[1, 2, 3, 4, 5].map((n) => li(n, label[MODIFIERS[n]])));
  const [p, m] = lastGesture.split("|").map(Number);
  markLegend(p, m);
}

function li(n, text) {
  const el = document.createElement("li");
  el.innerHTML = `<span class="n">${n}</span><span class="v"></span>`;
  el.lastChild.textContent = text;
  el.title = text;
  return el;
}

function markLegend(p, m) {
  [...$("legend-play").children].forEach((el, i) => el.classList.toggle("on", i + 1 === p));
  [...$("legend-mod").children].forEach((el, i) => el.classList.toggle("on", i + 1 === m));
}

function initSegs() {
  for (const seg of document.querySelectorAll(".seg[data-setting]")) {
    const key = seg.dataset.setting;
    const marker = seg.querySelector(".sel-marker");
    const select = (btn, animate) => {
      for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-checked", String(b === btn));
      slideMarker(seg, marker, btn, { animate, bleed: 1 });
    };
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      select(btn, true);
      const raw = btn.dataset.value;
      settings[key] = key === "frames" ? +raw : raw;
      if (key === "preset") organ?.setPreset(raw);
      if (key === "leslie") organ?.setLeslie(raw);
      if (key === "frames") stab.frames = +raw;
    });
    select(seg.querySelector(`button[data-value="${settings[key]}"]`), false);
    new ResizeObserver(() => select(seg.querySelector('[aria-checked="true"]'), false)).observe(seg);
  }
}

$("swell").addEventListener("change", (e) => {
  settings.swell = e.target.checked;
  if (!settings.swell) organ?.setExpression(0.8);
});
$("start-btn").addEventListener("click", start);

// Download MediaPipe + model right away (async, no user gesture needed), so Start only has to open the camera.
// tracker.js is imported lazily so the page renders before the CDN bundle arrives.
const trackerModule = import("./tracker.js");
const landmarkerReady = trackerModule.then((m) => m.loadLandmarker());
landmarkerReady.catch(() => {}); // surfaced in start()

const css = getComputedStyle(document.documentElement);
colors = { play: css.getPropertyValue("--accent").trim(), mod: css.getPropertyValue("--accent-2").trim() };
buildKeys();
setKey(0);
initSegs();

// debug handle for verification in the console
window.__fp = { settings, get organ() { return organ; }, play };
