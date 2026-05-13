export interface ScienceSnapshot {
  scaleFactor: number;
  redshiftZ: number;
  cmbKelvin: number;
  matterOmega: number;
  darkEnergyOmega: number;
  expansionDrift: number;
}

interface ScaleRange {
  startLog10A: number;
  endLog10A: number;
}

const SCALE_RANGES: ScaleRange[] = [
  { startLog10A: -32, endLog10A: -26 },
  { startLog10A: -12, endLog10A: -10 },
  { startLog10A: Math.log10(1 / 1300), endLog10A: Math.log10(1 / 900) },
  { startLog10A: Math.log10(1 / 31), endLog10A: Math.log10(1 / 11) },
  { startLog10A: Math.log10(1 / 11), endLog10A: Math.log10(1 / 3) },
  { startLog10A: Math.log10(1 / 3), endLog10A: 0 },
  { startLog10A: 5, endLog10A: 14 },
  { startLog10A: 14, endLog10A: 40 },
  { startLog10A: 40, endLog10A: 100 },
];

function smooth01(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function scienceSnapshot(epochIndex: number, epochTimer: number, epochDuration: number): ScienceSnapshot {
  const range = SCALE_RANGES[Math.max(0, Math.min(SCALE_RANGES.length - 1, epochIndex))];
  const progress = smooth01(epochTimer / Math.max(1, epochDuration));
  const logA = lerp(range.startLog10A, range.endLog10A, progress);
  const scaleFactor = 10 ** logA;
  const redshiftZ = (1 / scaleFactor) - 1;
  const cmbKelvin = 2.725 / scaleFactor;
  const matterTerm = 0.315 * scaleFactor ** -3;
  const darkEnergyTerm = 0.685;
  const densitySum = matterTerm + darkEnergyTerm;
  const matterOmega = Number.isFinite(matterTerm) && densitySum > 0 ? matterTerm / densitySum : 1;
  const darkEnergyOmega = Number.isFinite(matterTerm) && densitySum > 0 ? darkEnergyTerm / densitySum : 0;
  const expansionDrift = darkEnergyOmega * Math.max(0, Math.min(1, logA / 100));
  return { scaleFactor, redshiftZ, cmbKelvin, matterOmega, darkEnergyOmega, expansionDrift };
}

export function formatScienceValue(value: number) {
  if (!Number.isFinite(value)) return 'inf';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 10000 || abs < 0.01) return value.toExponential(1).replace('e+', 'e');
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatTemperature(kelvin: number) {
  if (!Number.isFinite(kelvin)) return 'inf K';
  if (kelvin < 0.01) return `${kelvin.toExponential(1).replace('e+', 'e')} K`;
  if (kelvin >= 10000) return `${kelvin.toExponential(1).replace('e+', 'e')} K`;
  if (kelvin >= 100) return `${kelvin.toFixed(0)} K`;
  return `${kelvin.toFixed(2)} K`;
}
