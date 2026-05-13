import * as THREE from 'three';

// ============================================================================
// EPOCHS — the nine eras of the universe, in order.
// Heat Death is the final epoch; reaching its final pickup triggers the witness ending.
// ============================================================================
export interface Epoch {
  name: string;
  subtitle: string;
  duration: number;          // seconds of real-world play
  paletteA: THREE.Color;
  paletteB: THREE.Color;
  palettePoint: THREE.Color;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  speedMul: number;
  hazardDensity: number;
  pickupDensity: number;
  twistFreq: number;
  twistAmp: number;
  description: string;
  chapter: string;
  hazardKinds: string[];
  codexKey: string;
  isHeatDeath?: boolean;
}

export const EPOCHS: Epoch[] = [
  {
    name: 'Inflationary', subtitle: '10⁻³⁶ → 10⁻³² seconds', duration: 35,
    paletteA: new THREE.Color(0xff2a55), paletteB: new THREE.Color(0x6b00b3), palettePoint: new THREE.Color(0xfff7d0),
    fogColor: new THREE.Color(0x1a0418), fogNear: 60, fogFar: 480,
    speedMul: 1.00, hazardDensity: 0.7, pickupDensity: 1.4, twistFreq: 0.012, twistAmp: 8,
    description: 'Spacetime expanding faster than light. The vacuum boils with quantum fluctuations that seed every galaxy yet to come.',
    chapter: 'You begin inside the blow. Distance has not learned to keep secrets.',
    hazardKinds: ['fluctuation','gravityWell'], codexKey: 'INFLATION',
  },
  {
    name: 'Quark Plasma', subtitle: '10⁻⁶ seconds', duration: 40,
    paletteA: new THREE.Color(0xff8a3c), paletteB: new THREE.Color(0x8a1a78), palettePoint: new THREE.Color(0xfff3a8),
    fogColor: new THREE.Color(0x2a0820), fogNear: 60, fogFar: 460,
    speedMul: 1.06, hazardDensity: 1.1, pickupDensity: 1.0, twistFreq: 0.018, twistAmp: 12,
    description: 'A soup of quarks and gluons too hot for protons to form. Color charge tangles every photon path.',
    chapter: 'You are made, broken, and made again. The soup is everything.',
    hazardKinds: ['gluon','fluctuation','gravityWell'], codexKey: 'QGP',
  },
  {
    name: 'Recombination', subtitle: '380,000 years', duration: 50,
    paletteA: new THREE.Color(0xffd980), paletteB: new THREE.Color(0xff5e9c), palettePoint: new THREE.Color(0xf2f7ff),
    fogColor: new THREE.Color(0x1c1a30), fogNear: 80, fogFar: 520,
    speedMul: 1.00, hazardDensity: 1.0, pickupDensity: 1.0, twistFreq: 0.010, twistAmp: 14,
    description: 'Electrons bind to nuclei. The plasma fog clears. The light you carry now will become the cosmic microwave background.',
    chapter: 'The fog opens. For the first time, you travel farther than a scream.',
    hazardKinds: ['plasma','fluctuation','gravityWell'], codexKey: 'CMB',
  },
  {
    name: 'First Stars', subtitle: 'T + 200 million years', duration: 190,
    paletteA: new THREE.Color(0xff8a3c), paletteB: new THREE.Color(0x1a3a8a), palettePoint: new THREE.Color(0xfff2c8),
    fogColor: new THREE.Color(0x180a18), fogNear: 70, fogFar: 500,
    speedMul: 1.10, hazardDensity: 1.2, pickupDensity: 0.9, twistFreq: 0.014, twistAmp: 16,
    description: 'Hydrogen and helium collapse into the first stars. They burn brilliant, brief, and they explode. Most of what you fly through tonight was forged here.',
    chapter: 'The dark catches fire. Brightness is not safety.',
    hazardKinds: ['plasma','gravityWell','darkMatterFilament','supernova','fluctuation'], codexKey: 'FIRSTSTARS',
  },
  {
    name: 'Galactic', subtitle: 'T + 1 billion years', duration: 230,
    paletteA: new THREE.Color(0x6e3aff), paletteB: new THREE.Color(0x2a78b0), palettePoint: new THREE.Color(0xb0d4ff),
    fogColor: new THREE.Color(0x100820), fogNear: 80, fogFar: 540,
    speedMul: 1.08, hazardDensity: 1.1, pickupDensity: 1.0, twistFreq: 0.020, twistAmp: 22,
    description: 'Galaxies form inside dark matter halos. Spiral arms whip past in long curves. Invisible mass bends every photon path before starlight names it.',
    chapter: 'Matter learns to turn in great slow wheels. The unseen scaffold turns first.',
    hazardKinds: ['plasma','gluon','gravityWell','darkMatterFilament','fluctuation'], codexKey: 'GALACTIC',
  },
  {
    name: 'Stellar', subtitle: 'T + 5 billion years', duration: 360,
    paletteA: new THREE.Color(0xffb04a), paletteB: new THREE.Color(0xb01a4a), palettePoint: new THREE.Color(0xfff8d4),
    fogColor: new THREE.Color(0x18080a), fogNear: 80, fogFar: 520,
    speedMul: 1.12, hazardDensity: 1.4, pickupDensity: 1.2, twistFreq: 0.012, twistAmp: 14,
    description: 'The heyday of stars. Light, dense, complex. The visible universe rides inside a larger invisible mass field.',
    chapter: 'Worlds catch light in water, leaf, glass, and eye. Under them, unseen halos keep their shape.',
    hazardKinds: ['plasma','gluon','gravityWell','darkMatterFilament','fluctuation','supernova'], codexKey: 'STELLAR',
  },
  {
    name: 'Degenerate', subtitle: 'T + 100 trillion years', duration: 200,
    paletteA: new THREE.Color(0x4a4a90), paletteB: new THREE.Color(0x1a1a3a), palettePoint: new THREE.Color(0xc4c8ff),
    fogColor: new THREE.Color(0x080814), fogNear: 60, fogFar: 420,
    speedMul: 0.95, hazardDensity: 0.9, pickupDensity: 0.7, twistFreq: 0.010, twistAmp: 10,
    description: 'Stars die. White dwarfs, neutron stars, brown dwarfs. The universe cools, but slowly. The unseen mass remains as the lights go out.',
    chapter: 'The bright ones die. The bones of the dark keep holding the road.',
    hazardKinds: ['gravityWell','darkMatterFilament','plasma','fluctuation'], codexKey: 'DEGENERATE',
  },
  {
    name: 'Black Hole', subtitle: 'T + 10⁴⁰ years', duration: 240,
    paletteA: new THREE.Color(0x180828), paletteB: new THREE.Color(0x000000), palettePoint: new THREE.Color(0x4a3a8a),
    fogColor: new THREE.Color(0x040408), fogNear: 40, fogFar: 280,
    speedMul: 0.85, hazardDensity: 0.5, pickupDensity: 0.4, twistFreq: 0.006, twistAmp: 6,
    description: 'The matter era ends. Only black holes remain, slowly evaporating. Space is mostly empty, and you can hear it.',
    chapter: 'Gravity stops bending the road and starts making verdicts.',
    hazardKinds: ['gravityWell','eventHorizon','fluctuation'], codexKey: 'BLACKHOLE',
  },
  {
    name: 'Heat Death', subtitle: 'T + 10¹⁰⁰ years', duration: 360,
    paletteA: new THREE.Color(0x0a0a18), paletteB: new THREE.Color(0x05050a), palettePoint: new THREE.Color(0x222244),
    fogColor: new THREE.Color(0x000000), fogNear: 30, fogFar: 200,
    speedMul: 0.55, hazardDensity: 0.06, pickupDensity: 0, twistFreq: 0.005, twistAmp: 4,
    description: 'The universe runs out of usable energy. Stars burn out. Black holes evaporate. Dark energy keeps stretching the distance between what remains. You are still here.',
    chapter: 'Nothing stops you. Expansion does not need to hurry.',
    hazardKinds: ['fluctuation'], codexKey: 'HEATDEATH', isHeatDeath: true,
  },
];

