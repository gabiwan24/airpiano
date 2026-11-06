# Decisions
<!-- one line each: YYYY-MM-DD – decision – why. Append only. -->
2026-11-05 – Vanilla JS + static server, no framework/bundler – least overhead per frame, nothing to build.
2026-11-05 – MediaPipe HandLandmarker (GPU, VIDEO mode, requestVideoFrameCallback, 640×480 @ 60 fps request) – fastest in-browser hand tracking; one detection per new frame.
2026-11-05 – Raw Web Audio instead of Tone.js; permanent oscillator per key, PeriodicWave from drawbars – note-on is only a gain change, no allocation.
2026-11-05 – No DynamicsCompressorNode, tanh WaveShaper limiter; Leslie/reverb as parallel wet paths – compressor look-ahead and delay lines would add latency to the dry signal.
2026-11-05 – Finger count mapping: play hand 1–5 = I IV V vi ii, second hand = 7/sus4/sus2/add9/parallel – most-used chords on the easiest counts.
2026-11-05 – Hand roles by image position, not MediaPipe handedness label – label depends on mirroring and flips; position is unambiguous.
2026-11-05 – Fingers of both hands are summed: 1–7 = I…vii°, 8–10 = I ii iii an octave up; variant only by click – user wants the full scale playable by gesture, variants deliberately not by hand.
2026-11-05 – "Fits next" suggestions from the classical root-movement chart (iii→vi→ii/IV→V/vii°→I) – standard functional harmony, predictable for players.
2026-11-05 – Dev server scripts/serve.py with Cache-Control: no-store – http.server let the browser serve stale CSS after edits.
2026-11-06 – Bass walks the scale as a ladder (tonic D2–C♯3 + scale step, 8–10 +12), upper voices stay voice-led and above the bass – the old +12 shift of the whole voicing made 7 → 8 leap 13 semitones.
