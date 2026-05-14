import { describe, expect, it } from 'vitest';
import { epochFeelFrame } from './epochFeel';

const base = {
  epochDuration: 100,
  scienceMode: true,
  mobile: false,
  reducedMotion: false,
  shiftedThisRun: false,
  phaseStreak: 0,
  darkMatterSignal: 0,
};

describe('epoch feel frame', () => {
  it('starts with Big Bang awe and settles by fifteen seconds', () => {
    const start = epochFeelFrame({ ...base, epochIndex: 0, epochName: 'Inflationary', epochTimer: 0, epochDuration: 35 });
    const settled = epochFeelFrame({ ...base, epochIndex: 0, epochName: 'Inflationary', epochTimer: 15, epochDuration: 35 });

    expect(start.phase).toBe('awe');
    expect(start.birthIntensity).toBeGreaterThan(0.95);
    expect(start.fluctuationNoise).toBeGreaterThan(0.75);
    expect(start.bloomMul).toBeGreaterThan(4);
    expect(settled.birthIntensity).toBe(0);
    expect(settled.fluctuationNoise).toBeLessThan(0.15);
    expect(settled.bloomMul).toBeCloseTo(1, 3);
  });

  it('dampens high-intensity signals on mobile and reduced motion', () => {
    const desktop = epochFeelFrame({ ...base, epochIndex: 0, epochName: 'Inflationary', epochTimer: 1, epochDuration: 35 });
    const damped = epochFeelFrame({ ...base, epochIndex: 0, epochName: 'Inflationary', epochTimer: 1, epochDuration: 35, mobile: true, reducedMotion: true });

    expect(damped.birthIntensity).toBeLessThan(desktop.birthIntensity);
    expect(damped.fluctuationNoise).toBeLessThan(desktop.fluctuationNoise);
    expect(damped.bloomMul).toBeLessThan(desktop.bloomMul);
    expect(damped.lensingPulse).toBeLessThan(desktop.lensingPulse);
  });

  it('ramps Recombination clarity through the epoch', () => {
    const early = epochFeelFrame({ ...base, epochIndex: 2, epochName: 'Recombination', epochTimer: 5, epochDuration: 50 });
    const late = epochFeelFrame({ ...base, epochIndex: 2, epochName: 'Recombination', epochTimer: 45, epochDuration: 50 });

    expect(early.phase).toBe('release');
    expect(late.clarity).toBeGreaterThan(early.clarity);
    expect(late.clarity).toBeGreaterThan(0.85);
    expect(late.fluctuationNoise).toBeLessThan(early.fluctuationNoise);
  });

  it('raises structure tension only in structure-building eras', () => {
    const recombination = epochFeelFrame({ ...base, epochIndex: 2, epochName: 'Recombination', epochTimer: 25, epochDuration: 50 });
    const galactic = epochFeelFrame({ ...base, epochIndex: 4, epochName: 'Galactic', epochTimer: 115, epochDuration: 230, darkMatterSignal: 0.6 });

    expect(galactic.phase).toBe('structure');
    expect(galactic.structureTension).toBeGreaterThan(0.65);
    expect(galactic.structureTension).toBeGreaterThan(recombination.structureTension);
    expect(galactic.lensingPulse).toBeLessThan(0.2);
  });

  it('moves late epochs toward sparse dread and entropy without adding density', () => {
    const blackHole = epochFeelFrame({ ...base, epochIndex: 7, epochName: 'Black Hole', epochTimer: 120, epochDuration: 240 });
    const heatEarly = epochFeelFrame({ ...base, epochIndex: 8, epochName: 'Heat Death', epochTimer: 30, epochDuration: 360 });
    const heatLate = epochFeelFrame({ ...base, epochIndex: 8, epochName: 'Heat Death', epochTimer: 330, epochDuration: 360 });

    expect(blackHole.phase).toBe('dread');
    expect(blackHole.gravityDread).toBeGreaterThan(0.55);
    expect(heatLate.phase).toBe('entropy');
    expect(heatLate.entropyFade).toBeGreaterThan(heatEarly.entropyFade);
    expect(heatLate.densityMul).toBeLessThanOrEqual(heatEarly.densityMul);
    expect(heatLate.exposureAdd).toBeLessThanOrEqual(0);
  });
});
