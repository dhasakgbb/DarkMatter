# Fun Lab Design

## Goal

Build a local Fun Lab for Photon that helps determine whether the game is fun, what kind of fun it is producing, and which tuning changes are most likely to improve it.

The first version measures, explains, and recommends. It does not auto-tune gameplay. A later Adaptive Fun Director can use the same model once signals are trustworthy.

## Approved Direction

Use a weighted fun model with separate axes:

- Dopamine: instant excitement, speed, near misses, streaks, clutch recoveries.
- Flow and mastery: readable challenge, fair deaths, smooth control rhythm, skillful improvement.
- One-more-run pull: upgrade tension, progress, seed variance, new bests, restart desire.
- Frustration dampener: cheap damage, confusion, repeated early failure, rage quit patterns.
- Readability dampener: unclear hazard state, visual overload, route ambiguity, HUD clutter.

Use hybrid measurement:

- Runtime telemetry during each run.
- Occasional lightweight post-run vibe checks.
- Local designer-facing analysis and recommendations.

Use Fun Lab now, not auto-tuning. The lab should recommend changes first; controlled bounded auto-tuning can come later after enough trusted evidence.

## Architecture

Fun Lab is a separate layer beside the game runtime. It observes run events, summarizes behavior, combines that summary with player vibe ratings, and produces a fun fingerprint plus tuning recommendation cards.

Core flow:

```text
Run Events -> Run Summary -> Vibe Rating -> Fun Fingerprint -> Tuning Cards
```

The game runtime must remain playable if Fun Lab storage, scoring, or UI fails. Measurement should never block a run, replay, upgrade choice, or Heat Death completion.

## Components

### Event Collector

Records lightweight gameplay events with timestamps and enough context to explain the run.

Initial events:

- Run start, run end, death, quit, restart.
- Epoch enter and epoch exit.
- Gate hit, gate miss, racing-line streak change.
- Speed pad hit and speed chain break.
- Hazard near miss, hazard hit, phase-through, damage.
- Boost start, boost end, boost depletion.
- Field strain enter, field strain peak, field strain recovery.
- Upgrade options shown and upgrade selected.

### Run Summarizer

Converts raw events into stable per-run metrics.

Initial metrics:

- Run duration and epoch reached.
- Average speed, speed variance, boost uptime.
- Gate hit rate, gate streak peak, line break count.
- Speed-pad chain count and chain peak.
- Near misses per minute.
- Damage count, damage clustering, time from damage to recovery.
- Death cause, death timing, repeated early-death pattern.
- Boredom gaps, defined as long spans without meaningful hazard, gate, pad, or recovery events.
- Route strain and edge-strain peaks.

### Vibe Check

Asks a small optional post-run question after selected runs, not every run.

Fields:

- Fun: 1-5.
- Flow: 1-5.
- Frustration: 1-5.
- One-more-run pull: 1-5.
- Optional short note.
- Skip action always available.

Trigger rules:

- Ask after deaths, wins, major milestones, and every Nth run.
- Do not interrupt upgrade selection.
- Do not block immediate replay.
- Back off if the player repeatedly skips.

### Fun Model

Produces a per-run fun fingerprint:

- Dopamine score.
- Flow/mastery score.
- One-more-run score.
- Frustration score.
- Readability score.
- Overall Fun Index.
- Trust score.

The Overall Fun Index is a weighted combination of positive axes dampened by frustration and unreadability. The UI must always show the separate axes so the score remains explainable.

High dopamine with high frustration is not treated as a great run. It is flagged as exciting but unstable.

### Trust Model

Recommendations need trust gates before they become high-confidence.

Rules:

- Do not promote recommendations from one unusual run.
- Increase confidence only when telemetry and vibe ratings agree across multiple runs.
- Mark conflicting signals as uncertain.
- Track recommendation confidence separately from fun score.
- Future auto-tuning can only use high-trust recommendations.

### Recommendation Engine

