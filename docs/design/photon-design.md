# PHOTON — Design Document

> "You are born. You do not remember why."
> "You forget. But the universe remembers what you've seen."

## Vision in one sentence

Photon is a 30-minute roguelike where each successful run is the entire history of physical reality, and each death adds a memory the universe carries forward.

## The two design pillars

Every feature, copy line, audio cue, hazard, and visual must serve at least one of these. If it serves neither, cut it or reshape it.

### Pillar 1: The run IS the universe

A "long run" is not a phrase that exists in this game. There is only "you witnessed the heat death" or "you forgot before the end."

This reframes the player's relationship with the run. Failure is not running out of energy. Failure is the universe outliving you. Success is not skill. Success is presence.

Practical consequences:

The 30-minute target run length is not arbitrary. It maps to the full cosmic timeline, non-linearly compressed. The Inflationary Epoch lasts 30-45 seconds. The Stellar Era takes the longest (six to eight minutes) because that's when complexity peaked and the player is most engaged. The Black Hole Era thins out. The Heat Death takes five-plus minutes of nearly nothing, and that emptiness is the entire point of the game.

Pacing arc, in order of intensity (not time):
- **Inflation** (45s): explosive, chaotic, fast, near-impossible to die
- **Quark Plasma** (90s): dense, hot, lots of fluctuations
- **Recombination** (90s): the visual reveal moment, plasma parts, you see for the first time
- **First Stars** (3 min): nucleosynthesis, supernovae as one-shot shockwaves
- **Galactic Era** (4 min): spiral arm hazards, magnetic field eddies
- **Stellar Era** (6 min): peak complexity, dense hazards, the longest epoch — most players who fail will fail here
- **Degenerate Era** (3 min): white dwarfs, neutron stars, slingshots
- **Black Hole Era** (4 min): event horizons, must-phase walls, mostly empty space, ominous
- **Heat Death** (6 min): five minutes of fade-to-black with one final pickup. Audio drops to a single tone. Then silence.

Difficulty is non-monotonic. It rises through Galactic, peaks in Stellar, falls through Black Hole, and Heat Death is mechanically easy because nothing is left to dodge. The challenge of Heat Death is psychological. It is meant to be uncomfortable. It is meant to make some players quit and that is fine.

Surface to the player:
- The title screen tracks "N photons have witnessed the heat death" globally (a localStorage int the player can also feel proud of personally; later, an actual server count)
- A cosmic time HUD overlay on the right side: "T + 4.7 billion years" or similar, scaling non-linearly with epoch
- Each epoch transition shows a chapter card with the cosmological event in plain language ("The plasma parts. Photons fly free for the first time.")
- The achievement "You witnessed the universe" exists. There are no other terminal achievements. Surviving everything else is just practice for that one.
- The tagline on the title screen and any future store page: "Survive the universe."

### Pillar 2: The photon remembers

Death is not a failure state. Death is the photon being absorbed back into the universe, taking its experiences with it. The next photon born inherits memories.

Memories are not codex entries. The codex (already implemented) stores facts: "A photon is a quantum of the electromagnetic field." Memories store *experiences*, in second person, with the universe as narrator.

Examples of memory copy:

> "You remember the taste of plasma. Hot, wet, electric. A million billion years before the word 'taste' could exist."

> "You remember when the first stars ignited. You were inside one of them, briefly. You felt the dark before, and the light after."

> "You remember falling toward the well. You did not fall. The well unfolded around you and you came out the other side, somewhere later."

Three types of memory, all surfaced together but distinguished visually:

1. **Pure narrative memories** (the majority): just text, beautifully formatted. No mechanical effect. Their purpose is to reward exploration and reaching new milestones.
2. **Resonance memories** (gameplay): grant a passive effect for all future runs. Example: "You remember the gluon binding" → first chained gluon strand each run is auto-passable.
3. **Threshold memories** (unlocks): named keys that unlock variants, modes, or secret epochs. Example: "You remember being everywhere at once" unlocks Quantum Photon variant.

How memories are earned:
- One memory per epoch reached for the first time (across runs)
- One memory per first-time event (first wormhole opened, first chain phased, first death in Black Hole Era, first time held boost for 10 seconds, etc.)
- One memory per "milestone of presence" (first run that survives 5 minutes, first run that survives 15, first survives 25, first witnesses heat death)
- Cap of three memories per single run to keep them special

Reframing existing systems through Pillar 2:

- The death panel currently says "ABSORBED." It should still say that, but underneath should appear "You forget. But the universe remembers." with new memory cards displayed like Hades' boon UI.
- The codex panel should get a sister panel called "Memories" with the same UI grammar. Tabs at top: Codex / Memories.
- The upgrade picker between epochs is a stat thing. It stays mechanical. But it gets reframed: each upgrade card is the photon "feeling" something it didn't before. Headers go from "Top velocity" to "You feel faster. The void resists less." Same +8% speed, more flavor.
- The upgrade unlock thresholds stay as-is. Memories sit *next* to upgrades, not in place of them.

## The signature scene

Every great game has a moment players talk about. For Photon, that scene is the Heat Death epoch.

Specification:
- 6-minute duration in real time
- Hazard count drops to ~1 every 30 seconds
- Pickup count drops to one total, placed at minute 5
- Visuals: nebula shader fades to near-black over the first 90 seconds. Stars dim to 30% then 15% then 5% then off. The tunnel rings dim and slow their shimmer rate.
- Audio: authored Heat Death low-tone and vanishing texture collapse toward near-silence over the final third of the epoch. Engine hum stays on but softens. No SFX except the player's own boost and witness-critical cues.
- The HUD shrinks during this epoch. Distance counter and combo display fade out. Only the wavelength selector and energy bar remain.
- The cosmic time overlay accelerates dramatically: "T + 100 quintillion years," "T + 10^100 years," and so on. The numbers stop meaning anything and that's the point.
- The final pickup at minute 5 grants a memory called "The last photon." That memory unlocks the credits and the achievement.
- After collecting it, the photon continues for one more minute through total black, then the screen fades to white, then a single line: "You have witnessed the universe." Hold for 10 seconds. Then the credits scroll silently.

