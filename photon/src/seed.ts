// Mulberry32 PRNG. Simple, fast, good enough for gameplay variety.
import { EPOCHS } from './cosmology';
import { game } from './state';

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function (): number {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  if (window.crypto && window.crypto.getRandomValues) {
    const a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0];
  }
  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}

export function seedToLabel(s: number): string {
  return (s >>> 0).toString(36).padStart(6, '0').slice(-6).toUpperCase();
}

// Mutable, replaced every startRun. Modules import this and call it for seeded randomness.
export let runRng: () => number = mulberry32(0);
export function setRunSeed(seed: number) {
  runRng = mulberry32(seed);
}

// MULTIVERSE: derive per-run physical constants from the seed. Returns identity
// modulations until the player has witnessed the heat death at least once.
export function computeCosmicConstants(seed: number, witnessedCount: number) {
  if ((witnessedCount || 0) < 1) {
    return { speedMul: 1, agilityMul: 1, coherenceThreshold: 14 };
  }
  // Reseed deterministically from runSeed XOR'd with a constant so multiverse modulations
  // are independent of (and stable across) the epoch-level seed math.
  const sub = mulberry32((seed ^ 0xC0FFEE13) >>> 0);
  // ±8% on base speed, ±10% on agility, ±20% on the coherence-fatigue threshold (seconds)
  const speedMul = 0.92 + sub() * 0.16;
  const agilityMul = 0.90 + sub() * 0.20;
  const coherenceThreshold = 12 + sub() * 5;  // 12-17s before redshift drain starts
  return { speedMul, agilityMul, coherenceThreshold };
}

// Parse a 6-char base-36 string back into a 32-bit seed, or null if invalid.
export function parseSeedLabel(label: string): number | null {
  const cleaned = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 0 || cleaned.length > 7) return null;
  const n = parseInt(cleaned, 36);
  if (!Number.isFinite(n) || n < 0) return null;
  return n >>> 0;
}

// Compute per-epoch seeded modulations once and stash on game.epochParams[idx].
export function computeEpochParams(idx: number) {
  const e = EPOCHS[idx]; if (!e) return;
  const sub = mulberry32((game.runSeed ^ ((idx + 1) * 0x9E3779B9)) >>> 0);
  const twistFreqMul = 0.85 + sub() * 0.30;
  const twistAmpMul  = 0.85 + sub() * 0.30;
  const hueShift     = (sub() - 0.5) * 0.18;
  const dominantIdx  = Math.floor(sub() * e.hazardKinds.length);
  const dominantKind = e.hazardKinds[dominantIdx];
  game.epochParams[idx] = { twistFreqMul, twistAmpMul, hueShift, dominantKind };
}
