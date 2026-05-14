import { photonEquationSnapshot, scienceSnapshot } from './science';
import { readJsonStorage, writeStorage } from './storage';
import { waveDualityFrame } from './waveDuality';

export const PHYSICS_SEED_BOOKMARKS_KEY = 'photon-seed-bookmarks-v1';
const MAX_BOOKMARKS = 8;

export interface PhysicsInsightInput {
  seed: number;
  seedLabel: string;
  epochIndex: number;
  epochName: string;
  epochTimer: number;
  epochDuration: number;
  wavelengthKey: string;
  runDistance: number;
  flowPeak: number;
  bestLineStreak: number;
  phaseStreak: number;
  darkMatterDetections: number;
  manualEnd: boolean;
  scienceMode: boolean;
}

export interface PhysicsInsightReport {
  seed: { value: number; label: string };
  epoch: { index: number; name: string; timer: number };
  photon: {
    wavelength: string;
    emittedWavelengthM: number;
    observedWavelengthM: number;
    energyEv: number;
  };
  path: {
    properDistanceUnits: number;
    comovingDistanceGpc: number;
    redshiftZ: number;
    scaleFactor: number;
    energyLostPercent: number;
  };
  run: {
    flowPeak: number;
    bestLineStreak: number;
    phaseStreak: number;
    darkMatterDetections: number;
  };
  insight: {
    score: number;
    label: string;
    components: {
      cosmology: number;
      resonance: number;
      flow: number;
      discovery: number;
      confidence: number;
      penalty: number;
    };
  };
  resonance: {
    phaseChain: number;
    lineChain: number;
    label: string;
  };
  wave: {
    coherence: number;
    phaseAlignment: number;
    diffraction: number;
    causticBoost: number;
    analysisCoherence: number;
  };
  discovery: {
    darkMatterObserved: boolean;
    note: string;
  };
  bookmarkHint: string;
}

