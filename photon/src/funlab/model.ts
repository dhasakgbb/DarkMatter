import type { FunFingerprint, FunRunEvent, FunRunSummary, TuningRecommendation, VibeRating } from './types';

const MEANINGFUL_EVENTS = new Set<FunRunEvent['type']>([
  'gate-hit',
  'gate-miss',
  'speed-pad-hit',
  'gravity-sling',
  'hazard-near-miss',
  'hazard-hit',
  'phase-through',
  'damage',
  'pickup',
  'boost-start',
  'field-strain-peak',
  'recovery',
  'upgrade-options',
  'upgrade-selected',
]);

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function count(events: FunRunEvent[], type: FunRunEvent['type']) {
  return events.filter((e) => e.type === type).length;
}

function eventTime(event: FunRunEvent, startAt: number) {
  if (typeof event.t === 'number') return event.t;
  return Math.max(0, (event.at - startAt) / 1000);
}

function vibeScore(value: number | undefined) {
  if (value == null) return undefined;
  return clamp((value - 1) * 25);
}

export function summarizeRun(events: FunRunEvent[], fallbackRunId = `run-${Date.now()}`): FunRunSummary {
  const ordered = [...events].sort((a, b) => (a.t ?? a.at) - (b.t ?? b.at));
  const start = ordered.find((e) => e.type === 'run-start') || ordered[0];
  const end = [...ordered].reverse().find((e) => e.type === 'run-end' || e.type === 'death' || e.type === 'quit') || ordered[ordered.length - 1] || start;
  const startedAt = start?.at ?? Date.now();
  const endedAt = end?.at ?? startedAt;
  const durationSec = Math.max(0.1, eventTime(end || start, startedAt));
  const runId = start?.runId || fallbackRunId;
  const epochEvents = ordered.filter((e) => e.epochIndex != null);
  const lastEpoch = epochEvents[epochEvents.length - 1];
  const speedSamples = ordered.map((e) => e.speed).filter((n): n is number => typeof n === 'number');
  const avgSpeed = speedSamples.length ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length : 0;
  const speedVariance = speedSamples.length
    ? speedSamples.reduce((sum, sample) => sum + Math.pow(sample - avgSpeed, 2), 0) / speedSamples.length
    : 0;
  const gateHits = count(ordered, 'gate-hit');
  const gateMisses = count(ordered, 'gate-miss');
  const gateTotal = gateHits + gateMisses;
  const explicitDamageEvents = ordered.filter((e) => e.type === 'damage');
  const damageEvents = explicitDamageEvents.length ? explicitDamageEvents : ordered.filter((e) => e.type === 'hazard-hit');
  const damageTotal = damageEvents.reduce((sum, e) => sum + (e.damage || e.value || 0), 0);
  let clusteredDamageEvents = 0;
  for (let i = 1; i < damageEvents.length; i++) {
    if (eventTime(damageEvents[i], startedAt) - eventTime(damageEvents[i - 1], startedAt) <= 2.2) clusteredDamageEvents += 1;
  }
  const meaningfulEvents = ordered
    .filter((e) => MEANINGFUL_EVENTS.has(e.type))
    .map((e) => ({ type: e.type, time: eventTime(e, startedAt) }))
    .sort((a, b) => a.time - b.time);
  let boredomGapCount = 0;
  let longestBoredomGap = 0;
  for (let i = 1; i < meaningfulEvents.length; i++) {
    const prev = meaningfulEvents[i - 1];
    const current = meaningfulEvents[i];
    if (prev.type === 'upgrade-options' && current.type === 'upgrade-selected') continue;
    const gap = current.time - prev.time;
    longestBoredomGap = Math.max(longestBoredomGap, gap);
    if (gap >= 12) boredomGapCount += 1;
  }
  if (meaningfulEvents.length === 0 && durationSec >= 12) {
    boredomGapCount = 1;
    longestBoredomGap = durationSec;
  }
  const fieldStrainEvents = ordered.filter((e) => e.type === 'field-strain-peak' || e.type === 'field-strain-enter');
  const distance = Math.max(...ordered.map((e) => e.distance || 0), 0);
  const boostStarts = ordered.filter((e) => e.type === 'boost-start');
  const boostEnds = ordered.filter((e) => e.type === 'boost-end' || e.type === 'boost-depleted');
  let boostUptimeSec = 0;
  for (let i = 0; i < boostStarts.length; i++) {
    const startT = eventTime(boostStarts[i], startedAt);
    const endT = boostEnds.find((e) => eventTime(e, startedAt) >= startT);
    boostUptimeSec += Math.max(0, (endT ? eventTime(endT, startedAt) : durationSec) - startT);
  }
  const death = ordered.find((e) => e.type === 'death');
  const quit = ordered.some((e) => e.type === 'quit');

  return {
    runId,
    startedAt,
    endedAt,
    durationSec,
    epochReached: lastEpoch?.epochIndex ?? 0,
    epochName: lastEpoch?.epochName || 'Unknown',
    distance,
    avgSpeed,
    speedVariance,
    boostUptimeSec,
    gateHits,
    gateMisses,
    gateHitRate: gateTotal ? gateHits / gateTotal : 0,
    gateStreakPeak: Math.max(...ordered.map((e) => e.streak || 0), 0),
    lineBreaks: count(ordered, 'line-break') + count(ordered, 'speed-chain-break'),
    speedPads: count(ordered, 'speed-pad-hit'),
    speedChainBreaks: count(ordered, 'speed-chain-break'),
    gravitySlingshots: count(ordered, 'gravity-sling'),
    nearMisses: count(ordered, 'hazard-near-miss'),
    nearMissesPerMin: count(ordered, 'hazard-near-miss') / Math.max(1 / 60, durationSec / 60),
    hazardHits: count(ordered, 'hazard-hit'),
    phases: count(ordered, 'phase-through'),
    pickups: count(ordered, 'pickup'),
    damageEvents: damageEvents.length,
    damageTotal,
    clusteredDamageEvents,
    recoveryEvents: count(ordered, 'recovery'),
    boredomGapCount,
    longestBoredomGap,
    fieldStrainPeak: Math.max(...fieldStrainEvents.map((e) => e.strain || e.value || 0), 0),
    fieldStrainEvents: fieldStrainEvents.length,
    deathCause: death?.cause || '',
    quit,
    upgradeChoices: count(ordered, 'upgrade-selected'),
    eventCount: ordered.length,
  };
}

