import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderFunLabDashboard, renderVibePrompt } from './ui';
import type { FunRunRecord } from './types';

const HISTORY_KEY = 'photon-funlab-v1';

function fakeElement() {
  return {
    innerHTML: '',
    dataset: {} as Record<string, string>,
    value: '',
    classList: { toggle: vi.fn() },
    addEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
  };
}

function hostileRecord(): FunRunRecord {
  return {
    id: 'run-1"><img src=x onerror=1>',
    createdAt: Date.now(),
    events: [
      {
        type: 'damage',
        at: 1000,
        t: 1,
        runId: 'run-1',
        cause: '<img src=x onerror=alert(1)>',
      },
      {
        type: 'run-end',
        at: 2000,
        t: 2,
        runId: 'run-1',
        epochName: '<script>alert(2)</script>',
      },
    ],
    summary: {
      runId: 'run-1',
      startedAt: 0,
      endedAt: 2000,
      durationSec: 2,
      epochReached: 8,
      epochName: '<img src=x onerror=alert(3)>',
      distance: 1200,
      avgSpeed: 600,
      speedVariance: 0,
      boostUptimeSec: 0,
      gateHits: 0,
      gateMisses: 0,
      gateHitRate: 0,
      gateStreakPeak: 0,
      lineBreaks: 0,
      speedPads: 0,
      speedChainBreaks: 0,
      gravitySlingshots: 0,
      nearMisses: 0,
      nearMissesPerMin: 0,
      hazardHits: 0,
      phases: 0,
      pickups: 0,
      damageEvents: 1,
      damageTotal: 5,
      clusteredDamageEvents: 0,
      recoveryEvents: 0,
      boredomGapCount: 0,
      longestBoredomGap: 0,
      fieldStrainPeak: 0,
      fieldStrainEvents: 0,
      deathCause: '',
      quit: false,
      upgradeChoices: 0,
      eventCount: 2,
    },
    vibe: {
      fun: 5,
      flow: 4,
      frustration: 1,
      oneMoreRun: 5,
      note: '<script>alert(4)</script>',
      at: Date.now(),
    },
    fingerprint: {
      dopamine: 90,
      flow: 80,
      oneMoreRun: 85,
      frustration: 10,
      readability: 75,
      funIndex: '<img src=x onerror=alert(9)>' as unknown as number,
      trust: '<script>alert(10)</script>' as unknown as number,
      uncertainty: ['<img src=x onerror=alert(5)>'],
    },
    recommendations: [
      {
        id: 'hostile',
        finding: '<script>alert(6)</script>',
        evidence: ['<img src=x onerror=alert(7)>'],
        suggestion: '<script>alert(8)</script>',
        confidence: 'high',
        risk: 'low',
        axes: ['dopamine'],
      },
    ],
  };
}

function installDom(records: FunRunRecord[]) {
  const elements: Record<string, ReturnType<typeof fakeElement>> = {
    'funlab-run-list': fakeElement(),
    'funlab-detail': fakeElement(),
    'vibe-panel': fakeElement(),
    'vibe-summary': fakeElement(),
    'vibe-note': fakeElement(),
    'vibe-fun': fakeElement(),
    'vibe-flow': fakeElement(),
    'vibe-frustration': fakeElement(),
    'vibe-oneMoreRun': fakeElement(),
  };

  vi.stubGlobal('document', {
    getElementById: vi.fn((id: string) => elements[id] || null),
  });
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === HISTORY_KEY ? JSON.stringify(records) : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  return elements;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fun Lab UI rendering', () => {
  it('escapes stored run strings before rendering the dashboard', () => {
    const elements = installDom([hostileRecord()]);

    renderFunLabDashboard();

    const html = `${elements['funlab-run-list'].innerHTML}${elements['funlab-detail'].innerHTML}`;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('tracks vibe return state and escapes prompt summary text', () => {
    const elements = installDom([hostileRecord()]);

    renderVibePrompt('run-1"><img src=x onerror=1>', 'title');

    expect(elements['vibe-panel'].dataset.runId).toBe('run-1"><img src=x onerror=1>');
    expect(elements['vibe-panel'].dataset.returnState).toBe('title');
    expect(elements['vibe-summary'].innerHTML).not.toContain('<img');
    expect(elements['vibe-summary'].innerHTML).toContain('&lt;img');
  });
});