export interface PhysicsSeedBookmark {
  seed: number;
  label: string;
  createdAt: number;
  insightScore: number;
  epochName: string;
  note: string;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function labelForScore(score: number) {
  if (score >= 82) return 'Textbook run';
  if (score >= 66) return 'Strong signal';
  if (score >= 46) return 'Useful trace';
  if (score >= 30) return 'Partial signal';
  return 'Low signal';
}

function resonanceLabel(phaseChain: number) {
  if (phaseChain >= 8) return 'coherent phase chain';
  if (phaseChain >= 5) return 'stable resonance';
  if (phaseChain >= 2) return 'forming resonance';
  return 'unresolved phase';
}

function wavelengthIndexForKey(key: string) {
  if (key === 'gamma') return 0;
  if (key === 'radio') return 2;
  return 1;
}

export function analyzePhysicsRun(input: PhysicsInsightInput): PhysicsInsightReport {
  const science = scienceSnapshot(input.epochIndex, input.epochTimer, input.epochDuration);
  const photonEquation = photonEquationSnapshot(input.wavelengthKey, science.redshiftZ, input.runDistance);
  const wave = waveDualityFrame({
    epochIndex: input.epochIndex,
    epochName: input.epochName,
    epochTimer: input.epochTimer,
    epochDuration: input.epochDuration,
    wavelengthIndex: wavelengthIndexForKey(input.wavelengthKey),
    phaseStreak: input.phaseStreak,
    shiftedThisRun: input.phaseStreak > 0,
    darkMatterSignal: input.darkMatterDetections > 0 ? 0.72 : 0,
    scienceMode: input.scienceMode,
    mobile: false,
    reducedMotion: false,
  });
  const emittedEnergyEv = photonEquation.energyEv * Math.max(1, 1 + science.redshiftZ);
  const energyLostPercent = clamp((1 - photonEquation.energyEv / Math.max(emittedEnergyEv, Number.EPSILON)) * 100);
  const epochProgress = clamp(input.epochTimer / Math.max(1, input.epochDuration), 0, 1);
  const distanceSignal = clamp(input.runDistance / 42000, 0, 1);

  const cosmology = clamp(42 + epochProgress * 20 + distanceSignal * 22 + Math.min(16, energyLostPercent / 6), 0, 100);
  const resonance = clamp(input.phaseStreak * 8 + input.bestLineStreak * 4, 0, 100);
  const flow = clamp(input.flowPeak * 100);
  const discovery = clamp((input.darkMatterDetections > 0 ? 86 : 34) + Math.min(14, input.darkMatterDetections * 4), 0, 100);
  const confidence = clamp(epochProgress * 45 + distanceSignal * 35 + Math.min(20, input.phaseStreak * 2.5), 0, 100);
  const penalty = clamp((input.manualEnd ? 14 : 0) + (input.epochIndex === 0 && input.runDistance < 800 ? 18 : 0), 0, 100);
  const score = Math.round(clamp(
    cosmology * 0.26 +
    resonance * 0.24 +
    flow * 0.20 +
    discovery * 0.18 +
    confidence * 0.12 -
    penalty,
  ));

  const darkMatterObserved = input.darkMatterDetections > 0;
  const note = darkMatterObserved
    ? 'A dark-matter filament bent the route; this seed is worth replaying from the same hypothesis.'
    : 'No dark-matter lensing was confirmed in this trace.';
  const bookmarkHint = score >= 45
    ? `Replay ${input.seedLabel} to test the same universe against one changed timing hypothesis.`
    : `Collect a longer trace before treating ${input.seedLabel} as a physics replay seed.`;

  return {
    seed: { value: input.seed >>> 0, label: input.seedLabel },
    epoch: { index: input.epochIndex, name: input.epochName, timer: Math.round(input.epochTimer * 10) / 10 },
    photon: {
      wavelength: input.wavelengthKey,
      emittedWavelengthM: photonEquation.emittedWavelengthM,
      observedWavelengthM: photonEquation.observedWavelengthM,
      energyEv: photonEquation.energyEv,
    },
    path: {
      properDistanceUnits: Math.round(input.runDistance),
      comovingDistanceGpc: photonEquation.comovingDistanceGpc,
      redshiftZ: science.redshiftZ,
      scaleFactor: science.scaleFactor,
      energyLostPercent,
    },
    run: {
      flowPeak: input.flowPeak,
      bestLineStreak: input.bestLineStreak,
      phaseStreak: input.phaseStreak,
      darkMatterDetections: input.darkMatterDetections,
    },
    insight: {
      score,
      label: labelForScore(score),
      components: {
        cosmology: Math.round(cosmology),
        resonance: Math.round(resonance),
        flow: Math.round(flow),
        discovery: Math.round(discovery),
        confidence: Math.round(confidence),
        penalty: Math.round(penalty),
      },
    },
    resonance: {
      phaseChain: input.phaseStreak,
      lineChain: input.bestLineStreak,
      label: resonanceLabel(input.phaseStreak),
    },
    wave: {
      coherence: wave.coherence,
      phaseAlignment: wave.phaseAlignment,
      diffraction: wave.diffraction,
      causticBoost: wave.causticBoost,
      analysisCoherence: wave.analysisCoherence,
    },
    discovery: { darkMatterObserved, note },
    bookmarkHint,
  };
}

function normalizeBookmark(value: unknown): PhysicsSeedBookmark | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<PhysicsSeedBookmark>;
  if (typeof raw.seed !== 'number' || typeof raw.label !== 'string') return null;
  return {
    seed: raw.seed >>> 0,
    label: raw.label,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    insightScore: clamp(typeof raw.insightScore === 'number' ? raw.insightScore : 0),
    epochName: typeof raw.epochName === 'string' ? raw.epochName : 'Unknown',
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

export function loadSeedBookmarks(): PhysicsSeedBookmark[] {
  const raw = readJsonStorage<unknown>(PHYSICS_SEED_BOOKMARKS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeBookmark)
    .filter((bookmark): bookmark is PhysicsSeedBookmark => !!bookmark)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_BOOKMARKS);
}

export function saveSeedBookmark(bookmark: PhysicsSeedBookmark) {
  const normalized = normalizeBookmark(bookmark);
  if (!normalized) return;
  const bookmarks = loadSeedBookmarks().filter((existing) => existing.seed !== normalized.seed);
  bookmarks.unshift(normalized);
  writeStorage(PHYSICS_SEED_BOOKMARKS_KEY, JSON.stringify(bookmarks.slice(0, MAX_BOOKMARKS)));
}
