import { describe, expect, it } from 'vitest';
import { epochHazardWeight, epochMechanics } from './epochMechanics';

describe('epoch mechanics', () => {
  it('makes quark plasma denser and more chain-heavy', () => {
    const normal = epochMechanics('Stellar');
    const plasma = epochMechanics('Quark Plasma');
    expect(plasma.hazardGapMul).toBeLessThan(1);
    expect(plasma.gluonChainChance).toBeGreaterThan(normal.gluonChainChance);
    expect(epochHazardWeight('Quark Plasma', 'gluon', 1)).toBeGreaterThan(epochHazardWeight('Inflationary', 'gluon', 1));
  });

  it('makes recombination open into racing-line payoff', () => {
    const recombination = epochMechanics('Recombination');
    expect(recombination.hazardGapMul).toBeGreaterThan(1);
    expect(recombination.racingGapMul).toBeLessThan(1);
    expect(recombination.padChanceMul).toBeGreaterThan(1);
  });

  it('keeps dark matter rare but more likely in galactic structure', () => {
    const base = epochHazardWeight('First Stars', 'darkMatterFilament', 1);
    const galactic = epochHazardWeight('Galactic', 'darkMatterFilament', 1);
    expect(galactic).toBeGreaterThan(base);
    expect(galactic).toBeLessThan(1);
  });

  it('sharpens named late-era threats', () => {
    expect(epochHazardWeight('First Stars', 'supernova', 1)).toBeGreaterThan(1);
    expect(epochHazardWeight('Black Hole', 'eventHorizon', 1)).toBeGreaterThan(1);
  });
});
