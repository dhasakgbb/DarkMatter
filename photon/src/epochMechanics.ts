export interface EpochMechanics {
  hazardGapMul: number;
  pickupChanceMul: number;
  gluonChainChance: number;
  racingGapMul: number;
  padChanceMul: number;
}

const DEFAULT_MECHANICS: EpochMechanics = {
  hazardGapMul: 1,
  pickupChanceMul: 1,
  gluonChainChance: 0.45,
  racingGapMul: 1,
  padChanceMul: 1,
};

export function epochMechanics(epochName: string): EpochMechanics {
  if (epochName === 'Inflationary') return { ...DEFAULT_MECHANICS, hazardGapMul: 1.16, pickupChanceMul: 1.08, racingGapMul: 0.94 };
  if (epochName === 'Quark Plasma') return { ...DEFAULT_MECHANICS, hazardGapMul: 0.92, gluonChainChance: 0.74, racingGapMul: 1.04 };
  if (epochName === 'Recombination') return { ...DEFAULT_MECHANICS, hazardGapMul: 1.28, pickupChanceMul: 0.9, racingGapMul: 0.78, padChanceMul: 1.14 };
  if (epochName === 'First Stars') return { ...DEFAULT_MECHANICS, hazardGapMul: 0.96, pickupChanceMul: 0.95, racingGapMul: 1.02 };
  if (epochName === 'Galactic') return { ...DEFAULT_MECHANICS, hazardGapMul: 1.05, padChanceMul: 1.08 };
  if (epochName === 'Stellar') return { ...DEFAULT_MECHANICS, hazardGapMul: 0.92, pickupChanceMul: 1.08, racingGapMul: 0.96 };
  if (epochName === 'Degenerate') return { ...DEFAULT_MECHANICS, hazardGapMul: 1.18, pickupChanceMul: 0.86, racingGapMul: 1.12, padChanceMul: 0.82 };
  if (epochName === 'Black Hole') return { ...DEFAULT_MECHANICS, hazardGapMul: 1.34, pickupChanceMul: 0.72, racingGapMul: 1.22, padChanceMul: 0.7 };
  return DEFAULT_MECHANICS;
}

export function epochHazardWeight(epochName: string, kind: string, baseWeight: number) {
  let weight = baseWeight;
  if (kind === 'darkMatterFilament') weight *= 0.22;
  if (epochName === 'Quark Plasma' && kind === 'gluon') weight *= 1.8;
  if (epochName === 'Recombination' && kind === 'plasma') weight *= 1.45;
  if (epochName === 'Recombination' && kind === 'gravityWell') weight *= 0.62;
  if (epochName === 'First Stars' && kind === 'supernova') weight *= 1.55;
  if (epochName === 'Galactic' && kind === 'darkMatterFilament') weight *= 2.4;
  if (epochName === 'Stellar' && kind === 'supernova') weight *= 1.35;
  if (epochName === 'Black Hole' && kind === 'eventHorizon') weight *= 1.65;
  return weight;
}
