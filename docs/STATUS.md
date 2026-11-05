# Status
_Updated: 2026-11-05_

## Now
v1 live on GitHub Pages (https://gabiwan24.github.io/airpiano/, repo gabiwan24/airpiano, deploys from `main` root on every push). Waiting for a real webcam test by the user.

## Works
- Organ: 49 permanent tonewheel oscillators, 4 drawbar presets, Leslie (off/slow/fast), reverb, tanh limiter
- Chords: play hand 1–5 fingers = I IV V vi ii, second hand = 7/sus4/sus2/add9/major↔minor, 12 keys, voice leading
- MediaPipe HandLandmarker on GPU (~18 ms/frame measured), preloaded on page load, shader warm-up before going live
- Keyboard 1–5 fallback, HUD (camera fps, detection ms, audio latency)
- Unit tests: `npm test` (10 pass)

## Next
1. Live test with webcam; tune `TH` in `src/gesture.js` if finger counts flicker
2. Optional: move detection into a Web Worker if detect time blocks the UI

## Known issues
- Camera does not work in the Claude browser pane (capture blocked) – test in Chrome/Edge via start.bat
- Audio output latency is device-bound (measured 56 ms in the pane; wired output/ASIO-class drivers are lower; Bluetooth much higher)
- Design audit dark R9 on active segment is a false positive (marker under text not seen by audit)
