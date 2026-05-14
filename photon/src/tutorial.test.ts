import { describe, expect, it } from 'vitest';
import { activeTutorialNeed, tutorialHazardGapScale, tutorialPhaseWavelength, tutorialRacingTuning } from './tutorial';

describe('tutorial tuning', () => {
  it('exposes the active tutorial need safely', () => {
    expect(activeTutorialNeed(false, 0)).toBeNull();
    expect(activeTutorialNeed(true, 0)).toBe('steer');
    expect(activeTutorialNeed(true, 999)).toBeNull();
  });

  it('gives early tutorial hazards more breathing room', () => {
    expect(tutorialHazardGapScale('steer')).toBeGreaterThan(tutorialHazardGapScale('phase'));
    expect(tutorialHazardGapScale('phase')).toBeGreaterThan(tutorialHazardGapScale(null));
  });

  it('forces phase tutorial hazards onto the current wavelength', () => {
    expect(tutorialPhaseWavelength('phase', 2, 0)).toBe(2);
    expect(tutorialPhaseWavelength('shift', 2, 0)).toBe(0);
  });

  it('centers the racing-line tutorial and increases reward cadence', () => {
    const normal = tutorialRacingTuning(null);
    const line = tutorialRacingTuning('line');
    expect(line.centered).toBe(true);
    expect(line.gapBase + line.gapRange).toBeLessThan(normal.gapBase + normal.gapRange);
    expect(line.padChance).toBeGreaterThan(normal.padChance);
  });
});