// ============================================================================
// WAVELENGTHS — three states the photon can tune to. Note: these are mutated at
// runtime when the High-Contrast accessibility toggle is on (see settings.applySettings).
// ============================================================================
export interface Wavelength {
  key: string;
  name: string;
  color: THREE.Color;
  hex: number;
}
export const WAVELENGTHS: Wavelength[] = [
  { key: 'gamma',   name: 'γ Gamma',  color: new THREE.Color(0xb888ff), hex: 0xb888ff },
  { key: 'visible', name: 'Visible',  color: new THREE.Color(0xffffff), hex: 0xffffff },
  { key: 'radio',   name: 'Radio',    color: new THREE.Color(0xff5566), hex: 0xff5566 },
];

// ============================================================================
// CODEX — factual phenomena. Memories store experience; codex stores facts.
// ============================================================================
export interface CodexEntry { title: string; body: string; }
export const CODEX_ENTRIES: Record<string, CodexEntry> = {
  PHOTON:     { title: 'You',                     body: 'A photon is a quantum of the electromagnetic field. Massless, chargeless, eternal so long as nothing absorbs you.' },
  INFLATION:  { title: 'Cosmic inflation',        body: 'In 10⁻³² seconds the universe grew by a factor of 10²⁶. Faster than light? No — space itself expanded. You rode that wave.' },
  QGP:        { title: 'Quark-gluon plasma',      body: 'For one millionth of a second the universe was hotter than two trillion Kelvin. No protons, no atoms — only quarks and the gluons that bind them.' },
  CMB:        { title: 'The microwave background',body: 'When the universe cooled to 3000 K, electrons fell into nuclei and photons stopped scattering. Those photons still arrive at every detector on Earth, redshifted to 2.7 K.' },
  GRAVWELL:   { title: 'Gravitational well',      body: 'A region where spacetime curves enough to bend your path. Even light cannot travel a straight line through one.' },
  DARKMATTER: { title: 'Dark matter scaffold',    body: 'Roughly 27% of the universe is unseen matter. It does not shine, but its gravity builds halos and filaments where galaxies can form. You detect it the same way astronomers do: by how your path bends.' },
  DARKENERGY: { title: 'Dark energy',             body: 'About 68% of today\'s cosmic energy budget behaves like dark energy. In Lambda-CDM it accelerates expansion, stretching wavelengths and thinning the future until almost nothing can meet.' },
  GAMMA:      { title: 'Gamma wavelength',        body: 'Photons with wavelengths shorter than 10⁻¹¹ m. Energetic enough to ionize matter. Most cosmic gamma rays are born from violent events.' },
  RADIO:      { title: 'Radio wavelength',        body: 'Wavelengths above 1 mm. Photons of this energy slip through dust clouds the visible spectrum cannot.' },
  GLUON:      { title: 'Gluon strand',            body: 'Gluons mediate the strong force. In the early universe they bound quarks into chains that briefly trapped passing light.' },
  REDSHIFT:   { title: 'Cosmological redshift',   body: 'Expanding space stretches every photon you encounter. The further it has traveled, the redder it gets.' },
  HEATDEATH:  { title: 'The heat death',          body: 'The far future. Entropy reaches its maximum. No usable energy remains anywhere in the cosmos. Space is dark, cold, and almost empty. You are one of the last photons still in flight.' },
  WITNESS:    { title: 'You witnessed it',        body: 'The full life of the universe took thirty minutes from your point of view. From the universe\'s point of view it took 10¹⁰⁰ years. Both numbers are true.' },
  FIRSTSTARS: { title: 'The first stars',         body: 'Several hundred million years after the Big Bang, gravity collapsed gas clouds into the first stars. They were enormous, blue-hot, and lived only millions of years before exploding as supernovae. Their corpses seeded the universe with metals.' },
  GALACTIC:   { title: 'Galaxy formation',        body: 'Stars clustered. Dark matter halos pulled gas into rotating disks. The first spiral galaxies took shape around 1 billion years after the Big Bang. The light you carry has been bent through hundreds of them.' },
  STELLAR:    { title: 'The stellar era',         body: 'The current era. Most stars in the universe are still burning. This is the brightest the universe will ever be. From here on, things slowly go dark.' },
  DEGENERATE: { title: 'The degenerate era',      body: 'Hundreds of trillions of years from now, all main-sequence stars will have burned out. Only white dwarfs, neutron stars, and brown dwarfs remain. The universe cools to nearly nothing.' },
  BLACKHOLE:  { title: 'The black hole era',      body: 'After 10⁴⁰ years, even degenerate stars are gone. Only black holes remain, slowly evaporating via Hawking radiation. The largest take 10¹⁰⁰ years to dissipate.' },
  SUPERNOVA:  { title: 'Supernova shockwave',     body: 'A massive star\'s collapse releases more energy in seconds than the sun produces in 10 billion years. The shockwave outruns even photons for the first few hours.' },
  HORIZON:    { title: 'Event horizon',           body: 'The boundary of a black hole. Inside, all paths lead inward. Light cannot climb out. Only photons of the right wavelength, at exactly the right angle, escape via Hawking emission.' },
};

