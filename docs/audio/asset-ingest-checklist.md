# Photon Audio Asset Ingest Checklist

Use this every time a purchased, commissioned, or generated audio asset enters the game.

## Before Import

- Confirm license holder and purchase/commission source.
- Save invoice/license outside the public runtime folder.
- Confirm commercial game use, trailers, social clips, streams, and storefront media.
- Confirm there is no Content ID or platform-claim surprise.
- Confirm attribution requirements.
- Confirm AI/ML restrictions do not conflict with the project.

## File Prep

- Keep source masters as WAV, preferably 48 kHz.
- Export runtime copies as OGG.
- Use lowercase kebab-case filenames.
- Trim silence.
- Verify loop points.
- Normalize by ear against gameplay, not just peak values.
- Leave SFX headroom over music.

## Runtime Import

- Place runtime files under `photon/public/audio/music/` or `photon/public/audio/sfx/`.
- Add or update entries in `photon/src/audio-manifest.json`.
- Keep `enabled: false` until the file exists and license is clear.
- Enable one cue group at a time.
- Run `npm run typecheck`.
- Run `npm run build`.
- Playtest with headphones and laptop speakers.

## Acceptance

- No console errors if an asset is missing.
- Missing assets fall back to procedural audio.
- Enabled SFX plays instead of procedural fallback.
- Enabled music fades in and out without abrupt cuts.
- Common SFX do not stack into clipping during high-speed play.
- Heat Death does not accidentally play ordinary race clutter.
