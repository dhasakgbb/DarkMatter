# Photon Runtime Audio

This folder is the optional external browser audio drop zone.

Use `photon/src/audio-manifest.json` to declare music stems and SFX. Small assets that must work in the generated single-file build should live under `photon/src/audio-assets/` instead, where Vite can inline them. Larger externally hosted assets can live here for dev/server builds. The game will silently fall back to procedural Web Audio cues whenever a declared asset is missing, disabled, or not decoded yet.

Recommended runtime format:

- `ogg` for shipped browser playback.
- `wav` only for very short UI/SFX if quality requires it.
- 48 kHz source masters stored outside this runtime folder or in a separate source archive.

Suggested folders:

- `music/<epoch-or-state>/<stem>.ogg`
- `sfx/<cue>/<cue>-01.ogg`

After adding assets, run:

```bash
npm run typecheck
npm run build
```
