import type {
  DopamineEngineReport,
  DopamineEngineState,
  DopamineMissingBeat,
  DopaminePlanStep,
  DopamineTuningDelta,
  DopamineTuningKnob,
  FunFingerprint,
  FunRunSummary,
  GameDesignPrinciple,
  RecommendationConfidence,
  RecommendationRisk,
} from './types';

const TARGET_MIN_DOPAMINE = 48;
const TARGET_MAX_DOPAMINE = 78;
const TARGET_MIN_FLOW = 54;
const TARGET_MAX_FRUSTRATION = 54;
const TARGET_MIN_READABILITY = 58;
const MIN_REWARD_CADENCE_SEC = 3.5;
const MAX_REWARD_CADENCE_SEC = 10.5;
const MAX_DELTA = 0.18;

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function boundedAmount(value: number) {
  return Math.round(Math.min(MAX_DELTA, Math.max(0.04, value)) * 100) / 100;
}

function confidenceFor(fingerprint: FunFingerprint): RecommendationConfidence {
  if (fingerprint.trust >= 72 && fingerprint.uncertainty.length === 0) return 'high';
  if (fingerprint.trust >= 48) return 'medium';
  return 'low';
}

function addDelta(
  tuning: DopamineTuningDelta[],
  knob: DopamineTuningKnob,
  direction: DopamineTuningDelta['direction'],
  amount: number,
  confidence: RecommendationConfidence,
  risk: RecommendationRisk,
  reason: string,
) {
  tuning.push({ knob, direction, amount: direction === 'hold' ? 0 : boundedAmount(amount), confidence, risk, reason });
}

function rewardEvents(summary: FunRunSummary) {
  return summary.gateHits + summary.speedPads + summary.gravitySlingshots + summary.nearMisses + summary.phases + summary.pickups + summary.recoveryEvents;
}

function rewardCadenceSec(summary: FunRunSummary) {
  const events = rewardEvents(summary);
  if (events <= 0) return Math.round(summary.durationSec * 10) / 10;
  return Math.round((summary.durationSec / events) * 10) / 10;
}

function classify(summary: FunRunSummary, fingerprint: FunFingerprint, cadence: number): DopamineEngineState {
  if (fingerprint.trust < 38) return 'low-confidence';
  if (fingerprint.readability < 50 || (summary.gateMisses >= 3 && summary.gateHitRate < 0.5)) return 'confusing';
  if (fingerprint.frustration >= 70 || summary.clusteredDamageEvents >= 2) return 'punishing';
  if (fingerprint.dopamine >= 70 && fingerprint.frustration >= 56) return 'overheated';
  if (fingerprint.dopamine < TARGET_MIN_DOPAMINE || cadence > MAX_REWARD_CADENCE_SEC || summary.boredomGapCount > 0) return 'underfed';
  if (
    fingerprint.flow >= TARGET_MIN_FLOW &&
    fingerprint.dopamine <= TARGET_MAX_DOPAMINE &&
    fingerprint.frustration <= TARGET_MAX_FRUSTRATION &&
    fingerprint.readability >= TARGET_MIN_READABILITY
  ) return 'sweet-spot';
  return fingerprint.frustration > TARGET_MAX_FRUSTRATION ? 'overheated' : 'underfed';
}

function fmt(value: number, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0';
}

function addMissing(
  beats: DopamineMissingBeat[],
  beat: string,
  principle: GameDesignPrinciple,
  evidence: string,
  suggestion: string,
) {
  beats.push({ beat, principle, evidence, suggestion });
}

