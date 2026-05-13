import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOW_PARAMS, flowTarget, skillBias, stepFlow } from './flow';

describe('flow signal', () => {
  it('rises monotonically as phase streak builds with clean engagement', () => {
    let level = 0;
    let last = -1;
    for (let i = 0; i < 12; i++) {
      const target = flowTarget({
        phaseStreak: i + 1,
        cleanRunTime: i * (1 / 60) * 10, // accumulates ~time
        timeSincePhase: 0,                // phasing every frame
        energyRatio: 0.6,
        boosting: false,
      });
      level = stepFlow(level, target, 1 / 60);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
    expect(level).toBeGreaterThan(0.05);
  });

  it('skill bias stays clamped to [-0.2, +0.2] across full flow range', () => {
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const b = skillBias(f, 1);
      expect(b).toBeGreaterThanOrEqual(-0.2 - 1e-9);
      expect(b).toBeLessThanOrEqual(0.2 + 1e-9);
    }
    // Tutorial epoch is exempt regardless of flow.
    expect(skillBias(1, 0)).toBe(0);
  });

  it('clean-run dwell decays after engagement gap (avoidance no longer counts as flow)', () => {
    const baseInputs = { phaseStreak: 0, cleanRunTime: 30, energyRatio: 0, boosting: false };
    const engaged = flowTarget({ ...baseInputs, timeSincePhase: 0 });
    const grace = flowTarget({ ...baseInputs, timeSincePhase: DEFAULT_FLOW_PARAMS.cleanGrace });
    const decayed = flowTarget({
      ...baseInputs,
      timeSincePhase: DEFAULT_FLOW_PARAMS.cleanGrace + DEFAULT_FLOW_PARAMS.cleanDecay,
    });
    expect(engaged).toBeGreaterThan(0);
    expect(grace).toBeCloseTo(engaged, 5);
    expect(decayed).toBe(0);
  });

  it('full inputs saturate the target at 1.0', () => {
    const target = flowTarget({
      phaseStreak: DEFAULT_FLOW_PARAMS.streakSat,
      cleanRunTime: DEFAULT_FLOW_PARAMS.cleanSat,
      timeSincePhase: 0,
      energyRatio: 1,
      boosting: true,
    });
    expect(target).toBeCloseTo(1, 5);
  });
});