export function scoreRun(summary: FunRunSummary, vibe?: VibeRating): FunFingerprint {
  const vibeFun = vibeScore(vibe?.fun);
  const vibeFlow = vibeScore(vibe?.flow);
  const vibeFrustration = vibeScore(vibe?.frustration);
  const vibeOneMore = vibeScore(vibe?.oneMoreRun);

  const dopamineBase =
    clamp(summary.nearMissesPerMin * 8, 0, 30) +
    clamp(summary.speedPads * 9, 0, 24) +
    clamp(summary.gravitySlingshots * 10, 0, 22) +
    clamp(summary.gateStreakPeak * 5, 0, 24) +
    clamp(summary.phases * 4, 0, 16) +
    clamp(summary.recoveryEvents * 7, 0, 14);
  const dopamine = clamp(vibeFun == null ? dopamineBase : dopamineBase * 0.72 + vibeFun * 0.28);

  const flowBase =
    28 +
    summary.gateHitRate * 28 +
    clamp(summary.gateStreakPeak * 4, 0, 18) +
    clamp(summary.recoveryEvents * 5, 0, 12) -
    clamp(summary.lineBreaks * 6, 0, 22) -
    clamp(summary.clusteredDamageEvents * 10, 0, 28) -
    clamp(summary.boredomGapCount * 8, 0, 18);
  const flow = clamp(vibeFlow == null ? flowBase : flowBase * 0.68 + vibeFlow * 0.32);

  const oneMoreBase =
    18 +
    clamp(summary.durationSec / 1.5, 0, 24) +
    clamp(summary.epochReached * 6, 0, 24) +
    clamp(summary.upgradeChoices * 8, 0, 18) +
    clamp(summary.gateStreakPeak * 2.5, 0, 14) -
    (summary.quit ? 22 : 0);
  const oneMoreRun = clamp(vibeOneMore == null ? oneMoreBase : oneMoreBase * 0.55 + vibeOneMore * 0.45);

  const frustrationBase =
    clamp(summary.damageEvents * 10, 0, 30) +
    clamp(summary.clusteredDamageEvents * 14, 0, 32) +
    clamp(summary.fieldStrainEvents * 4, 0, 16) +
    (summary.durationSec < 18 && summary.deathCause ? 18 : 0) +
    (summary.quit ? 20 : 0);
  const frustration = clamp(vibeFrustration == null ? frustrationBase : frustrationBase * 0.58 + vibeFrustration * 0.42);

  const readability = clamp(
    88 -
    clamp(summary.gateMisses * 8, 0, 30) -
    clamp(summary.lineBreaks * 5, 0, 18) -
    clamp(summary.fieldStrainPeak * 22, 0, 22) -
    clamp(summary.clusteredDamageEvents * 9, 0, 22) -
    clamp(summary.boredomGapCount * 7, 0, 14),
  );

  const funIndex = clamp(
    dopamine * 0.34 +
    flow * 0.30 +
    oneMoreRun * 0.24 +
    readability * 0.16 -
    frustration * 0.28,
  );
  const uncertainty: string[] = [];
  const telemetryFun = clamp(dopamine * 0.38 + flow * 0.32 + oneMoreRun * 0.30 - frustration * 0.22);
  if (!vibe || vibe.skipped) uncertainty.push('No vibe rating attached; trust is telemetry-only.');
  if (vibeFun != null && Math.abs(vibeFun - telemetryFun) > 42) uncertainty.push('Player fun rating disagrees with telemetry.');
  if (vibeFlow != null && Math.abs(vibeFlow - flow) > 42) uncertainty.push('Player flow rating disagrees with route/control telemetry.');
  if (summary.eventCount < 8) uncertainty.push('Run has too few events for strong confidence.');

  let trust = 30 + clamp(summary.eventCount * 2, 0, 26) + clamp(summary.durationSec / 2, 0, 18);
  if (vibe && !vibe.skipped) trust += 18;
  if (vibe && !vibe.skipped && uncertainty.length === 0) trust += 8;
  trust -= uncertainty.length * 12;
  if (summary.quit) trust -= 6;

  return {
    dopamine: Math.round(dopamine),
    flow: Math.round(flow),
    oneMoreRun: Math.round(oneMoreRun),
    frustration: Math.round(frustration),
    readability: Math.round(readability),
    funIndex: Math.round(funIndex),
    trust: Math.round(clamp(trust)),
    uncertainty,
  };
}

