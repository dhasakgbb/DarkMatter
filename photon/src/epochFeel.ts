import { birthSequenceFrame } from './birthSequence';

export type EpochFeelPhase = 'awe' | 'mastery' | 'release' | 'structure' | 'dread' | 'entropy' | 'cruise';

export interface EpochFeelInput {
  epochIndex: number;
  epochName: string;
  epochTimer: number;
  epochDuration: number;
  scienceMode: boolean;
  mobile: boolean;
  reducedMotion: boolean;
  shiftedThisRun: boolean;
  phaseStreak: number;
  darkMatterSignal: number;
}

export interface EpochFeelFrame {
  phase: EpochFeelPhase;
  birthIntensity: number;
  fluctuationNoise: number;
  clarity: number;
  structureTension: number;
  gravityDread: number;
  entropyFade: number;
  coherence: number;
  bloomMul: number;
  exposureAdd: number;
  lensingPulse: number;
  audioIntensity: number;
  densityMul: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smooth01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function epochFeelFrame(input: EpochFeelInput): EpochFeelFrame {
  const duration = Math.max(1, Number.isFinite(input.epochDuration) ? input.epochDuration : 1);
  const timer = Math.max(0, Number.isFinite(input.epochTimer) ? input.epochTimer : 0);
  const progress = smooth01(timer / duration);
  const scienceMul = input.scienceMode ? 1 : 0.68;
  const comfortMul = (input.mobile ? 0.78 : 1) * (input.reducedMotion ? 0.64 : 1);
  const highIntensityMul = scienceMul * comfortMul;
  const birth = birthSequenceFrame(timer, {
    scienceMode: input.scienceMode,
    mobile: input.mobile || input.reducedMotion,
  });
  const phaseChain = clamp01(input.phaseStreak / 8);
  const darkMatter = clamp01(input.darkMatterSignal);

  let phase: EpochFeelPhase = 'cruise';
  let birthIntensity = 0;
  let fluctuationNoise = 0.12 * scienceMul;
  let clarity = 0.25 + progress * 0.25;
  let structureTension = 0;
  let gravityDread = 0;
  let entropyFade = 0;
  let coherence = 0;
  let bloomMul = 1;
  let exposureAdd = 0;
  let lensingPulse = 0;
  let audioIntensity = 0.28 + progress * 0.16;
  let densityMul = 1;

  if (input.epochIndex === 0 || input.epochName === 'Inflationary') {
    birthIntensity = birth.flash;
    fluctuationNoise = clamp01((birth.noiseAmp - 1) / 1.25);
    coherence = timer <= 12 && input.shiftedThisRun ? clamp01((12 - timer) / 9) * (0.45 + phaseChain * 0.55) * highIntensityMul : 0;
    phase = birthIntensity > 0.12 ? 'awe' : 'mastery';
    clarity = clamp01(0.12 + birth.progress * 0.46 + coherence * 0.24);
    bloomMul = Math.max(1, birth.bloomMul) * (1 + coherence * 0.18);
    exposureAdd = birth.exposureAdd + coherence * 0.08;
    lensingPulse = birth.lensing * 0.55;
    audioIntensity = clamp01(0.58 + birthIntensity * 0.34 + coherence * 0.18);
    densityMul = 1 + fluctuationNoise * 0.18;
  } else if (input.epochName === 'Recombination') {
    phase = 'release';
    clarity = clamp01(0.22 + progress * 0.76);
    fluctuationNoise = (1 - clarity) * 0.48 * scienceMul;
    bloomMul = 1 - clarity * 0.08;
    exposureAdd = clarity * 0.04;
    audioIntensity = 0.34 + clarity * 0.32;
    densityMul = 1 - clarity * 0.42;
  } else if (input.epochName === 'First Stars' || input.epochName === 'Galactic' || input.epochName === 'Stellar') {
    phase = 'structure';
    structureTension = clamp01((0.42 + progress * 0.30 + darkMatter * 0.34) * scienceMul);
    clarity = clamp01(0.46 + progress * 0.22);
    fluctuationNoise = 0.18 * scienceMul;
    bloomMul = 1 + structureTension * 0.16;
    exposureAdd = structureTension * 0.045;
    lensingPulse = darkMatter * 0.18 * comfortMul;
    audioIntensity = clamp01(0.42 + structureTension * 0.48);
    densityMul = 1 + structureTension * 0.10;
  } else if (input.epochName === 'Black Hole') {
    phase = 'dread';
    gravityDread = clamp01((0.58 + progress * 0.28) * scienceMul);
    clarity = clamp01(0.42 - gravityDread * 0.12);
    fluctuationNoise = 0.08 * scienceMul;
    bloomMul = 1 - gravityDread * 0.12;
    exposureAdd = -gravityDread * 0.05;
    lensingPulse = 0;
    audioIntensity = clamp01(0.34 + gravityDread * 0.34);
    densityMul = 0.76 - gravityDread * 0.20;
  } else if (input.epochName === 'Heat Death') {
    phase = 'entropy';
    entropyFade = clamp01(progress);
    gravityDread = clamp01(0.22 * (1 - entropyFade));
    clarity = clamp01(0.18 - entropyFade * 0.10);
    fluctuationNoise = 0.03 * (1 - entropyFade) * scienceMul;
    bloomMul = 1 - entropyFade * 0.18;
    exposureAdd = -entropyFade * 0.08;
    lensingPulse = 0;
    audioIntensity = clamp01(0.32 - entropyFade * 0.20);
    densityMul = 0.34 - entropyFade * 0.20;
  }

  return {
    phase,
    birthIntensity: round3(clamp01(birthIntensity)),
    fluctuationNoise: round3(clamp01(fluctuationNoise)),
    clarity: round3(clamp01(clarity)),
    structureTension: round3(clamp01(structureTension)),
    gravityDread: round3(clamp01(gravityDread)),
    entropyFade: round3(clamp01(entropyFade)),
    coherence: round3(clamp01(coherence)),
    bloomMul: round3(Math.max(0.4, bloomMul)),
    exposureAdd: round3(Math.max(-0.3, Math.min(0.8, exposureAdd))),
    lensingPulse: round3(clamp01(lensingPulse)),
    audioIntensity: round3(clamp01(audioIntensity)),
    densityMul: round3(Math.max(0.02, densityMul)),
  };
}
