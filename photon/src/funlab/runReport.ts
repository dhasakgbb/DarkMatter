import type { FunRunRecord } from './types';

export interface RunFeelRow {
  label: string;
  value: string;
}

const STATE_LABELS: Record<string, string> = {
  'low-confidence': 'Needs signal',
  underfed: 'Underfed',
  'sweet-spot': 'Sweet spot',
  overheated: 'Overheated',
  confusing: 'Confusing',
  punishing: 'Punishing',
};

export function runFeelStateLabel(record: FunRunRecord | null | undefined) {
  if (!record) return 'No signal';
  return STATE_LABELS[record.dopamineEngine.state] || record.dopamineEngine.state;
}

export function runFeelRows(record: FunRunRecord | null | undefined): RunFeelRow[] {
  if (!record) return [];
  const engine = record.dopamineEngine;
  const fingerprint = record.fingerprint;
  return [
    { label: 'Feel state', value: runFeelStateLabel(record) },
    { label: 'Fun index', value: String(fingerprint.funIndex) },
    { label: 'Dopamine', value: String(fingerprint.dopamine) },
    { label: 'Flow', value: String(fingerprint.flow) },
    { label: 'Reward cadence', value: engine.rewardCadenceSec.toFixed(1) + ' s' },
    { label: 'Readability', value: String(fingerprint.readability) },
  ];
}

export function runFeelNudge(record: FunRunRecord | null | undefined) {
  const step = record?.dopamineEngine.plan.find((item) => item.priority === 'now') || record?.dopamineEngine.plan[0];
  if (!step) return 'Collect a longer run so the universe has enough signal to answer.';
  return step.action;
}

export function runFeelExport(record: FunRunRecord | null | undefined) {
  if (!record) return null;
  return {
    state: record.dopamineEngine.state,
    stateLabel: runFeelStateLabel(record),
    score: record.dopamineEngine.score,
    rewardCadenceSec: record.dopamineEngine.rewardCadenceSec,
    rewardEventsPerMin: record.dopamineEngine.rewardEventsPerMin,
    pressure: record.dopamineEngine.pressure,
    mastery: record.dopamineEngine.mastery,
    safety: record.dopamineEngine.safety,
    novelty: record.dopamineEngine.novelty,
    dopamine: record.fingerprint.dopamine,
    flow: record.fingerprint.flow,
    oneMoreRun: record.fingerprint.oneMoreRun,
    frustration: record.fingerprint.frustration,
    readability: record.fingerprint.readability,
    funIndex: record.fingerprint.funIndex,
    trust: record.fingerprint.trust,
    uncertainty: record.fingerprint.uncertainty,
    nextNudge: runFeelNudge(record),
    tuning: record.dopamineEngine.tuning,
    guardrails: record.dopamineEngine.guardrails,
  };
}
