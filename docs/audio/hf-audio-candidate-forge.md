# Photon HF Audio Candidate Forge

This is the offline lane for using Hugging Face audio models without putting runtime ML or unclear licensing into Photon.

The forge creates music and SFX candidate prompts from `photon/src/audio-manifest.json`, writes a prompt matrix and license ledger under `docs/evidence/audio-candidate-forge/`, and optionally inventories candidate audio files in a scratch folder.

## What This Is

- A way to generate and compare reference music/SFX candidates for Photon.
- A prompt matrix for epoch stems, core racing cues, gravity whooshes, Heat Death textures, UI, and memory cues.
- A licensing firewall: HF output starts as reference-only until commercial rights are cleared.
- A bridge from AI sketches to either runtime temp assets or a human/commercial audio brief.

## What This Is Not

- No runtime text-to-audio calls.
- No browser-side model loading.
- No automatic manifest replacement.
- No final asset approval based only on waveform scores.

## Commands

Run from the repository root.

```bash
node tools/audio_candidate_forge.mjs --write
```

That writes:

- `docs/evidence/audio-candidate-forge/prompt-matrix.json`
- `docs/evidence/audio-candidate-forge/prompt-matrix.md`
- `docs/evidence/audio-candidate-forge/license-ledger-template.csv`
- `docs/evidence/audio-candidate-forge/import-plan.md`

After generating or collecting candidate audio files, keep them outside runtime asset folders first:

```text
photon/output/audio-candidate-forge/
```

Then inventory them:

```bash
node tools/audio_candidate_forge.mjs --write --candidate-root photon/output/audio-candidate-forge
```

That also writes:

- `docs/evidence/audio-candidate-forge/candidate-inventory.json`
- `docs/evidence/audio-candidate-forge/candidate-inventory.md`

## Hugging Face Model Lanes

| Lane | Model | License Posture | Use In Photon |
|---|---|---|---|
| MusicGen medium | `facebook/musicgen-medium` | `cc-by-nc-4.0` | Reference music, stem direction, composer briefing. |
| MusicGen stereo large | `facebook/musicgen-stereo-large` | `cc-by-nc-4.0` | Wide music references, not final runtime without separate rights. |
| AudioLDM2 | `cvssp/audioldm2` | `cc-by-nc-sa-4.0` | SFX sketches, whooshes, transitions, texture studies. |
| AudioLDM2 music | `cvssp/audioldm2-music` | `cc-by-nc-sa-4.0` | Long mood studies and Heat Death texture references. |

Default rule: treat these model outputs as reference-only. They can become runtime assets only when the license ledger proves commercial game use, trailers, streams, storefront media, and any soundtrack release needs are cleared.

## First Batch

Start with music, because the game needs an identity, not just louder one-shots:

- Stellar `pulse`, `bass`, `motion`, and `danger`.
- Heat Death `low-tone` and `vanishing-texture`.
- One alternate Galactic `pulse` or `motion` if the Stellar batch needs contrast.

Then do the SFX that teach the race by ear:

- `speedPad`
- `lineGate`
- `gateMiss`
- `railScrape`
- `gravityWellWhoosh`
- `hazardWhoosh`
- `damageHit`
- `death`

## Import Gate

Do not copy generated candidates directly into `photon/src/audio-assets/`.

Promotion sequence:

1. Put raw candidates in `photon/output/audio-candidate-forge/`.
2. Run the forge inventory command.
3. Fill the license ledger for the candidate.
4. Convert selected masters to OGG.
5. Copy only cleared runtime files into `photon/src/audio-assets/music/` or `photon/src/audio-assets/sfx/`.
6. Update `photon/src/audio-manifest.json` one cue group at a time.
7. Run `node tools/audit_audio_manifest.mjs`.
8. Run `node tools/score_audio_engagement.mjs --write-report`.
9. Run `node tools/playtest_audio_cdp.mjs`.
10. Listen on headphones and laptop speakers.

The candidate can replace director-temp audio only if the runtime audit passes, the engagement report clears the bar, the cue remains readable in play, and licensing is explicitly approved.

## Human / Vendor Handoff

The prompt matrix doubles as a micro-audition brief. If a HF candidate has the right feel but cannot ship, attach the prompt, the candidate file, and the score report to a composer/sound-designer handoff. Ask for owned stems and SFX variants that match the cue map in `photon/src/audio-manifest.json`.
