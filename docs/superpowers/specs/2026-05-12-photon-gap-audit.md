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
| HUD shrinks during Heat Death: distance and combo fade out, only wavelength selector and energy bar remain | The signature scene | missing | `photon/src/hud.ts:100-110`; distance drawn unconditionally at line 91, no `isHeatDeath` gate on combo/distance | 1+2 | high | M | Heat Death branch only adds a micro-text overlay (lines 100-110); distance counter, cosmic-time label, boost bar, and combo display all render unchanged — no shrink, fade, or hide logic tied to `e.isHeatDeath`. |
| No SFX except the player's own boost during Heat Death | The signature scene | missing | `photon/src/audio.ts:234-408`; no `isHeatDeath` gate in `playSfx` or per-cue dispatchers | 1 | high | S | `playSfx` and all cue methods (`pickup`, `lineGate`, `gateMiss`, `railScrape`, `hit`, `shift`, `witnessChime`, `memoryUnlock`, UI cues) fire unconditionally; nothing suppresses non-boost SFX when `startHeatDeath` is active, so the silence-except-boost rule is unenforced. |
| After collecting it, the photon continues for one more minute through total black | The signature scene | missing | `photon/src/hazards.ts:414-419`; `photon/src/witness.ts:32-56` | 1+2 | high | M | `triggerWitness()` fires synchronously on `finalPickup` collision: overlay activates immediately (`overlay.classList.add('on')` at t+0), with no ~60s black-continuation interval where the photon keeps moving through darkness before the ending sequence begins. |
| Then the credits scroll silently | The signature scene | missing | `photon/index.html:26-30`; `photon/src/witness.ts:58-79` `endWitness()`; no `credits` id/class anywhere in `photon/` | 1 | high | L | No credits element exists in markup, CSS, or witness logic; pressing any key invokes `endWitness()` which strips overlay classes and returns to the title screen — there is no silent scrolling credits sequence after the held line. |
| The Heat Death epoch is not skippable and not chunkable | Risks and tradeoffs | missing | `photon/src/game.ts:143-159`; `photon/src/cosmology.ts:109` | 1+2 | high | XS | `saveCheckpoint()` is called unconditionally on every `enterEpoch()` (game.ts:143-144) with no `e.isHeatDeath` guard; the Heat Death epoch (cosmology.ts:109 `isHeatDeath: true`) writes a checkpoint at `epochIndex: 8` on entry just like every other epoch. `loadCheckpoint`/`startRun` likewise have no Heat Death exclusion (game.ts:308 accepts any `epochIndex < EPOCHS.length`), so a player who reaches Heat Death and quits can resume directly into it — bypassing the design-doc rule that Heat Death must be experienced as one unbroken 6-minute sit. No code path enforces "not skippable and not chunkable." This is a Pillar 1 enforcement gap, not polish — resuming directly into Heat Death bypasses the design's 6-minute unbroken signature-scene contract (photon-design.md §'The signature scene'). |
| Tunnel rings dim and slow their shimmer rate during Heat Death | The signature scene | missing | `photon/src/track.ts:198-199`; no `isHeatDeath` refs in `track.ts` | 1 | medium | S | Ring opacity uses `(0.055 + 0.255*t*farFade) * shimmer` with shimmer frequencies 2.7 and 7.3 Hz hardcoded — no epoch gating, so rings shimmer identically during Heat Death as in earlier epochs. |
| Engine hum stays on but softens during Heat Death | The signature scene | missing | `photon/src/procedural.ts:306-377`; `photon/src/audio.ts:411-432`; no `heatDeath` refs in engine paths | 1 | medium | S | Neither `startEngine`/`updateEngine` (procedural) nor `startAssetEngineLoop` (asset path) observe Heat Death state — engine gain and filter cutoff continue to track speed/boost only, with no softening hook fired from `startHeatDeath`. |
| Variant `xray` (X-ray) has a Memory-themed unlock condition | Pillar 2 | missing | `photon/src/cosmology.ts:336` | 2 | medium | XS | `unlockReq: "Reach the Stellar era"` — purely mechanical era-threshold framing; no witnessing/remembering/memory language. Needs rethread, e.g., "Remember the first stars." |
| Title screen shows global aggregate of photons-witnessed-heat-death across all players | Pillar 1 | missing | `photon/src/ui.ts:22-29`; `photon/src/meta.ts:14,41` | 1 | low | M | No server, no global counter — `witnessedHeatDeath` is local-only in `localStorage`. Design doc explicitly notes "a localStorage int now, server count later" so this is a known-deferred future-server gap, not a regression. |
| Then a single line: 'You have witnessed the universe.' Hold for 10 seconds | The signature scene | partial | `photon/src/witness.ts:48-55`; `photon/index.html:27-30` | 1+2 | high | S | Line text matches verbatim and reveals at t+4500ms, but the sequence then layers a subline at t+6500ms, photon-count tally at t+8000ms, and "Press any key to begin again" hint at t+13000ms (8500ms after the line, not the spec'd 10000ms); there is no enforced 10s solo hold of the single line — additional UI accretes on top of it. |
| Quark Plasma duration = 90s | Pillar 1 | partial | `photon/src/cosmology.ts:40` | 1 | high | XS | Design target 90s; live value 40s — −50s drift (~56% short, more than halved). |
| Recombination duration = 90s | Pillar 1 | partial | `photon/src/cosmology.ts:49` | 1 | high | XS | Design target 90s; live value 50s — −40s drift (~44% short). Early-universe pacing is materially compressed; combined with Quark Plasma (−56%) and Inflation (−22%), the first ~270s of the design is delivered in ~125s, breaking the design-doc's onboarding pacing arc. |
| Nebula shader fades to near-black over first 90 seconds | The signature scene | partial | `photon/src/game.ts:208-211` | 1 | medium | XS | Linear `visFade = clamp(1 - t/90, 0.05, 1)` drives `skyMat.uMix` from 0.6 to floor 0.03 reached at t=85.5s — floor 0.05 (not 0) likely intentional for readability but diverges from "near-black" target. |
| Stars dim to 30% then 15% then 5% then off | The signature scene | partial | `photon/src/game.ts:208,210` | 1 | medium | S | `starMat.uOpacity = 0.9 * visFade` is a continuous linear ramp from 0.9 to floor 0.045 over 85.5s — no 30/15/5/0 staircase, and never reaches 0 (floor 0.05 on visFade). |
| Drone fades to a single low sine wave at 40 Hz | The signature scene | partial | `photon/src/procedural.ts:267-269` | 1 | medium | XS | `startHeatDeath` layers three sines (36 Hz + 36.7 Hz detuned sub + 144 Hz ghost) through a 110 Hz lowpass — neither single nor at the spec'd 40 Hz; close in spirit but the frequency and voice count both miss the design contract. |
| Drone fades over the final two minutes | The signature scene | partial | `photon/src/procedural.ts:283-287` | 1 | medium | S | Gain envelope ramps 0→0.22 over 8s, decays to 0.12 at t+240s, then to 0 at t+360s; the fade-to-silence spans the last ~120s of a 6-minute profile but is tied to absolute audio-context time, not Heat Death epoch progress, so alignment with the in-game "final two minutes" is incidental and unverified. |
| Then the screen fades to white | The signature scene | partial | `photon/src/style.css:62-64`; `photon/src/witness.ts:46-47` | 1 | medium | XS | Witness overlay opens at `#000` then transitions to `#fafaff` (off-white) via the `.bright` class scheduled at t+1200ms with a 6s `background` transition; functionally a fade-to-near-white, but the missing 1-minute black continuation (row above) means it begins immediately after pickup rather than after a held darkness. |
| Cosmic time accelerates to 'T + 100 quintillion years', 'T + 10^100 years', etc. | The signature scene | partial | `photon/src/utils.ts:27,38-39` | 1 | medium | XS | Heat Death epoch produces `T + 10¹⁴ years` → `T + 10¹⁰⁰ years` (matches "T + 10^100 years" spec verbatim at f=1.0). However "T + 100 quintillion years" = 10²⁰ years falls in a gap: Degenerate caps at 10¹⁶ years and Black Hole starts at 10³⁰ years, so the label jumps from 10¹⁶ → 10³⁰ → 10¹⁴ (Heat Death restart) with no 10¹⁷..10²⁹ intermediate values ever displayed. The labels-stop-meaning-anything effect is achieved at the 10¹⁰⁰ extreme but the smooth quintillions→googol acceleration sketched in the design doc is not produced. |
| Inflation duration = 45s | Pillar 1 | partial | `photon/src/cosmology.ts:31` | 1 | medium | XS | Design target 45s; live value 35s — −10s drift (~22% short). |
| New memory cards displayed like Hades' boon UI on the death screen | Pillar 2 | partial | `photon/src/game.ts:395-412`; `photon/index.html:65` | 2 | medium | S | `#death-memories` is populated with one card per new memory: type-colored left border tint (`#ff7ad9` threshold / `#88e0ff` resonance / muted white), uppercase type label, italic body, translucent background — boon-flavored but minimal compared to Hades' framed/iconified cards; no icon, frame, or rarity flourish. |
| Cap of three memories per single run to keep them special | Pillar 2 | partial | `photon/src/memories.ts:13-28`; `photon/src/game.ts:397` | 2 | medium | S | Death-screen render caps display at `.slice(0, 3)` (game.ts:397), but `unlockMemory` and `checkMemoryTriggers` enforce no per-run cap — every triggered memory is committed to `meta.memories` and pushed to `game.newMemoriesThisRun`, so 4+ unlocks in one run silently persist while only the first 3 surface on the death panel. |
| Codex panel has a sister 'Memories' panel with the same UI grammar; tabs Codex / Memories at top | Pillar 2 | partial | `photon/index.html:44-45,81-94`; `photon/src/ui.ts:157-160` | 2 | medium | S | Both panels exist as siblings — `#codex` and `#memories` share the same `.layer` class, identical inner `.codex-list` markup, and matching Back buttons — and `#btn-codex` / `#btn-memories` buttons sit together on the title screen (index.html:44-45). However the entry points are title-screen buttons, not a Codex/Memories tab strip at the top of a unified panel: switching from one to the other requires returning to the title via Back, rather than toggling tabs in-place. UI grammar matches; tabbed navigation does not. |
| First Stars duration = 180s | Pillar 1 | partial | `photon/src/cosmology.ts:58` | 1 | low | XS | Design target 180s; live value 190s — +10s drift (~5% long). |
| Galactic Era duration = 240s | Pillar 1 | partial | `photon/src/cosmology.ts:67` | 1 | low | XS | Design target 240s; live value 230s — −10s drift (~4% short). |
| Degenerate Era duration = 180s | Pillar 1 | partial | `photon/src/cosmology.ts:85` | 1 | low | XS | Design target 180s; live value 200s — +20s drift (~11% long). |
| Tagline "Survive the universe." appears on title screen | Marketing positioning | partial | `photon/index.html:36` | 2 | low | XS | Title screen renders `<h2>Survive the universe</h2>` verbatim — copy matches except the trailing period from the design doc is omitted. Cosmetic punctuation drift only. |
| Difficulty is non-monotonic: rises through Galactic, peaks in Stellar, falls through Black Hole | Pillar 1 | unverifiable | `photon/src/cosmology.ts:37,46,55,64,73,82,91,100,109`; `photon/src/hazards.ts:229` | 1 | high | M | `hazardKinds` list lengths per epoch — Inflation 2, Quark 3, Recombination 3, First Stars 4, Galactic 4, Stellar 5, Degenerate 3, Black Hole 3, Heat Death 1 — are consistent with a rise-peak-fall shape peaking in Stellar, but no per-epoch spawn-rate, density, or interval constants exist in `cosmology.ts` or `hazards.ts` (only `hazardKinds` arrays drive variety, not frequency). Actual hazards-per-second calibration and perceived difficulty curve are not statically verifiable; requires playtest instrumentation.
| Studio-music path: authored Heat Death track fades appropriately | The signature scene | unverifiable | `photon/src/audio.ts:343-357` `startHeatDeath()` branch; studio-music call at line 353 when `useProcedural = false` | 1 | medium | S | Procedural drone path coverage is partial/missing per rows above; the studio-music branch requires runtime playtest to verify the authored Heat Death track exists, loads, and respects the 2-minute final-fade contract from the design doc. |
| Final pickup at minute 5 grants a memory called 'The last photon' | The signature scene | shipped | `photon/src/game.ts:217-220`; `photon/src/hazards.ts:414-419`; `photon/src/witness.ts:36-40`; `photon/src/cosmology.ts:232-235` | 1+2 | high | XS | `spawnFinalPickup` fires at `epochTimer >= 300` (5 min into Heat Death); collecting it calls `triggerWitness()`, which increments `meta.witnessedHeatDeath` and calls `checkMemoryTriggers()`, unlocking the `last-photon` memory whose `when: { witnessed: 1 }` threshold and body ("The last light is not brave. It is only still moving.") match the design contract. |
| Cosmic time HUD overlay on right side, scaling non-linearly with epoch | Pillar 1 | shipped | `photon/src/hud.ts:111,121-125`; `photon/src/utils.ts:21-42` | 1 | high | XS | `cosmicTimeLabel()` is rendered right-aligned (`hud.textAlign = 'right'`, x = `w - 20`, y=100) below a "COSMIC TIME" caption; per-epoch mapping is non-linear across orders of magnitude — Inflationary `T + 10⁻³²..10⁻⁶ sec`, Quark Plasma `T + 10⁻⁶ sec` → `T + 1.00 sec`, Recombination fixed `T + 380,000 years`, First Stars `T + 150..1000 million years`, Galactic `T + 1.0..5.0 billion years`, Stellar `T + 5.0..100.0 billion years`, Degenerate `T + 10¹²..10¹⁶ years`, Black Hole `T + 10³⁰..10⁴⁰ years`, Heat Death `T + 10¹⁴..10¹⁰⁰ years`. The "T + 4.7 billion years" example from the design doc falls inside the Galactic range. |
| Subtitle 'You forget. But the universe remembers.' appears underneath the heading | Pillar 2 | shipped | `photon/index.html:63` | 2 | high | XS | A dedicated `<p>` under the heading renders the line verbatim with letter-spacing 0.2em uppercase styling, sitting above the run stats and the memories block exactly as the design specifies. |
| Each epoch transition shows a chapter card with the cosmological event in plain language | Pillar 1 | shipped | `photon/index.html:24`; `photon/src/hud.ts:65-73` | 1 | high | XS | `showEpochToast(num, name, sub, chapter?)` writes the `chapter` string into `#epoch-chapter` and extends the toast duration to 5200ms when a chapter is present (2400ms otherwise). Chapter copy is sourced per-epoch from `EPOCHS[*].chapter` in `cosmology.ts` and fired on every epoch advance, matching the design's "5.2s plain-language card" contract. |
| Title screen shows personal photons-witnessed-heat-death count | Pillar 1 | shipped | `photon/src/ui.ts:22-29`; `photon/src/meta.ts:14,41` | 1 | medium | XS | `refreshTitleStats()` writes a stat row `['Witnessed the end', '${meta.witnessedHeatDeath \|\| 0}×']` into `#title-stats` (index.html:38). `witnessedHeatDeath` is an int persisted in `localStorage` via the meta save. Label phrasing differs from the design's "N photons have witnessed the heat death" — uses second-person/personal `Witnessed the end Nx` rather than the third-person plural "N photons have…" copy. |
| Stellar Era duration = 360s | Pillar 1 | shipped | `photon/src/cosmology.ts:76` | 1 | low | XS | Design target 360s; live value 360s — exact match. |
| Black Hole Era duration = 240s | Pillar 1 | shipped | `photon/src/cosmology.ts:94` | 1 | low | XS | Design target 240s; live value 240s — exact match. |
| Heat Death duration = 360s | Pillar 1 | shipped | `photon/src/cosmology.ts:103` | 1 | low | XS | Design target 360s; live value 360s — exact match. |
| Death panel heading still reads 'ABSORBED' | Pillar 2 | shipped | `photon/index.html:60` | 2 | low | XS | Death layer's `<h1>` renders `A B S O R B E D` (spaced for letter-spacing styling), preserving the original absorption framing verbatim per the design contract. |
| Upgrade headers reframed from stat-mechanical to second-person sensory voice | Pillar 2 | shipped | `photon/src/cosmology.ts:310-316`; `photon/src/game.ts:442` | 2 | low | XS | Live upgrade card names + descriptions are sensory/second-person, not stat-mechanical. Verbatim live strings: `"Faster" — "The void resists you less. +8% forward speed."`; `"Sharper" — "Curves want you. +12% lateral acceleration."`; `"Tougher" — "Hazards forget you sooner. −12% damage taken."`. Names are single sensory adjectives (Faster/Sharper/Wider/Tougher/Hungrier/Forgiveness) rather than "Top velocity"/"Energy capacity", and descriptions lead with flavor then append the +N% number, exactly matching the design's "You feel faster. The void resists less. Same +8% speed, more flavor." reframe. |
| User-facing combo label reads 'RESONANCE' (internal identifiers may still say 'combo') | Phase D | shipped | `photon/src/hud.ts:8,310-326` | 2 | low | XS | `hud.fillText('RESONANCE', 0, 16)` at hud.ts:326 renders the user-facing label literally as `RESONANCE`; internal symbols `comboMultiplier`, `comboProject`, and the `streak` → `mult` pipeline retain the "combo" name in code, matching the ratification doc's contract of player-facing rename without code-level churn. |
| Between-epoch save points: player can quit and resume at the start of any epoch they've reached | Risks and tradeoffs | shipped | `photon/src/meta.ts:67-91`; `photon/src/game.ts:143-159`; `photon/src/ui.ts:38-45,142-143` | 1+2 | low | XS | `Checkpoint` interface (epochIndex, runEnergy, energy, boost, wavelength, variant, runSeed, startTimeOffset, savedAt, epochName) is persisted to `localStorage` via `saveCheckpoint()` inside `enterEpoch()` on every epoch transition (game.ts:144). Title screen reads `loadCheckpoint()` and exposes a `↶ Resume from <epoch name>` button (ui.ts:38-45) whose handler invokes `startRun(cp)` (ui.ts:143); `startRun` honors `resumeSnapshot.epochIndex`, `runSeed`, `variant`, `energy`, `boost`, `wavelength`, and `startTimeOffset` (game.ts:244-323). Resume is true between-epoch granularity, not mid-epoch. |
| Variant `visible` (Visible) has a Memory-themed unlock condition | Pillar 2 | shipped | `photon/src/cosmology.ts:333` | 2 | low | XS | Default form, unlocked from the start (`unlocked: true`); no unlock condition required, so vacuously satisfies the "Memory-themed condition" contract by needing none. No `unlockReq` string. |
| Variant `gamma` (Gamma) has a Memory-themed unlock condition | Pillar 2 | shipped | `photon/src/cosmology.ts:334` | 2 | low | XS | `unlockReq: "A memory unlocks this"` — explicitly references the Memory system as the gating mechanism; player-facing copy is Memory-themed verbatim. |
| Variant `microwave` (Microwave) has a Memory-themed unlock condition | Pillar 2 | shipped | `photon/src/cosmology.ts:335` | 2 | low | XS | `unlockReq: "Witness the heat death once"` — uses "Witness" framing tied directly to the Pillar 1 witness-the-end loop; Memory-themed language present. |

## Summary

Total claims audited: **43**
- shipped: 15
- partial: 17
- missing: 9
- unverifiable: 2

### Highest-leverage gaps

_Rows where pillar impact is high and status is not shipped. Address these first when planning fix work._

| Claim | Notes (one-line) |
|---|---|
| HUD shrinks during Heat Death: distance and combo fade out, only wavelength selector and energy bar remain | Heat Death branch only adds a micro-text overlay; distance, cosmic time, boost, and combo render unchanged with no `isHeatDeath` gate. |
| No SFX except the player's own boost during Heat Death | `playSfx` and all cue dispatchers fire unconditionally; no `isHeatDeath` gate suppresses non-boost cues during the signature scene. |
| After collecting the final pickup, the photon continues for one more minute through total black | `triggerWitness()` activates the overlay synchronously at t+0 with no ~60s held-darkness continuation before the ending sequence. |
| Then the credits scroll silently | No credits element exists in markup, CSS, or witness logic; `endWitness()` returns straight to the title screen. |
| The Heat Death epoch is not skippable and not chunkable | `saveCheckpoint()` runs on every `enterEpoch()` with no `isHeatDeath` guard, so players can quit and resume directly into Heat Death. |
| Then a single line: 'You have witnessed the universe.' Hold for 10 seconds | Line text matches but subline (t+6.5s), photon tally (t+8s), and restart hint (t+13s) layer on top — no enforced 10s solo hold. |
| Quark Plasma duration = 90s | Design target 90s; live value 40s — −50s drift (~56% short, more than halved). |
| Recombination duration = 90s | Design target 90s; live value 50s — −40s drift (~44% short); compounds with Inflation/Quark to deliver first ~270s in ~125s. |

### Quick wins

_Rows with fix size XS or S that close real gaps. Candidates for the first fix-planning session._

| Claim | Fix size | Notes (one-line) |
|---|---|---|
| The Heat Death epoch is not skippable and not chunkable | XS | Add `if (e.isHeatDeath) return` guard in `saveCheckpoint()` call and exclude epochIndex 8 from `loadCheckpoint`/`startRun` resume path. |
| Quark Plasma duration = 90s | XS | Bump `cosmology.ts:40` from 40s → 90s. |
| Recombination duration = 90s | XS | Bump `cosmology.ts:49` from 50s → 90s. |
| Tunnel rings dim and slow their shimmer rate during Heat Death | S | Add `isHeatDeath` gate to ring opacity/shimmer in `track.ts:198-199`. |
| Engine hum stays on but softens during Heat Death | S | Wire `startHeatDeath` to drop engine gain/cutoff in `procedural.ts` and `audio.ts` engine paths. |
| No SFX except the player's own boost during Heat Death | S | Add `isHeatDeath` gate in `playSfx` to suppress non-boost cues. |
| Variant `xray` has a Memory-themed unlock condition | XS | Rewrite `unlockReq` at `cosmology.ts:336` from "Reach the Stellar era" to witnessing/memory framing. |
| Nebula shader fades to near-black over first 90 seconds | XS | Lower `visFade` floor in `game.ts:208-211` from 0.05 toward 0 for true near-black. |
| Stars dim to 30% then 15% then 5% then off | S | Replace continuous linear ramp with a 30/15/5/0 staircase tied to Heat Death progress. |
| Drone fades to a single low sine wave at 40 Hz | XS | Reduce `startHeatDeath` voices to one sine at 40 Hz in `procedural.ts:267-269`. |
| Drone fades over the final two minutes | S | Tie gain envelope to Heat Death epoch progress, not audio-context absolute time. |
| Then the screen fades to white | XS | Pure-white target color or extend the fade after the held-darkness minute lands. |
| Cosmic time accelerates to 'T + 100 quintillion years', 'T + 10^100 years', etc. | XS | Fill the 10¹⁷..10²⁹ gap between Degenerate and Black Hole in `utils.ts:27,38-39`. |
| Inflation duration = 45s | XS | Bump `cosmology.ts:31` from 35s → 45s. |
| Then a single line: 'You have witnessed the universe.' Hold for 10 seconds | S | Push subline/tally/hint reveal to t+14.5s so the line gets its 10s solo hold. |
| New memory cards displayed like Hades' boon UI on the death screen | S | Add icon/frame/rarity flourish to `#death-memories` card render. |
| Cap of three memories per single run to keep them special | S | Enforce per-run cap in `unlockMemory`/`checkMemoryTriggers`, not just the death-screen slice. |
| Codex panel has a sister 'Memories' panel with the same UI grammar; tabs Codex / Memories at top | S | Replace title-screen button pair with an in-panel Codex/Memories tab strip. |
| First Stars duration = 180s | XS | Trim `cosmology.ts:58` from 190s → 180s. |
| Galactic Era duration = 240s | XS | Bump `cosmology.ts:67` from 230s → 240s. |
| Degenerate Era duration = 180s | XS | Trim `cosmology.ts:85` from 200s → 180s. |
| Tagline "Survive the universe." appears on title screen | XS | Add trailing period to `<h2>` text in `index.html:36`. |

### Requires runtime playtest

_Claims that cannot be confirmed by static read of `photon/src/`. Pull these into the next playtest session and measure them live._

- Difficulty is non-monotonic (rises through Galactic, peaks in Stellar, falls through Black Hole) — needs instrumented hazards-per-second sampling across a full run because no per-epoch spawn-rate constants exist; only `hazardKinds` variety is statically visible.
- Studio-music path: authored Heat Death track fades appropriately — needs a `useProcedural = false` playtest to confirm the authored track exists, loads, and respects the 2-minute final-fade contract.

## Next step

A subsequent planning session takes the "Highest-leverage gaps" + "Quick wins" rows and produces a fix-implementation plan under `docs/superpowers/plans/`. The fix plan modifies `photon/src/` and is out of scope for this audit.
