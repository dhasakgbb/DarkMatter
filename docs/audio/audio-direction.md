# Photon Audio Direction

Photon needs to sound like speed crossing cosmic time, not like generic synthwave. The audio goal is A+++ studio identity: readable racing feedback, emotional cosmic pacing, and a final Heat Death sequence that feels intentionally empty.

## North Star

The player is a photon racing from the Big Bang to Heat Death. Every sound should support one of three jobs:

- Make the racing line readable without looking away from the road.
- Make each epoch feel physically and emotionally distinct.
- Make silence, thinning, and restraint feel authored rather than missing.

## Sonic References

Use these as direction, not imitation:

- F-Zero style velocity and pitch-driven feedback.
- Tron-like synthetic clarity for gates, pads, and UI.
- Interstellar-scale low-frequency pressure for black hole and Heat Death material.
- Hades-style reward clarity for memory and progression moments.

Avoid:

- Generic trailer risers.
- Busy cyberpunk loops that bury gameplay cues.
- Constant percussion in Heat Death.
- Melodic sweetness during danger reads.

## Music Deliverables

Commission loopable stem sets, not flat full mixes. Each stem should export as 48 kHz WAV for source and OGG for runtime.

Primary hero pieces:

- `title`: 90-120 seconds, loopable, quiet awe, no combat pulse.
- `race-high`: 120 seconds, loopable, modular stems for peak Stellar-era play.
- `black-hole`: 120 seconds, loopable, sparse, gravitational, low movement.
- `heat-death`: 360 seconds or modular long-form stems, fading toward near-silence.

Epoch beds:

- `Inflationary`: unstable pressure, fast attack, bright distortion.
- `Quark Plasma`: hot, dense, granular, collision-heavy.
- `Recombination`: first clarity, widening harmony, less friction.
- `First Stars`: ignition, blue-hot bloom, early triumph with danger.
- `Galactic`: curved motion, magnetic sweep, racing-line confidence.
- `Stellar`: brightest and busiest; the main dopamine race layer.
- `Degenerate`: cooler, heavier, fewer moving parts.
- `Black Hole`: mostly negative space, sub pressure, long gravity bends.
- `Heat Death`: single low tone, vanishing texture, silence as the final instrument.

Recommended stems per epoch:

- `pulse`: timing and velocity.
- `bass`: low engine pressure.
- `motion`: arps, syncopation, or propulsion.
- `texture`: epoch identity.
- `danger`: optional layer for high hazard pressure.
- `reward`: optional layer for clean racing-line streaks.

## SFX Deliverables

Commission 60-100 final one-shots and short loops. Each gameplay cue needs at least three variations unless noted.

Core racing:

- `speedPad`: magenta acceleration shove, 4 variations.
- `lineGate`: clean cyan threading cue, 6 variations across streak intensity.
- `gateMiss`: short negative read, 3 variations.
- `railScrape`: edge strain and field contact, 5 variations.
- `boostStart`: ignition transient, 3 variations.
- `boostLoop`: optional loop layered under authored engine and boost assets.
- `boostEnd`: release or depletion tail, 3 variations.

Photon state:

- `pickup`: energy pickup, 4 variations.
- `wavelengthShift`: three color-tuning reads, gamma/visible/radio variants.
- `damageHit`: absorption impact, 5 variations.
- `death`: absorbed back into the field, 2 long variations.
- `witnessChime`: final recognition, 1-2 long variations.

World:

- `hazardWhoosh`: generic pass-by, 6 variations.
- `gravityWellWhoosh`: heavier spatial pass-by, 4 variations.
- `supernovaShock`: epoch-specific heavy event, 3 variations.
- `eventHorizonPull`: black-hole pressure, 3 variations.

UI:

- `uiTick`: very small hover/toggle tick.
- `uiClick`: button confirm.
- `uiSwoosh`: panel open.
- `epochRiser`: chapter transition.
- `memoryUnlock`: reward card reveal.

## Runtime Contract

Runtime assets are declared in `photon/src/audio-manifest.json`. Small shipped assets that must survive the single-file build live under `photon/src/audio-assets/`; larger externally hosted assets can live under `photon/public/audio/` for dev/server builds.

Rules:

- Keep source WAVs outside the browser build or in a separate source archive.
- Ship OGG for runtime by default.
- All loops must be seamless.
- Loudness target: avoid clipping; leave headroom for SFX over music.
- Filenames use lowercase kebab-case.
- Manifest entries stay `enabled: false` until files exist and licensing is verified, except generated director-temp assets covered by `photon/public/audio/TEMP_LICENSE.md`.
- `photon/src/audio.ts` plays manifest assets only; missing or late assets stay silent and are traceable through `__PHOTON_AUDIO_TRACE`.

## Acceptance Tests

Before calling an audio pass final:

- Start a run with no audio assets present: no errors, and missing cues stay silent.
- Enable one SFX asset: it plays from the manifest path.
- Enable one epoch stem set: it loops and fades in on epoch start.
- Cross an epoch boundary: old loop fades out cleanly, new loop starts when its asset is available.
- Play 10 minutes: no runaway node buildup or obvious clipping.
- Reach Heat Death: music thins out and SFX restraint matches the design.

## Hiring Brief

Ask for a composer/sound designer who can deliver:

- Interactive game stems, not only rendered tracks.
- Clean loop points and implementation notes.
- Sound design that can survive fast browser playback and small speakers.
- A signed license covering commercial game distribution, trailers, streams, and storefront media.
- Confirmation that no training-data or sample-library restrictions block game release.

The strongest vendor deliverable is a small playable audio pack first: `speedPad`, `lineGate`, `railScrape`, `pickup`, `death`, plus one `Stellar` stem loop. If that works in-game, scale to the full score.
