import { META_KEY, RUN_KEY } from './constants';
import { readJsonStorage, removeStorage, writeStorage } from './storage';

export interface MetaState {
  upgrades: Record<string, number>;
  variant: string;
  unlockedVariants: string[];
  bestEpoch: number;
  bestDistance: number;
  totalRuns: number;
  totalEnergy: number;
  codex: Record<string, boolean>;
  tutorialDone: boolean;
  witnessedHeatDeath: number;
  memories: Record<string, boolean>;
  phasesLifetime: number;
  pickupsLifetime: number;
  colorPhases: [number, number, number];
  bestStreak: number;
  pausedOnce: boolean;
  mutedOnce: boolean;
  boostedOnce: boolean;
  firstWormhole: boolean;
  firstChainPhased: boolean;
  bestLineStreak: number;
  speedPadsHit: number;
  gatesThreaded: number;
  flowDwellLifetime: number;
  darkMatterDetections: number;
  runsThisSession: number;
  sessionStartedAt: number;
  analysisDwellMs: number;
  addictionScoreHistory: number[];
}

export const defaultMeta = (): MetaState => ({
  upgrades: { topSpeed: 0, agility: 0, capacitor: 0, shielding: 0, recharge: 0, phaseWindow: 0 },
  variant: 'visible',
  unlockedVariants: ['visible'],
  bestEpoch: 0,
  bestDistance: 0,
  totalRuns: 0,
  totalEnergy: 0,
  codex: { PHOTON: true },
  tutorialDone: false,
  witnessedHeatDeath: 0,
  memories: {},
  phasesLifetime: 0,
  pickupsLifetime: 0,
  colorPhases: [0, 0, 0],
  bestStreak: 0,
  pausedOnce: false,
  mutedOnce: false,
  boostedOnce: false,
  firstWormhole: false,
  firstChainPhased: false,
  bestLineStreak: 0,
  speedPadsHit: 0,
  gatesThreaded: 0,
  flowDwellLifetime: 0,
  darkMatterDetections: 0,
  runsThisSession: 0,
  sessionStartedAt: 0,
  analysisDwellMs: 0,
  addictionScoreHistory: [],
});

export function loadMeta(): MetaState {
  const merged = Object.assign(defaultMeta(), readJsonStorage<Partial<MetaState>>(META_KEY, {}));
  if (!Array.isArray(merged.addictionScoreHistory)) merged.addictionScoreHistory = [];
  merged.addictionScoreHistory = merged.addictionScoreHistory.slice(-50);
  return merged;
}
export function saveMeta(m: MetaState) {
  writeStorage(META_KEY, JSON.stringify(m));
}

export const meta: MetaState = loadMeta();

// Per-run checkpoint snapshot
export interface Checkpoint {
  epochIndex: number;
  runEnergy: number;
  energy: number;
  maxEnergyAtSave: number;
  boost: number;
  wavelength: number;
  variant: string;
  runSeed: number;
  phaseStreak: number;
  perfectEpochThisRun: boolean;
  startTimeOffset: number;
  savedAt: number;
  epochName: string;
}
export function saveCheckpoint(snapshot: Checkpoint) {
  writeStorage(RUN_KEY, JSON.stringify(snapshot));
}
export function loadCheckpoint(): Checkpoint | null {
  return readJsonStorage<Checkpoint | null>(RUN_KEY, null);
}
export function clearCheckpoint() {
  removeStorage(RUN_KEY);
}
