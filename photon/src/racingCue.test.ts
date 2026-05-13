import { describe, expect, it } from 'vitest';
import { pickNextRacingCue, type RacingCueCandidate } from './racingCue';

function candidate(overrides: Partial<RacingCueCandidate>): RacingCueCandidate {
  return {
    kind: 'gate',
    dist: 100,
    lateral: 0,
    vertical: 0,
    radius: 7,
    hit: false,
    missed: false,
    ...overrides,
  };
}

describe('racing cue selection', () => {
  it('selects the nearest actionable line target ahead of the photon', () => {
    const cue = pickNextRacingCue([
      candidate({ kind: 'pad', dist: 155 }),
      candidate({ kind: 'gate', dist: 118, lateral: 3 }),
    ], 100, 0, 0);

    expect(cue?.kind).toBe('gate');
    expect(cue?.dz).toBe(18);
  });

  it('ignores spent targets and stale targets behind the hit window', () => {
    const cue = pickNextRacingCue([
      candidate({ dist: 90 }),
      candidate({ dist: 112, hit: true }),
      candidate({ kind: 'pad', dist: 130, missed: true }),
      candidate({ kind: 'pad', dist: 144 }),
    ], 108, 0, 0);

    expect(cue?.kind).toBe('pad');
    expect(cue?.dz).toBe(36);
  });

  it('does not keep pointing at a pad once the photon has passed it', () => {
    const cue = pickNextRacingCue([
      candidate({ kind: 'pad', dist: 96 }),
      candidate({ kind: 'gate', dist: 126 }),
    ], 100, 0, 0);

    expect(cue?.kind).toBe('gate');
    expect(cue?.dz).toBe(26);
  });

  it('reports alignment from the photon toward the cue center', () => {
    const centered = pickNextRacingCue([candidate({ lateral: 0, vertical: 0 })], 90, 0, 0);
    const wide = pickNextRacingCue([candidate({ lateral: 14, vertical: 0 })], 90, 0, 0);

    expect(centered?.align).toBe(1);
    expect(wide?.align).toBeLessThan(centered?.align || 0);
    expect(wide?.align).toBeGreaterThanOrEqual(0);
  });

  it('prefers a readable lead cue over an off-axis target that is already too late', () => {
    const cue = pickNextRacingCue([
      candidate({ dist: 106, lateral: 18, vertical: 0 }),
      candidate({ kind: 'pad', dist: 132, lateral: 3, vertical: 0 }),
    ], 100, 0, 0);

    expect(cue?.kind).toBe('pad');
    expect(cue?.dz).toBe(32);
  });

  it('keeps a late off-axis cue when no better lead cue exists', () => {
    const cue = pickNextRacingCue([
      candidate({ dist: 106, lateral: 18, vertical: 0 }),
    ], 100, 0, 0);

    expect(cue?.kind).toBe('gate');
    expect(cue?.dz).toBe(6);
  });
});
