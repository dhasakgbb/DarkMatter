# Photon Spec-vs-Shipped Gap Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single markdown punch-list comparing every concrete claim in `docs/design/photon-design.md` against live behavior in `photon/src/`, with file:line evidence and pillar-impact ranking.

**Architecture:** Read-only audit. No gameplay code is modified. The output is one new file under `docs/superpowers/specs/` containing a structured findings table. Each audit task reads a slice of the design doc, inspects the corresponding code area, and appends one or more rows to the findings table in the deliverable. Tasks are independent and can run in any order — the engineer should commit after each task so partial progress is recoverable.

**Tech Stack:** No runtime — this is a documentation/grep/read exercise. The auditor uses `grep`, the `Read` tool, and direct inspection of `photon/src/*.ts`, `photon/index.html`, and `docs/design/photon-design.md`. No tests, no build, no dev server.

**Source spec:** `docs/superpowers/specs/2026-05-12-photon-core-loop-ratification.md` §5.

**Output file:** `docs/superpowers/specs/YYYY-MM-DD-photon-gap-audit.md` where `YYYY-MM-DD` is the date the audit ships. For the rest of this plan the placeholder `<AUDIT_DATE>` stands for that date — replace it at the top of Task 1 and use the same value everywhere.

---

## File Structure

- **Create:** `docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md` — the deliverable. One file, one responsibility (the findings punch-list). No other files touched.
- **Read-only reference:** `docs/design/photon-design.md` (claims), `photon/src/*.ts` (evidence), `photon/index.html` (DOM hooks for HUD/death-panel inspection).

## Findings Row Schema

Every row appended to the deliverable uses this schema:

| Column | Allowed values |
|---|---|
| `Claim` | Verbatim or near-verbatim sentence from `docs/design/photon-design.md` |
| `Section` | Section header in `docs/design/photon-design.md` where the claim lives (e.g. "Pillar 1", "The signature scene") |
| `Status` | `shipped` / `partial` / `missing` / `unverifiable` |
| `Evidence` | File:line citation in `photon/src/` or `photon/index.html`, or "no match found" |
| `Pillar` | `1` (the run IS the universe), `2` (the photon remembers), or `1+2` |
| `Pillar impact` | `high` / `medium` / `low` — how much a gap here degrades the named pillar |
| `Fix size` | `XS` (single line of copy / one constant) / `S` (one function / one shader uniform) / `M` (cross-file refactor / new UI surface) / `L` (new subsystem) |
| `Notes` | One short sentence — what is missing, or what edge case is partial |

Rows for `shipped` claims should be terse (one-word Notes is fine). Rows for `partial` / `missing` are the actual value-add — write a precise one-sentence Notes column that a future fix-planning session can act on.

---

## Task 1: Create the audit document skeleton

**Files:**
- Create: `docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md`

