import { chordFromGesture, voiceStep, keyName, nextDegrees } from "./chords.js";
import { extendedFingers, countOf, sortByX, Stabilizer } from "./gesture.js";
import { Organ } from "./organ.js";
import { slideMarker } from "./motion.js";

const $ = (id) => document.getElementById(id);
const settings = { key: 0, variant: "", preset: "jazz", leslie: "slow", frames: 2, swell: true };

let organ = null;
let count = 0; // committed finger count (0 = silence)
let lastChord = null; // last sounding chord – suggestions stay visible after release
const stab = new Stabilizer(settings.frames);

// ---------- chord output ----------
const NOTE = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
function play(n) {
  count = n;
  const chord = chordFromGesture(settings.key, n, settings.variant);
  const v = voiceStep(chord);
  if (chord) lastChord = chord;
  organ?.setNotes(v.notes);
  $("chord-name").textContent = chord ? chord.name : "–";
  $("chord-name").classList.toggle("live", !!chord);
  $("chord-roman").textContent = chord ? chord.roman : "";
  $("chord-notes").textContent = chord ? v.notes.map((x) => NOTE[x % 12]).join(" ") : "";
  showSuggestions();
}

function applyCount(n) {
  const c = stab.push(n);
  if (c === undefined || c === count) return;
  play(c);
}

// ---------- "fits next" suggestions ----------
const nameOf = (degree) => chordFromGesture(settings.key, degree + 1, settings.variant).name;
function showSuggestions() {
  const next = lastChord ? nextDegrees(lastChord.degree) : { strong: [], good: [] };
  const fmt = (ds) => ds.map((d) => `${nameOf(d)} (${d + 1})`).join(" · ");
  $("next-strong").textContent = fmt(next.strong);
  $("next-good").textContent = fmt(next.good);
  $("chord-next").classList.toggle("empty", !lastChord);
  [...$("legend-play").children].forEach((el, i) => {
    const d = i % 7; // 8–10 are the same chords an octave up
    el.classList.toggle("on", i + 1 === count);
    el.classList.toggle("strong", next.strong.includes(d));
    el.classList.toggle("good", next.good.includes(d));
  });
}

// ---------- camera loop ----------
const canvas = $("overlay");
const ctx2d = canvas.getContext("2d");
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const TIPS = [4, 8, 12, 16, 20];
let tipColor;
let prevStates = [null, null];

function drawHand(lm, states) {
  const w = canvas.width, h = canvas.height;
  ctx2d.strokeStyle = "rgba(255,255,255,0.9)"; // video is dimmed to 10 %, so the skeleton carries the picture
  ctx2d.lineWidth = 3;
  ctx2d.beginPath();
  for (const [a, b] of BONES) { ctx2d.moveTo(lm[a].x * w, lm[a].y * h); ctx2d.lineTo(lm[b].x * w, lm[b].y * h); }
  ctx2d.stroke();
  TIPS.forEach((t, i) => {
    ctx2d.fillStyle = states[i] ? tipColor : "rgba(255,255,255,0.5)";
    ctx2d.fillRect(lm[t].x * w - 7, lm[t].y * h - 7, 14, 14);
  });
}

function onResult(result, detectMs) {
  const hands = sortByX(result.landmarks.map((landmarks, i) => ({ landmarks, world: result.worldLandmarks[i] })));
  const states = hands.map((hd, i) => extendedFingers(hd.world, prevStates[i]));
  prevStates = [states[0] ?? null, states[1] ?? null];

  applyCount(states.reduce((n, s) => n + countOf(s), 0));

  if (hands.length && settings.swell && organ) {
    // middle-finger knuckle: stable while fingers change; two hands → their average height
    const y = hands.reduce((s, hd) => s + hd.landmarks[9].y, 0) / hands.length;
    organ.setExpression(Math.min(1, Math.max(0, (0.85 - y) / 0.6)));
  }

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  hands.forEach((hd, i) => drawHand(hd.landmarks, states[i]));
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
      : err?.name === "NotFoundError" ? "Keine Kamera gefunden. Tasten 1–9 und 0 spielen trotzdem."
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

// ---------- keyboard fallback: 1–9, 0 = 10, play while held ----------
const held = [];
const keyCount = (k) => (k === "0" ? 10 : +k);
addEventListener("keydown", (e) => {
  if (e.repeat || !/^[0-9]$/.test(e.key)) return;
  ensureOrgan();
  held.push(keyCount(e.key));
  play(keyCount(e.key));
});
addEventListener("keyup", (e) => {
  if (!/^[0-9]$/.test(e.key)) return;
  const i = held.indexOf(keyCount(e.key));
  if (i < 0) return;
  held.splice(i, 1);
  play(held.length ? held[held.length - 1] : 0);
});

// ---------- settings UI ----------
/** Separate choice buttons (gaps, no sliding marker): key and variant grids. */
function choiceGrid(box, items, current, onPick) {
  box.replaceChildren(...items.map(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.textContent = label;
    b.dataset.value = value;
    b.addEventListener("click", () => { mark(value); onPick(value); });
    return b;
  }));
  const mark = (v) => { for (const b of box.children) b.setAttribute("aria-checked", String(b.dataset.value === String(v))); };
  mark(current);
}

function rebuild() {
  // legend names depend on key + variant
  $("legend-play").replaceChildren(...Array.from({ length: 10 }, (_, i) => {
    const el = document.createElement("li");
    el.innerHTML = `<span class="n">${i + 1}</span><span class="v"></span>`;
    el.lastChild.textContent = chordFromGesture(settings.key, i + 1, settings.variant).name;
    el.title = el.lastChild.textContent;
    return el;
  }));
  if (count) play(count); else showSuggestions(); // re-voice the sounding chord
}

const VARIANTS = [["", "Dreiklang"], ["7", "7"], ["sus4", "sus4"], ["sus2", "sus2"], ["add9", "add9"], ["parallel", "Dur↔Moll"]];
choiceGrid($("keys"), Array.from({ length: 12 }, (_, pc) => [String(pc), keyName(pc)]), "0", (v) => { settings.key = +v; rebuild(); });
choiceGrid($("variants"), VARIANTS, "", (v) => { settings.variant = v; rebuild(); });

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

tipColor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
rebuild();
initSegs();

// debug handle for verification in the console
window.__fp = { settings, get organ() { return organ; }, play };
