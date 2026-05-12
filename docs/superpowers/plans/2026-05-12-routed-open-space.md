# Routed Open Space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dominant tunnel feel with a full-screen routed-open-space racing field while preserving Photon’s forward-run structure.

**Architecture:** Keep the existing plain TypeScript/Vite/Three.js runtime and the `distance`-based racing spine. Reframe the tube as a soft route cue: wider lateral/vertical playfield bounds, sparse lensing arcs, broader hazard/gate placement, and field-strain edge feedback.

**Tech Stack:** TypeScript, Vite, Three.js, DOM/HUD overlays, Playwright/browser screenshots for QA.

---

### Task 1: Playfield Constants And Bounds

**Files:**
- Modify: `photon/src/constants.ts`
- Modify: `photon/src/photon.ts`
- Modify: `photon/src/hud.ts`

- [x] Add `PLAYFIELD_HALF_WIDTH` and `PLAYFIELD_HALF_HEIGHT` constants next to `TUBE_RADIUS`.
- [x] Replace circular player clamping with rectangular/elliptical field clamping.
- [x] Keep existing internal `railScrapeTime` state for compatibility, but change user-facing text to `FIELD STRAIN`.
- [x] Run `npm run typecheck`.

### Task 2: Route Visuals

**Files:**
- Modify: `photon/src/track.ts`
- Modify: `photon/src/constants.ts`

- [x] Turn full rings into sparse partial arcs.
- [x] Widen dust/star-flow placement to the new playfield bounds.
- [x] Keep rings present as route/lensing cues, not as the dominant course wall.
- [x] Run `npm run typecheck`.

### Task 3: Hazard And Racing-Line Placement

**Files:**
- Modify: `photon/src/hazards.ts`
- Modify: `photon/src/racing.ts`

- [x] Spawn hazards and pickups across the wider open field.
- [x] Retune event-horizon/front-facing hazards so they do not fill the whole screen.
- [x] Make gates and pads route through open space using broader deterministic curves.
- [x] Run `npm run typecheck`.

### Task 4: Camera Framing

**Files:**
- Modify: `photon/src/game.ts`
- Modify: `photon/src/scene.ts`

- [x] Widen the default camera feel enough that the player visibly moves across the screen.
- [x] Reduce camera lateral/vertical follow so the playfield reads as the whole viewport, not always player-centered.
- [x] Keep HUD and overlays in DOM/canvas.
- [x] Run `npm run typecheck`.

### Task 5: Build, Artifact, Playtest

**Files:**
- Modify generated: `photon-racer-v2.html`
- Read/verify: `photon/dist/index.html`

- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Copy `photon/dist/index.html` to `photon-racer-v2.html`.
- [x] Confirm `cmp -s photon/dist/index.html photon-racer-v2.html`.
- [x] Capture desktop and mobile screenshots with browser playtest.
- [x] Report any remaining playfield/HUD readability issues by severity.

---

### Self-Review

- Spec coverage: constants/bounds, route visuals, hazards/gates/pads, camera, edge feedback, artifact refresh, and playtest are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: plan preserves existing state names except user-facing field-strain copy.

### Execution Checkpoints

- [x] Architecture subagent callback: no blockers.
- [x] QA subagent callback: no blockers after current pause/settings capture.
- [x] Screenshot pixel checks: desktop and mobile run captures are nonblank.
