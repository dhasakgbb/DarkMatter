import { analyzeRun } from './model';
import type { FunRunRecord, VibeRating } from './types';
import { readJsonStorage, readStorage, removeStorage, writeStorage } from '../storage';

const HISTORY_KEY = 'photon-funlab-v1';
const SKIP_KEY = 'photon-funlab-skip-v1';
const MAX_RUNS = 40;

export function loadFunHistory(): FunRunRecord[] {
  const parsed = readJsonStorage<FunRunRecord[]>(HISTORY_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveFunHistory(records: FunRunRecord[]) {
  writeStorage(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_RUNS)));
}

export function saveRunRecord(record: FunRunRecord) {
  const rest = loadFunHistory().filter((r) => r.id !== record.id);
  saveFunHistory([record, ...rest]);
}

export function updateRunVibe(runId: string, vibe: VibeRating): FunRunRecord | null {
  const history = loadFunHistory();
  const index = history.findIndex((r) => r.id === runId);
  if (index < 0) return null;
  const existing = history[index];
  const analysis = analyzeRun(existing.events, vibe, runId);
  const updated: FunRunRecord = {
    ...existing,
    vibe,
    summary: analysis.summary,
    fingerprint: analysis.fingerprint,
    recommendations: analysis.recommendations,
    dopamineEngine: analysis.dopamineEngine,
  };
  history[index] = updated;
  saveFunHistory(history);
  return updated;
}

export function clearFunHistory() {
  removeStorage(HISTORY_KEY);
}

export function exportFunHistoryJSON() {
  return JSON.stringify(loadFunHistory(), null, 2);
}

export function loadSkipCount() {
  return Number(readStorage(SKIP_KEY) || '0') || 0;
}

export function noteVibeSkipped() {
  writeStorage(SKIP_KEY, String(loadSkipCount() + 1));
}

export function noteVibeAnswered() {
  writeStorage(SKIP_KEY, '0');
}