// ============================================================================
// MEMORIES — qualia, not facts. Surfaced on death and in the Memories panel.
// type: narrative (flavor), resonance (passive bonus when unlocked), threshold (unlock).
// when: unlock condition map evaluated by checkMemoryTriggers().
// evolved: alternate body shown after the player has witnessed the heat death N times.
// ============================================================================
export interface MemoryCondition {
  reachedEpoch?: number;
  runs?: number;
  witnessed?: number;
  phasesLifetime?: number;
  pickupsLifetime?: number;
  peakStreak?: number;
  lineStreak?: number;
  speedPadsHit?: number;
  gatesThreaded?: number;
  gammaPhases?: number;
  visiblePhases?: number;
  radioPhases?: number;
  boostedOnce?: boolean;
  pausedOnce?: boolean;
  mutedOnce?: boolean;
  firstWormhole?: boolean;
  firstChainPhased?: boolean;
  perfectEpoch?: boolean;
  flowPeakDwell?: number;
  flowDwellLifetime?: number;
  darkMatterDetections?: number;
}
export interface MemoryResonance {
  startEnergyBonus?: number;
  startBoostBonus?: number;
  firstChainFreePerRun?: boolean;
  perfectStartBoost?: number;
}
export interface MemoryThreshold { unlockVariant?: string; }
export interface Memory {
  id: string;
  type: 'narrative' | 'resonance' | 'threshold';
  when: MemoryCondition;
  body: string;
  evolved?: { afterWitnesses: number; body: string };
  resonance?: MemoryResonance;
  threshold?: MemoryThreshold;
}
export const MEMORIES: Memory[] = [
  { id: 'first-spark',     type: 'narrative', when: { reachedEpoch: 0 },
    body: 'You remember the first pressure. No up, no dark, no room to turn. Everything was hot enough to be one thing.',
    evolved: { afterWitnesses: 1, body: 'You remember the first pressure. You know now what came after. You went anyway.' } },
  { id: 'the-soup',        type: 'narrative', when: { reachedEpoch: 1 },
    body: 'You remember the taste of plasma. Wet with charge, loud with collisions. You could not keep your shape for long.' },
  { id: 'the-fog-clears',  type: 'narrative', when: { reachedEpoch: 2 },
    body: 'You remember when space became wide enough to breathe. The fog thinned. For the first time, your direction lasted.',
    evolved: { afterWitnesses: 1, body: 'You remember when space became wide enough to breathe. The fog parts and you keep going, every time. There is something almost funny about it now.' } },
  { id: 'first-fire',      type: 'narrative', when: { reachedEpoch: 3 },
    body: 'You remember when the first stars ignited. The dark tore open. Hydrogen burned blue-white and the universe learned how to make shadows.' },
  { id: 'spiral-arm',      type: 'narrative', when: { reachedEpoch: 4 },
    body: 'You remember being inside a spiral arm. Beautiful from outside, loud from inside. The magnetic field tugged at you constantly, asking you to turn slightly, which you did.' },
  { id: 'the-stellar-era', type: 'narrative', when: { reachedEpoch: 5 },
    body: 'You remember glass, water, leaf, eye. For a while, matter became careful enough to notice you.' },
  { id: 'the-cooling',     type: 'narrative', when: { reachedEpoch: 6 },
    body: 'You remember red stars lasting longer than grief. Small, stubborn fires. They gave little light and spent it carefully.' },
  { id: 'the-quiet',       type: 'narrative', when: { reachedEpoch: 7 },
    body: 'You remember the great black mouths. Around them, time dragged its feet. Light bent until even escape felt ashamed.' },
  { id: 'the-dark-after',  type: 'narrative', when: { reachedEpoch: 8 },
    body: 'You remember crossing a place where nothing answered. No dust. No gas. No eyes. Only distance, clean and terrible.',
    evolved: { afterWitnesses: 1, body: 'You remember crossing a place where nothing answered. You can see the others now. They are with you. They are all of them you.' } },
  { id: 'first-tune',      type: 'resonance', when: { phasesLifetime: 5 },
    body: 'You remember tuning yourself. Some wavelengths resonate exactly. Some punch through. Some slip past. Matter was not a wall; it was a question.',
    resonance: { startEnergyBonus: 8 } },
  { id: 'chained',         type: 'resonance', when: { firstChainPhased: true },
    body: 'You remember being held by three at once. You remember the moment one of them let go and the rest had to as well. You learned that grip is plural.',
    resonance: { firstChainFreePerRun: true } },
  { id: 'the-shortcut',    type: 'narrative', when: { firstWormhole: true },
    body: 'You remember a shortcut. You did not take it. The shortcut took you. You came out the other side already there.' },
  { id: 'untouched',       type: 'resonance', when: { perfectEpoch: true },
    body: 'You remember moving through everything without touching anything. Brief. The universe asked nothing of you and you gave it back.',
    resonance: { perfectStartBoost: 25 } },
  { id: 'first-end',       type: 'narrative', when: { runs: 1 },
    body: 'You remember being absorbed. It did not hurt. You entered matter and did not come out.',
    evolved: { afterWitnesses: 1, body: 'You remember being absorbed. You remember being absorbed many times. The continuing was always the part that mattered.' } },
  { id: 'last-photon',     type: 'threshold', when: { witnessed: 1 },
    body: 'You remember being one of the last. The last light is not brave. It is only still moving.',
    evolved: { afterWitnesses: 2, body: 'You remember being one of the last. You were not the last. You are still not the last. You wonder if there is a last.' },
    threshold: { unlockVariant: 'gamma' } },
  { id: 'second-witness',  type: 'narrative', when: { witnessed: 2 },
    body: 'You remember the second time it ended. You expected it this time. It was not less.' },
  { id: 'fifth-witness',   type: 'narrative', when: { witnessed: 5 },
    body: 'You remember the fifth time. The universe was patient. You were beginning to suspect you were not the photon. You were the watching.' },
  { id: 'first-boost',     type: 'narrative', when: { boostedOnce: true },
    body: 'You remember pushing. You did not have a body but you remembered having one in some other run. The push felt like a body remembering.' },
  { id: 'light-sail',      type: 'narrative', when: { speedPadsHit: 1 },
    body: 'You remember the magenta shove. The road spent itself under you and called it help.' },
  { id: 'the-line',        type: 'resonance', when: { lineStreak: 4 },
    body: 'You remember a gate opening around you. Not a door. A line that was correct enough for the universe to reward it.',
    resonance: { startBoostBonus: 10 } },
  { id: 'fast-streak',     type: 'resonance', when: { peakStreak: 5 },
    body: 'You remember chaining. One color, then another, then another, the universe revealing its cross-section in real time.',
    resonance: { startBoostBonus: 15 } },
  { id: 'deep-streak',     type: 'threshold', when: { peakStreak: 12 },
    body: 'You remember the resonance. Twelve obstacles in a row tuned to your wavelength. The universe was speaking your language and not the other way around.',
    threshold: { unlockVariant: 'gamma' } },
  { id: 'gamma-tuning',    type: 'narrative', when: { gammaPhases: 10 },
    body: 'You remember the gamma rays. Sharp, narrow, expensive. Most things let you through but the things that did not let you through were violent about it.' },
  { id: 'radio-patience',  type: 'narrative', when: { radioPhases: 10 },
    body: 'You remember the radio. Soft, wide, slow. It went where the sharper colors could not.' },
  { id: 'visible-thanks',  type: 'narrative', when: { visiblePhases: 10 },
    body: 'You remember the visible. Plain old light. The wavelength most things were tuned for. You were grateful for it. You forgot to say so.' },
  { id: 'fivefold',        type: 'narrative', when: { runs: 5 },
    body: 'You remember being five photons. You remember each of their endings. You also remember feeling, vaguely, that they had all been you.' },
  { id: 'twentyfive',      type: 'narrative', when: { runs: 25 },
    body: 'You remember being twenty-five photons. The earliest ones felt like strangers. The last few felt like rehearsals.' },
  { id: 'fifty',           type: 'threshold', when: { runs: 50 },
    body: 'You remember fifty endings. You stopped counting after that. The number stopped mattering.',
    threshold: { unlockVariant: 'gamma' } },
  { id: 'pickups-100',     type: 'resonance', when: { pickupsLifetime: 100 },
    body: 'You remember finding things. Little glowing leftovers from older photons that did not make it. You took them. You made of them what you could.',
    resonance: { startEnergyBonus: 12 } },
  { id: 'dark-matter-bones', type: 'threshold', when: { darkMatterDetections: 1 },
    body: 'You remember something unseen drawing the road through places that never shone. The course has bones.',
    threshold: { unlockVariant: 'xray' } },
  { id: 'the-pause',       type: 'narrative', when: { pausedOnce: true },
    body: 'You remember stopping. The universe did not stop. Then it did.' },
  { id: 'the-mute',        type: 'narrative', when: { mutedOnce: true },
    body: 'You remember the silence. Not the kind that was waiting at the end. The other kind. The chosen kind.' },
  { id: 'the-end',         type: 'threshold', when: { reachedEpoch: 8, runs: 5 },
    body: 'You remember knowing where this was going. Five times. Each time you went anyway.',
    threshold: { unlockVariant: 'gamma' } },
  { id: 'flow-veil',       type: 'narrative', when: { flowPeakDwell: 6 },
    body: 'You remember a stretch where deciding stopped. Steering, phasing, breathing — one motion. The veil between you and the road thinned.' },
  { id: 'flow-resonant',   type: 'resonance', when: { flowDwellLifetime: 30 },
    body: 'You remember the long resonance. Many runs of it now. The universe began to expect your shape.',
    resonance: { startBoostBonus: 12 } },
  { id: 'flow-absorbed',   type: 'threshold', when: { flowDwellLifetime: 120 },
    body: 'You remember being so much in the moving that the moving became you. You were not the photon. You were the wave the photon kept catching.',
    threshold: { unlockVariant: 'gamma' } },
];