function buildMissingBeats(summary: FunRunSummary, fingerprint: FunFingerprint, cadence: number, state: DopamineEngineState) {
  const beats: DopamineMissingBeat[] = [];

  if (cadence > MAX_REWARD_CADENCE_SEC || summary.boredomGapCount > 0 || fingerprint.dopamine < TARGET_MIN_DOPAMINE) {
    addMissing(
      beats,
      'Reward anticipation/payoff loop',
      'anticipation-payoff',
      'Reward cadence ' + fmt(cadence, 1) + 's, boredom gaps ' + summary.boredomGapCount + ', dopamine ' + fingerprint.dopamine + '/100.',
      'Place an optional visible reward beat before the longest quiet gap, then pay it off with a speed pad, gate chain, or gravity sling.',
    );
  }

  if (fingerprint.readability < TARGET_MIN_READABILITY || summary.gateMisses >= 3 || summary.lineBreaks >= 2) {
    addMissing(
      beats,
      'Readable challenge contract',
      'readable-challenge',
      'Readability ' + fingerprint.readability + '/100, gate misses ' + summary.gateMisses + ', line breaks ' + summary.lineBreaks + '.',
      'Make the next demanded action legible before increasing speed, density, or route pressure.',
    );
  }

  if (summary.clusteredDamageEvents > 0 || fingerprint.frustration > TARGET_MAX_FRUSTRATION || summary.fieldStrainPeak > 0.72) {
    addMissing(
      beats,
      'Recovery window after spike',
      'recovery-windows',
      'Frustration ' + fingerprint.frustration + '/100, clustered damage ' + summary.clusteredDamageEvents + ', peak field strain ' + fmt(summary.fieldStrainPeak, 2) + '.',
      'Add a breath beat after damage or edge strain so the player can re-center before the next threat.',
    );
  }

  if (summary.gateHits > 0 && summary.gateStreakPeak < 3 && summary.lineBreaks > 0) {
    addMissing(
      beats,
      'Mastery streak continuity',
      'mastery-feedback',
      'Gate hits ' + summary.gateHits + ', peak streak ' + summary.gateStreakPeak + ', line breaks ' + summary.lineBreaks + '.',
      'Clarify partial success and near-streak progress so players know what to fix on the next run.',
    );
  }

  if (summary.nearMisses === 0 && summary.speedPads <= 1 && state === 'underfed') {
    addMissing(
      beats,
      'Optional risk/reward invitation',
      'risk-reward',
      'Near misses ' + summary.nearMisses + ', speed pads ' + summary.speedPads + ', reward events/min ' + fmt(rewardEvents(summary) / Math.max(1 / 60, summary.durationSec / 60), 1) + '.',
      'Offer a clearly telegraphed risky lane with a stronger reward, without making it mandatory for survival.',
    );
  }

  if (summary.quit) {
    addMissing(
      beats,
      'Quit intent context',
      'perceived-fairness',
      'Manual quit in ' + summary.epochName + ' with one-more-run ' + fingerprint.oneMoreRun + '/100.',
      'Treat this trace as qualitative context; avoid increasing difficulty until the quit reason is clear.',
    );
  }

  if (fingerprint.trust < 48) {
    addMissing(
      beats,
      'Evidence depth',
      'flow-channel',
      'Trust ' + fingerprint.trust + '/100; uncertainty: ' + (fingerprint.uncertainty.join(' ') || 'none') + '.',
      'Collect more internal traces or a designer note before shipping a tuning change.',
    );
  }

  return beats;
}

function statePrinciples(state: DopamineEngineState): GameDesignPrinciple[] {
  if (state === 'low-confidence') return ['flow-channel', 'perceived-fairness'];
  if (state === 'underfed') return ['anticipation-payoff', 'variable-reward-cadence', 'optional-challenge'];
  if (state === 'confusing') return ['readable-challenge', 'perceived-fairness', 'mastery-feedback'];
  if (state === 'punishing') return ['recovery-windows', 'perceived-fairness', 'flow-channel'];
  if (state === 'overheated') return ['risk-reward', 'recovery-windows', 'readable-challenge'];
  return ['flow-channel', 'mastery-feedback', 'risk-reward'];
}

function evidencePack(summary: FunRunSummary, fingerprint: FunFingerprint, cadence: number) {
  return [
    'State metrics: dopamine ' + fingerprint.dopamine + ', flow ' + fingerprint.flow + ', frustration ' + fingerprint.frustration + ', readability ' + fingerprint.readability + '.',
    'Reward cadence ' + fmt(cadence, 1) + 's, reward events ' + rewardEvents(summary) + ', boredom gaps ' + summary.boredomGapCount + '.',
    'Damage ' + summary.damageEvents + ', clustered damage ' + summary.clusteredDamageEvents + ', gate hit rate ' + fmt(summary.gateHitRate * 100, 0) + '%.',
  ];
}

