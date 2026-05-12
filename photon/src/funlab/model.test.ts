import { describe, expect, it } from 'vitest';
import { analyzeRun, scoreRun, summarizeRun } from './model';
import type { FunRunEvent, VibeRating } from './types';

function ev(type: FunRunEvent['type'], t: number, extra: Partial<FunRunEvent> = {}): FunRunEvent {
  return { type, at: t * 1000, t, runId: 'fixture', ...extra };
}

const happyVibe: VibeRating = { fun: 5, flow: 4, frustration: 1, oneMoreRun: 5, at: 60_000 };
const roughVibe: VibeRating = { fun: 2, flow: 1, frustration: 5, oneMoreRun: 2, at: 18_000 };

describe('Fun Lab model', () => {
  it('scores high-dopamine traces without hiding frustration', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 1, epochName: 'Quark Plasma' }),
      ev('epoch-enter', 1, { epochIndex: 1, epochName: 'Quark Plasma' }),
      ev('hazard-near-miss', 4),
      ev('speed-pad-hit', 7),
      ev('gate-hit', 9, { streak: 1 }),
      ev('hazard-near-miss', 11),
      ev('phase-through', 13),
      ev('speed-pad-hit', 16),
      ev('gate-hit', 18, { streak: 2 }),
      ev('damage', 20, { damage: 18, cause: 'plasma' }),
      ev('hazard-near-miss', 22),
      ev('gate-hit', 24, { streak: 3 }),
      ev('run-end', 31, { distance: 1800, epochIndex: 1, epochName: 'Quark Plasma' }),
    ];

    const { fingerprint, recommendations } = analyzeRun(events, happyVibe);

    expect(fingerprint.dopamine).toBeGreaterThan(60);
    expect(fingerprint.funIndex).toBeGreaterThan(50);
    expect(fingerprint.frustration).toBeLessThan(45);
    expect(recommendations.map((r) => r.id)).not.toContain('cheap-damage');
  });

  it('flags clustered damage as frustration even with near misses', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 2, epochName: 'Recombination' }),
      ev('hazard-near-miss', 5),
      ev('damage', 8, { damage: 22, cause: 'gluon' }),
      ev('damage', 9.2, { damage: 20, cause: 'gluon' }),
      ev('damage', 10.7, { damage: 18, cause: 'plasma' }),
      ev('gate-miss', 12),
      ev('death', 15, { cause: 'clustered hazards', epochIndex: 2, epochName: 'Recombination' }),
    ];

    const { fingerprint, recommendations } = analyzeRun(events, roughVibe);

    expect(fingerprint.frustration).toBeGreaterThan(70);
    expect(fingerprint.flow).toBeLessThan(45);
    expect(recommendations.map((r) => r.id)).toContain('cheap-damage');
  });

  it('detects boredom gaps and recommends excitement density', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 3, epochName: 'Dark Ages' }),
      ev('gate-hit', 4, { streak: 1 }),
      ev('speed-pad-hit', 8),
      ev('pickup', 29),
      ev('run-end', 45, { distance: 2000, epochIndex: 3, epochName: 'Dark Ages' }),
    ];

    const { summary, recommendations } = analyzeRun(events, { fun: 2, flow: 3, frustration: 1, oneMoreRun: 2, at: 45_000 });

    expect(summary.boredomGapCount).toBeGreaterThan(0);
    expect(summary.longestBoredomGap).toBeGreaterThanOrEqual(12);
    expect(recommendations.map((r) => r.id)).toContain('boredom-gap');
  });

  it('lowers trust when telemetry and ratings disagree', () => {
    const events = [
      ev('run-start', 0),
      ev('gate-hit', 4, { streak: 1 }),
      ev('gate-hit', 7, { streak: 2 }),
      ev('speed-pad-hit', 9),
      ev('hazard-near-miss', 12),
      ev('phase-through', 15),
      ev('run-end', 30, { distance: 1600, epochIndex: 2, epochName: 'Recombination' }),
    ];
    const summary = summarizeRun(events);
    const happy = scoreRun(summary, happyVibe);
    const contradictory = scoreRun(summary, roughVibe);

    expect(happy.trust).toBeGreaterThan(contradictory.trust);
    expect(contradictory.uncertainty.length).toBeGreaterThan(0);
  });
});
