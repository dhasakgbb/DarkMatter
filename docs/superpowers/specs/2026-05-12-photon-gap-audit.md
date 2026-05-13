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

## Summary

_To be filled in by Task 11 after all rows are recorded._
