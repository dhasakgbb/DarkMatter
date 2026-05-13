# Photon Core Loop — Design Ratification & Gap-Audit Handoff

**Date:** 2026-05-12
**Repo head at ratification:** `8dd6a3b` (Restore procedural audio synthesis as default; add wavelength science mastery)
**Scope:** ratification only. No new design surface. Identifies the next planned slice.

## 1. Status

The Photon core gameplay loop — auto-forward photon flight through a procedurally curved tunnel with dual-axis steering, 3-state wavelength phasing, energy/boost resource management, and epoch-based progression toward a Heat Death ending — is hereby ratified as the immutable core design. It is not aspirational. It is substantially implemented in [photon/src/](../../../photon/src/) as of the date above. This document records that fact and hands off the only honest remaining design-adjacent slice: a spec-vs-shipped gap audit.

## 2. Authoritative source

The canonical design document is [docs/design/photon-design.md](../../../docs/design/photon-design.md). Its two pillars — *the run IS the universe* and *the photon remembers* — and its phased roadmap (A–F) are the source of truth for all Photon feature, copy, audio, and tuning decisions.

This ratification adds nothing to that document. It does not re-litigate the pillars, the 30-minute target run length, the non-monotonic difficulty curve, the removal of endless mode, or the Heat Death signature scene. Anyone disagreeing with those decisions edits `docs/design/photon-design.md` directly and proposes a revision; they do not work around them in code.

## 3. Shipped-vs-open snapshot (2026-05-12)

Evidence cited by file:line so a future session can verify quickly.

| Phase | Status | Evidence |
|---|---|---|
| **A — Heat Death PoC** | Shipped | [cosmology.ts:103](../../../photon/src/cosmology.ts#L103) defines Heat Death (360s, `isHeatDeath: true`, sparse hazards). [game.ts:202](../../../photon/src/game.ts#L202) `heatDeathTick` implements the fade. [game.ts:216](../../../photon/src/game.ts#L216) spawns the single final pickup at t=300s. [witness.ts](../../../photon/src/witness.ts) drives the witness ending. [audio.ts:343](../../../photon/src/audio.ts#L343) `startHeatDeath` handles the drone. [audio.ts:401](../../../photon/src/audio.ts#L401) `witnessChime`. Cosmic-time HUD via `cosmicTimeLabel` in [utils.ts](../../../photon/src/utils.ts). |
| **B — Memory system** | Shipped | 33 memory entries defined in [cosmology.ts](../../../photon/src/cosmology.ts) (design called for ~30). All three types (`narrative`, `resonance`, `threshold`) present. Evolved-copy mechanic via `memoryBody` in [memories.ts:8](../../../photon/src/memories.ts#L8). Trigger wiring in [memories.ts:31](../../../photon/src/memories.ts#L31) `checkMemoryTriggers`. Resonance bonuses applied in [memories.ts:66](../../../photon/src/memories.ts#L66). |
| **C — Remaining epochs** | Defined; play-tuning unverified | All 9 epochs declared in [cosmology.ts](../../../photon/src/cosmology.ts) with palette, duration, hazardKinds, and second-person `chapter` strings. Whether each epoch *plays* at the design-doc difficulty curve (Stellar Era as the longest peak, Black Hole Era's thinning emptiness) is the open question for the gap audit. |
| **D — Reframe pass** | Mostly shipped | Per-epoch chapter cards render via [hud.ts:38](../../../photon/src/hud.ts#L38) `showEpochToast` with 5.2s duration when a chapter is present. User-facing combo label is "RESONANCE" at [hud.ts:297](../../../photon/src/hud.ts#L297). Internal identifier `comboMultiplier` is still named "combo" but is not user-visible. Codex + Memories surfaced as **sibling title-screen entry points (`#btn-codex` + `#btn-memories`), not a top-of-panel tab strip** — corrected on 2026-05-12 after the gap audit observed the design-doc "tabs at top" spec is not literally met. Death-panel copy presence not fully verified — listed as an audit item below. |
| **E — Production values** | Partial | Procedural drones + studio-music keys exist (`startStudioMusic`). Per-epoch authored music tracks for Recombination / Stellar / Black Hole / Heat Death, and the hand-tuned shader pass on the heat-death fade described in `docs/design/photon-design.md` §"The signature scene", are not confirmed complete. |
| **F — Telemetry & achievements** | Not shipped | The global "N photons have witnessed the heat death" title-screen counter backed by a server endpoint, and a formal achievement system, were not found by grep on `witness` / `telemetry` / `achievement`. |

## 4. Out of scope

The following are explicitly *not* what the next session should plan or build:

- Any revision to the two pillars or the 30-minute timeline.
- A re-design of Heat Death, the memory system, or the death-panel framing. They exist; they may need polish.
- Re-introducing endless mode in any form.
- New gameplay verbs beyond the four locked in §1 (steer, phase, manage resources, navigate epochs).
- "Dopamine amplifiers" layered on top of the live loop unless the gap audit surfaces a concrete deficit the design doc already calls for.

## 5. Next slice — Spec-vs-shipped gap audit

The only honest design-adjacent work remaining is a careful, evidence-first audit comparing every concrete claim in `docs/design/photon-design.md` against the live behavior in `photon/src/`.

**Deliverable:** A punch-list document under `docs/superpowers/specs/` named `YYYY-MM-DD-photon-gap-audit.md` (dated on the day the audit ships) enumerating each design-doc claim, marking it as `shipped` / `partial` / `missing`, citing file:line evidence, and ranking each gap by leverage on the two pillars.

**Audit targets, non-exhaustive:**

- **Heat Death numerics.** Does the visual fade actually drop stars from 100 → 30 → 15 → 5 → 0% over the first 90s? Does the drone collapse to a single 40Hz sine and then fade across the final two minutes? Is there a 10-second white-hold after "You have witnessed the universe"? Do silent credits scroll after? Cosmic-time HUD reaching "T + 10^100 years" non-linearly?
- **HUD shrink during Heat Death.** Does the distance counter and combo display fade out, leaving only the wavelength selector and energy bar?
- **Non-monotonic difficulty curve.** Do the epoch durations and hazard densities match the spec (Inflation 45s, Quark Plasma 90s, Recombination 90s, First Stars 3m, Galactic 4m, Stellar 6m, Degenerate 3m, Black Hole 4m, Heat Death 6m)? Does Stellar Era actually present the highest hazard density?
- **Death-panel reframe.** Does the panel display "ABSORBED" with the subtitle "You forget. But the universe remembers." and surface up to three memory cards Hades-style?
- **Memory cap.** Is the per-run cap of three memories enforced?
- **Chapter cards.** Does every epoch transition show its `chapter` string?
- **Between-epoch save points.** Can the player quit and resume at the start of any epoch they have reached, with the explicit exception that Heat Death is not chunkable?
- **Variant unlock conditions.** Does each variant's unlock condition match its design-doc Memory-themed framing?
- **Tagline / title-screen copy.** Is "Survive the universe." present?

Each finding is one row: `claim | shipped/partial/missing | evidence (file:line) | pillar impact | suggested fix size`.

## 6. Handoff

After this ratification is approved, invoke the [writing-plans](../../../) skill against §5. The implementation plan it produces should:

- Be read-only and analysis-only (the audit produces findings; it does not modify gameplay code).
- Emit one markdown file under `docs/superpowers/specs/`.
- Treat any subsequent code change to close an audited gap as its own future plan, not bundled into the audit itself.

That keeps each session's scope honest: audit, then plan fixes, then ship fixes — never collapsed into one cycle.
