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
