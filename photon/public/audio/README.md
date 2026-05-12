# Photon Runtime Audio

This folder is the browser-shipped audio drop zone.

Use `photon/src/audio-manifest.json` to declare music stems and SFX. Keep entries disabled until the referenced files exist and the license is cleared. The game will silently fall back to procedural Web Audio cues whenever a declared asset is missing, disabled, or not decoded yet.

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
