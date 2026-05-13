# Director Temp Audio Pack

This pack is original generated placeholder audio for Photon. It exists to keep the manifest-based studio asset path testable while the current build defaults to the richer real-time `ProceduralSynth` runtime.

Status:

- It is not final music or final sound design.
- It is safe to use as temporary in-game audio because it is generated locally from deterministic synthesis.
- It is not the default audible path in the current game; `settings.proceduralAudio` starts enabled and the pause menu exposes the A/B toggle.
- It should be replaced by commissioned or licensed studio assets once the custom-audio sprint lands.

Coverage:

- Music stems for every epoch, including the four-stem Stellar high-speed layer.
- Racing SFX: pickup, speed pad, line gate, gate miss, rail scrape.
- Photon state SFX: wavelength shifts, damage, death, witness chime.
- World/UI SFX: hazard whoosh, gravity-well whoosh, looped engine bed, UI tick/click/swoosh, epoch riser, memory unlock.
- Runtime location: `photon/src/audio-assets/`, so Vite can inline these small temporary assets into the single-file build as the asset-mode fallback.

Regenerate with:

```bash
python3 tools/generate_director_audio.py
```

Then validate:

```bash
cd photon
npm run typecheck
npm test
npm run build:standalone
```
