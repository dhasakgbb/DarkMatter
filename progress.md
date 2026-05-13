Original prompt: 10 more passes [$ralph-marathon](/Users/damian/.codex/skills/ralph-marathon/SKILL.md) [$game-studio:game-playtest](/Users/damian/.codex/plugins/cache/openai-curated/game-studio/1141b764/skills/game-playtest/SKILL.md) [$develop-web-game](/Users/damian/.codex/skills/develop-web-game/SKILL.md)

## Notes

- 2026-05-12: Started Ralph Marathon passes 9-18. Current mission is concrete tech-debt removal plus browser/playtest evidence for Photon.
- Pass 9: Added `window.render_game_to_text` and `window.advanceTime(ms)` in `photon/src/game.ts` so the web-game Playwright client can inspect and deterministically step the game.
- Pass 10: Installed the missing Playwright Chromium runtime for the develop-web-game client and captured a live run state/screenshot through the browser client.
- Pass 11: Hardened keyboard input so game shortcuts do not fire while typing, and added the expected fullscreen toggle on `F`.
- Pass 12: Removed avoidable `Color`/`Vector3` allocations from epoch background, death burst, speed pad, and racing-line particle paths.
- Pass 13: Replaced biased random-sort upgrade choice with bounded Fisher-Yates selection.
- Pass 14: Removed dead endless-mode scaffolding from shared state, hazard spacing, photon speed, and HUD labeling.
- Pass 15: Replayed the browser game through the develop-web-game client after cleanup and confirmed screenshots/text state stayed live with no console error artifact.
- Pass 16: Reused collision/collection particle colors in `hazards.update` instead of allocating fresh `THREE.Color` objects during active play.
- Pass 17: Converted echo trails from clone/unshift arrays to fixed ring buffers and made echo life/maxLife share one roll.
- Pass 18: Ran full `npm run precommit`, rebuilt `photon/dist/index.html`, synced `photon-racer-v2.html`, and smoke-tested the standalone file through the browser client.

## Marathon 2: 30 More Passes

- Pass 1: Established a persistent Playwright baseline against `http://127.0.0.1:5190` with desktop screenshot and `render_game_to_text` run state.
- Pass 2: Hid the boot overlay immediately after dismissal so mobile title screens no longer ghost `Initializing spacetime` through the panel.
- Pass 3: Wrapped tutorial HUD text and moved the mobile tutorial card upward so it no longer crowds bottom controls.
- Pass 4: Added audio mode/engine/drone state to `render_game_to_text` so playtests can prove procedural audio is active.
- Pass 5: Exposed the existing `proceduralAudio` setting in the pause menu and verified the toggle renders on by default.
- Pass 6: Tightened procedural synth cleanup by disconnecting stopped engine nodes and stopping hit noise after the hit envelope.
- Pass 7: Fixed redshift drone pitch handling so control LFO/noise sources are not retuned as audible voices.
- Pass 8: Added a procedural synth regression test proving redshift retunes pitch voices without retuning the LFO.
- Pass 9: Added transient dry/wet send cleanup for procedural one-shot cues to avoid stale connected audio nodes.
- Pass 10: Verified the pause-menu audio toggle can round-trip asset/procedural mode and returns to procedural.
- Pass 11: Sorted `render_game_to_text` nearby hazard and racing entries by distance for stable playtest analysis.
- Pass 12: Added active hazard/racing/echo counts to `render_game_to_text` so spawn-system health is visible in playtests.
- Pass 13: Added viewport size, pixel ratio, and fullscreen state to `render_game_to_text`.
- Pass 14: Added WebGL context-loss/restored handling with a visible graphics recovery overlay.
- Pass 15: Ran a lighter browser-client smoke after the REPL timeout, then passed `npm run lint` and `npm run qa:fast`.
- Pass 16: Rebootstrapped the persistent Playwright REPL session with a shorter desktop-only check.
- Pass 17: Added `sync:standalone` and `build:standalone` scripts, and made `precommit` refresh `photon-racer-v2.html`.
- Pass 18: Updated director-temp audio docs to reflect ProceduralSynth as default and the OGG pack as asset-mode fallback.
- Pass 19: Updated the main audio direction runtime contract and acceptance tests for procedural default plus manifest asset mode.
- Pass 20: Ran the cadence typecheck/lint gate plus whitespace diff check.
- Pass 21: Moved hazard spacing, placement, pickups, movement, and wormhole variation onto the run RNG for seed replay determinism.
- Pass 22: Added numeric run seed and replay label to `render_game_to_text`.
- Pass 23: Added `window.startSeededRun(seed)` for deterministic browser playtest replay.
- Pass 24: Verified same-seed browser replay produces identical nearby hazards, racing objects, and spawn counts after advancing.
- Pass 25: Reset input state at `startRun` so replay and run-again starts cannot inherit held keys.
- Pass 26: Reworked mobile touch input to recompute on touchstart/move/end/cancel through one helper.
- Pass 27: Added bottom-HUD wavelength touch targets and kept their touches out of steering/boost state.
- Pass 28: Made mobile HUD/tutorial prompts teach touch steering, touch wavelength, and two-finger boost.
- Pass 29: Moved wavelength HUD/touch geometry into a shared layout helper so rendering and hit testing stay in sync.
- Pass 30: Ran final precommit/cadence gates, rebuilt and synced `photon-racer-v2.html`, and smoke-tested the standalone file artifact.

## Visual Fidelity Marathon

- Added explicit visual quality tiers (`mobile`, `balanced`, `ultra`) with desktop defaulting to `ultra`, mobile defaulting to `mobile`, and a pause-menu selector wired through persisted settings.
- Centralized render-budget knobs in `photon/src/renderProfile.ts` so scenery density, pixel-ratio caps, bloom, lensing, star fields, cosmic web, track dust, and hazard detail come from one profile helper.
- Rebuilt the visual layer around richer procedural sky detail, parallax star shells, nebula dust volumes, denser cosmic-web depth, stronger track corridor materials, and higher-fidelity hazard silhouettes.
- Browser evidence captured desktop, mobile, Inflationary, Recombination, and Heat Death states with procedural audio still active and `render_game_to_text` counts populated.
