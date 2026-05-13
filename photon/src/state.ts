// Mutable shared run-state singleton. Imported by everyone who needs to read or write it.
// Functions live in game.ts but operate on this. Photon, hazards, hud, etc., consult these fields.

import { VARIANTS, type Variant } from './cosmology';
import { meta } from './meta';

export type GameStateName = 'title' | 'run' | 'upgrade' | 'death' | 'codex' | 'pause' | 'memories' | 'form' | 'vibe' | 'funlab';

export interface RunState {
  state: GameStateName;
  epochIndex: number;
  epochTimer: number;
  epochCleared: boolean;
  runDistance: number;
  runEnergy: number;
  variant: Variant;
  startTime: number;
  // Feel: shake + hit-stop + dying cinematic
  trauma: number;
  timeScale: number;
  hitStopTime: number;
  dying: boolean;
  dyingTime: number;
  dyingTotal: number;
  manualEndRequested: boolean;
  // Tutorial
  tutorialActive: boolean;
  tutorialStep: number;
  tutorialTime: number;
  // Run telemetry
  phaseCount: number;
  hitCount: number;
  phaseStreak: number;
  perfectEpochThisRun: boolean;
  lastRunWasPerfect: boolean;
  newMemoriesThisRun: string[];
  // Heat death
  heatDeathFade: number;
  heatDeathFinalSpawned: boolean;
  witnessing: boolean;
  // Echoes
  _echoTime?: number;
  // Coherence (redshift fatigue)
  coherenceTime: number;
  // Racing line systems
  padBoostTime: number;
  padBoostTotal: number;
  lineStreak: number;
  bestLineStreakThisRun: number;
  lineEventText: string;
  lineEventTime: number;
  railScrapeTime: number;
  railScrapeCooldown: number;
  fieldStrain: number;
  fieldStrainX: number;
  fieldStrainY: number;
  gravityShear: number;
  gravityShearX: number;
  gravityShearY: number;
  // Cinematic transition guard
  _anyEpochSetThisRun: boolean;
  // Cosmic seed and per-epoch seeded params
  runSeed: number;
  epochParams: Record<number, { twistFreqMul: number; twistAmpMul: number; hueShift: number; dominantKind: string }>;
  // MULTIVERSE: per-run physical constant modulations (only active after first witness)
  cosmicConstants: { speedMul: number; agilityMul: number; coherenceThreshold: number };
  // Endless scaffolding (deprecated by Heat Death; kept for safety)
  endlessLoop: number;
  // Misc HUD/debug
  _speed: number;
  _shiftedThisRun: boolean;
  _idleZ?: number;
  reducedMotion?: boolean;
}

export const game: RunState = {
  state: 'title',
  epochIndex: 0,
  epochTimer: 0,
  epochCleared: false,
  runDistance: 0,
  runEnergy: 0,
  variant: VARIANTS.find(v => v.key === meta.variant) || VARIANTS[0],
  startTime: 0,
  trauma: 0,
  timeScale: 1,
  hitStopTime: 0,
  dying: false,
  dyingTime: 0,
  dyingTotal: 1.6,
  manualEndRequested: false,
  tutorialActive: false,
  tutorialStep: 0,
  tutorialTime: 0,
  phaseCount: 0,
  hitCount: 0,
  phaseStreak: 0,
  perfectEpochThisRun: true,
  lastRunWasPerfect: false,
  newMemoriesThisRun: [],
  heatDeathFade: 0,
  heatDeathFinalSpawned: false,
  witnessing: false,
  coherenceTime: 0,
  padBoostTime: 0,
  padBoostTotal: 0,
  lineStreak: 0,
  bestLineStreakThisRun: 0,
  lineEventText: '',
  lineEventTime: 0,
  railScrapeTime: 0,
  railScrapeCooldown: 0,
  fieldStrain: 0,
  fieldStrainX: 0,
  fieldStrainY: 0,
  gravityShear: 0,
  gravityShearX: 0,
  gravityShearY: 0,
  _anyEpochSetThisRun: false,
  runSeed: 0,
  epochParams: {},
  cosmicConstants: { speedMul: 1, agilityMul: 1, coherenceThreshold: 14 },
  endlessLoop: 0,
  _speed: 0,
  _shiftedThisRun: false,
};