// ============================================================================
// UPGRADES — permanent stat upgrades picked between epochs.
// ============================================================================
export interface UpgradeTarget {
  speedBonus: number;
  agilityBonus: number;
  energyMaxBonus: number;
  damageReduction: number;
  boostRechargeBonus: number;
  phaseWindowSec: number;
}

export interface Upgrade {
  key: string;
  name: string;
  desc: string;
  max: number;
  apply: (s: UpgradeTarget, level: number) => void;
}
export const UPGRADES: Upgrade[] = [
  { key: 'topSpeed',    name: 'Faster',      desc: 'The void resists you less. +8% forward speed.',          max: 5, apply: (s, l) => { s.speedBonus = 1 + 0.08 * l; } },
  { key: 'agility',     name: 'Sharper',     desc: 'Curves want you. +12% lateral acceleration.',            max: 5, apply: (s, l) => { s.agilityBonus = 1 + 0.12 * l; } },
  { key: 'capacitor',   name: 'Wider',       desc: 'More of you to lose. +15 maximum energy.',               max: 4, apply: (s, l) => { s.energyMaxBonus = 15 * l; } },
  { key: 'shielding',   name: 'Tougher',     desc: 'Hazards forget you sooner. −12% damage taken.',          max: 4, apply: (s, l) => { s.damageReduction = Math.min(0.6, 0.12 * l); } },
  { key: 'recharge',    name: 'Hungrier',    desc: 'You recover from pushing faster. +20% boost regen.',     max: 4, apply: (s, l) => { s.boostRechargeBonus = 1 + 0.20 * l; } },
  { key: 'phaseWindow', name: 'Forgiveness', desc: 'A matched wavelength grants a half-second of grace.',    max: 3, apply: (s, l) => { s.phaseWindowSec = 0.18 * l; } },
];

