import { describe, expect, it } from 'vitest';
import { formatScienceValue, formatTemperature, scienceSnapshot } from './science';

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
});
