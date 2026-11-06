# Status
_Updated: 2026-11-06_

## Now
v2 live on GitHub Pages (https://gabiwan24.github.io/airpiano/, repo gabiwan24/airpiano, deploys from `main` root on every push). Waiting for a real webcam test by the user.

## Works
- 1–10 fingers (both hands summed) = all 7 scale-step chords, 8–10 an octave higher; bass climbs 1–2 semitones per finger (no leap at 7 → 8)
- Variant (triad/7/sus4/sus2/add9/major↔minor) and key by click
- "Fits next" suggestions (strong/good) on the stage and in the 10-cell legend; stay visible after release
- Organ: permanent tonewheel oscillators (36–96), 4 drawbar presets, Leslie, reverb, tanh limiter; Space = mute
- MediaPipe HandLandmarker on GPU (~18 ms/frame measured), preloaded, shader warm-up before going live
- Keyboard fallback 1–9, 0 = 10; HUD (camera fps, detection ms, audio latency)
- Unit tests: `npm test` (12 pass)

## Next
1. Live test with webcam, especially 6–10 (both hands, thumbs); tune `TH` in `src/gesture.js` if counts flicker
2. Optional: move detection into a Web Worker if detect time blocks the UI

## Known issues
- Camera does not work in the Claude browser pane (capture blocked) – test in Chrome/Edge
- Audio output latency is device-bound (56–66 ms measured in the pane)
- Design audit dark R9 on active segment is a false positive (marker under text not seen by audit)
