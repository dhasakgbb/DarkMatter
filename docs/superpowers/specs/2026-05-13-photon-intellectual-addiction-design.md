# Photon — Intellectual Addiction (Pillars 1 + 2) — Delta-Only Design

**Date:** 2026-05-13
**Project:** `photon/`
**Status:** Pending user review (then plan-writing)
**Scope:** Delta-only spec + audit. Targets the genuinely-missing portions of the "Engineering Intellectual Addiction" brief; existing implementations are referenced, not redescribed.

---

## 1. Goal

Turn the existing 30-minute Photon roguelike run into a tight scientific-method loop for physics-literate players:

> hypothesize wavelength/boost/phase strategy from ΛCDM intuition → execute with embodied feedback (Pillar 1) → encounter unpredictable dark-matter discovery + post-run analysis (Pillar 2) → iterate on next seeded run.

The core design bet: **flow-state mastery + variable intellectual reward + analytical closure** is the addictive pattern, not generic roguelike dopamine. No new currencies, no fake streaks, no meta-progression bloat.

**Hard constraint:** Default (non-science) mode is byte-for-byte identical to `main` after this work lands. Every delta is gated on `meta.scienceMode` or a science-mode-aware fallback.

---

## 2. Audit — brief claims vs. repo reality

| Brief claim | Status | Reference | Notes |
|---|---|---|---|
| `audio.ts` has `setRedshift / setFlow / setDarkMatterSignal / setHeatDeathProgress` | EXISTS | [audio.ts:154-171](../../../photon/src/audio.ts#L154-L171) | All four live |
| `applyScienceAutomation()` routes science params to filter / delay / stem gains | EXISTS | [audio.ts:491-519](../../../photon/src/audio.ts#L491-L519) | Linear blends — see delta D1 |
| Redshift filter curve `cutoff = 8000 × (1+z)^-0.8` | MISSING | — | Delta D1 |
| Live `E = hc/λ` HUD readout + cumulative energy-loss text | MISSING (live) | post-run only via [physicsInsight.ts:101-102](../../../photon/src/physicsInsight.ts#L101-L102) | Delta D2 |
| Resonance streak → particles wavefront escalation | MISSING | — | Delta D3a |
| Resonance streak → `scienceGain` boost | MISSING | — | Delta D3b |
| 3-tier DM lensing (common nudge / rare unlock / ultra-rare path-split) | PARTIAL | [hazards.ts:474-483](../../../photon/src/hazards.ts#L474-L483) — single tier by `strength` | Delta D4 |
| Deterministic-seed lensing floor in final 20% Stellar | MISSING | — | Delta D4b |
| Cross-run "seed-echo" memory referencing prior best chain/lensing | MISSING | [memories.ts](../../../photon/src/memories.ts) has no seed-keyed memory type | Delta D5 |
| Post-run Photon Path Analysis screen | EXISTS | [game.ts:510](../../../photon/src/game.ts#L510) | Renders `physicsInsight` report |
| Insight score formula `0.6 cosmology + 0.4 events` | DRIFT | actual = 6-component weighted sum in [physicsInsight.ts:112-119](../../../photon/src/physicsInsight.ts#L112-L119) | Resolution: dual-score (Delta D6a) |
| 50-seed `addiction-smoke.test.ts` simulation | MISSING | — | Delta D6b |
| Telemetry: runs/session, insight dist, dwell, DM events | PARTIAL | `meta.darkMatterDetections` exists; others not | Delta D6c |
| `setDarkMatterSignal()` wired continuously in main loop | EXISTS | [game.ts:747](../../../photon/src/game.ts#L747) | — |
| Seed bookmarks for replay | EXISTS | [physicsInsight.ts:187-203](../../../photon/src/physicsInsight.ts#L187-L203) | Reused by D5 |

**Drift call-out — insight formula:** The brief proposes `0.6 × cosmology + 0.4 × events`. The repo's score is a 6-component weighted sum (`cosmology 0.26 + resonance 0.24 + flow 0.20 + discovery 0.18 + confidence 0.12 − penalty`). The 6-component score is covered by [physicsInsight.test.ts](../../../photon/src/physicsInsight.test.ts) and surfaced in the live analysis UI; rewriting it churns UX and tests for no win. **Resolution:** keep `insight.score` exactly as-is and add a separate `addictionScore` field (D6a) used by the smoke test and surfaced as a secondary readout in the analysis screen.

---

## 3. Deltas

### D1 — Exponential redshift sonification curve

**File:** `photon/src/audio.ts` (`applyScienceAutomation`, ~5 lines)
**Behavior:** Replace the current linear redshift term in the `cutoff` calculation with an exponential decay parameterized by a single tunable constant.

```
const REDSHIFT_FILTER_EXPONENT = 0.8;
const REDSHIFT_FILTER_CEILING_HZ = 8000;
// `redshift` here is the audio-engine [0,1] normalized value (this.scienceRedshift),
// set by game.ts:239 from game.redshiftAmount. We treat it directly as the (1+z) input
// — the literal cosmological z is not piped through audio; the [0,1] control IS the
// game's z proxy and the brief's "(1+z)^-0.8" maps onto it cleanly.
const expCutoff = REDSHIFT_FILTER_CEILING_HZ * Math.pow(1 + redshift, -REDSHIFT_FILTER_EXPONENT);
// blend with flow/dm/heatFade contributions exactly as before
const cutoff = clamp(expCutoff + flow * 1800 + darkMatter * 700 − heatFade * 1100, 520, 8800);
```

At `redshift = 0` the exponential term equals 8000 Hz (matching current pre-redshift cutoff); at `redshift = 1` it falls to `8000 × 2^-0.8 ≈ 4592 Hz` — a musically meaningful but not extreme darkening. This range is the starting tuning target; `REDSHIFT_FILTER_EXPONENT` is the single tunable knob.

**Gating:** Active when `scienceMode === true`. When false, the existing linear blend is preserved unchanged (early return / branch).

**Why the exponent lives as a `const`:** single-point tunability so the spec freezes intent without re-wiring on each tuning playtest.

### D2 — Live energy HUD readout

**File:** `photon/src/hud.ts` (~10 lines), reuses `photonEquationSnapshot()` from `science.ts`.
**Behavior:** Science-mode-only HUD row showing:
- `E = 1240 / λ_nm eV` (current observed energy)
- `ΔE since recombination: NN%` (computed from `emittedEnergyEv` vs current — identical math to [physicsInsight.ts:101-102](../../../photon/src/physicsInsight.ts#L101-L102))

**Update cadence:** once per HUD tick. No new state — derived from existing `scienceSnapshot()` + current wavelength.

**Edge case:** during epoch transitions when `λ` is undefined for ≤ 1 frame, hold the previous value; if still undefined after 2 frames, hide the row (no flicker).

### D3 — Resonance streak amplification

**D3a — Particles wavefront escalation.** File: `photon/src/particles.ts` (~5 lines). When current `phaseStreak ≥ 3`, scale the sine-offset amplitude term by `1 + min(0.5, streak × 0.06)`. Visually: the wavefront interference pattern visibly tightens at high streaks. Resets to 1.0 on streak break.

**D3b — `scienceGain` audio boost.** File: `photon/src/audio.ts` (~8 lines). Add:
```
setResonanceStreak(n: number) {
  this.scienceResonanceStreak = Math.max(0, n | 0);
  this.applyScienceAutomation();
}
```
Inside `applyScienceAutomation`, after the existing `heatMul` line:
```
const streakBoost = Math.min(0.25, this.scienceResonanceStreak * 0.05);
const fadedBoost = streakBoost * (1 − heatFade); // gracefully decays at Heat Death
nodes.scienceGain.gain.setTargetAtTime(Math.max(0.08, heatMul + fadedBoost), t, 0.35);
```

**Wire-up:** call `audio.setResonanceStreak(game.phaseStreak)` at the same site that updates `game.phaseStreak` (existing site to be located during plan writing; expected in `game.ts` phase-chain handler).

### D4 — Three-tier dark-matter lensing

**File:** `photon/src/hazards.ts` (~20 lines around line 474).

**Tier mapping (deterministic, from existing `strength`):**
| Tier | Strength threshold | Behavior |
|---|---|---|
| 1 | `strength ≥ 0.35` | Existing nudge + brief lensing shader (current behavior preserved) + Codex fact unlock |
| 2 | `strength ≥ 0.65` | Tier-1 effects + unlock memory `bullet-cluster-confirmed` via `unlockMemory()` (idempotent — existing guard) |
| 3 | `strength ≥ 0.88` AND `scienceMode` AND `renderProfile.tier !== 'low'` | Tier-2 effects + full path-split visual (`lensingPass.uniforms.uIntensity` ramp) + `setDarkMatterSignal(1.0)` peak |

The single existing detection counter (`meta.darkMatterDetections`) increments once per event regardless of tier — preserves bookmark / memory thresholds.

**D4b — Deterministic floor.** At run start (after seed pin in `seed.ts`), draw one extra value from the seeded RNG:
```
game.seedFloorRoll = seededRng(); // pinned, deterministic per seed
```
At 80% of Stellar epoch duration, if `meta.scienceMode` AND `game.lensingEventsThisRun === 0` AND `game.seedFloorRoll < 0.85`, **set a one-shot flag `game.floorLensingPending = true`**. The next regular dark-matter-filament hazard spawn from the existing hazard-spawn path in `hazards.ts` consumes that flag and is forced to register a Tier-1 lensing event (i.e. its `strength` is floored to `≥ 0.35` so the existing tier mapping fires it as Tier-1). Reusing the existing spawn pipeline guarantees the floor event is visually and audibly indistinguishable from a natural one; the flag is consumed on first matching spawn or expires harmlessly at end of Stellar.

Because `seedFloorRoll` is pinned at run start, the same seed always yields the same floor decision; because the floor only floors `strength` (does not insert a new spawn), the existing seed-deterministic spawn schedule is preserved → reproducibility holds end-to-end.

**Determinism review checklist** (must be ticked in the implementation PR):
- [ ] All new RNG calls in D4 use the seed-pinned generator, not `Math.random()`.
- [ ] `seedFloorRoll` is drawn exactly once per run.
- [ ] No tier decision reads run-time mutable state other than `strength` (itself a deterministic function of seed + frame).

### D5 — Cross-run seed-echo memory

**Files:** `photon/src/cosmology.ts` (add `MEMORIES` entry) + `photon/src/memories.ts` (extend `checkMemoryTriggers`).

**New memory entry shape:**
```
{
  id: 'seed-echo',
  title: 'Echo across runs',
  body: 'Seed {seedLabel} carries a trace of your previous photon. The DM filament you threaded still resonates.',
  threshold: undefined,
  when: { previousSeedBookmark: true }, // new predicate
  resonance: undefined,
}
```

**Predicate logic** added to `checkMemoryTriggers`:
```
if (w.previousSeedBookmark) {
  const bookmarks = loadSeedBookmarks();
  const match = bookmarks.find(b => b.seed === game.currentSeed && b.insightScore >= 45);
  if (!match) ok = false;
}
```

**Throttling:** at most one `seed-echo` unlock per run (existing `meta.memories[id]` guard handles this implicitly — once unlocked, never re-fires). First-ever play: `loadSeedBookmarks()` returns `[]`, predicate fails silently.

### D6 — Observability

**D6a — `addictionScore`.** Add to `PhysicsInsightReport` in [physicsInsight.ts](../../../photon/src/physicsInsight.ts):
```
addictionScore: {
  value: number;        // 0–100
  cosmologyMatch: number;
  eventsSignal: number;
}
```
Formula:
```
cosmologyMatch = clamp(100 - Math.abs(observedZ - idealZ) * SCALE_Z, 0, 100)
eventsSignal   = clamp(lensingEvents * 33 + phaseStreak * 4, 0, 100)
addictionScore = 0.6 * cosmologyMatch + 0.4 * eventsSignal
```
Where `idealZ` is the redshift the photon *would* have at the current epoch position under perfect ΛCDM — read directly from `science.ts:scienceSnapshot().redshiftZ` for the epoch end-state, which already uses the cosmology.ts ΛCDM scale-factor model. `observedZ` is the photon's actual `(1/scaleFactor − 1)` at absorption, also from `scienceSnapshot()`.

**Starting value:** `SCALE_Z = 12`. Rationale: the brief's success criterion (`mean addictionScore > 70`) requires `cosmologyMatch ≥ ~70` on average. With `SCALE_Z = 12`, a typical `|Δz| ≈ 2.5` between observed and ideal yields `cosmologyMatch = 70` — i.e. a player who stays within ~2.5 of the ideal redshift curve scores well, while a player drifting `|Δz| ≥ 8.3` floors at 0. This is the starting calibration; commit-3 development confirms the empirical mean lands in range and adjusts if necessary.

`insight.score` and all six component values remain unchanged — `physicsInsight.test.ts` still passes verbatim.

**D6b — Smoke test.** New file `photon/src/addiction-smoke.test.ts` (Vitest):
- Drives 50 deterministic seeds through a headless run loop (no Three.js, no audio — invokes the simulation core only).
- Asserts `mean(addictionScore) ≥ CALIBRATED_FLOOR` and `mean(lensingEventsPerRun) ≥ 2.0`.
- `CALIBRATED_FLOOR` is set during commit-3 development to a value `≤ empirical mean − 3` (regression-detection target, not aspirational).
- Wall-clock budget: < 8s under `npm test` on the CI baseline machine.

**D6c — Telemetry counters.** Added to `meta` (existing serialization path):
- `runsThisSession: number` — increments per run; resets after > 30 min idle.
- `analysisDwellMs: number` — accumulated; updated while analysis screen is visible.
- `addictionScoreHistory: number[]` — capped at 50 most recent (FIFO).
- `darkMatterDetections` — **already exists**; spec only renames in docs, not in code.

---

## 4. Data flow

```
seed.ts (deterministic RNG, pinned at run start)
   │
   ├─→ hazards.ts (D4): floor decision + tier rolls
   │       │
   │       ├─→ game.darkMatterSignal, meta.darkMatterDetections
   │       ├─→ audio.setDarkMatterSignal()
   │       ├─→ memories.checkMemoryTriggers() (D4 tier-2/3, D5 echo)
   │       └─→ physicsInsight: eventsSignal input
   │
   ├─→ game loop: phaseStreak updates ─→ audio.setResonanceStreak() (D3b)
   │                                  ─→ particles.wavefront amplitude (D3a)
   │
   └─→ science.ts: photonEquationSnapshot() ─→ hud.ts live readout (D2)
                                            ─→ physicsInsight: cosmologyMatch input

post-run absorption:
   physicsInsight.analyzePhysicsRun(input)
     ─→ {insight.score (unchanged), addictionScore (D6a)}
     ─→ game.ts analysis screen renders both
     ─→ saveSeedBookmark() if insight.score ≥ 45
     ─→ meta.addictionScoreHistory.push() (D6c)
```

---

## 5. Commits & sequencing

Three thematic commits — matches the repo's existing cadence (`d71a501`, `4f52724`, `5f73dde`).

### Commit 1 — Audio sonification & visceral feedback
- D1 (exponential redshift curve)
- D2 (live HUD energy readout)
- D3a (particles wavefront escalation)
- D3b (`setResonanceStreak` + scienceGain boost)
- Touches: `audio.ts`, `hud.ts`, `particles.ts`, possibly `game.ts` (wire-up of `setResonanceStreak`).
- Independently shippable: even with no Pillar 2 follow-up, this commit improves science-mode play standalone.

### Commit 2 — Discovery & memory (gameplay)
- D4 (3-tier lensing)
- D4b (deterministic floor)
- D5 (seed-echo memory + `previousSeedBookmark` predicate)
- Touches: `hazards.ts`, `cosmology.ts`, `memories.ts`, `seed.ts` (one extra roll), `state.ts` (`game.seedFloorRoll`, `game.lensingEventsThisRun`).

### Commit 3 — Observability & proof
- D6a (`addictionScore` in physicsInsight)
- D6b (smoke test)
- D6c (telemetry counters)
- Touches: `physicsInsight.ts`, `physicsInsight.test.ts` (extend), `meta.ts`, new `addiction-smoke.test.ts`.
- Calibration step here: run smoke locally, set `CALIBRATED_FLOOR` from empirical mean.

---

## 6. Testing strategy

| Layer | Test | Status |
|---|---|---|
| Unit | `physicsInsight.test.ts` — extend with `addictionScore` assertions on fixed inputs | extend existing |
| Unit | `hazards.tier.test.ts` — `strength → tier` mapping + deterministic floor logic | NEW |
| Unit | `memoryEcho.test.ts` — `seed-echo` fires iff bookmark with score ≥ 45 exists for current seed | NEW |
| Sim | `addiction-smoke.test.ts` — 50-seed run, mean addictionScore ≥ floor, mean lensing ≥ 2 | NEW |
| Regression | `audio.test.ts`, `science.test.ts`, `epochMechanics.test.ts`, `flow.test.ts`, `racingCue.test.ts`, `touchControls.test.ts` | must remain green untouched |
| Manual | 10-run mobile playtest (iOS Safari + Android Chrome) before merging commit 1 | gating manual gate |

---

## 7. Edge cases & error handling

- **Mobile audio latency** — all new automations use `setTargetAtTime` with ≥ 0.06s time constant (existing pattern).
- **Heat-Death amplification** — `setResonanceStreak` boost multiplied by `(1 − heatDeathFadeAmount())`; fades naturally during Heat Death.
- **First-ever play `seed-echo`** — `loadSeedBookmarks()` returns `[]`; predicate fails silently, no crash.
- **`addictionScore` numerator zero** — clamped to `[0, 100]`; smoke test asserts no `NaN`.
- **Tier-2 memory unlock idempotency** — guaranteed by existing `unlockMemory()` guard at [memories.ts:14](../../../photon/src/memories.ts#L14).
- **Tier-3 path-split on low-end mobile** — gated on `renderProfile.tier !== 'low'`.
- **Live HUD readout `λ` undefined** — hold previous value 1 frame; hide after 2.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pillar 1 audio "feels different" to existing science-mode users in a bad way | Commit 1 independently revertable; ship behind science-mode (default off); manual A/B playtest before merge |
| Smoke test flakes under CI load | Deterministic seeds + fixed simulation timestep; assert on means, not single-run values |
| `seed-echo` memory feels spammy | At most one per run (memory unlock guard); requires bookmark score ≥ 45 — already a quality filter |
| Brief's `(1+z)^-0.8` exponent feels too sharp on low-z epochs | Constant `REDSHIFT_FILTER_EXPONENT` in `audio.ts` allows one-line tuning post-playtest |
| Tier-3 GPU cost spike | Gated on `renderProfile.tier !== 'low'`; ramps `lensingPass.uIntensity` smoothly (no instant pop) |
| `addictionScore` formula goes stale as gameplay evolves | Single calibration constant `CALIBRATED_FLOOR` in smoke test; one-line update path |

---

## 9. Success criteria

1. All existing tests green; 3 new test files (`hazards.tier.test.ts`, `memoryEcho.test.ts`, `addiction-smoke.test.ts`) plus extended `physicsInsight.test.ts` passing.
2. Smoke test: mean `addictionScore` over 50 seeds ≥ `CALIBRATED_FLOOR` (set at commit-3 time from empirical run).
3. Smoke test: mean lensing events per science-mode run ≥ 2.0.
4. Default (non-science) mode: zero diff in audio output and visuals vs. `main` — verified by manual playtest sign-off.
5. 10-run mobile playtest produces no new audio glitches or frame-rate regressions.

---

## 10. Out of scope (explicitly)

- New currencies, meta-progression, fake streaks.
- Multiplayer / leaderboards.
- Post-Heat-Death content.
- Non-science-mode behavior changes.
- Codex content authoring beyond the one new `bullet-cluster-confirmed` memory body.
- Rewriting `insight.score` formula (resolved via dual-score per Audit drift call-out).
- "Guaranteed lensing" floor in non-science mode (science-mode-only contract).

---

## 11. Determinism contract (review gate)

Reviewers must verify before merging Commit 2:

- [ ] `seedFloorRoll` drawn exactly once per run, from seed-pinned RNG.
- [ ] No `Math.random()` introduced anywhere in new code.
- [ ] Tier decisions read only deterministic inputs (`strength`, `scienceMode`, `renderProfile.tier`).
- [ ] Running the same seed twice produces identical lensing event sequence (manual verification).
- [ ] Seed bookmarks remain valid across this change (a bookmark saved pre-change can still be loaded post-change).