Produces human-readable tuning cards.

Each card includes:

- Finding.
- Evidence.
- Suggested tuning knob.
- Confidence.
- Risk.
- Affected fun axes.

Example:

```text
Finding: High dopamine, low flow in Inflationary.
Evidence: 6 near misses/min, 4 damage events clustered within 9 seconds, low gate streak.
Suggestion: Increase post-hazard recovery spacing or brighten next-route cues in this epoch.
Confidence: Medium.
Risk: Low.
```

Initial recommendation categories:

- Increase route readability.
- Reduce cheap damage.
- Add or move speed pads.
- Adjust gate density.
- Reduce boredom gaps.
- Improve recovery window after damage.
- Lower visual clutter in a specific epoch.
- Increase challenge if runs are clean but low excitement.

### Fun Lab Dashboard

Local designer-facing surface for analysis.

Views:

- Run list with Fun Index and axis scores.
- Selected-run fingerprint.
- Event timeline.
- Vibe check responses.
- Recommendation queue.
- Trust and uncertainty notes.

The dashboard should initially live as an in-game DOM layer, reachable from the title screen and pause menu through a `Fun Lab` button. It should follow the existing panel pattern used by Codex, Memories, Form, and Pause so it stays visually native to Photon. A separate route or standalone lab page is out of scope for v1.

## Product Boundaries

In v1:

- Local-only telemetry.
- Local browser storage or local export/import.
- Optional post-run vibe checks.
- Designer-facing dashboard.
- Explainable recommendation cards.
- Synthetic traces and unit fixtures for scoring.

Out of v1:

- Cloud analytics.
- User accounts.
- Biometrics.
- Dark-pattern retention optimization.
- Auto-tuning gameplay.
- Monetization optimization.

## Data Storage

The first version can store recent run records locally.

Recommended shape:

- `FunRunEvent[]` for raw events.
- `FunRunSummary` for metrics.
- `VibeRating` for post-run player input.
- `FunFingerprint` for scores.
- `TuningRecommendation[]` for cards.

Storage should be resilient:

- If local storage fails, gameplay continues.
- Keep a bounded history to avoid unbounded browser storage growth.
- Provide exportable JSON for manual playtest review.

## Error Handling

- Event recording failures must not crash gameplay.
- Missing vibe ratings produce lower trust, not invalid runs.
- Conflicting telemetry and ratings produce uncertainty notes.
- Unknown event types are ignored or preserved without breaking scoring.
- Dashboard failures do not affect the game loop.

## Testing

Use focused deterministic checks before browser playtests.

Required test coverage:

- Scoring fixtures for high dopamine, high flow, high frustration, boredom, and unreadable-run traces.
- Trust model fixtures where telemetry and ratings agree, disagree, or are missing.
- Recommendation fixtures for each initial recommendation category.
- Storage fallback when local persistence is unavailable.
- Browser checks for post-run vibe prompt readability.
- Browser checks for dashboard readability on desktop and mobile.

Manual playtest validation:

- Run at least three short playtests.
- Rate each run with the vibe check.
- Confirm the dashboard explains the run in a way that matches human intuition.
- Confirm recommendations are specific enough to tune a knob.

## Future Adaptive Director

The later Adaptive Fun Director can consume high-trust recommendation categories and apply bounded changes between runs.

Allowed future knobs:

- Hazard density.
- Gate density.
- Speed-pad density.
- Recovery spacing.
- Route-cue brightness.
- Epoch-specific visual clutter.
- Difficulty ramp slope.

Constraints:

- All auto-tuning must be bounded.
- All auto-tuning must be reversible.
- The player-facing fantasy must remain Photon racing across the universe, not a system visibly manipulating engagement.
- The designer must be able to inspect why a tuning change happened.

## Validation Gate For Implementation

The implementation plan should start with measurement and fixture tests, then add the vibe check, then add the dashboard, then add recommendation cards.

Do not implement auto-tuning in the first pass.
