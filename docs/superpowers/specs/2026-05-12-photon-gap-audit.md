# Photon Spec-vs-Shipped Gap Audit

**Date:** 2026-05-12
**Source spec:** [`photon-design.md`](../../../photon-design.md)
**Ratification:** [`2026-05-12-photon-core-loop-ratification.md`](2026-05-12-photon-core-loop-ratification.md)
**Repo head at audit:** `41aea89`
**Scope:** read-only. No gameplay code is modified. Each row below cites file:line evidence.

## How to read this

Each row is one concrete claim from `photon-design.md` checked against `photon/src/`. Status values:
- `shipped` — claim is implemented and matches the design-doc numbers/behavior.
- `partial` — implemented but diverges from the design doc in a specific, named way.
- `missing` — no implementation found.
- `unverifiable` — would require a runtime playtest to confirm; static read is insufficient.

`Pillar impact` ranks how much a gap on this row degrades the named pillar(s). Fix size is the engineer's estimate of what closing the gap would cost.

## Findings

| Claim | Section | Status | Evidence | Pillar | Pillar impact | Fix size | Notes |
|---|---|---|---|---|---|---|---|
| Nebula shader fades to near-black over first 90 seconds | The signature scene | partial | `photon/src/game.ts:208-211` | 1 | medium | XS | Linear `visFade = clamp(1 - t/90, 0.05, 1)` drives `skyMat.uMix` from 0.6 to floor 0.03 reached at t=85.5s — floor 0.05 (not 0) likely intentional for readability but diverges from "near-black" target. |
| Stars dim to 30% then 15% then 5% then off | The signature scene | partial | `photon/src/game.ts:208,210` | 1 | medium | S | `starMat.uOpacity = 0.9 * visFade` is a continuous linear ramp from 0.9 to floor 0.045 over 85.5s — no 30/15/5/0 staircase, and never reaches 0 (floor 0.05 on visFade). |
| Tunnel rings dim and slow their shimmer rate during Heat Death | The signature scene | missing | `photon/src/track.ts:198-199`; no `isHeatDeath` refs in `track.ts` | 1 | medium | S | Ring opacity uses `(0.055 + 0.255*t*farFade) * shimmer` with shimmer frequencies 2.7 and 7.3 Hz hardcoded — no epoch gating, so rings shimmer identically during Heat Death as in earlier epochs. |
| HUD shrinks during Heat Death: distance and combo fade out, only wavelength selector and energy bar remain | The signature scene | missing | `photon/src/hud.ts:100-110`; distance drawn unconditionally at line 91, no `isHeatDeath` gate on combo/distance | 1+2 | high | M | Heat Death branch only adds a micro-text overlay (lines 100-110); distance counter, cosmic-time label, boost bar, and combo display all render unchanged — no shrink, fade, or hide logic tied to `e.isHeatDeath`. |
| Drone fades to a single low sine wave at 40 Hz | The signature scene | partial | `photon/src/procedural.ts:267-269` | 1 | medium | XS | `startHeatDeath` layers three sines (36 Hz + 36.7 Hz detuned sub + 144 Hz ghost) through a 110 Hz lowpass — neither single nor at the spec'd 40 Hz; close in spirit but the frequency and voice count both miss the design contract. |
| Drone fades over the final two minutes | The signature scene | partial | `photon/src/procedural.ts:283-287` | 1 | medium | S | Gain envelope ramps 0→0.22 over 8s, decays to 0.12 at t+240s, then to 0 at t+360s; the fade-to-silence spans the last ~120s of a 6-minute profile but is tied to absolute audio-context time, not Heat Death epoch progress, so alignment with the in-game "final two minutes" is incidental and unverified. |
| Engine hum stays on but softens during Heat Death | The signature scene | missing | `photon/src/procedural.ts:306-377`; `photon/src/audio.ts:411-432`; no `heatDeath` refs in engine paths | 1 | medium | S | Neither `startEngine`/`updateEngine` (procedural) nor `startAssetEngineLoop` (asset path) observe Heat Death state — engine gain and filter cutoff continue to track speed/boost only, with no softening hook fired from `startHeatDeath`. |
| No SFX except the player's own boost during Heat Death | The signature scene | missing | `photon/src/audio.ts:234-408`; no `isHeatDeath` gate in `playSfx` or per-cue dispatchers | 1 | high | S | `playSfx` and all cue methods (`pickup`, `lineGate`, `gateMiss`, `railScrape`, `hit`, `shift`, `witnessChime`, `memoryUnlock`, UI cues) fire unconditionally; nothing suppresses non-boost SFX when `startHeatDeath` is active, so the silence-except-boost rule is unenforced. |
| Studio-music path: authored Heat Death track fades appropriately | The signature scene | unverifiable | `photon/src/audio.ts:343-357` `startHeatDeath()` branch; studio-music call at line 353 when `useProcedural = false` | 1 | medium | S | Procedural drone path coverage is partial/missing per rows above; the studio-music branch requires runtime playtest to verify the authored Heat Death track exists, loads, and respects the 2-minute final-fade contract from the design doc. |
| Final pickup at minute 5 grants a memory called 'The last photon' | The signature scene | shipped | `photon/src/game.ts:217-220`; `photon/src/hazards.ts:414-419`; `photon/src/witness.ts:36-40`; `photon/src/cosmology.ts:232-235` | 1+2 | high | XS | `spawnFinalPickup` fires at `epochTimer >= 300` (5 min into Heat Death); collecting it calls `triggerWitness()`, which increments `meta.witnessedHeatDeath` and calls `checkMemoryTriggers()`, unlocking the `last-photon` memory whose `when: { witnessed: 1 }` threshold and body ("The last light is not brave. It is only still moving.") match the design contract. |
| After collecting it, the photon continues for one more minute through total black | The signature scene | missing | `photon/src/hazards.ts:414-419`; `photon/src/witness.ts:32-56` | 1+2 | high | M | `triggerWitness()` fires synchronously on `finalPickup` collision: overlay activates immediately (`overlay.classList.add('on')` at t+0), with no ~60s black-continuation interval where the photon keeps moving through darkness before the ending sequence begins. |
| Then the screen fades to white | The signature scene | partial | `photon/src/style.css:62-64`; `photon/src/witness.ts:46-47` | 1 | medium | XS | Witness overlay opens at `#000` then transitions to `#fafaff` (off-white) via the `.bright` class scheduled at t+1200ms with a 6s `background` transition; functionally a fade-to-near-white, but the missing 1-minute black continuation (row above) means it begins immediately after pickup rather than after a held darkness. |
| Then a single line: 'You have witnessed the universe.' Hold for 10 seconds | The signature scene | partial | `photon/src/witness.ts:48-55`; `photon/index.html:27-30` | 1+2 | high | S | Line text matches verbatim and reveals at t+4500ms, but the sequence then layers a subline at t+6500ms, photon-count tally at t+8000ms, and "Press any key to begin again" hint at t+13000ms (8500ms after the line, not the spec'd 10000ms); there is no enforced 10s solo hold of the single line — additional UI accretes on top of it. |
| Then the credits scroll silently | The signature scene | missing | `photon/index.html:26-30`; `photon/src/witness.ts:58-79` `endWitness()`; no `credits` id/class anywhere in `photon/` | 1 | high | L | No credits element exists in markup, CSS, or witness logic; pressing any key invokes `endWitness()` which strips overlay classes and returns to the title screen — there is no silent scrolling credits sequence after the held line. |

## Summary

_To be filled in by Task 11 after all rows are recorded._
