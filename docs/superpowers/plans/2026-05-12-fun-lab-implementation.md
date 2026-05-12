# Fun Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Photon's local Fun Lab so runs can be measured, rated, explained, and converted into human-readable tuning recommendations.

**Architecture:** Keep Fun Lab beside the core racing runtime. Add a focused `photon/src/funlab/` module set for event collection, summaries, scoring, storage, recommendations, and fixtures; wire gameplay events into the collector; add in-game DOM layers for the optional post-run vibe check and designer-facing dashboard. Do not implement auto-tuning in this pass.

**Tech Stack:** TypeScript, Vite, Three.js, DOM overlays, localStorage, Vitest for deterministic model fixtures, Playwright/browser screenshots for UI verification.

---

## File Structure

- Create: `photon/src/funlab/types.ts`  
  Owns all Fun Lab data contracts.
- Create: `photon/src/funlab/model.ts`  
  Converts raw events into summaries, fingerprints, trust, and recommendations.
- Create: `photon/src/funlab/storage.ts`  
  Resilient local run history persistence and export helpers.
- Create: `photon/src/funlab/runtime.ts`  
  Runtime singleton used by gameplay code to record events and finalize runs.
- Create: `photon/src/funlab/ui.ts`  
  DOM helpers for vibe check and Fun Lab dashboard.
- Create: `photon/src/funlab/model.test.ts`  
  Deterministic scoring/trust/recommendation fixtures.
- Modify: `photon/package.json`, `photon/package-lock.json`  
  Add `test` script and Vitest dev dependency.
- Modify: `photon/src/state.ts`  
  Add `funlab` and `vibe` states.
- Modify: `photon/index.html`  
  Add title/pause `Fun Lab` buttons, vibe layer, and lab layer.
- Modify: `photon/src/style.css`  
  Add compact controls for ratings, fingerprints, timelines, and recommendation cards.
- Modify: `photon/src/ui.ts`  
  Bind Fun Lab buttons, vibe submission, skip, export, clear, and dashboard refresh.
- Modify: `photon/src/game.ts`, `photon/src/photon.ts`, `photon/src/hazards.ts`, `photon/src/racing.ts`  
  Record run events at natural gameplay seams.
- Modify generated: `photon-racer-v2.html`  
  Refresh bundled output after build.
- Create: `.gitignore`, `index.html`  
  Prepare the new git repo and GitHub Pages root.

---

### Task 1: Repository And Test Harness

**Files:**
- Create: `.gitignore`
- Create: `index.html`
- Modify: `photon/package.json`
- Modify: `photon/package-lock.json`

- [x] Add a `.gitignore` that excludes `node_modules`, `.DS_Store`, Playwright scratch files, Superpowers companion scratch files, Vite timestamp files, and transient screenshots while keeping source, docs, and `photon-racer-v2.html` trackable.
- [x] Add root `index.html` that redirects/links to `photon-racer-v2.html` for GitHub Pages publishing.
- [x] Run `npm install -D vitest` in `photon/`.
- [x] Add `"test": "vitest run"` to `photon/package.json`.
- [x] Run `npm run typecheck` and `npm test` to establish the harness.

### Task 2: Fun Lab Model And Fixtures

**Files:**
- Create: `photon/src/funlab/types.ts`
- Create: `photon/src/funlab/model.ts`
- Create: `photon/src/funlab/model.test.ts`

- [x] Define event, summary, vibe rating, fingerprint, trust, and recommendation types.
- [x] Implement `summarizeRun(events)` for duration, epoch, speed, gate, pad, near-miss, damage, boredom, field-strain, and death metrics.
- [x] Implement `scoreRun(summary, vibe?)` for dopamine, flow, one-more-run, frustration, readability, overall Fun Index, and trust.
- [x] Implement `recommend(summary, fingerprint)` with the v1 recommendation categories from the spec.
- [x] Add deterministic fixtures for high dopamine, high flow, high frustration, boredom, unreadable traces, agreement, disagreement, and missing vibe.
- [x] Run `npm test` and `npm run typecheck`.