- [ ] **Step 1: Pick the audit date and create the file with this exact content** (replace both `<AUDIT_DATE>` occurrences with today's ISO date, e.g. `2026-05-13`):

```markdown
# Photon Spec-vs-Shipped Gap Audit

**Date:** <AUDIT_DATE>
**Source spec:** [`docs/design/photon-design.md`](../../../docs/design/photon-design.md)
**Ratification:** [`2026-05-12-photon-core-loop-ratification.md`](../specs/2026-05-12-photon-core-loop-ratification.md)
**Repo head at audit:** `<git rev-parse --short HEAD output>`
**Scope:** read-only. No gameplay code is modified. Each row below cites file:line evidence.

## How to read this

Each row is one concrete claim from `docs/design/photon-design.md` checked against `photon/src/`. Status values:
- `shipped` — claim is implemented and matches the design-doc numbers/behavior.
- `partial` — implemented but diverges from the design doc in a specific, named way.
- `missing` — no implementation found.
- `unverifiable` — would require a runtime playtest to confirm; static read is insufficient.

`Pillar impact` ranks how much a gap on this row degrades the named pillar(s). Fix size is the engineer's estimate of what closing the gap would cost.

## Findings

| Claim | Section | Status | Evidence | Pillar | Pillar impact | Fix size | Notes |
|---|---|---|---|---|---|---|---|

## Summary

_To be filled in by Task 11 after all rows are recorded._
```

- [ ] **Step 2: Capture the repo head and substitute it**

Run: `git -C /Users/damian/GitHub/DarkMatter rev-parse --short HEAD`
Replace the literal string `<git rev-parse --short HEAD output>` with the captured value.

- [ ] **Step 3: Commit the skeleton**

```bash
cd /Users/damian/GitHub/DarkMatter
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs: scaffold photon gap audit"
```

---

## Task 2: Audit Heat Death visual fade numerics

**Files:**
- Read: `docs/design/photon-design.md` §"The signature scene"
- Read: `photon/src/game.ts:202-221` (`heatDeathTick`), `photon/src/scene.ts`
- Modify: `docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md` (append rows)

Design-doc claims to verify (from §"The signature scene"):
1. "nebula shader fades to near-black over the first 90 seconds"
2. "Stars dim to 30% then 15% then 5% then off"
3. "The tunnel rings dim and slow their shimmer rate"
4. "The HUD shrinks during this epoch. Distance counter and combo display fade out. Only the wavelength selector and energy bar remain."

- [ ] **Step 1: Inspect `heatDeathTick`**

Run: `grep -n "heatDeathTick\|visFade\|heatDeathFade\|starMat.uOpacity\|skyMat" /Users/damian/GitHub/DarkMatter/photon/src/game.ts`

Read the lines returned. Record: what curve does `visFade` follow? Over what duration? Does it produce the 30/15/5/0 step pattern or a continuous fade?

- [ ] **Step 2: Inspect tunnel ring dimming**

Run: `grep -n "ring\|tunnel\|shimmer" /Users/damian/GitHub/DarkMatter/photon/src/scene.ts /Users/damian/GitHub/DarkMatter/photon/src/track.ts | head -40`

Determine whether ring opacity or shimmer rate is modulated when `epoch.isHeatDeath` is true.

- [ ] **Step 3: Inspect HUD shrink behavior during Heat Death**

Run: `grep -n "isHeatDeath\|hideDuringHeatDeath\|distance-counter\|combo-badge" /Users/damian/GitHub/DarkMatter/photon/src/hud.ts /Users/damian/GitHub/DarkMatter/photon/index.html`

Determine whether the distance counter and combo display actually hide/fade during Heat Death.

- [ ] **Step 4: Append four rows to the findings table** — one per claim above. Use the schema in the plan header. Example row format:

```markdown
| "Nebula shader fades to near-black over the first 90 seconds" | The signature scene | partial | game.ts:207 `visFade = clamp(1 - t/90, 0.05, 1)` | 1 | medium | S | Linear fade reaches floor 0.05 at t=85.5s, not "near-black" — design-doc target is closer to 0 over 90s. Floor of 0.05 may be intentional to preserve readability; flag for design call. |
```

Append rows for: nebula-shader fade, star dim staircase, tunnel ring dim/shimmer, HUD shrink.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): Heat Death visual fade numerics"
```

---

## Task 3: Audit Heat Death audio collapse

**Files:**
- Read: `docs/design/photon-design.md` §"The signature scene" (audio paragraph)
- Read: `photon/src/audio.ts` around `startHeatDeath` (line 343) and the synth implementation it calls
- Modify: deliverable

Design-doc claims:
1. "drone fades to a single low sine wave at 40 Hz"
2. "then fades that over the final two minutes"
3. "Engine hum stays on but softens"
4. "No SFX except the player's own boost"

- [ ] **Step 1: Inspect `startHeatDeath` and its synth target**

Run: `grep -n "startHeatDeath\|heatDeath\|40\|sine\|frequency" /Users/damian/GitHub/DarkMatter/photon/src/audio.ts | head -60`

Capture: what frequency does the heat-death drone settle at? Is it a single sine, or a layered drone? Where is the final-two-minutes fade implemented?

- [ ] **Step 2: Inspect engine hum + SFX suppression**

Run: `grep -n "engine\|hum\|sfxGain\|sfx\|playSfx" /Users/damian/GitHub/DarkMatter/photon/src/audio.ts | head -40`

Determine whether engine volume softens during Heat Death and whether non-boost SFX are gated off.

- [ ] **Step 3: Append four rows** to the findings table — one per audio claim. Record exact frequency and exact fade duration found in code; mark `partial` if it diverges from 40 Hz / 2 min.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): Heat Death audio collapse"
```

---

