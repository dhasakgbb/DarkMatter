import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audio', () => ({
  audio: {
    memoryUnlock: vi.fn(),
  },
}));
vi.mock('./utils', () => ({
  showToast: vi.fn(),
  cosmicTimeLabel: () => '',
  comboMultiplier: () => 1,
}));
vi.mock('./constants', () => ({
  META_KEY: 'photon-meta-v1',
  RUN_KEY: 'photon-run-v1',
}));

import { checkMemoryTriggers } from './memories';
import { meta } from './meta';
import { game } from './state';
import { saveSeedBookmark } from './physicsInsight';

describe('seed-echo memory unlock', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
      clear: vi.fn(() => { values.clear(); }),
    });
    delete meta.memories['seed-echo'];
    meta.totalRuns = 1;
    meta.bestEpoch = 0;
    meta.darkMatterDetections = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete meta.memories['seed-echo'];
  });

  it('does not fire when no bookmark exists for the current seed', () => {
    game.runSeed = 12345;
    checkMemoryTriggers();
    expect(meta.memories['seed-echo']).toBeFalsy();
  });

  it('does not fire when bookmark exists but score is below 45', () => {
    saveSeedBookmark({ seed: 12345, label: '009IX', createdAt: 1, insightScore: 30, epochName: 'Galactic', note: '' });
    game.runSeed = 12345;
    checkMemoryTriggers();
    expect(meta.memories['seed-echo']).toBeFalsy();
  });

  it('fires when a bookmark with score >= 45 matches the current seed', () => {
    saveSeedBookmark({ seed: 12345, label: '009IX', createdAt: 1, insightScore: 72, epochName: 'Galactic', note: '' });
    game.runSeed = 12345;
    checkMemoryTriggers();
    expect(meta.memories['seed-echo']).toBe(true);
  });

  it('does not double-fire across repeated checks within a run', () => {
    saveSeedBookmark({ seed: 99, label: '00002R', createdAt: 1, insightScore: 90, epochName: 'Galactic', note: '' });
    game.runSeed = 99;
    checkMemoryTriggers();
    checkMemoryTriggers();
    expect(meta.memories['seed-echo']).toBe(true);
    expect(typeof meta.memories['seed-echo']).toBe('boolean');
  });
});
