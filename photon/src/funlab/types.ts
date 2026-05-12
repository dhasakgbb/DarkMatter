export type FunEventType =
  | 'run-start'
  | 'run-end'
  | 'death'
  | 'quit'
  | 'restart'
  | 'epoch-enter'
  | 'epoch-exit'
  | 'gate-hit'
  | 'gate-miss'
  | 'line-break'
  | 'speed-pad-hit'
  | 'speed-chain-break'
  | 'hazard-near-miss'
  | 'hazard-hit'
  | 'phase-through'
  | 'damage'
  | 'pickup'
  | 'boost-start'
  | 'boost-end'
  | 'boost-depleted'
  | 'field-strain-enter'
  | 'field-strain-peak'
  | 'field-strain-recovery'
  | 'upgrade-options'
  | 'upgrade-selected'
  | 'recovery';

export interface FunRunEvent {
  type: FunEventType;
  at: number;
  t?: number;
  runId?: string;
  epochIndex?: number;
  epochName?: string;
  distance?: number;
  speed?: number;
  value?: number;
  damage?: number;
  cause?: string;
  streak?: number;
  strain?: number;
  note?: string;
}

export interface FunRunSummary {
  runId: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  epochReached: number;
  epochName: string;
  distance: number;
  avgSpeed: number;
  speedVariance: number;
  boostUptimeSec: number;
  gateHits: number;
  gateMisses: number;
  gateHitRate: number;
  gateStreakPeak: number;
  lineBreaks: number;
  speedPads: number;
  speedChainBreaks: number;
  nearMisses: number;
  nearMissesPerMin: number;
  hazardHits: number;
  phases: number;
  pickups: number;
  damageEvents: number;
  damageTotal: number;
  clusteredDamageEvents: number;
  recoveryEvents: number;
  boredomGapCount: number;
  longestBoredomGap: number;
  fieldStrainPeak: number;
  fieldStrainEvents: number;
  deathCause: string;
  quit: boolean;
  upgradeChoices: number;
  eventCount: number;
}

export interface VibeRating {
  fun: number;
  flow: number;
  frustration: number;
  oneMoreRun: number;
  note?: string;
  skipped?: boolean;
  at: number;
}

export interface FunFingerprint {
  dopamine: number;
  flow: number;
  oneMoreRun: number;
  frustration: number;
  readability: number;
  funIndex: number;
  trust: number;
  uncertainty: string[];
}

export type RecommendationConfidence = 'low' | 'medium' | 'high';
export type RecommendationRisk = 'low' | 'medium' | 'high';

export interface TuningRecommendation {
  id: string;
  finding: string;
  evidence: string[];
  suggestion: string;
  confidence: RecommendationConfidence;
  risk: RecommendationRisk;
  axes: Array<keyof Pick<FunFingerprint, 'dopamine' | 'flow' | 'oneMoreRun' | 'frustration' | 'readability'>>;
}

export interface FunRunRecord {
  id: string;
  createdAt: number;
  events: FunRunEvent[];
  summary: FunRunSummary;
  vibe?: VibeRating;
  fingerprint: FunFingerprint;
  recommendations: TuningRecommendation[];
}