## Task 4: Audit the witness ending sequence

**Files:**
- Read: `docs/design/photon-design.md` §"The signature scene" (final paragraph)
- Read: `photon/src/witness.ts`, `photon/src/game.ts` around `triggerWitness` (line 453), `photon/index.html` (witness-hint / credits DOM)
- Modify: deliverable

Design-doc claims:
1. "The final pickup at minute 5 grants a memory called 'The last photon.'"
2. "After collecting it, the photon continues for one more minute through total black"
3. "then the screen fades to white"
4. "then a single line: 'You have witnessed the universe.' Hold for 10 seconds."
5. "Then the credits scroll silently."

- [ ] **Step 1: Read `witness.ts` end-to-end**

Run: `cat /Users/damian/GitHub/DarkMatter/photon/src/witness.ts` (use the Read tool, not cat). Document the full sequence it triggers.

- [ ] **Step 2: Confirm 'last-photon' memory awarding**

Run: `grep -n "last-photon\|spawnFinalPickup\|witnessChime\|triggerWitness" /Users/damian/GitHub/DarkMatter/photon/src/*.ts`

Trace: when the final pickup is collected, is the memory `last-photon` unlocked? Where?

- [ ] **Step 3: Confirm white-fade + 10-second hold + silent credits**

Run: `grep -n "witness\|credits\|white\|fade" /Users/damian/GitHub/DarkMatter/photon/index.html`
Run: `grep -n "10000\|setTimeout\|witnessHint\|witness-hint" /Users/damian/GitHub/DarkMatter/photon/src/witness.ts /Users/damian/GitHub/DarkMatter/photon/src/game.ts`

Determine: does the witness sequence include a one-minute black continuation? A white fade? A 10-second hold on the "You have witnessed the universe" line? Silent credits scroll?

- [ ] **Step 4: Append five rows** (one per claim). Be precise — if a hold is implemented at 8000ms instead of 10000ms, mark `partial` and put `8s hold vs design-doc 10s` in Notes.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): witness ending sequence"
```

---

## Task 5: Audit cosmic-time HUD overlay

**Files:**
- Read: `docs/design/photon-design.md` §"Pillar 1" (HUD overlay paragraph) and §"The signature scene" (cosmic time during Heat Death)
- Read: `photon/src/utils.ts` (`cosmicTimeLabel`), `photon/src/hud.ts`, `photon/index.html`
- Modify: deliverable

Design-doc claims:
1. "A cosmic time HUD overlay on the right side: 'T + 4.7 billion years' or similar, scaling non-linearly with epoch"
2. "The cosmic time overlay accelerates dramatically: 'T + 100 quintillion years,' 'T + 10^100 years,' and so on. The numbers stop meaning anything and that's the point."

- [ ] **Step 1: Inspect the time-label generator**

Run: `grep -n "cosmicTimeLabel\|cosmicTime" /Users/damian/GitHub/DarkMatter/photon/src/utils.ts /Users/damian/GitHub/DarkMatter/photon/src/hud.ts`

Read `cosmicTimeLabel` in full. Document the mapping: which epoch indices produce which approximate label outputs? Is the scale non-linear (different orders of magnitude per epoch)? Does Heat Death produce "T + 10^100 years"-style labels?

- [ ] **Step 2: Confirm HUD placement**

Run: `grep -n "cosmic-time\|epoch-time\|overlay-right" /Users/damian/GitHub/DarkMatter/photon/index.html /Users/damian/GitHub/DarkMatter/photon/src/hud.ts`

Confirm the label is rendered on the right side and is visible during a run.

- [ ] **Step 3: Append two rows** to the findings table. If the non-linear scaling is present but doesn't reach `10^100` in Heat Death, mark `partial` with the exact ceiling.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): cosmic-time HUD overlay"
```

---

## Task 6: Audit the non-monotonic difficulty curve and epoch durations

**Files:**
- Read: `docs/design/photon-design.md` §"Pillar 1" (pacing arc list)
- Read: `photon/src/cosmology.ts` (EPOCHS array), `photon/src/hazards.ts` (hazard density logic)
- Modify: deliverable

