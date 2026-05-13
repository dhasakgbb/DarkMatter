# Graphics And Physics Next Plan

## North Star

Photon should read as a real open-space racer: the whole screen is the race plane, the route is authored through cosmic structure, and hazards feel like physical fields rather than colored props.

## Graphics And Asset Quality

1. Epoch signatures:
   - Inflationary: pressure, scale stretch, quantum sparks, lens-ripple gates.
   - Quark Plasma: dense charged crowd, smeared color charge, short-lived readable gaps.
   - Recombination: fog clearing, first long sightline, soft CMB afterglow.
   - First Stars: sharp ignition blooms, star-forge debris, dangerous beauty.
   - Galactic: filaments, voids, gravitational curves, readable cosmic-web routes.
   - Stellar: richer dust, worlds as tiny readable glints, higher object density.
   - Degenerate: dim compact remnants, heavier wells, fewer brighter signals.
   - Black Hole: sparse space, strong lensing, event-horizon silhouettes.
   - Heat Death: almost nothing, slow drift, minimal particles, high contrast.

2. Asset rules:
   - Prefer procedural Three.js assets until a final source asset is clearly better.
   - Keep temporary audio in `photon/src/audio-assets` with manifest coverage and license notes.
   - Any final bitmap/GLB asset needs a source path, license/provenance, and mobile budget note.
   - Route cues must remain brighter and cleaner than background flourish.

3. Next visual slices:
   - Replace flat speed-pad surfaces with layered magnetic-field pads.
   - Give gates a directional entry/exit treatment so misses feel fair.
   - Add a ghost-route echo that uses the same route bead grammar without blocking the player.
   - Give each epoch one dominant silhouette change, not only a palette swap.

## Physics Depth

1. Gravity wells:
   - Current state: pre-contact shear, lens halo, ring visuals, slingshot reward.
   - Next: make well mass explicit per spawn, scale pull radius/ring size by mass, and clamp stacked wells so the field stays readable.
   - Acceptance: skimming a well should feel risky, rewarding, and recoverable within 1 second.

2. Flight feel:
   - Add subtle velocity carry after slingshot, then decay back into normal control.
   - Tie camera roll and lensing intensity to lateral acceleration, not only boost.
   - Keep field-edge strain punitive but readable; avoid edge strain becoming the main source of difficulty.

3. Racing grammar:
   - Gates and pads should form the suggested line.
   - Wells should create optional cut-wide or skim-close decisions.
   - Hazards should not stack directly on the readable line without a recovery affordance.

## Fun Lab Signals

- Dopamine: near misses, speed pads, gravity slings, gate streak peaks, recovery events.
- Flow: gate hit rate, streak peak, low line breaks, low clustered damage.
- Readability: gate misses, line breaks, field-strain peaks, clustered damage, boredom gaps.
- Trust: rated runs matter more than telemetry-only samples; manual quits should not harden difficulty.

## Acceptance Gates

- `npm test`
- `npm run typecheck`
- `npm run lint`
- Desktop Playwright run: start, steer, boost, phase, trigger at least one reward event, zero console warnings/errors.
- Mobile Playwright title/Fun Lab check for text fit.
- `npm run build`, refresh `photon-racer-v2.html`, and confirm the Pages artifact remains reachable after push.
