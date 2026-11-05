# Finger Organ
Web app: play organ chords with finger gestures in front of the webcam.

## Run
- Start: `start.bat` (free port from 8000, `scripts/serve.py` = static server with `Cache-Control: no-store`)
- Deploy: push to `main` → GitHub Pages https://gabiwan24.github.io/airpiano/
- Test: `npm test` (node:test, pure logic only: `src/chords.js`, `src/gesture.js`)
- Build: none – plain ES modules, no bundler

## Stack
Vanilla JS (ES modules), MediaPipe Tasks Vision 1.1.1 `HandLandmarker` (CDN, GPU delegate), raw Web Audio API.

## Conventions
- Latency is the top priority. Keep per-frame work allocation-free; DOM writes only on change, HUD max 4×/s.
- `chords.js` / `gesture.js` stay DOM-free so Node tests can import them.
- Organ: one permanently running oscillator per key (tonewheel model); notes are gain changes only.
- UI follows the global `design-system` skill (tokens.css / components.css / motion.js copied from it).

## Gotchas
- Camera needs a secure context: serve on `localhost`/`127.0.0.1`, not a LAN IP.
- Raw camera frames are unmirrored. Video + canvas are mirrored via CSS only. Hands are sorted by x only to keep hysteresis per hand; their finger counts are summed.
- Plain `python -m http.server` lets the browser cache CSS/JS – stale styles after edits. Use `scripts/serve.py`.
- No `DynamicsCompressorNode` (fixed look-ahead delay) – limiter is a tanh WaveShaper.
- Finger thresholds live in `TH` in `src/gesture.js`; tune there.

## Compact instructions
Preserve: current goal, changed files + why, open TODOs, unresolved errors verbatim, start/port setup.