function step(
  plan: DopaminePlanStep[],
  priority: DopaminePlanStep['priority'],
  title: string,
  principle: GameDesignPrinciple,
  diagnosis: string,
  action: string,
  expectedEffect: string,
  risk: RecommendationRisk,
  evidence: string[],
) {
  plan.push({ priority, title, principle, diagnosis, action, expectedEffect, risk, evidence });
}

function buildPlan(summary: FunRunSummary, fingerprint: FunFingerprint, cadence: number, state: DopamineEngineState, missingBeats: DopamineMissingBeat[]) {
  const plan: DopaminePlanStep[] = [];
  const evidence = evidencePack(summary, fingerprint, cadence);
  const missingNames = missingBeats.map((beat) => beat.beat).join(', ') || 'none';

  if (state === 'low-confidence') {
    step(
      plan,
      'now',
      'Collect a stronger internal sample',
      'flow-channel',
      'The run does not have enough trustworthy signal to justify tuning the shipped loop.',
      'Run seeded desktop and mobile traces for the same epoch, then attach an internal designer note if the telemetry and observed feel disagree.',
      'Prevents overfitting to a noisy death, quit, or short run.',
      'low',
      evidence,
    );
    return plan;
  }

  if (state === 'underfed') {
    step(
      plan,
      'now',
      'Shorten the reward drought',
      'anticipation-payoff',
      'The loop is not creating enough anticipation/payoff pressure; missing beats: ' + missingNames + '.',
      'Place one optional gate-to-pad or gravity-sling sequence before the longest quiet gap, visible from far enough away to choose it deliberately.',
      'Raises dopamine and one-more-run pull without forcing survival difficulty upward.',
      'medium',
      evidence,
    );
    step(
      plan,
      'next',
      'Turn clean control into visible mastery',
      'mastery-feedback',
      'Low punishment can still feel flat if the player cannot feel improvement compounding.',
      'Add a stronger streak celebration for two or three clean route beats: audio accent, line brightness, and a modest speed-pad payoff.',
      'Creates a skill loop players want to repeat because competence is legible.',
      'low',
      ['Peak gate streak ' + summary.gateStreakPeak + ', flow ' + fingerprint.flow + '/100.'],
    );
    step(
      plan,
      'later',
      'Rotate novelty by epoch, not by new verbs',
      'novelty-rotation',
      'The core verbs are locked, so novelty should come from arrangements and sensory payoff.',
      'For the next epoch pass, vary reward rhythm by route shape, hazard silhouette, and audio response rather than adding a new action.',
      'Keeps the run fresh while protecting the canonical control surface.',
      'low',
      ['Epoch reached ' + summary.epochReached + ', novelty proxy ' + summary.upgradeChoices + ' upgrades and ' + summary.gravitySlingshots + ' gravity slings.'],
    );
  } else if (state === 'confusing') {
    step(
      plan,
      'now',
      'Rebuild the readable challenge contract',
      'readable-challenge',
      'The player is being asked to perform before the next action reads cleanly.',
      'Brighten route cues, reduce competing particles near gates, and increase lead time on the next actionable target before touching difficulty.',
      'Restores perceived fairness and lets misses become learning instead of noise.',
      'low',
      evidence,
    );
    step(
      plan,
      'next',
      'Retune density only after clarity improves',
      'perceived-fairness',
      'If density changes first, the lab cannot tell whether success came from easier play or better information.',
      'Run an A/B seed with identical hazard timing and only cue/readability changes; then compare gate hit rate and line breaks.',
      'Separates visual UX debt from true difficulty.',
      'low',
      ['Gate misses ' + summary.gateMisses + ', line breaks ' + summary.lineBreaks + ', readability ' + fingerprint.readability + '/100.'],
    );
  } else if (state === 'punishing') {
    step(
      plan,
      'now',
      'Insert recovery valleys after spikes',
      'recovery-windows',
      'Damage is clustering, which converts tension into perceived cheapness.',
      'After damage, high field strain, or a missed gate, widen spacing and surface the safest lane for one short beat before reintroducing pressure.',
      'Keeps danger meaningful while restoring player agency.',
      'low',
      evidence,
    );
    step(
      plan,
      'next',
      'Make blame legible',
      'perceived-fairness',
      'Hard games stay sticky when the player can explain the failure in one sentence.',
      'Audit death/retry moments for visible cause, last avoidable decision, and immediate next-run correction cue.',
      'Raises retry intent by turning failure into a plan.',
      'medium',
      ['Death cause ' + (summary.deathCause || 'none') + ', frustration ' + fingerprint.frustration + '/100.'],
    );
  } else if (state === 'overheated') {
    step(
      plan,
      'now',
      'Separate thrill peaks with readable exits',
      'risk-reward',
      'The run is exciting, but pressure and reward are stacked tightly enough to threaten control clarity.',
      'Keep near-miss and speed beats, but add a recovery lane or cue pulse between hazard clusters and route payoffs.',
      'Preserves adrenaline while reducing rage exits.',
      'medium',
      evidence,
    );
    step(
      plan,
      'next',
      'Check the high-speed visual budget',
      'readable-challenge',
      'High dopamine can mask readability debt until mobile or reduced-motion play breaks down.',
      'Smoke test the same seed on mobile, reduced motion, and high contrast, then compare missed gates around speed-pad chains.',
      'Protects the peak experience across input and accessibility modes.',
      'low',
      ['Speed pads ' + summary.speedPads + ', near misses ' + summary.nearMisses + ', readability ' + fingerprint.readability + '/100.'],
    );
  } else {
    step(
      plan,
      'now',
      'Preserve the current flow channel',
      'flow-channel',
      'Reward, pressure, readability, and frustration are inside the target band.',
      'Freeze core density for this epoch profile and use this seed as a regression reference when adding assets or route variants.',
      'Prevents accidental drift away from a good-feeling loop.',
      'low',
      evidence,
    );
    step(
      plan,
      'next',
      'Add optional novelty at the edge of mastery',
      'optional-challenge',
      'Sweet spots become sticky when expert players can self-select slightly harder lines.',
      'Add a small optional route branch or riskier speed-pad angle that improves score feel but is never required to survive.',
      'Adds depth without disrupting the average player path.',
      'medium',
      ['Gate hit rate ' + fmt(summary.gateHitRate * 100, 0) + '%, peak streak ' + summary.gateStreakPeak + '.'],
    );
  }

  return plan;
}

