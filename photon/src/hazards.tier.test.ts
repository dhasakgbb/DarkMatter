import { describe, expect, it, vi } from 'vitest';

// './hazards' imports a heavy graph (scene, track, photon, audio, ...) that
// touches `document`/`window`/`navigator` at module load. The pure helpers
// under test reference none of those; stub the heaviest leaves so the module
// graph resolves cleanly in vitest's default node environment.
vi.mock('./scene', () => ({
  scene: { add: () => {}, remove: () => {} },
  canvas: {},
  camera: {},
  hudCanvas: {},
  composer: {},
}));
vi.mock('./track', () => ({ track: { sample: () => ({}) } }));
vi.mock('./particles', () => ({ particleManager: { spawn: () => {}, update: () => {} } }));
vi.mock('./photon', () => ({ photon: {} }));
vi.mock('./audio', () => ({ audio: { play: () => {} } }));
vi.mock('./witness', () => ({ triggerWitness: () => {} }));
vi.mock('./renderProfile', () => ({ getActiveRenderProfile: () => ({ pixelRatioCap: 1 }) }));
vi.mock('./funlab/runtime', () => ({ funLab: {} }));
vi.mock('./memories', () => ({ checkMemoryTriggers: () => {}, maybeUnlockCodex: () => {} }));
vi.mock('./meta', () => ({ meta: {}, saveMeta: () => {} }));
vi.mock('./state', () => ({ game: {} }));
vi.mock('./flow', () => ({ skillBias: () => 0 }));
vi.mock('./seed', () => ({ runRng: null }));
vi.mock('./constants', () => ({
  BOOST_MAX: 100,
  IS_MOBILE: false,
  PLAYFIELD_HALF_HEIGHT: 24,
  PLAYFIELD_HALF_WIDTH: 36,
  SEGMENT_LEN: 6,
  SEGMENTS_AHEAD: 80,
}));

import { tierForStrength, applyFloorIfPending } from './hazards';

describe('tierForStrength', () => {
  it('returns 0 below the tier-1 threshold (no lensing event)', () => {
    expect(tierForStrength(0)).toBe(0);
    expect(tierForStrength(0.34)).toBe(0);
  });

  it('returns 1 for typical filament proximity', () => {
    expect(tierForStrength(0.35)).toBe(1);
    expect(tierForStrength(0.5)).toBe(1);
    expect(tierForStrength(0.64)).toBe(1);
  });

  it('returns 2 for rare strong proximity', () => {
    expect(tierForStrength(0.65)).toBe(2);
    expect(tierForStrength(0.87)).toBe(2);
  });

  it('returns 3 for ultra-rare direct passes', () => {
    expect(tierForStrength(0.88)).toBe(3);
    expect(tierForStrength(1.0)).toBe(3);
  });

  it('clamps NaN and negatives to 0', () => {
    expect(tierForStrength(Number.NaN)).toBe(0);
    expect(tierForStrength(-1)).toBe(0);
  });
});

describe('applyFloorIfPending', () => {
  it('floors strength to >= 0.35 when the pending flag is set and consumes it', () => {
    const state = { floorLensingPending: true };
    const next = applyFloorIfPending(state, 0.05);
    expect(next.strength).toBeGreaterThanOrEqual(0.35);
    expect(next.consumed).toBe(true);
    expect(state.floorLensingPending).toBe(false);
  });

  it('leaves strength untouched when no flag is set', () => {
    const state = { floorLensingPending: false };
    const next = applyFloorIfPending(state, 0.05);
    expect(next.strength).toBe(0.05);
    expect(next.consumed).toBe(false);
  });

  it('leaves strong strengths untouched and still consumes the flag', () => {
    const state = { floorLensingPending: true };
    const next = applyFloorIfPending(state, 0.9);
    expect(next.strength).toBe(0.9);
    expect(next.consumed).toBe(true);
    expect(state.floorLensingPending).toBe(false);
  });
});
