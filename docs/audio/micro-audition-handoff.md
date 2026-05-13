# Photon Micro-Audition Handoff

This is the paid micro-audition package for final Photon audio. The goal is not a full soundtrack. The goal is to prove that a composer/sound designer can make Photon feel faster, cleaner, and more emotionally specific than the generated reference pack.

## Project Frame

Photon is a browser-based cosmic racing game. The player is a photon crossing the full history of the universe, from the Big Bang to Heat Death. The audio must serve two pillars:

- The run is the universe.
- The photon remembers.

The sound should be cosmic racing minimalism: readable racing signals inside an evolving score that gradually learns how to disappear. Avoid stock synthwave, constant EDM drums, generic trailer risers, and big explosion-style death sounds.

## Reference Pack

The current in-game pack is deterministic generated director audio, not final production audio. It is useful as a timing, routing, and density reference.

Current automated reference evidence:

- `node tools/audit_audio_manifest.mjs`: 20 music entries, 50 SFX entries, 70 bundled assets, 0 missing paths, 70/70 decoded.
- `node tools/score_audio_engagement.mjs --write-report`: `rawWaveform 98/100`, `racingReadability 100/100`, `heatDeath 96/100`, `coverage 100/100`, final `overall 68/100` because generated temporary audio is capped at reference quality.
- `node tools/playtest_audio_cdp.mjs`: browser asset-mode smoke passed with 9 music buffers, 17 SFX buffers, and no CDP issues.

The production audition must beat the reference by ear, not merely by waveform score.

## Deliverables

Music:

- `Stellar / pulse`: 45-60 seconds, seamless loop, clean forward timing.
- `Stellar / bass`: 45-60 seconds, seamless loop, low propulsion with browser/mobile headroom.
- `Stellar / motion`: 45-60 seconds, seamless loop, speed and curved motion without masking SFX.
- `Stellar / danger`: 45-60 seconds, seamless loop, tension layer that can sit under peak play.

SFX:

| Cue | Count | Direction |
|---|---:|---|
| `speedPad` | 4 | Magenta acceleration shove; instant pleasure, short readable tail. |
| `lineGate` | 6 | Cyan tuned confirmation; stackable and streak-friendly. |
| `gateMiss` | 3 | Short negative read; not comedic, not harsh. |
| `railScrape` | 5 | Field strain at the edge, not metal scraping. |
| `pickup` | 4 | Energy acquisition; bright but smaller than line gates. |
| `damageHit` | 5 | Clear absorption impact with room for visual trauma. |
| `death` | 2 | Absorbed back into the field; falling, soft, final. |
| `hazardWhoosh` | 6 | Spatial pass-by threat; readable without masking gates. |
| `gravityWellWhoosh` | 4 | Heavier spatial pass-by; gravitational bend and pressure. |
| `witnessChime` | 1-2 | Recognition after silence; sparse, human, earned. |

Implementation notes:

- 48 kHz WAV source masters.
- OGG runtime exports.
- Loop point notes for every stem.
- Suggested gain staging and ducking notes.
- Notes on any sample libraries, synthesis sources, or generative tools used.
- Written license terms for commercial game distribution, trailers, social clips, streams, storefront media, and Content ID safety.

## Acceptance Bar

Automated checks:

- `node tools/audit_audio_manifest.mjs` passes with 0 missing paths and 0 decode failures.
- `node tools/score_audio_engagement.mjs --write-report` reports `overall >= 85` with no director-temp gate.
- `racingReadability >= 85`.
- No clipping/headroom findings.
- No missing-variation findings for the cues in this handoff.

Human playtest checks:

- Clean driving sounds better than messy driving.
- A player can identify `speedPad`, `lineGate`, `gateMiss`, `railScrape`, `damageHit`, and `death` by ear while steering.
- Music makes Stellar feel faster without hiding SFX.
- The pack reads on headphones and laptop speakers.
- `death` sounds like absorption, not failure.
- `witnessChime` sounds like recognition, not a generic reward jingle.

If automated scores pass but the in-game listening pass fails, the audition fails.

## Files To Read

- `docs/audio/audio-direction.md`
- `docs/audio/audio-engagement-metrics.md`
- `docs/audio/procurement-board.md`
- `docs/audio/asset-ingest-checklist.md`
- `photon/src/audio-manifest.json`

## Delivery Path

Put runtime OGG candidates under `photon/src/audio-assets/` only after license/source clarity. Update `photon/src/audio-manifest.json` one cue group at a time. Run the manifest audit, engagement scorer, and browser smoke before playtest signoff.