### Task 3: Runtime Collector And Storage

**Files:**
- Create: `photon/src/funlab/storage.ts`
- Create: `photon/src/funlab/runtime.ts`
- Modify: `photon/src/state.ts`

- [x] Add bounded localStorage history under a new Fun Lab key.
- [x] Add export and clear helpers for run history.
- [x] Add `funLab.startRun`, `funLab.record`, `funLab.finishRun`, `funLab.attachVibe`, and query helpers.
- [x] Add `funlab` and `vibe` to `GameStateName`.
- [x] Ensure storage failures are swallowed and gameplay continues.
- [x] Run `npm test` and `npm run typecheck`.

### Task 4: Gameplay Event Wiring

**Files:**
- Modify: `photon/src/game.ts`
- Modify: `photon/src/photon.ts`
- Modify: `photon/src/hazards.ts`
- Modify: `photon/src/racing.ts`

- [x] Record run start, run end, death, quit, restart, epoch enter, and upgrade selection.
- [x] Record gate hit, gate miss, speed-pad hit, speed chain break, boost start/end, field-strain peak, and field-strain recovery.
- [x] Record hazard near miss, hazard hit, phase-through, damage, pickup, and recovery after damage.
- [x] Keep events lightweight; do not allocate per-frame except for small threshold transitions.
- [x] Run `npm test` and `npm run typecheck`.

### Task 5: Vibe Check UI

**Files:**
- Modify: `photon/index.html`
- Modify: `photon/src/style.css`
- Modify: `photon/src/ui.ts`
- Modify: `photon/src/game.ts`

- [x] Add a skippable `vibe` layer after selected completed/death runs.
- [x] Add four 1-5 controls: fun, flow, frustration, one-more-run.
- [x] Add optional note input, submit button, and skip button.
- [x] Ensure immediate replay remains available and upgrade selection is never interrupted.
- [x] Back off if the player repeatedly skips.
- [x] Run browser check on desktop and mobile.

### Task 6: Fun Lab Dashboard UI

**Files:**
- Modify: `photon/index.html`
- Modify: `photon/src/style.css`
- Modify: `photon/src/ui.ts`
- Create: `photon/src/funlab/ui.ts`

- [x] Add `Fun Lab` buttons to title and pause panels.
- [x] Add an in-game `funlab` layer matching Photon panel style.
- [x] Show recent runs, selected run fingerprint, event timeline, vibe response, recommendation queue, trust, uncertainty, export, clear, and back actions.
- [x] Keep dashboard readable on desktop and mobile.
- [x] Run browser check on desktop and mobile.

### Task 7: Build Artifact And Publish Prep

**Files:**
- Modify generated: `photon-racer-v2.html`
- Read/verify: `photon/dist/index.html`

- [x] Run `npm test`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Copy `photon/dist/index.html` to `photon-racer-v2.html`.
- [x] Confirm `cmp -s photon/dist/index.html photon-racer-v2.html`.
- [x] Capture browser screenshots for title, vibe check, Fun Lab dashboard, and a run.

### Task 8: Git Repo, Commit, Push, Publish

**Files:**
- All intentional project files.

- [ ] Initialize git with `main` as the default branch.
- [ ] Confirm ignored files do not include source/docs/artifact and do exclude dependencies/scratch files.
- [ ] Commit implementation and source docs.
- [ ] Create or reuse `dhasakgbb/DarkMatter` on GitHub.
- [ ] Push `main`.
- [ ] Enable GitHub Pages from the `main` branch root.
- [ ] Verify the published Pages URL responds or report the propagation status.

---

## Self-Review

- Spec coverage: event collection, summaries, vibe checks, fun fingerprint, trust, recommendation cards, dashboard, local storage, failure handling, tests, and future auto-tuning boundary are covered.
- Placeholder scan: no implementation placeholders remain in the plan.
- Type consistency: plan consistently uses `FunRunEvent`, `FunRunSummary`, `VibeRating`, `FunFingerprint`, `TuningRecommendation`, `funlab`, and `vibe`.
- Scope check: auto-tuning remains explicitly out of scope for v1.
