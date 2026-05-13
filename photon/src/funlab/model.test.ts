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

    const { fingerprint, recommendations, dopamineEngine } = analyzeRun(events, roughVibe);

    expect(fingerprint.frustration).toBeGreaterThan(70);
    expect(fingerprint.flow).toBeLessThan(45);
    expect(recommendations.map((r) => r.id)).toContain('cheap-damage');
    expect(dopamineEngine.state).toBe('punishing');
    expect(dopamineEngine.theoryTags).toContain('recovery-windows');
    expect(dopamineEngine.plan[0].principle).toBe('recovery-windows');
  });

  it('does not double-count paired damage and hazard-hit telemetry', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 2, epochName: 'Recombination' }),
      ev('damage', 8, { damage: 22, cause: 'gluon' }),
      ev('hazard-hit', 8.01, { damage: 22, cause: 'gluon' }),
      ev('damage', 13, { damage: 18, cause: 'plasma' }),
      ev('hazard-hit', 13.01, { damage: 18, cause: 'plasma' }),
      ev('death', 20, { cause: 'test death', epochIndex: 2, epochName: 'Recombination' }),
    ];

    const summary = summarizeRun(events);

    expect(summary.damageEvents).toBe(2);
    expect(summary.hazardHits).toBe(2);
    expect(summary.clusteredDamageEvents).toBe(0);
    expect(summary.damageTotal).toBe(40);
  });

  it('treats gravity slingshots as dopamine events', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 4, epochName: 'First Stars' }),
      ev('hazard-near-miss', 4, { cause: 'well' }),
      ev('gravity-sling', 4.1, { cause: 'well', value: 0.8 }),
      ev('gate-hit', 7, { streak: 1 }),
      ev('gravity-sling', 11, { cause: 'well', value: 0.6 }),
      ev('run-end', 18, { distance: 1200, epochIndex: 4, epochName: 'First Stars' }),
    ];

    const { summary, fingerprint } = analyzeRun(events, { fun: 4, flow: 4, frustration: 1, oneMoreRun: 4, at: 18_000 });

    expect(summary.gravitySlingshots).toBe(2);
    expect(fingerprint.dopamine).toBeGreaterThan(45);
  });

  it('detects boredom gaps and recommends excitement density', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 3, epochName: 'Dark Ages' }),
      ev('gate-hit', 4, { streak: 1 }),
      ev('speed-pad-hit', 8),
      ev('pickup', 29),
      ev('run-end', 45, { distance: 2000, epochIndex: 3, epochName: 'Dark Ages' }),
    ];

    const { summary, recommendations, dopamineEngine } = analyzeRun(events, { fun: 2, flow: 3, frustration: 1, oneMoreRun: 2, at: 45_000 });

    expect(summary.boredomGapCount).toBeGreaterThan(0);
    expect(summary.longestBoredomGap).toBeGreaterThanOrEqual(12);
    expect(recommendations.map((r) => r.id)).toContain('boredom-gap');
    expect(dopamineEngine.state).toBe('underfed');
    expect(dopamineEngine.missingBeats.map((beat) => beat.principle)).toContain('anticipation-payoff');
    expect(dopamineEngine.plan.some((step) => step.title.includes('reward drought'))).toBe(true);
  });

  it('does not treat upgrade deliberation as gameplay boredom', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 0, epochName: 'Inflationary' }),
      ev('gate-hit', 4, { streak: 1 }),
      ev('speed-pad-hit', 8),
      ev('upgrade-options', 10, { epochIndex: 0, epochName: 'Inflationary' }),
      ev('upgrade-selected', 42, { epochIndex: 0, epochName: 'Inflationary', note: 'speed' }),
      ev('epoch-enter', 43, { epochIndex: 1, epochName: 'Quark Plasma' }),
      ev('speed-pad-hit', 45),
      ev('gate-hit', 47, { streak: 2 }),
      ev('quit', 50, { distance: 2000, epochIndex: 1, epochName: 'Quark Plasma' }),
    ];

    const { summary, recommendations } = analyzeRun(events, { fun: 4, flow: 4, frustration: 2, oneMoreRun: 4, at: 50_000 });

    expect(summary.boredomGapCount).toBe(0);
    expect(recommendations.map((r) => r.id)).not.toContain('boredom-gap');
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

  it('builds a readability-first plan for confusing route telemetry', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 3, epochName: 'Dark Ages' }),
      ev('gate-miss', 4),
      ev('line-break', 4.2),
      ev('gate-miss', 8),
      ev('line-break', 8.1),
      ev('gate-miss', 12),
      ev('hazard-near-miss', 15),
      ev('run-end', 26, { distance: 1300, epochIndex: 3, epochName: 'Dark Ages' }),
    ];

    const { dopamineEngine } = analyzeRun(events, { fun: 3, flow: 2, frustration: 2, oneMoreRun: 3, at: 26_000 });

    expect(dopamineEngine.state).toBe('confusing');
    expect(dopamineEngine.theoryTags).toContain('readable-challenge');
    expect(dopamineEngine.plan[0].title).toContain('readable challenge');
    expect(dopamineEngine.tuning.map((delta) => delta.knob)).toContain('routeCueBrightness');
  });

  it('keeps manual quits in context instead of over-reading difficulty', () => {
    const events = [
      ev('run-start', 0, { epochIndex: 2, epochName: 'Recombination' }),
      ev('gate-hit', 4, { streak: 1 }),
      ev('gate-hit', 7, { streak: 2 }),
      ev('speed-pad-hit', 9),
      ev('hazard-near-miss', 12),
      ev('quit', 18, { distance: 1200, epochIndex: 2, epochName: 'Recombination', cause: 'manual end run' }),
    ];

    const { recommendations } = analyzeRun(events, { fun: 3, flow: 3, frustration: 2, oneMoreRun: 3, at: 18_000 });
    const ids = recommendations.map((r) => r.id);

    expect(ids).toContain('manual-quit-context');
    expect(ids).not.toContain('route-readability');
  });
});
