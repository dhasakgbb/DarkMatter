import { describe, expect, it } from 'vitest';
import { birthSequenceFrame, shouldTriggerPrimordialLensing } from './birthSequence';

describe('Big Bang birth sequence curve', () => {
  it('starts white-hot and damps toward normal play by fifteen seconds', () => {
    const start = birthSequenceFrame(0, { scienceMode: true, mobile: false });
    const settled = birthSequenceFrame(15, { scienceMode: true, mobile: false });

    expect(start.flash).toBeGreaterThan(0.95);
    expect(start.noiseAmp).toBeGreaterThan(1.8);
    expect(start.bloomMul).toBeGreaterThan(4);
    expect(start.progress).toBe(0);
    expect(settled.flash).toBe(0);
    expect(settled.noiseAmp).toBeCloseTo(1, 3);
    expect(settled.bloomMul).toBeCloseTo(1, 3);
    expect(settled.progress).toBe(1);
  });

  it('keeps mobile intense but damped for performance and readability', () => {
    const desktop = birthSequenceFrame(1, { scienceMode: true, mobile: false });
    const mobile = birthSequenceFrame(1, { scienceMode: true, mobile: true });

    expect(mobile.flash).toBeLessThan(desktop.flash);
    expect(mobile.noiseAmp).toBeLessThan(desktop.noiseAmp);
    expect(mobile.bloomMul).toBeLessThan(desktop.bloomMul);
    expect(mobile.jitter).toBeLessThan(desktop.jitter);
  });

  it('tones down non-science mode without removing the opening', () => {
    const science = birthSequenceFrame(0.75, { scienceMode: true, mobile: false });
    const casual = birthSequenceFrame(0.75, { scienceMode: false, mobile: false });

    expect(casual.flash).toBeLessThan(science.flash);
    expect(casual.noiseAmp).toBeLessThan(science.noiseAmp);
    expect(casual.bloomMul).toBeLessThan(science.bloomMul);
  });
});

describe('primordial lensing chance', () => {
  it('is deterministic per seed and only eligible during the opening window', () => {
    const seed = 0xabc123;
    const first = shouldTriggerPrimordialLensing(seed, 4, true);
    const second = shouldTriggerPrimordialLensing(seed, 4, true);

    expect(first).toBe(second);
    expect(shouldTriggerPrimordialLensing(seed, 9, true)).toBe(false);
    expect(shouldTriggerPrimordialLensing(seed, 4, false)).toBe(false);
  });
});
