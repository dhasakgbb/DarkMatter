import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHYSICS_SEED_BOOKMARKS_KEY,
  analyzePhysicsRun,
  loadSeedBookmarks,
  saveSeedBookmark,
  type PhysicsInsightInput,
} from './physicsInsight';

function input(overrides: Partial<PhysicsInsightInput> = {}): PhysicsInsightInput {
  return {
    seed: 123456,
    seedLabel: '002N9C',
    epochIndex: 4,
    epochName: 'Galactic',
    epochTimer: 120,
    epochDuration: 230,
    wavelengthKey: 'visible',
    runDistance: 42000,
    flowPeak: 0.82,
    bestLineStreak: 7,
    phaseStreak: 9,
    darkMatterDetections: 1,
    manualEnd: false,
    scienceMode: true,
    ...overrides,
  };
}

describe('physics insight analysis', () => {
  it('scores a high-resonance clean discovery run as strong insight', () => {
    const report = analyzePhysicsRun(input());

    expect(report.insight.score).toBeGreaterThanOrEqual(82);
    expect(report.insight.label).toBe('Textbook run');
    expect(report.resonance.label).toBe('coherent phase chain');
    expect(report.resonance.phaseChain).toBe(9);
    expect(report.bookmarkHint).toContain('Replay');
  });

  it('rewards dark-matter discovery even when the phase chain is modest', () => {
    const withDetection = analyzePhysicsRun(input({ phaseStreak: 2, bestLineStreak: 2, flowPeak: 0.45, darkMatterDetections: 1 }));
    const withoutDetection = analyzePhysicsRun(input({ phaseStreak: 2, bestLineStreak: 2, flowPeak: 0.45, darkMatterDetections: 0 }));

    expect(withDetection.insight.score).toBeGreaterThan(withoutDetection.insight.score);
    expect(withDetection.discovery.darkMatterObserved).toBe(true);
  });

  it('keeps early low-signal deaths from looking like insight', () => {
    const report = analyzePhysicsRun(input({
      epochIndex: 0,
      epochName: 'Inflationary',
      epochTimer: 5,
      epochDuration: 35,
      runDistance: 180,
      flowPeak: 0.08,
      bestLineStreak: 0,
      phaseStreak: 0,
      darkMatterDetections: 0,
    }));

    expect(report.insight.score).toBeLessThan(30);
    expect(report.insight.label).toBe('Low signal');
  });

  it('penalizes manual quits without invalidating the export', () => {
    const completed = analyzePhysicsRun(input({ manualEnd: false }));
    const quit = analyzePhysicsRun(input({ manualEnd: true }));

    expect(quit.insight.score).toBeLessThan(completed.insight.score);
    expect(quit.seed.label).toBe('002N9C');
    expect(quit.path.energyLostPercent).toBeGreaterThan(0);
  });

  it('preserves the death-screen export compatibility fields', () => {
    const report = analyzePhysicsRun(input());

    expect(report).toMatchObject({
      seed: { value: 123456, label: '002N9C' },
      epoch: { index: 4, name: 'Galactic' },
      photon: { wavelength: 'visible' },
      path: {
        properDistanceUnits: 42000,
        comovingDistanceGpc: expect.any(Number),
        redshiftZ: expect.any(Number),
        energyLostPercent: expect.any(Number),
      },
      run: {
        flowPeak: 0.82,
        bestLineStreak: 7,
        phaseStreak: 9,
        darkMatterDetections: 1,
      },
      insight: { score: expect.any(Number), label: expect.any(String), components: expect.any(Object) },
      resonance: { phaseChain: 9, label: expect.any(String) },
      bookmarkHint: expect.any(String),
    });
  });
});

describe('physics seed bookmarks', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
      clear: vi.fn(() => { values.clear(); }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads an empty list when storage is missing or malformed', () => {
    expect(loadSeedBookmarks()).toEqual([]);
    localStorage.setItem(PHYSICS_SEED_BOOKMARKS_KEY, '{not-json');
    expect(loadSeedBookmarks()).toEqual([]);
  });

  it('saves newest bookmarks first and replaces duplicate seeds', () => {
    saveSeedBookmark({ seed: 1, label: '000001', createdAt: 1, insightScore: 41, epochName: 'Inflationary', note: 'first note' });
    saveSeedBookmark({ seed: 2, label: '000002', createdAt: 2, insightScore: 80, epochName: 'Galactic', note: 'second note' });
    saveSeedBookmark({ seed: 1, label: '000001', createdAt: 3, insightScore: 95, epochName: 'Heat Death', note: 'replacement' });

    expect(loadSeedBookmarks()).toEqual([
      { seed: 1, label: '000001', createdAt: 3, insightScore: 95, epochName: 'Heat Death', note: 'replacement' },
      { seed: 2, label: '000002', createdAt: 2, insightScore: 80, epochName: 'Galactic', note: 'second note' },
    ]);
  });

  it('bounds bookmark history', () => {
    for (let i = 0; i < 14; i++) {
      saveSeedBookmark({ seed: i, label: String(i).padStart(6, '0'), createdAt: i, insightScore: i, epochName: 'Galactic', note: `seed ${i}` });
    }

    const bookmarks = loadSeedBookmarks();
    expect(bookmarks).toHaveLength(8);
    expect(bookmarks[0].seed).toBe(13);
    expect(bookmarks[7].seed).toBe(6);
  });
});
