// Flow-state signal: a hidden 0..1 meter blending phase-streak (skill chain),
// recent clean-run dwell (no-hit time gated by recent engagement), and current
// activity (boost + energy). Smoothed so a single hit's streak reset doesn't
// snap the signal to zero. Drives adaptive difficulty, audio intensity, and
// camera FOV breathe.

export interface FlowInputs {
  phaseStreak: number;
  cleanRunTime: number;
  timeSincePhase: number;
  energyRatio: number; // photon.energy / max
  boosting: boolean;
}

export interface FlowParams {
  streakSat: number;        // streak value at which streak contribution saturates
  cleanSat: number;         // seconds of no-hit dwell at which clean contribution saturates
  cleanGrace: number;       // seconds since last phase before clean starts decaying
  cleanDecay: number;       // seconds over which clean fully decays once past grace
  tau: number;              // smoothing time constant in seconds
}

export const DEFAULT_FLOW_PARAMS: FlowParams = {
  streakSat: 8,
  cleanSat: 12,
  cleanGrace: 6,
  cleanDecay: 6,
  tau: 0.4,
};

/** Compute the un-smoothed flow target [0,1] from current run inputs. */
export function flowTarget(inputs: FlowInputs, params: FlowParams = DEFAULT_FLOW_PARAMS): number {
  const streak = clamp01(inputs.phaseStreak / params.streakSat);
  const cleanRaw = clamp01(inputs.cleanRunTime / params.cleanSat);
  // Engagement gate: clean dwell only counts while you're still actually
  // phasing things. After cleanGrace seconds without a phase, contribution
  // decays linearly to zero over cleanDecay seconds.
  const engagement = clamp01(1 - Math.max(0, inputs.timeSincePhase - params.cleanGrace) / params.cleanDecay);
  const clean = cleanRaw * engagement;
  const activity = (inputs.boosting ? 1 : 0.4) * clamp01(inputs.energyRatio);
  return streak * 0.5 + clean * 0.3 + activity * 0.2;
}

/** Advance the smoothed flow level toward its target by one frame. */
export function stepFlow(prev: number, target: number, dt: number, tau = DEFAULT_FLOW_PARAMS.tau): number {
  return prev + (target - prev) * Math.min(1, dt / tau);
}

/** Skill bias derived from flow level, in [-0.2, +0.2]. Returns 0 on the tutorial epoch. */
export function skillBias(flowLevel: number, epochIndex: number): number {
  if (epochIndex === 0) return 0;
  return (flowLevel - 0.5) * 0.4;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