Design-doc claims (each epoch's duration is a separate verifiable claim):
1. Inflation 45s, 2. Quark Plasma 90s, 3. Recombination 90s, 4. First Stars 3m (180s), 5. Galactic Era 4m (240s), 6. Stellar Era 6m (360s) — longest, peak complexity, 7. Degenerate Era 3m (180s), 8. Black Hole Era 4m (240s), 9. Heat Death 6m (360s).
Plus the overall claim: "Difficulty is non-monotonic. It rises through Galactic, peaks in Stellar, falls through Black Hole."

- [ ] **Step 1: Extract live durations**

Run: `grep -n "name: '" /Users/damian/GitHub/DarkMatter/photon/src/cosmology.ts | head -20`

For each epoch entry, read the line containing `duration:` and record it.

- [ ] **Step 2: Inspect hazard density per epoch**

Run: `grep -n "hazardKinds\|spawnRate\|density\|hazardInterval" /Users/damian/GitHub/DarkMatter/photon/src/cosmology.ts /Users/damian/GitHub/DarkMatter/photon/src/hazards.ts | head -40`

Look at how hazard spawn density scales per epoch. Does Stellar Era produce the densest hazards? Does Black Hole Era explicitly thin out?

- [ ] **Step 3: Append nine duration rows + one curve-shape row** (ten total). Each duration row's Notes column gives both the design-doc target and the live value. The curve-shape row marks `shipped` / `partial` / `unverifiable` based on whether hazard density visibly rises then falls — if static read is insufficient, mark `unverifiable` and note that runtime playtest is required.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): epoch durations and difficulty curve"
```

---

## Task 7: Audit death-panel reframe and memory surfacing

**Files:**
- Read: `docs/design/photon-design.md` §"Pillar 2" (death-panel paragraph)
- Read: `photon/src/game.ts` around line 393 (death-card tint) and the death-panel DOM in `photon/index.html`, `photon/src/ui.ts`
- Modify: deliverable

Design-doc claims:
1. "The death panel currently says 'ABSORBED.' It should still say that"
2. "but underneath should appear 'You forget. But the universe remembers.'"
3. "with new memory cards displayed like Hades' boon UI"
4. "Cap of three memories per single run to keep them special"

- [ ] **Step 1: Inspect death-panel DOM and copy**

Run: `grep -n "ABSORBED\|absorbed\|forget\|universe.*remembers" /Users/damian/GitHub/DarkMatter/photon/index.html /Users/damian/GitHub/DarkMatter/photon/src/*.ts`

Confirm: is "ABSORBED" the death heading? Is the subtitle "You forget. But the universe remembers." present anywhere?

- [ ] **Step 2: Inspect new-memories-this-run rendering**

Run: `grep -n "newMemoriesThisRun\|memoryCard\|death.*memory" /Users/damian/GitHub/DarkMatter/photon/src/game.ts /Users/damian/GitHub/DarkMatter/photon/src/ui.ts`

Confirm: are memory cards rendered on the death screen styled like a card UI (boon-style)?

- [ ] **Step 3: Check the per-run cap of three memories**

Run: `grep -n "newMemoriesThisRun\|memoryCap\|3" /Users/damian/GitHub/DarkMatter/photon/src/memories.ts /Users/damian/GitHub/DarkMatter/photon/src/game.ts`

Determine whether `unlockMemory` or `checkMemoryTriggers` enforces a per-run cap. If no cap is enforced, mark `missing`.

- [ ] **Step 4: Append four rows** to the findings table.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): death panel reframe and memory surfacing"
```

---

## Task 8: Audit chapter cards, codex/memories tabs, and upgrade reframe

**Files:**
- Read: `docs/design/photon-design.md` §"Pillar 2" (existing-systems table) and §"Phase D"
- Read: `photon/src/hud.ts` (`showEpochToast`), `photon/src/cosmology.ts` (epoch `chapter` strings), `photon/src/ui.ts`, `photon/index.html`, `photon/src/meta.ts`
- Modify: deliverable

Design-doc claims:
1. "Each epoch transition shows a chapter card with the cosmological event in plain language"
2. "The codex panel should get a sister panel called 'Memories' with the same UI grammar. Tabs at top: Codex / Memories."
3. "Headers go from 'Top velocity' to 'You feel faster. The void resists less.' Same +8% speed, more flavor." — upgrade copy reframed to second-person sensory voice
4. The combo HUD has been renamed user-facing to "RESONANCE" (already noted in ratification §3)

- [ ] **Step 1: Inspect chapter card rendering**

Run: `grep -n "showEpochToast\|epoch-chapter\|chapter" /Users/damian/GitHub/DarkMatter/photon/src/hud.ts /Users/damian/GitHub/DarkMatter/photon/index.html`

Confirm chapter strings render on each epoch transition with sufficient duration to read.

- [ ] **Step 2: Inspect codex/memories tab UI**

Run: `grep -n "tab\|codex\|memories\|memoriesTab\|codexTab" /Users/damian/GitHub/DarkMatter/photon/index.html /Users/damian/GitHub/DarkMatter/photon/src/ui.ts`

Confirm both tabs exist and use sibling UI grammar.

- [ ] **Step 3: Inspect upgrade-card copy**

Run: `grep -n "upgrade\|UPGRADES\|topVelocity\|speedMul" /Users/damian/GitHub/DarkMatter/photon/src/meta.ts /Users/damian/GitHub/DarkMatter/photon/src/ui.ts /Users/damian/GitHub/DarkMatter/photon/src/game.ts | head -40`

Read the upgrade-card labels and descriptions. Are headers written in second-person sensory voice ("You feel faster") or in stat-mechanical voice ("Top velocity")? Record exact strings.

- [ ] **Step 4: Append four rows** to the findings table. The upgrade-copy row is the most likely `partial` — capture exact current labels in Notes so a future copy pass has a starting point.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): chapter cards, tabs, upgrade copy"
```

---

## Task 9: Audit between-epoch save points

**Files:**
- Read: `docs/design/photon-design.md` §"Risks and tradeoffs" (mobile-length mitigation paragraph)
- Read: `photon/src/state.ts`, `photon/src/storage.ts`, `photon/src/game.ts` (`startRun` Checkpoint handling)
- Modify: deliverable

Design-doc claims:
1. "between-epoch save points. The player can quit and resume at the start of any epoch they've reached."
2. "The Heat Death epoch is not skippable and not chunkable."

- [ ] **Step 1: Inspect Checkpoint type and save/resume flow**

Run: `grep -n "Checkpoint\|checkpoint\|resumeSnapshot\|saveCheckpoint" /Users/damian/GitHub/DarkMatter/photon/src/*.ts`

Trace: is there a Checkpoint type? When is it saved (per-epoch or per-frame)? Is there a UI surface to resume from a saved checkpoint?

- [ ] **Step 2: Check Heat Death exclusion**

Run: `grep -n "isHeatDeath" /Users/damian/GitHub/DarkMatter/photon/src/state.ts /Users/damian/GitHub/DarkMatter/photon/src/storage.ts /Users/damian/GitHub/DarkMatter/photon/src/ui.ts`

Determine whether Heat Death is explicitly excluded from chunkable resume.

- [ ] **Step 3: Append two rows** to the findings table. If checkpoints don't exist at all, mark both rows `missing` with the resume-flow line "no Checkpoint persistence path found" in Notes.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): between-epoch save points"
```

---

## Task 10: Audit variant unlocks, tagline, and the witness-count surface

**Files:**
- Read: `docs/design/photon-design.md` §"Pillar 1" (title-screen counter), §"Pillar 2" (variants with Memory-themed unlocks), §"Marketing positioning" (tagline)
- Read: `photon/src/cosmology.ts` (VARIANTS array), `photon/src/game.ts` (variant unlock wiring), `photon/index.html` (title-screen DOM), `photon/src/meta.ts`
- Modify: deliverable

Design-doc claims:
1. "The title screen tracks 'N photons have witnessed the heat death' globally" (a localStorage int now, server count later)
2. "Each variant gets a Memory-themed unlock condition and lore."
3. Tagline: "Survive the universe." present on title screen.

- [ ] **Step 1: Inspect VARIANTS and unlockReq strings**

Run: `grep -n "VARIANTS\|unlockReq\|unlocked:" /Users/damian/GitHub/DarkMatter/photon/src/cosmology.ts | head -30`

For each variant, record its `unlockReq` string and decide: is the condition Memory-themed (references witnessing, remembering, an experience) or generic-mechanical?

- [ ] **Step 2: Inspect title-screen witness counter**

Run: `grep -n "witnessedHeatDeath\|refreshTitleStats\|title-stats\|photons.*witnessed" /Users/damian/GitHub/DarkMatter/photon/src/game.ts /Users/damian/GitHub/DarkMatter/photon/src/meta.ts /Users/damian/GitHub/DarkMatter/photon/index.html`

Confirm: is a personal `witnessedHeatDeath` count surfaced on the title screen? Is there any global server-aggregate (likely missing per ratification §3 row F)?

- [ ] **Step 3: Inspect tagline copy**

Run: `grep -n "Survive the universe\|survive.*universe\|tagline" /Users/damian/GitHub/DarkMatter/photon/index.html /Users/damian/GitHub/DarkMatter/photon/src/*.ts`

Record presence/absence verbatim.

- [ ] **Step 4: Append rows** — one per variant (count them; likely 6–8 rows), plus one row for the personal witness counter, one row for the global aggregate, one row for the tagline. Group variant rows tightly — their Notes column should record the live `unlockReq` string verbatim so a future copy pass can re-thread them through Pillar 2.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): variants, witness counter, tagline"
```

---

## Task 11: Fill in the Summary section and finalize

**Files:**
- Modify: `docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md` (Summary section + sort)

- [ ] **Step 1: Tally counts**

Count the rows in the findings table by status. Record:
- Total claims audited: N
- `shipped`: A
- `partial`: B
- `missing`: C
- `unverifiable`: D

- [ ] **Step 2: Identify highest-leverage gaps**

Filter rows where `Status ∈ {partial, missing}` AND `Pillar impact = high`. List those rows (Claim + Notes) under a "Highest-leverage gaps" subheading.

- [ ] **Step 3: Identify smallest-cost gaps**

Filter rows where `Status ∈ {partial, missing}` AND `Fix size ∈ {XS, S}`. List under "Quick wins" — these are candidates for the first fix-planning session.

- [ ] **Step 4: List unverifiable claims**

Any row marked `unverifiable` becomes a candidate for a future runtime playtest. List them under "Requires runtime playtest" with a one-line note on what to measure.

- [ ] **Step 5: Write the final Summary section** (replace the placeholder added in Task 1):

```markdown
## Summary

Total claims audited: **N**
- shipped: A
- partial: B
- missing: C
- unverifiable: D

### Highest-leverage gaps

_Rows where pillar impact is high and status is not shipped. Address these first when planning fix work._

| Claim | Notes |
|---|---|
| ... | ... |

### Quick wins

_Rows with fix size XS or S that close real gaps. Candidates for the first fix-planning session._

| Claim | Fix size | Notes |
|---|---|---|
| ... | ... | ... |

### Requires runtime playtest

_Claims that cannot be confirmed by static read of `photon/src/`. Pull these into the next playtest session and measure them live._

- ...

## Next step

A subsequent planning session takes the "Highest-leverage gaps" + "Quick wins" rows and produces a fix-implementation plan under `docs/superpowers/plans/`. The fix plan modifies `photon/src/` and is out of scope for this audit.
```

- [ ] **Step 6: Sort the findings table** so `missing` rows come first, then `partial`, then `unverifiable`, then `shipped`. Within each status group, sort by `Pillar impact` descending (`high` → `medium` → `low`).

- [ ] **Step 7: Final commit**

```bash
git add docs/superpowers/specs/<AUDIT_DATE>-photon-gap-audit.md
git commit -m "docs(audit): summary and sort findings"
```

---

## Self-Review Checklist (run before declaring the plan complete)

- [ ] Every audit target listed in ratification §5 maps to at least one task (Heat Death numerics → Tasks 2+3+4, HUD shrink → Task 2, non-monotonic difficulty → Task 6, death-panel reframe → Task 7, memory cap → Task 7, chapter cards → Task 8, save points → Task 9, variant unlocks → Task 10, tagline → Task 10). ✓
- [ ] No task modifies `photon/src/` — confirmed, all "Modify" entries point only at the deliverable markdown file. ✓
- [ ] `<AUDIT_DATE>` placeholder is called out explicitly in the plan header and Task 1 — engineer substitutes once at the start. ✓
- [ ] Findings row schema is defined exactly once (plan header) and referenced from each audit task. ✓
- [ ] Each task ends with a commit step. ✓
- [ ] No placeholders inside task bodies — every grep command is concrete, every claim is verbatim from the design doc. ✓