This is the only ending. There is no boss. There is no explosion. There is no win condition besides being there at the end.

## How the existing systems map onto the pillars

| Existing system | Reframe under pillars |
|---|---|
| Wavelength shifting | Stays mechanical. Becomes a way the photon "tunes itself to the era." |
| Phase chains / combo | Surfaced as "resonance" instead of "combo." The HUD multiplier becomes a tuning fork icon. |
| Wormholes on gravity well phase | Reframed as "you remember a shortcut." Grants a memory on first occurrence. |
| Energy meter | Stays. Hitting zero is "you are absorbed back into the field." |
| Boost | Stays. No reframe needed. |
| Codex | Stays for facts. Add Memories as a sister tab. |
| Upgrades | Stays mechanically. Copy gets reframed in second person. |
| Variants | Each variant gets a Memory-themed unlock condition and lore. |
| Dark matter filaments | A rare invisible-mass route event. The player detects it by lensing/shear before seeing a reward label, reinforcing that unseen mass is known by gravitational effect, not by glow. |
| Science Mode | Baseline quantitative HUD, sonification, and post-run path analysis: redshift, flow, dark-matter signal, E=hc/lambda, wavelength stretch, proper vs comoving distance, scale factor, CMB temperature, matter/dark-energy fractions, and expansion drift are always part of the run. Phase chains show a small which-path interference cue that resolves on resonance. The science layer is the game, not a side mode. |
| Endless mode | Removed. Replaced with the actual remaining epochs ending in Heat Death. |

That last one is important: **endless mode is incompatible with Pillar 1.** If the universe can be looped, it isn't really the universe. Endless was a useful scaffolding while we had only three epochs. Once Stellar through Heat Death exist, endless gets cut. Players who want to play "again" do so by starting a new run, which is again the entire universe, with new memories carried.

## Implementation roadmap

In order of priority (each phase ships and is playtested before the next):

**Phase A: The Heat Death proof of concept** (this is the thing that proves the vision works)
- Replace endless mode with a placeholder Heat Death epoch
- Six minutes long, near-empty, fading audio and visuals
- One final pickup that triggers the "You have witnessed the universe" sequence
- Add the cosmic time HUD overlay
- Ship and playtest. The question: does the slow-fade ending land emotionally, or do players bounce? If it lands, the rest of the design is justified.

**Phase B: The memory system mechanics**
- Memory data structure (id, type, body, epochs visited, conditions met)
- Death-screen UI: existing "ABSORBED" panel gets a "You forget. But the universe remembers." subtitle and one to three memory cards underneath
- Memories tab on title screen, sister to Codex
- Initial set of 30 memory entries written
- Trigger conditions wired to existing events (epoch reached, first wormhole, first chain, milestones)

**Phase C: The remaining epochs**
- First Stars, Galactic Era, Stellar Era, Degenerate Era, Black Hole Era
- Each with palette, drone, hazard mix, signature beat
- Difficulty curve calibrated against the non-monotonic spec above

**Phase D: The reframe pass**
- Rewrite all UI copy in second-person universe-as-narrator voice
- Rename "combo" to "resonance"
- Add chapter cards between epochs
- Replace death copy with the new framing

**Phase E: Production values**
- Per-epoch authored music tracks (not just procedural drones) for Recombination, Stellar Era, Black Hole Era, Heat Death
- Hand-tuned shader work on the Heat Death fade
- Voice line readings of the more important memories (optional, expensive, ships only if budget allows)

**Phase F: Telemetry and polish**
- Anonymous count of "photons who witnessed the heat death" sent to a tiny server endpoint
- Surface that count on the title screen
- Achievement system

## Risks and tradeoffs

**Risk: Heat Death is boring instead of profound.**
The whole vision rests on a six-minute slow-fade landing emotionally. If it doesn't, the game ends weakly and Pillar 1 fails. Mitigation: prototype Phase A first. If two of three playtesters say "I quit before the end was on purpose," not "I quit because I was bored," we're on track. If they say "I closed the tab," reduce Heat Death duration to 3 minutes and add one quiet visual event in the middle.

**Risk: Memory copy is precious instead of evocative.**
Bad cosmic-poetry copy is worse than no copy at all. We need a writer (or a tight self-editing loop) to keep the memory text grounded. The voice should be plain, second person, sensory. Avoid words like "ineffable" and "transcendent." Reach for "wet," "loud," "small," "alone."

**Risk: Cutting endless mode upsets players who liked it.**
This is fine. Endless mode is a different game. Photon is not that game. If the audience that wants endless is large, we make a separate game mode for them later, but we do not let it dilute the main experience.

**Risk: 30 minutes is too long for a single sitting on mobile.**
Mitigation: between-epoch save points. The player can quit and resume at the start of any epoch they've reached. The full run can be played in chunks. The Heat Death epoch is not skippable and not chunkable.

## Marketing positioning

Tagline: **"Survive the universe."**

Subtitle: A 30-minute roguelike where each run is the history of physical reality and each death adds a memory.

The pitch sentence: *Photon is what would happen if Hades' narrative loop met Cosmos and they decided to make a Tron racer.*

The hook for influencers: "I played a 30 minute video game and at the end the universe ended and I cried."

The hook for stores: rare combination of high replayability (memory unlocks across hundreds of runs), low session length flexibility (chunkable by epoch), and a guaranteed emotional moment that drives word of mouth.
