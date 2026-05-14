export interface BirthSequenceOptions {
  scienceMode: boolean;
  mobile: boolean;
}

export interface BirthSequenceFrame {
  progress: number;
  flash: number;
  noiseAmp: number;
  noiseFreq: number;
  jitter: number;
  bloomMul: number;
  exposureAdd: number;
  lensing: number;
}

const BIRTH_DURATION_SEC = 8;
const SETTLE_DURATION_SEC = 15;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

export function birthSequenceFrame(seconds: number, options: BirthSequenceOptions): BirthSequenceFrame {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const birthProgress = clamp01(time / BIRTH_DURATION_SEC);
  const settleProgress = clamp01(time / SETTLE_DURATION_SEC);
  const thermalDecay = Math.exp(-time * (options.mobile ? 0.62 : 0.52));
  const scienceMul = options.scienceMode ? 1 : 0.62;
  const mobileMul = options.mobile ? 0.68 : 1;
  const intensity = thermalDecay * scienceMul * mobileMul;

  return {
    progress: Number(easeOutExpo(birthProgress).toFixed(4)),
    flash: time >= SETTLE_DURATION_SEC ? 0 : clamp01(intensity * 1.18),
    noiseAmp: time >= SETTLE_DURATION_SEC ? 1 : 1 + 1.25 * intensity,
    noiseFreq: time >= SETTLE_DURATION_SEC ? 1 : 1 + 2.25 * intensity,
    jitter: time >= SETTLE_DURATION_SEC ? 0 : 0.55 * intensity * (1 - settleProgress * 0.45),
    bloomMul: time >= SETTLE_DURATION_SEC ? 1 : 1 + 3.65 * intensity,
    exposureAdd: time >= SETTLE_DURATION_SEC ? 0 : 0.58 * intensity,
    lensing: time >= SETTLE_DURATION_SEC ? 0 : 0.42 * intensity,
  };
}

function seededUnit(seed: number) {
  let t = (seed ^ 0x9e3779b9) >>> 0;
  t += 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shouldTriggerPrimordialLensing(seed: number, seconds: number, scienceMode: boolean) {
  if (!scienceMode || seconds < 1.5 || seconds > 8) return false;
  return seededUnit(seed >>> 0) < 0.22;
}
