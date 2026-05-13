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

## Summary

_To be filled in by Task 11 after all rows are recorded._
