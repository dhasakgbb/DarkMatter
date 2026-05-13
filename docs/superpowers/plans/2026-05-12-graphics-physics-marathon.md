# Graphics And Physics Marathon Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ralph-marathon cadence with explicit iteration status lines.

**Goal:** Use ten focused passes to raise Photon's graphic/asset quality and make the open-space race plane feel more physical without replacing the existing Three.js/Vite architecture.

**Architecture:** Keep simulation state in TypeScript state modules, keep Three.js as the render adapter, keep DOM overlays for menus/HUD, and refresh `photon-racer-v2.html` only from the Vite build.

**Tech Stack:** TypeScript, Vite, Three.js, procedural WebGL assets, DOM HUD, Vitest, Playwright, GitHub Pages.

---

## QA Inventory

- Title: published and local title screens remain readable and startable.
- Run graphics: skyfield, route flow, gates, pads, hazards, photon trail, and HUD remain visible over motion.
- Run physics: lateral/up/down input, boost, edge strain, speed pads, gravity wells, hazard phasing, and recovery all remain understandable.
- Asset quality: shipped director-temp audio and any procedural visual assets have documented temporary/final status.
- Fun Lab: new physics/visual changes do not corrupt run recording or recommendation screens.
- Mobile: title and Fun Lab retain fit; gameplay HUD does not clip essential controls.
- Build/publish: Vite build, generated single-file artifact, and Pages endpoint stay current.

## Passes

- [x] Pass 1: Create graphics/physics sprint plan and baseline validation.
- [x] Pass 2: Add richer cosmic-web background asset.
- [x] Pass 3: Improve racing route readability with authored visual beads.
- [x] Pass 4: Add gravity-well pull physics and HUD/readability feedback.
- [x] Pass 5: Gate cadence validation and desktop/mobile visual pass.
- [x] Pass 6: Upgrade gravity-well visual asset quality.
- [x] Pass 7: Tune physical feel from playtest signal.
- [x] Pass 8: Add visual/asset quality roadmap and debug notes.
- [ ] Pass 9: Build artifact and publish prep.
- [ ] Pass 10: Final gates, commit, push, publish verification.

## Playtest Claims To Sign Off

- The race plane should look denser and more authored without hiding the route.
- Gravity wells should feel physically meaningful before collision.
- The temporary audio asset path should be documented as non-final but shippable for direction testing.
- Desktop and mobile layouts should avoid embarrassing clipping in the primary screens.

## Pass Log

- Pass 1 baseline: local Vite server on `127.0.0.1:5174` responds, `npm test` passes, and `npm run typecheck` passes against the current tree. The worktree already contains temporary audio asset changes from parallel asset work; this sprint preserves and documents them rather than reverting them.
- Pass 2 visual asset: added a low-cost procedural cosmic-web line layer behind the race plane, with epoch-tinted color and subtle rotation. It stays in the render layer and does not own simulation state.
- Pass 3 route asset: added shimmering route beads along the authored racing flow so the suggested line reads as a chain through open space rather than only thin guide lines.
- Pass 4 physics: gravity wells now exert pre-contact lateral/vertical pull through shared run state, draining a small amount of boost/energy under shear and surfacing a HUD gravity-shear read.
- Pass 5 validation: desktop and mobile Playwright passes confirmed title fit, full-screen playfield readability, canvas sizing, active WebGL2 rendering, and a clean console after the graphics additions.
- Pass 6 visual asset: gravity wells now render as layered curved-space events with a dark core, additive lens halo, and counter-rotating accretion rings.
- Pass 7 physics: well near-misses can trigger `GRAVITY SLING`, awarding a short speed burst and logging `gravity-sling` into Fun Lab. A fresh automated run on the current dev bundle produced two gravity slingshots, no damage, and a telemetry-only Fun Index sample.
- Pass 8 planning: added a next-sprint graphics/physics roadmap covering epoch asset priorities, physics depth, performance budgets, and acceptance gates.