// ============================================================================
// VARIANTS — photon forms. visible is default; others unlock via meta progression.
// ============================================================================
export interface VariantMods { speedMul: number; agilityMul: number; energyMul: number; boostMul: number; }
export interface Variant {
  key: string;
  name: string;
  desc: string;
  unlocked: boolean;
  unlockReq?: string;
  startWavelength: number;
  mods: VariantMods;
}
export const VARIANTS: Variant[] = [
  { key: 'visible',   name: 'Visible',   desc: 'Plain old light. Balanced in every way.',                        unlocked: true,  startWavelength: 1, mods: { speedMul: 1.00, agilityMul: 1.00, energyMul: 1.00, boostMul: 1.00 } },
  { key: 'gamma',     name: 'Gamma',     desc: 'Sharp, narrow, energetic. Fast and frail.',                      unlocked: false, unlockReq: 'A memory unlocks this',           startWavelength: 0, mods: { speedMul: 1.18, agilityMul: 1.10, energyMul: 0.70, boostMul: 1.00 } },
  { key: 'microwave', name: 'Microwave', desc: 'Long, soft, patient. Slower but tougher; starts in radio.',      unlocked: false, unlockReq: 'Witness the heat death once',     startWavelength: 2, mods: { speedMul: 0.88, agilityMul: 0.95, energyMul: 1.40, boostMul: 0.90 } },
  { key: 'xray',      name: 'X-ray',     desc: 'Penetrating. Recharges boost faster, slightly faster baseline.', unlocked: false, unlockReq: 'Detect the unseen mass scaffold', startWavelength: 0, mods: { speedMul: 1.06, agilityMul: 1.05, energyMul: 0.95, boostMul: 1.50 } },
];

