# Photon A+++ Audio Procurement Board

This is the practical board for getting Photon to studio-grade audio. The answer is not one marketplace and it is not one asset pack. Use three lanes at once:

- Custom score and hero SFX for identity.
- Premium libraries for source layers and fast coverage.
- Temporary in-game director audio for testing cue timing before final assets arrive.

## Decision

Photon should commission custom work for music identity and the signature gameplay cues. Use libraries for source material, variations, and temp coverage. Do not ship a soundtrack that sounds like a stock cyberpunk pack.

## Lane 1: Custom Audio Team

Goal: own the signature sound of the game.

Hire for:

- Interactive electronic/cinematic composer who delivers stems.
- Sound designer with game implementation literacy.
- Optional mixer/mastering engineer once the full cue list exists.

Shortlist sources to audition:

- SoundBetter Game Audio: https://www.soundbetter.com/s/game-audio
- SoundBetter Electronic Game Audio: https://soundbetter.com/s/game-audio/electronic
- SoundBetter Electronic Sound Design: https://soundbetter.com/s/sound-design/electronic
- Briar Soundworks: https://www.briarsoundworks.com/
- Universal Production Music / Gamescape Audio: https://www.universalproductionmusic.com/en-us/news/gamescape-audio
- Compozly custom game briefs: https://compozly.com/

Audition ask:

- One 45-second Stellar loop with `pulse`, `bass`, `motion`, and `danger` stems.
- `speedPad`, `lineGate`, `gateMiss`, `railScrape`, `pickup`, `death`, and `witnessChime`.
- Implementation notes for gain staging and loop points.
- Written license covering commercial game distribution, trailers, social clips, streams, soundtrack release discussion, and storefront media.

Selection criteria:

- Can make speed readable without clutter.
- Can make Heat Death emotionally difficult without melodrama.
- Provides stems and variations, not only stereo masters.
- Understands browser/mobile headroom and short SFX playback.
- No Content ID surprises.
- No unclear AI-training/sample-source restrictions.

## Lane 2: Premium SFX Source Cart

Goal: acquire high-quality raw material for immediate layering, temp coverage, and final variations.

Priority buys:

| Priority | Source | Use In Photon | Why It Fits |
|---|---|---|---|
| 1 | Sonniss GDC 2026 Bundle: https://gdc.sonniss.com/ | temp and layer source for impacts, whooshes, sci-fi textures | free, royalty-free, game/media oriented, large enough to mine quickly |
| 2 | A Sound Effect - Energy and Force Fields: https://www.asoundeffect.com/sound-library/energy-and-force-fields/ | speed pads, rail scrape, wavelength shift, field strain | royalty-free energy/electricity/force-field source material |
| 3 | A Sound Effect - Sci-Fi User Interface Sounds: https://www.asoundeffect.com/sound-library/Sci-Fi-User-Interface-Sounds/ | UI tick/click, menu confirms, codex/memory surfaces | cheap, focused, game-ready UI coverage |
| 4 | A Sound Effect - Sci-Fi Interface Bundle: https://www.asoundeffect.com/sound-library/sci-fi-interface-bundle/ | high-end UI, drones, machine textures, transition layers | large sci-fi micro one-shot and atmosphere bundle |
| 5 | Sound Response - Spaceship Pass-Bys via A Sound Effect: https://www.asoundeffect.com/sounddesigner/sound-response/ | hazard whooshes, gravity well pass-bys, boost tails | pass-by motion maps directly to Photon hazards |
| 6 | BOOM Library The Interface: https://www.boomlibrary.com/sound-effects/the-interface/ | polished UI and futuristic confirm/error reads | premium UI library from a top-tier SFX vendor |
| 7 | BOOM Library / BOOM ONE: https://www.boomlibrary.com/ | broad final-layer library if budget allows | industry-grade general library for sound designers |
| 8 | WOW Sound: https://wowsound.com/ | backup game music/SFX licensing lane | game-specific paid licensing path |

License rule:

- Store invoice/license PDFs under a private delivery folder, not committed unless allowed.
- Add a local `AUDIO_LICENSES.md` with source, license holder, date, project, and allowed use.
- Do not use assets with attribution-only, non-commercial, unclear YouTube Content ID, or extraction-hostile terms unless legal signs off.

## Lane 3: Temporary Director Audio

Goal: get timing, gain, and game feel right before final assets arrive.

Use original generated or procedural temp sounds only for:

- validating cue timing,
- proving music stem transitions,
- checking mix headroom,
- communicating intent to the commissioned audio team.

Do not mistake temp audio for the final sound. The final bar is "memorable and ownable," not "present."

## First Purchase / Hire Sprint

Day 1:

- Download Sonniss GDC 2026 bundle and archive the license.
- Buy `Energy and Force Fields`.
- Buy either `Sci-Fi User Interface Sounds` or `Sci-Fi Interface Bundle`.
- Ask three custom candidates for a paid micro-audition.

Day 2:

- Mine 10-20 temp SFX candidates.
- Convert selected runtime copies to OGG.
- Enable only those assets in `photon/src/audio-manifest.json`.
- Playtest gate/pad/rail/death/witness reads.

Day 3:

- Choose one composer/sound designer for the micro-audition.
- Give them `docs/audio/audio-direction.md`, this procurement board, and a gameplay video.
- Require stem delivery and implementation notes.

## Micro-Audition Brief

Subject: Photon micro-audition: cosmic racing game audio

Photon is a browser-based cosmic racing game. The player is a photon racing from the Big Bang to the Heat Death of the universe. We need speed, clarity, and cosmic restraint. The sound should not be generic synthwave.

Please quote a paid micro-audition for:

- 45 seconds of loopable Stellar-era music, delivered as stems: `pulse`, `bass`, `motion`, `danger`.
- Seven SFX: `speedPad`, `lineGate`, `gateMiss`, `railScrape`, `pickup`, `death`, `witnessChime`.
- One paragraph of implementation notes.
- License terms for commercial game distribution, trailers, streams, social clips, and store pages.

References: high-speed F-Zero readability, Tron-like synthetic clarity, Interstellar-scale low-frequency restraint, Hades-like reward legibility. Avoid constant EDM, trailer riser spam, and melodic clutter during gameplay.

## Minimum Final Deliverables

Music:

- Title theme.
- 9 epoch stem sets.
- Heat Death long-form ending material.
- Witness/credits ending.

SFX:

- 80+ one-shots/short loops.
- At least 3 variations for common gameplay cues.
- Separate mix notes for small speakers and headphones.

Implementation:

- OGG runtime exports.
- WAV source masters.
- Loop point notes.
- Cue mapping sheet matching `photon/src/audio-manifest.json`.
- License packet.

## Go / No-Go

Go if:

- Clean driving sounds better than messy driving.
- A player can identify pad, gate hit, gate miss, rail scrape, damage, and death by ear.
- Heat Death sounds like an authored ending, not missing content.
- The score has at least one hook that belongs to Photon.

No-go if:

- It sounds like stock cyberpunk.
- Music masks racing cues.
- SFX are cool in isolation but unreadable at speed.
- Licensing cannot survive commercial release and streaming.
