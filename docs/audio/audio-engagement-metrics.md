# Photon Audio Engagement Metrics

Photon's audio quality bar is not raw loudness or retention pressure. For this project, "dopamine" means a player feels faster, cleaner, and more emotionally pulled through cosmic time without losing readability or the Heat Death restraint.

This document defines the automated screening metric and the human playtest bar for music and SFX drops.

## Command

Run from the repository root:

```bash
node tools/score_audio_engagement.mjs
```

Useful modes:

```bash
node tools/score_audio_engagement.mjs --json
node tools/score_audio_engagement.mjs --write-report
node tools/score_audio_engagement.mjs --strict
```

`--write-report` writes:

- `docs/evidence/audio-engagement/audio-engagement-report.json`
- `docs/evidence/audio-engagement/audio-engagement-report.md`

The scorer requires `ffmpeg` so it can decode OGG/WAV assets into PCM samples.

## What The Scorer Measures

The script reads `photon/src/audio-manifest.json`, resolves files from `photon/src/audio-assets/` and `photon/public/audio/`, decodes them to mono 16 kHz PCM, then scores each enabled asset.

Music signals:

- duration and loop suitability,
- peak headroom,
- RMS loudness range,
- energy motion over 50 ms windows,
- transient density,
- pulse clarity from envelope autocorrelation,
- silence/restraint, especially for Heat Death.

SFX signals:

- duration fit for the cue role,
- peak headroom,
- RMS loudness,
- crest factor/punch,
- transient density,
- zero-crossing brightness proxy,
- trimmed silence ratio.

Coverage signals:

- required production stems for `Stellar` and `Heat Death`,
- final-asset variant targets for high-frequency SFX such as `lineGate`, `railScrape`, `damageHit`, and hazard whooshes.

## Score Interpretation

| Score | Meaning |
|---:|---|
| 85-100 | Studio-ready signal, but still requires in-game listening. |
| 72-84 | Promising; playtest and mix tuning required. |
| 60-71 | Usable temp/reference quality. |
| 0-59 | Not ready for final audio signoff. |

The report includes `rawWaveform` when the technical signal differs from the final `overall` score. Current director-temp/generated assets are capped at reference quality even if their waveform metrics are strong, because they do not prove final identity, license posture, or human emotional response.

## Photon Dopamine Bar

An audio drop is not accepted as high-engagement until all of these are true:

- `overall >= 85` with no director-temp gate.
- `racingReadability >= 85`.
- `heatDeath >= 80`, while still sounding intentionally sparse.
- No clipping/headroom findings.
- No high-priority missing-variation findings for `speedPad`, `lineGate`, `railScrape`, `damageHit`, `hazardWhoosh`, or `gravityWellWhoosh`.
- In a live run, clean driving sounds better than messy driving.
- The player can identify pad, gate hit, gate miss, rail scrape, damage, and death without looking away from the road.
- Heat Death feels authored, not empty by accident.

## Human Playtest Sheet

Automated metrics are the first filter. Human playtest is the decision.

For each audio drop, capture ratings from at least three listeners or playtesters after a two-minute Stellar run segment and one Heat Death segment.

| Question | Target |
|---|---:|
| Did the music make the run feel faster? | 4/5+ |
| Could you identify `lineGate`, `speedPad`, `gateMiss`, `railScrape`, `damageHit`, and `death` by ear? | 5/6+ cues |
| Did the music hide important SFX? | 1/5 or lower |
| Did clean driving feel more rewarding than messy driving? | 4/5+ |
| Did Heat Death feel intentional rather than missing content? | 4/5+ |
| Did any sound become annoying after repetition? | 2/5 or lower |

If automated scores pass but the playtest sheet fails, the audio drop fails. The ear gets the last vote.

## Recommended Workflow

1. Import or replace audio according to `docs/audio/asset-ingest-checklist.md`.
2. Run `node tools/audit_audio_manifest.mjs`.
3. Run `node tools/score_audio_engagement.mjs --write-report`.
4. Run `node tools/playtest_audio_cdp.mjs` for runtime trace evidence.
5. Playtest the asset-only runtime on headphones and laptop speakers.
6. Accept only if the automated report and human playtest sheet both clear the Photon Dopamine Bar.
