import { describe, expect, it } from 'vitest';
import { formatComovingDistance, formatPhotonEnergy, formatScienceValue, formatTemperature, formatWavelength, photonEnergyLossPercent, photonEquationSnapshot, scienceSnapshot } from './science';

describe('science telemetry', () => {
  it('maps recombination near the observed CMB release redshift', () => {
    const snapshot = scienceSnapshot(2, 25, 50);
    expect(snapshot.redshiftZ).toBeGreaterThan(900);
    expect(snapshot.redshiftZ).toBeLessThan(1300);
    expect(snapshot.cmbKelvin).toBeGreaterThan(2500);
    expect(snapshot.cmbKelvin).toBeLessThan(3600);
  });

  it('moves dark energy toward dominance in far-future epochs', () => {
    const stellar = scienceSnapshot(5, 360, 360);
    const heatDeath = scienceSnapshot(8, 360, 360);
    expect(stellar.darkEnergyOmega).toBeGreaterThan(0.6);
    expect(heatDeath.darkEnergyOmega).toBeGreaterThan(0.99);
    expect(heatDeath.expansionDrift).toBeGreaterThan(stellar.expansionDrift);
  });

  it('formats compact HUD values', () => {
    expect(formatScienceValue(1089)).toBe('1089');
    expect(formatScienceValue(1e-5)).toBe('1.0e-5');
    expect(formatTemperature(2.725)).toBe('2.73 K');
  });

  it('computes live photon equation telemetry', () => {
    const visible = photonEquationSnapshot('visible', 0, 54000);
    expect(visible.energyEv).toBeGreaterThan(2.2);
    expect(visible.energyEv).toBeLessThan(2.3);
    expect(visible.comovingDistanceGpc).toBeGreaterThan(7.1);
    expect(visible.comovingDistanceGpc).toBeLessThan(7.2);

    const redshifted = photonEquationSnapshot('visible', 1, 0);
    expect(redshifted.energyEv).toBeCloseTo(visible.energyEv / 2, 4);
    expect(formatPhotonEnergy(visible.energyEv)).toBe('2.25 eV');
    expect(formatComovingDistance(0.004)).toBe('4.00 Mpc');
    expect(formatWavelength(550e-9)).toBe('550 nm');
  });
});

describe('photonEnergyLossPercent', () => {
  it('returns 0 at emission (z=0)', () => {
    expect(photonEnergyLossPercent('visible', 0)).toBe(0);
  });

  it('returns ~50% when redshift halves the energy', () => {
    // observed = emitted * (1+z); energy ∝ 1/observed; so loss = z/(1+z).
    const loss = photonEnergyLossPercent('visible', 1);
    expect(loss).toBeGreaterThan(49);
    expect(loss).toBeLessThan(51);
  });

  it('clamps NaN and infinities to 0', () => {
    expect(photonEnergyLossPercent('visible', Number.NaN)).toBe(0);
    expect(photonEnergyLossPercent('visible', -1)).toBe(0);
  });
});
