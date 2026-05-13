import { IS_MOBILE, SETTINGS_KEY } from './constants';

export type VisualQuality = 'mobile' | 'balanced' | 'ultra';

export interface RenderProfile {
  quality: VisualQuality;
  pixelRatioCap: number;
  skySegments: number;
  skyRings: number;
  skyDetail: number;
  starCount: number;
  parallaxStarCount: number;
  nebulaDustCount: number;
  cosmicWebStrands: number;
  routeSamples: number;
  ringPoolSize: number;
  trackDustCount: number;
  hazardDetail: number;
  bloomBase: number;
  bloomRadius: number;
  bloomThreshold: number;
  bloomSpeedAdd: number;
  bloomBoostAdd: number;
  lensingMul: number;
  glowMul: number;
  exposure: number;
}

const PROFILES: Record<VisualQuality, RenderProfile> = {
  mobile: {
    quality: 'mobile',
    pixelRatioCap: window.innerWidth < 430 ? 1.15 : 1.25,
    skySegments: 36,
    skyRings: 18,
    skyDetail: 0.72,
    starCount: 820,
    parallaxStarCount: 180,
    nebulaDustCount: 260,
    cosmicWebStrands: 30,
    routeSamples: 42,
    ringPoolSize: 32,
    trackDustCount: 160,
    hazardDetail: 0.55,
    bloomBase: 0.46,
    bloomRadius: 0.54,
    bloomThreshold: 0.38,
    bloomSpeedAdd: 0.06,
    bloomBoostAdd: 0.07,
    lensingMul: 0.62,
    glowMul: 0.82,
    exposure: 0.94,
  },
  balanced: {
    quality: 'balanced',
    pixelRatioCap: 1.65,
    skySegments: 48,
    skyRings: 24,
    skyDetail: 0.92,
    starCount: 2200,
    parallaxStarCount: 560,
    nebulaDustCount: 820,
    cosmicWebStrands: 86,
    routeSamples: 54,
    ringPoolSize: 42,
    trackDustCount: 480,
    hazardDetail: 0.82,
    bloomBase: 0.54,
    bloomRadius: 0.62,
    bloomThreshold: 0.34,
    bloomSpeedAdd: 0.08,
    bloomBoostAdd: 0.10,
    lensingMul: 0.82,
    glowMul: 1.0,
    exposure: 0.98,
  },
  ultra: {
    quality: 'ultra',
    pixelRatioCap: 2.0,
    skySegments: 72,
    skyRings: 36,
    skyDetail: 1.18,
    starCount: 4200,
    parallaxStarCount: 1400,
    nebulaDustCount: 1800,
    cosmicWebStrands: 160,
    routeSamples: 76,
    ringPoolSize: 58,
    trackDustCount: 900,
    hazardDetail: 1.0,
    bloomBase: 0.66,
    bloomRadius: 0.72,
    bloomThreshold: 0.28,
    bloomSpeedAdd: 0.11,
    bloomBoostAdd: 0.14,
    lensingMul: 1.0,
    glowMul: 1.18,
    exposure: 1.04,
  },
};

function storedQuality(): VisualQuality | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { visualQuality?: unknown };
    return normalizeVisualQuality(parsed.visualQuality, null);
  } catch {
    return null;
  }
}

export function defaultVisualQuality(): VisualQuality {
  return IS_MOBILE ? 'mobile' : 'ultra';
}

export function normalizeVisualQuality(value: unknown, fallback: VisualQuality | null = defaultVisualQuality()): VisualQuality {
  return value === 'mobile' || value === 'balanced' || value === 'ultra' ? value : (fallback || defaultVisualQuality());
}

let activeProfile = PROFILES[storedQuality() || defaultVisualQuality()];

export function getActiveRenderProfile() {
  return activeProfile;
}

export function setActiveRenderProfile(quality: VisualQuality) {
  activeProfile = PROFILES[quality];
  return activeProfile;
}

export function renderPixelRatio() {
  return Math.min(activeProfile.pixelRatioCap, window.devicePixelRatio || 1);
}