function confidenceFor(fingerprint: FunFingerprint): 'low' | 'medium' | 'high' {
  if (fingerprint.trust >= 72 && fingerprint.uncertainty.length === 0) return 'high';
  if (fingerprint.trust >= 48) return 'medium';
  return 'low';
}

export function recommend(summary: FunRunSummary, fingerprint: FunFingerprint): TuningRecommendation[] {
  const confidence = confidenceFor(fingerprint);
  const recs: TuningRecommendation[] = [];
  const add = (rec: TuningRecommendation) => recs.push(rec);

  if (summary.quit) {
    add({
      id: 'manual-quit-context',
      finding: 'The player ended this run manually.',
      evidence: [`Stopped in ${summary.epochName}`, `Fun Index ${fingerprint.funIndex}/100`, `Trust ${fingerprint.trust}/100`],
      suggestion: 'Use this run for route readability and reward feel, but avoid making difficulty harder from this sample alone.',
      confidence,
      risk: 'low',
      axes: ['oneMoreRun', 'frustration'],
    });
  }
  if (fingerprint.readability < 52 || (summary.gateMisses >= 3 && summary.gateHitRate < 0.55) || summary.lineBreaks >= 2) {
    add({
      id: 'route-readability',
      finding: `${summary.epochName} is hard to read.`,
      evidence: [`Readability ${fingerprint.readability}/100`, `${summary.gateMisses} gate misses`, `${summary.lineBreaks} line breaks`],
      suggestion: 'Brighten next-route cues, widen gate affordance slightly, or reduce competing visual clutter in this epoch.',
      confidence,
      risk: 'low',
      axes: ['readability', 'flow'],
    });
  }
  if (summary.clusteredDamageEvents >= 2 || fingerprint.frustration >= 68) {
    add({
      id: 'cheap-damage',
      finding: 'Damage is clustering into frustration.',
      evidence: [`${summary.damageEvents} damage events`, `${summary.clusteredDamageEvents} clustered follow-up hits`, `Frustration ${fingerprint.frustration}/100`],
      suggestion: 'Increase post-hit recovery spacing or invulnerability clarity before adding more hazards.',
      confidence,
      risk: 'low',
      axes: ['frustration', 'flow'],
    });
  }
  if (summary.boredomGapCount > 0 || (fingerprint.dopamine < 42 && summary.speedPads < 2)) {
    add({
      id: 'boredom-gap',
      finding: 'The run has low excitement density.',
      evidence: [`${summary.boredomGapCount} boredom gaps`, `Longest quiet gap ${summary.longestBoredomGap.toFixed(1)}s`, `${summary.speedPads} speed pads`, `${summary.gravitySlingshots} gravity slings`],
      suggestion: 'Add a speed pad, gravity sling, gate, or readable hazard beat before the longest quiet gap.',
      confidence,
      risk: 'medium',
      axes: ['dopamine', 'oneMoreRun'],
    });
  }
  if (fingerprint.dopamine >= 70 && fingerprint.frustration >= 58) {
    add({
      id: 'exciting-but-unstable',
      finding: 'This run is exciting but unstable.',
      evidence: [`Dopamine ${fingerprint.dopamine}/100`, `Frustration ${fingerprint.frustration}/100`, `${summary.nearMisses} near misses`],
      suggestion: 'Keep the speed and near misses, but add clearer recovery cues after hazards.',
      confidence,
      risk: 'medium',
      axes: ['dopamine', 'frustration', 'flow'],
    });
  }
  if (fingerprint.flow >= 76 && fingerprint.frustration <= 24 && fingerprint.dopamine < 48) {
    add({
      id: 'too-clean',
      finding: 'The run is clean but under-stimulating.',
      evidence: [`Flow ${fingerprint.flow}/100`, `Frustration ${fingerprint.frustration}/100`, `Dopamine ${fingerprint.dopamine}/100`],
      suggestion: 'Increase challenge with one extra optional gate/pad chain rather than raw hazard density.',
      confidence,
      risk: 'medium',
      axes: ['dopamine', 'flow'],
    });
  }

  if (recs.length === 0) {
    add({
      id: 'no-strong-change',
      finding: 'No strong tuning change is justified yet.',
      evidence: [`Fun Index ${fingerprint.funIndex}/100`, `Trust ${fingerprint.trust}/100`],
      suggestion: 'Collect more rated runs before changing core pacing.',
      confidence: 'low',
      risk: 'low',
      axes: ['dopamine', 'flow', 'oneMoreRun', 'readability'],
    });
  }

  return recs;
}

export function analyzeRun(events: FunRunEvent[], vibe?: VibeRating, fallbackRunId?: string) {
  const summary = summarizeRun(events, fallbackRunId);
  const fingerprint = scoreRun(summary, vibe);
  const recommendations = recommend(summary, fingerprint);
  return { summary, fingerprint, recommendations };
}
