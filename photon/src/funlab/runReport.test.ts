import { describe, expect, it } from 'vitest';
import { runFeelNudge, runFeelRows, runFeelStateLabel } from './runReport';
import type { FunRunRecord } from './types';

function record(overrides: Partial<FunRunRecord> = {}): FunRunRecord {
  return {
    id: 'run-1',
    createdAt: 1,
    events: [],
    summary: {} as FunRunRecord['summary'],
    fingerprint: {
      dopamine: 62,
      flow: 58,
      oneMoreRun: 64,
      frustration: 22,
      readability: 74,
      funIndex: 67,
      trust: 80,
      uncertainty: [],
    },
    recommendations: [],
    dopamineEngine: {
      state: 'underfed',
      score: 61,
      rewardCadenceSec: 8.4,
      rewardEventsPerMin: 7.1,
      pressure: 32,
      mastery: 51,
      safety: 84,
      novelty: 30,
      theoryTags: ['anticipation-payoff'],
      missingBeats: [],
      plan: [{
        priority: 'now',
        title: 'Shorten the reward drought',
        principle: 'anticipation-payoff',
        diagnosis: 'Reward drought.',
        action: 'Thread a gate into a speed pad before the quiet gap.',
        expectedEffect: 'More pull.',
        risk: 'medium',
        evidence: ['cadence'],
      }],
      tuning: [],
      guardrails: [],
    },
    ...overrides,
  };
}

describe('run feel report', () => {
  it('formats the dopamine engine state and rows for the death screen', () => {
    const rows = runFeelRows(record());
    expect(runFeelStateLabel(record())).toBe('Underfed');
    expect(rows).toContainEqual({ label: 'Reward cadence', value: '8.4 s' });
    expect(rows).toContainEqual({ label: 'Fun index', value: '67' });
  });

  it('uses the now-plan action as the next nudge', () => {
    expect(runFeelNudge(record())).toBe('Thread a gate into a speed pad before the quiet gap.');
  });

  it('handles missing records defensively', () => {
    expect(runFeelRows(null)).toEqual([]);
    expect(runFeelStateLabel(null)).toBe('No signal');
    expect(runFeelNudge(null)).toContain('longer run');
  });
});
