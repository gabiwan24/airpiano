# Gates: Finger Organ v1

OWNS: **

Scope: Static web app that plays organ chords from webcam finger gestures with minimal latency, plus scaffold, docs and start.bat.

- [x] G1: Chord theory, voicing, finger detection, role split and debounce pass their unit tests
  CHECK: node --test tests/chords.test.mjs tests/gesture.test.mjs
  EXPECT: # fail 0
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Gabriel Weiss\Documents\Claude_Vibecoding\finger-piano; path=ec20f1c55ace/38 entries; output=# todo 0 | # duration_ms 118.7784

- [x] G2: find-port.ps1 prints a free port from 8000
  CHECK: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/find-port.ps1 8000
  EXPECT: 80
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Gabriel Weiss\Documents\Claude_Vibecoding\finger-piano; path=ec20f1c55ace/38 entries; output=8000

- [x] G3: Page served on localhost loads without console errors; MediaPipe HandLandmarker initialises (GPU or CPU fallback)
  EVIDENCE: Browser pane http://localhost:8000: no console errors except the expected camera NotAllowedError (pane blocks capture); loadLandmarker() → delegate=GPU, load 1258 ms, detect 18.4 ms/frame after warm-up

- [x] G4: Keyboard 1–5 produces the expected chord names and the organ graph sets exactly the voiced notes active
  EVIDENCE: keys 1–5 in C → C I [48,60,64,67] · F IV [41,60,65,69] · G V [43,59,62,67] · Am vi [45,60,64,69] · Dm ii [50,62,65,69]; release → on=0; key G + 3 → D; preset/leslie switching on live organ without errors

- [x] G5: Design audit (audit.js runAudit) reports zero violations in light and dark
  EVIDENCE: runAudit(body): light 0 violations; dark 1 = R9 1.6 on active .seg button – false positive: audit ignores the .sel-marker under the text; measured marker bg rgb(251,255,0) under black text (19.4:1)

- [ ] G6: Real webcam: finger counts trigger chords live
  EVIDENCE: pending

ABANDON: G6 The agent browser pane blocks camera capture (NotAllowedError), so live finger detection cannot be exercised here. Handoff: user tests with start.bat in Chrome/Edge; tune TH in src/gesture.js if counts are off.
