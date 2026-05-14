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

export interface PhotonEquationSnapshot {
  emittedWavelengthM: number;
  observedWavelengthM: number;
  energyEv: number;
  comovingDistanceGpc: number;
}

const REPRESENTATIVE_WAVELENGTH_M: Record<string, number> = {
  gamma: 1e-12,
  visible: 550e-9,
  radio: 0.21,
};

const HC_EV_M = 1.239841984e-6;
const FULL_RUN_DISTANCE_UNITS = 108000;
const OBSERVABLE_RADIUS_GPC = 14.26;

export function photonEquationSnapshot(wavelengthKey: string, redshiftZ: number, runDistance: number): PhotonEquationSnapshot {
  const emittedWavelengthM = REPRESENTATIVE_WAVELENGTH_M[wavelengthKey] || REPRESENTATIVE_WAVELENGTH_M.visible;
  const redshiftFactor = Math.max(1, 1 + (Number.isFinite(redshiftZ) ? redshiftZ : 0));
  const observedWavelengthM = emittedWavelengthM * redshiftFactor;
  const energyEv = HC_EV_M / observedWavelengthM;
  const comovingDistanceGpc = Math.max(0, runDistance) / FULL_RUN_DISTANCE_UNITS * OBSERVABLE_RADIUS_GPC;
  return { emittedWavelengthM, observedWavelengthM, energyEv, comovingDistanceGpc };
}

export function formatPhotonEnergy(ev: number) {
  if (!Number.isFinite(ev)) return 'inf eV';
  const abs = Math.abs(ev);
  if (abs >= 1e9) return `${formatScienceValue(ev / 1e9)} GeV`;
  if (abs >= 1e6) return `${formatScienceValue(ev / 1e6)} MeV`;
  if (abs >= 1e3) return `${formatScienceValue(ev / 1e3)} keV`;
  if (abs >= 1) return `${formatScienceValue(ev)} eV`;
  if (abs >= 1e-3) return `${formatScienceValue(ev * 1e3)} meV`;
  return `${formatScienceValue(ev)} eV`;
}

export function formatWavelength(meters: number) {
  if (!Number.isFinite(meters)) return 'inf m';
  const abs = Math.abs(meters);
  if (abs >= 1e9) return `${formatScienceValue(meters / 9.4607e15)} ly`;
  if (abs >= 1) return `${formatScienceValue(meters)} m`;
  if (abs >= 1e-3) return `${formatScienceValue(meters * 1000)} mm`;
  if (abs >= 1e-6) return `${formatScienceValue(meters * 1e6)} um`;
  if (abs >= 1e-9) return `${formatScienceValue(meters * 1e9)} nm`;
  if (abs >= 1e-12) return `${formatScienceValue(meters * 1e12)} pm`;
  return `${formatScienceValue(meters)} m`;
}

export function formatComovingDistance(gpc: number) {
  if (!Number.isFinite(gpc)) return 'inf Gpc';
  if (gpc < 0.01) return `${formatScienceValue(gpc * 1000)} Mpc`;
  return `${formatScienceValue(gpc)} Gpc`;
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
