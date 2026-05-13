export type RacingCueKind = 'gate' | 'pad';

export interface RacingCueCandidate {
  kind: RacingCueKind;
  dist: number;
  lateral: number;
  vertical: number;
  radius: number;
  hit: boolean;
  missed: boolean;
}

export interface RacingCue {
  kind: RacingCueKind;
  dz: number;
  lateral: number;
  vertical: number;
  radius: number;
  align: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

const MIN_READABLE_CUE_DZ = 12;
const LATE_MISS_RADIUS_SCALE = 1.35;

function lateralDistance(candidate: RacingCueCandidate, photonLat: number, photonVer: number) {
  const dx = candidate.lateral - photonLat;
  const dy = candidate.vertical - photonVer;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pickNextRacingCue(
  candidates: RacingCueCandidate[],
  photonDist: number,
  photonLat: number,
  photonVer: number,
): RacingCue | null {
  let best: RacingCueCandidate | null = null;
  let bestDz = Number.POSITIVE_INFINITY;
  let fallback: RacingCueCandidate | null = null;
  let fallbackDz = Number.POSITIVE_INFINITY;
  let bestDistance = 0;

  for (const candidate of candidates) {
    if (candidate.hit || candidate.missed) continue;
    const dz = candidate.dist - photonDist;
    if (dz < 0 || dz > 185) continue;
    const distance = lateralDistance(candidate, photonLat, photonVer);
    if (dz < fallbackDz) {
      fallback = candidate;
      fallbackDz = dz;
    }
    if (dz < MIN_READABLE_CUE_DZ && distance > candidate.radius * LATE_MISS_RADIUS_SCALE) continue;
    if (dz < bestDz) {
      best = candidate;
      bestDz = dz;
      bestDistance = distance;
    }
  }

  if (!best && fallback) {
    best = fallback;
    bestDz = fallbackDz;
    bestDistance = lateralDistance(fallback, photonLat, photonVer);
  }
  if (!best) return null;
  return {
    kind: best.kind,
    dz: bestDz,
    lateral: best.lateral,
    vertical: best.vertical,
    radius: best.radius,
    align: clamp01(1 - bestDistance / Math.max(1, best.radius * 2.15)),
  };
}
