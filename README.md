# DarkMatter / PHOTON

PHOTON is the TypeScript/Vite web game in this repo: a cosmic roguelike racer where a photon races from the Big Bang toward heat death.

## Project Map

| Path | Purpose |
| --- | --- |
| `photon/` | Main Vite app, source code, tests, package scripts, and checked-in audio source assets. |
| `photon/src/` | Runtime TypeScript for game state, rendering, input, HUD, audio, racing grammar, memories, and Fun Lab. |
| `photon/src/audio-assets/` | Tracked source audio pack used by the runtime manifest and build. |
| `photon/public/audio/` | Public audio staging structure and licensing notes. |
| `docs/design/photon-design.md` | Canonical product/design north star for Photon. |
| `photon-racer-v2.html` | Published single-file game artifact for GitHub Pages. Generated from the Vite build. |
| `index.html` | GitHub Pages launcher that redirects to `photon-racer-v2.html`. |
| `docs/audio/` | Audio direction, pipeline, procurement, and ingest documentation. |
| `docs/superpowers/` | Implementation plans, specs, and audit notes from earlier passes. |
| `docs/archive/` | Historical logs and legacy standalone artifacts that are useful as reference but not active entry points. |
| `docs/evidence/audio-playtest/` | Checked-in audio playtest evidence produced by `tools/playtest_audio_cdp.mjs`. |
| `tools/` | Repo utility scripts for audio audit/generation and browser audio playtest capture. |

## Generated Artifact Contract

The active source of truth is the Vite app under `photon/`. The root `photon-racer-v2.html` file is intentionally tracked because GitHub Pages serves it directly, but it should only be refreshed from the build output:

```sh
cd photon
npm run precommit
```

That command runs tests, typecheck, production build, and `sync:standalone`, which copies `photon/dist/index.html` to `../photon-racer-v2.html`.

## Cleanup Rules

Ignored browser captures, temporary screenshots, Vite timestamp modules, `.DS_Store`, and old generated build directories are disposable local residue. Keep source, docs, `docs/evidence/audio-playtest` evidence, `docs/design/photon-design.md`, and `photon-racer-v2.html` under review when changing the repo shape.