// ============================================================================
// TUTORIAL — contextual prompts that auto-advance on player action.
// ============================================================================
export interface TutorialStep { text: string; hint: string; max: number; needs: string | null; }
export const TUTORIAL_STEPS: TutorialStep[] = [
  { text: 'STEER WITH  W A S D  OR  ARROW KEYS',                  hint: 'Dodge the colored shapes',                max: 7,  needs: 'steer' },
  { text: 'PRESS  1  γ      2  VISIBLE      3  RADIO',            hint: 'Wavelength changes how matter answers',  max: 7,  needs: 'shift' },
  { text: 'MATCH COLORS TO RESONATE  ·  RADIO SLIPS THROUGH DIFFUSE MATTER', hint: 'Gamma phases can ionize nearby hazards', max: 9,  needs: 'phase' },
  { text: 'COLLECT YELLOW ORBS  ·  HOLD  SPACE  TO BOOST',         hint: 'Boost recharges when released',           max: 7,  needs: 'boost' },
  { text: 'THREAD CYAN GATES  ·  HIT MAGENTA SPEED PADS',          hint: 'The racing line rewards clean driving',   max: 8,  needs: 'line' },
  { text: 'SURVIVE TO RECOMBINATION TO UNLOCK MORE',              hint: 'Good luck, photon',                       max: 4,  needs: null  },
];
