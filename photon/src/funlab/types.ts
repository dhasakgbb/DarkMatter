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
  | 'gravity-sling'
  | 'dark-matter-detection'
  | 'hazard-near-miss'
  | 'hazard-hit'
  | 'phase-through'
  | 'gamma-ionization'
  | 'radio-transmission'
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
  gravitySlingshots: number;
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

export type DopamineEngineState = 'low-confidence' | 'underfed' | 'sweet-spot' | 'overheated' | 'confusing' | 'punishing';
export type DopamineTuningKnob =
  | 'hazardDensity'
  | 'gateDensity'
  | 'speedPadDensity'
  | 'recoverySpacing'
  | 'routeCueBrightness'
  | 'visualClutter'
  | 'difficultyRamp';
export type DopamineTuningDirection = 'increase' | 'decrease' | 'hold';
export type GameDesignPrinciple =
  | 'flow-channel'
  | 'anticipation-payoff'
  | 'readable-challenge'
  | 'risk-reward'
  | 'variable-reward-cadence'
  | 'recovery-windows'
  | 'mastery-feedback'
  | 'novelty-rotation'
  | 'perceived-fairness'
  | 'optional-challenge';

export interface DopamineTuningDelta {
  knob: DopamineTuningKnob;
  direction: DopamineTuningDirection;
  amount: number;
  confidence: RecommendationConfidence;
  risk: RecommendationRisk;
  reason: string;
}

export interface DopamineMissingBeat {
  beat: string;
  principle: GameDesignPrinciple;
  evidence: string;
  suggestion: string;
}

export interface DopaminePlanStep {
  priority: 'now' | 'next' | 'later';
  title: string;
  principle: GameDesignPrinciple;
  diagnosis: string;
  action: string;
  expectedEffect: string;
  risk: RecommendationRisk;
  evidence: string[];
}

export interface DopamineEngineReport {
  state: DopamineEngineState;
  score: number;
  rewardCadenceSec: number;
  rewardEventsPerMin: number;
  pressure: number;
  mastery: number;
  safety: number;
  novelty: number;
  theoryTags: GameDesignPrinciple[];
  missingBeats: DopamineMissingBeat[];
  plan: DopaminePlanStep[];
  tuning: DopamineTuningDelta[];
  guardrails: string[];
}

export interface FunRunRecord {
  id: string;
  createdAt: number;
  events: FunRunEvent[];
  summary: FunRunSummary;
  vibe?: VibeRating;
  fingerprint: FunFingerprint;
  recommendations: TuningRecommendation[];
  dopamineEngine?: DopamineEngineReport;
}
