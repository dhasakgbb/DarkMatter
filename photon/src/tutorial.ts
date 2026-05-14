import { TUTORIAL_STEPS, type TutorialStep } from './cosmology';

export type TutorialNeed = TutorialStep['needs'];

export interface TutorialRacingTuning {
  gapBase: number;
  gapRange: number;
  padChance: number;
  centered: boolean;
}

export function activeTutorialNeed(active: boolean, stepIndex: number): TutorialNeed {
  if (!active) return null;
  return TUTORIAL_STEPS[stepIndex]?.needs ?? null;
}

export function tutorialHazardGapScale(need: TutorialNeed) {
  if (need === 'steer' || need === 'shift') return 2.2;
  if (need === 'phase') return 1.35;
  return 1.0;
}

export function tutorialPhaseWavelength(need: TutorialNeed, currentWavelength: number, fallbackWavelength: number) {
  return need === 'phase' ? currentWavelength : fallbackWavelength;
}

export function tutorialRacingTuning(need: TutorialNeed): TutorialRacingTuning {
  if (need === 'line') {
    return { gapBase: 42, gapRange: 18, padChance: 0.98, centered: true };
  }
  return { gapBase: 56, gapRange: 32, padChance: 0.92, centered: false };
}
