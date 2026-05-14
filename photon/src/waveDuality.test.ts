import { describe, expect, it } from 'vitest';
import { waveDualityFrame } from './waveDuality';

const base = {
  epochIndex: 0,
  epochName: 'Inflationary',
  epochTimer: 4,
  epochDuration: 35,
  wavelengthIndex: 1,
  phaseStreak: 0,
  shiftedThisRun: false,
  darkMatterSignal: 0,
  scienceMode: true,
  mobile: false,
  reducedMotion: false,
};

describe('wave duality frame', () => {
  it('makes dense early epochs scattered and less coherent than Recombination', () => {
    const inflation = waveDualityFrame(base);
    const recombination = waveDualityFrame({
      ...base,
      epochIndex: 2,
      epochName: 'Recombination',
      epochTimer: 45,
      epochDuration: 50,
      shiftedThisRun: true,
    });

    expect(inflation.scatter).toBeGreaterThan(recombination.scatter);
    expect(recombination.coherence).toBeGreaterThan(inflation.coherence);
    expect(recombination.analysisCoherence).toBeGreaterThan(70);
  });

  it('uses phase streaks as constructive resonance alignment', () => {
    const unresolved = waveDualityFrame({ ...base, epochName: 'Galactic', epochIndex: 4, epochTimer: 120, epochDuration: 230, phaseStreak: 0 });
    const coherent = waveDualityFrame({ ...base, epochName: 'Galactic', epochIndex: 4, epochTimer: 120, epochDuration: 230, phaseStreak: 8, shiftedThisRun: true });

    expect(coherent.phaseAlignment).toBeGreaterThan(unresolved.phaseAlignment);
    expect(coherent.resonanceBonus).toBeGreaterThan(unresolved.resonanceBonus);
    expect(coherent.interference).toBeLessThan(unresolved.interference);
  });

  it('turns dark-matter signal into diffraction and caustic boost', () => {
    const quiet = waveDualityFrame({ ...base, epochName: 'Galactic', epochIndex: 4, epochTimer: 120, epochDuration: 230, darkMatterSignal: 0 });
    const lensed = waveDualityFrame({ ...base, epochName: 'Galactic', epochIndex: 4, epochTimer: 120, epochDuration: 230, darkMatterSignal: 0.75 });

    expect(lensed.diffraction).toBeGreaterThan(quiet.diffraction);
    expect(lensed.causticBoost).toBeGreaterThan(quiet.causticBoost);
  });

  it('stretches fringes and quiets intensity in Heat Death', () => {
    const recombination = waveDualityFrame({ ...base, epochName: 'Recombination', epochIndex: 2, epochTimer: 45, epochDuration: 50 });
    const heatDeath = waveDualityFrame({ ...base, epochName: 'Heat Death', epochIndex: 8, epochTimer: 330, epochDuration: 360, wavelengthIndex: 2 });

    expect(heatDeath.fringeSpacing).toBeGreaterThan(recombination.fringeSpacing);
    expect(heatDeath.wavefrontIntensity).toBeLessThan(recombination.wavefrontIntensity);
    expect(heatDeath.scatter).toBeLessThan(0.1);
  });

  it('dampens wavefront intensity on mobile and reduced motion while preserving exports', () => {
    const desktop = waveDualityFrame({ ...base, shiftedThisRun: true, phaseStreak: 5 });
    const damped = waveDualityFrame({ ...base, shiftedThisRun: true, phaseStreak: 5, mobile: true, reducedMotion: true });

    expect(damped.wavefrontIntensity).toBeLessThan(desktop.wavefrontIntensity);
    expect(damped.coherence).toBeGreaterThan(0);
    expect(damped.analysisCoherence).toBeGreaterThan(0);
  });
});