export function evaluateDopamineEngine(summary: FunRunSummary, fingerprint: FunFingerprint): DopamineEngineReport {
  const confidence = confidenceFor(fingerprint);
  const cadence = rewardCadenceSec(summary);
  const rewards = rewardEvents(summary);
  const rewardEventsPerMin = Math.round((rewards / Math.max(1 / 60, summary.durationSec / 60)) * 10) / 10;
  const pressure = clamp(
    summary.nearMissesPerMin * 8 +
    summary.hazardHits * 8 +
    summary.damageEvents * 7 +
    summary.gateMisses * 5 +
    summary.fieldStrainEvents * 4 +
    summary.epochReached * 2,
  );
  const mastery = clamp(
    summary.gateHitRate * 34 +
    summary.gateStreakPeak * 5 +
    fingerprint.flow * 0.34 +
    summary.recoveryEvents * 5 -
    summary.lineBreaks * 6,
  );
  const safety = clamp(
    100 -
    fingerprint.frustration * 0.62 -
    summary.clusteredDamageEvents * 15 -
    summary.fieldStrainPeak * 18 -
    (summary.durationSec < 18 && summary.deathCause ? 12 : 0),
  );
  const novelty = clamp(
    summary.upgradeChoices * 14 +
    summary.epochReached * 7 +
    summary.gravitySlingshots * 9 +
    summary.phases * 3 +
    Math.sqrt(Math.max(0, summary.speedVariance)) * 0.08,
  );
  const state = classify(summary, fingerprint, cadence);
  const missingBeats = buildMissingBeats(summary, fingerprint, cadence, state);
  const plan = buildPlan(summary, fingerprint, cadence, state, missingBeats);
  const theoryTags = Array.from(new Set([...statePrinciples(state), ...missingBeats.map((beat) => beat.principle), ...plan.map((item) => item.principle)]));
  const tuning: DopamineTuningDelta[] = [];
  const guardrails = [
    'Apply between runs only.',
    'Never change Heat Death density upward.',
    'Prefer optional rewards before raw hazard density.',
    'Designer review required before turning a plan step into shipped tuning.',
  ];

  if (state === 'low-confidence') {
    addDelta(tuning, 'difficultyRamp', 'hold', 0, 'low', 'low', 'Collect more telemetry or an internal design note before tuning core difficulty.');
    guardrails.push('Do not auto-promote a low-trust run into tuning changes.');
  } else if (state === 'underfed') {
    addDelta(tuning, 'speedPadDensity', 'increase', cadence > MAX_REWARD_CADENCE_SEC ? 0.14 : 0.09, confidence, 'medium', 'Reward cadence is too sparse for steady one-more-run pull.');
    addDelta(tuning, 'gateDensity', 'increase', summary.gateHitRate >= 0.58 ? 0.08 : 0.05, confidence, 'medium', 'Add optional mastery beats before increasing punishment.');
    if (fingerprint.readability >= 68 && fingerprint.frustration <= 32) {
      addDelta(tuning, 'difficultyRamp', 'increase', 0.05, confidence, 'medium', 'The run has room for a little more pressure without breaking flow.');
    }
  } else if (state === 'confusing') {
    addDelta(tuning, 'routeCueBrightness', 'increase', 0.16, confidence, 'low', 'Route or hazard readability is suppressing mastery.');
    addDelta(tuning, 'visualClutter', 'decrease', 0.12, confidence, 'low', 'Lower competing signal before changing difficulty.');
    addDelta(tuning, 'gateDensity', 'decrease', 0.06, confidence, 'medium', 'Reduce route decision pressure until cues are legible.');
  } else if (state === 'punishing') {
    addDelta(tuning, 'recoverySpacing', 'increase', 0.18, confidence, 'low', 'Clustered damage needs more recovery room.');
    addDelta(tuning, 'hazardDensity', 'decrease', 0.14, confidence, 'medium', 'Punishment is dominating reward learning.');
    addDelta(tuning, 'difficultyRamp', 'decrease', 0.1, confidence, 'medium', 'Back off ramp pressure after cheap early failure.');
  } else if (state === 'overheated') {
    addDelta(tuning, 'recoverySpacing', 'increase', 0.12, confidence, 'low', 'Keep the thrill but separate danger beats.');
    addDelta(tuning, 'routeCueBrightness', 'increase', 0.08, confidence, 'low', 'Make high-speed recovery choices easier to parse.');
    addDelta(tuning, 'hazardDensity', 'decrease', 0.06, confidence, 'medium', 'Trim pressure slightly without flattening dopamine.');
  } else {
    addDelta(tuning, 'speedPadDensity', 'hold', 0, confidence, 'low', 'Reward cadence is inside the target band.');
    addDelta(tuning, 'hazardDensity', 'hold', 0, confidence, 'low', 'Pressure is readable enough to preserve.');
  }

  if (cadence < MIN_REWARD_CADENCE_SEC && fingerprint.frustration > 45) {
    guardrails.push('Do not add more rewards until clustered pressure is reduced; cadence is already dense.');
  }
  if (summary.quit) guardrails.push('Manual quits should not increase difficulty without confirming internal context.');

  const score = clamp(
    fingerprint.dopamine * 0.24 +
    fingerprint.flow * 0.24 +
    fingerprint.oneMoreRun * 0.18 +
    mastery * 0.14 +
    safety * 0.12 +
    novelty * 0.08 -
    Math.max(0, fingerprint.frustration - 48) * 0.22,
  );

  return {
    state,
    score: Math.round(score),
    rewardCadenceSec: cadence,
    rewardEventsPerMin,
    pressure: Math.round(pressure),
    mastery: Math.round(mastery),
    safety: Math.round(safety),
    novelty: Math.round(novelty),
    theoryTags,
    missingBeats,
    plan,
    tuning,
    guardrails,
  };
}
