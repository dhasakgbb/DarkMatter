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

export function pickNextRacingCue(
  candidates: RacingCueCandidate[],
  photonDist: number,
  photonLat: number,
  photonVer: number,
): RacingCue | null {
  let best: RacingCueCandidate | null = null;
  let bestDz = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.hit || candidate.missed) continue;
    const dz = candidate.dist - photonDist;
    if (dz < 0 || dz > 185) continue;
    if (dz < bestDz) {
      best = candidate;
      bestDz = dz;
    }
  }

  if (!best) return null;
  const dx = best.lateral - photonLat;
  const dy = best.vertical - photonVer;
  const lateralDistance = Math.sqrt(dx * dx + dy * dy);
  return {
    kind: best.kind,
    dz: bestDz,
    lateral: best.lateral,
    vertical: best.vertical,
    radius: best.radius,
    align: clamp01(1 - lateralDistance / Math.max(1, best.radius * 2.15)),
  };
}
