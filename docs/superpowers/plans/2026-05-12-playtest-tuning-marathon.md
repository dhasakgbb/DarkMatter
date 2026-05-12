# Playtest Tuning Marathon Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ralph-marathon cadence with explicit iteration status lines.

**Goal:** Use ten play/tune/optimize passes to make Photon feel more readable, more rewarding, and better instrumented by Fun Lab.

**Architecture:** Preserve the plain TypeScript/Vite/Three.js runtime and keep simulation outside renderer objects. Tune using small, reversible changes to racing grammar, Fun Lab scoring, UI readability, and validation scripts; do not add auto-tuning or cloud analytics.

**Tech Stack:** TypeScript, Vite, Three.js, DOM overlays, Vitest, Playwright, GitHub Pages.

---

## QA Inventory

- Title: Begin run, Fun Lab, Form, Codex, Memories, Resume when present.
- Run: movement, route readability, hazards, gates, speed pads, boost, field strain, HUD.
- Pause: resume, Fun Lab, end run, settings layout.
- Vibe: submit, skip, run again, rating button state.
- Fun Lab: empty state, filled state, selected run, recommendation queue, timeline scroll, export, clear.
- Mobile: title fit, vibe fit, Fun Lab fit, run HUD density.
- Persistence: local run history is recorded and scoreable.
- Build/publish: bundled artifact and Pages endpoint stay current.

## Passes

- [x] Pass 1: Add cadence scripts and tuning plan.
- [x] Pass 2: Baseline playtest and first feel/readability tuning.
- [x] Pass 3: Tune Fun Lab recommendation prominence.
- [x] Pass 4: Tune vibe and quit/death flow.
- [x] Pass 5: Gate cadence validation and mobile fit pass.
- [x] Pass 6: Tune racing-line/pad pacing for higher dopamine.
- [x] Pass 7: Tune dashboard evidence quality and score interpretation.
- [x] Pass 8: Exploratory off-happy-path pass.
- [x] Pass 9: Build artifact and Pages publish prep.
- [x] Pass 10: Final gates, commit, push, publish verification.

## Playtest Log

- Pass 2 baseline: scripted keyboard run reached Recombination with high excitement but poor route clarity. Fun Lab reported dopamine 79, readability 0, 46 gate misses, 18 gate hits, 15 speed pads, and a high-confidence route-readability recommendation.
- Pass 2 tuning: widened and brightened gate affordances, extended the timing window, spawned the first route cue earlier, tightened gate spacing slightly, and raised speed-pad frequency to make the authored racing line easier to read across the full playfield.
- Pass 3 signal correction: damage clustering now uses explicit damage events when available, so paired `damage` + `hazard-hit` telemetry does not falsely create cheap-damage findings.
- Pass 3 UI tuning: recommendation cards now sit above the event timeline, and the timeline is capped tighter so the tuning queue stays visible without scrolling through a full log first.
- Pass 4 quit flow: manual End Run now finishes the Fun Lab record as `quit` instead of recording both quit and death, and the run-end prose distinguishes a released run from absorption.
- Pass 5 mobile fit: narrow viewport title controls fit cleanly; Fun Lab now constrains its run/detail grid on mobile so the action buttons stay reachable while the detail panel scrolls internally.
- Pass 6 reward tuning: speed pads now last longer, restore more boost/energy, and emit a stronger burst; gate streak rewards now climb slightly faster with a higher cap to make clean routing feel more electric.
- Pass 7 recommendation tuning: manual quits now receive an explicit context card, and route-readability findings require low readability, poor gate hit rate, or repeated line breaks instead of a few isolated misses.
- Pass 8 exploratory run: after route/reward tuning, a fresh run reached Quark Plasma with no damage and no clustered-hit frustration, but the lab falsely counted upgrade deliberation as boredom.
- Pass 8 evidence fix: upgrade option-to-selection time is now excluded from boredom-gap detection, so pacing recommendations stay focused on actual playfield quiet time.
- Pass 9 publish prep: ran the production Vite build, refreshed `photon-racer-v2.html` from `photon/dist/index.html`, and confirmed the files match byte-for-byte.
- Parallel audio prep: added a disabled runtime audio manifest, browser audio drop-zone docs, and fallback-aware audio loading so future studio SFX/music can replace procedural cues without breaking the current build.
- Pass 10 final gate: `npm run precommit` and `npm run lint` pass; `photon-racer-v2.html` was refreshed from the final build and matches `photon/dist/index.html`.
