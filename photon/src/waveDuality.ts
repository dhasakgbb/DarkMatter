export interface WaveDualityInput {
  epochIndex: number;
  epochName: string;
  epochTimer: number;
  epochDuration: number;
  wavelengthIndex: number;
  phaseStreak: number;
  shiftedThisRun: boolean;
  darkMatterSignal: number;
  scienceMode: boolean;
  mobile: boolean;
  reducedMotion: boolean;
}

export interface WaveDualityFrame {
  coherence: number;
  phaseAlignment: number;
  fringeSpacing: number;
  scatter: number;
  interference: number;
  diffraction: number;
  causticBoost: number;
  resonanceBonus: number;
  analysisCoherence: number;
  wavefrontIntensity: number;
  phaseDegrees: number;
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

function denseEpochScatter(epochName: string, progress: number) {
  if (epochName === 'Inflationary') return 0.86 - progress * 0.36;
  if (epochName === 'Quark Plasma') return 0.72 - progress * 0.18;
  if (epochName === 'Recombination') return 0.42 * (1 - progress);
  if (epochName === 'First Stars' || epochName === 'Galactic' || epochName === 'Stellar') return 0.22;
  if (epochName === 'Black Hole') return 0.08;
  if (epochName === 'Heat Death') return 0.02 * (1 - progress);
  return 0.14;
}

export function waveDualityFrame(input: WaveDualityInput): WaveDualityFrame {
  const duration = Math.max(1, Number.isFinite(input.epochDuration) ? input.epochDuration : 1);
  const timer = Math.max(0, Number.isFinite(input.epochTimer) ? input.epochTimer : 0);
  const progress = smooth01(timer / duration);
  const scienceMul = input.scienceMode ? 1 : 0.68;
  const comfortMul = (input.mobile ? 0.76 : 1) * (input.reducedMotion ? 0.62 : 1);
  const streak = clamp01(input.phaseStreak / 8);
  const darkMatter = clamp01(input.darkMatterSignal);
  const shifted = input.shiftedThisRun ? 1 : 0;
  const wavelengthStretch = input.wavelengthIndex <= 0 ? 0.72 : input.wavelengthIndex === 1 ? 1 : 1.42;
  const scatter = clamp01(denseEpochScatter(input.epochName, progress) * scienceMul);

  let baseCoherence = 0.40 + streak * 0.34 + shifted * 0.10 - scatter * 0.30;
  if (input.epochName === 'Recombination') baseCoherence += 0.44 * progress;
  if (input.epochName === 'Heat Death') baseCoherence = 0.36 + streak * 0.18 - progress * 0.18;
  if (input.epochName === 'Black Hole') baseCoherence -= 0.08;
  const coherence = clamp01(baseCoherence * scienceMul);

  const phaseAlignment = clamp01(0.28 + streak * 0.58 + shifted * 0.08 - scatter * 0.18);
  const interference = clamp01((1 - phaseAlignment) * (0.42 + scatter * 0.46));
  const diffraction = clamp01(darkMatter * (0.38 + coherence * 0.42));
  const causticBoost = clamp01(diffraction * (0.42 + phaseAlignment * 0.44));
  const resonanceBonus = clamp01(phaseAlignment * coherence * (0.24 + streak * 0.52));
  const heatStretch = input.epochName === 'Heat Death' ? 1 + progress * 2.8 : input.epochName === 'Black Hole' ? 1.65 : 1;
  const fringeSpacing = Math.max(0.35, wavelengthStretch * heatStretch * (1 + scatter * 0.22));
  const wavefrontIntensity = clamp01((0.20 + coherence * 0.52 + resonanceBonus * 0.24 + diffraction * 0.14 - (input.epochName === 'Heat Death' ? progress * 0.24 : 0)) * comfortMul);
  const phaseDegrees = Math.round((phaseAlignment - 0.5) * 180);
  const analysisCoherence = Math.round(clamp01(coherence * 0.70 + phaseAlignment * 0.20 + diffraction * 0.10) * 100);

  return {
    coherence: round3(coherence),
    phaseAlignment: round3(phaseAlignment),
    fringeSpacing: round3(fringeSpacing),
    scatter: round3(scatter),
    interference: round3(interference),
    diffraction: round3(diffraction),
    causticBoost: round3(causticBoost),
    resonanceBonus: round3(resonanceBonus),
    analysisCoherence,
    wavefrontIntensity: round3(wavefrontIntensity),
    phaseDegrees,
  };
}
