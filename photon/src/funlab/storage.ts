import { analyzeRun } from './model';
import type { FunRunRecord, VibeRating } from './types';

const HISTORY_KEY = 'photon-funlab-v1';
const SKIP_KEY = 'photon-funlab-skip-v1';
const MAX_RUNS = 40;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch (e) { return fallback; }
}

export function loadFunHistory(): FunRunRecord[] {
  try {
    const parsed = safeParse<FunRunRecord[]>(localStorage.getItem(HISTORY_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveFunHistory(records: FunRunRecord[]) {
  try {
    const bounded = records.slice(0, MAX_RUNS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(bounded));
  } catch (e) {}
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
  };
  history[index] = updated;
  saveFunHistory(history);
  return updated;
}

export function clearFunHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
}

export function exportFunHistoryJSON() {
  return JSON.stringify(loadFunHistory(), null, 2);
}

export function loadSkipCount() {
  try { return Number(localStorage.getItem(SKIP_KEY) || '0') || 0; } catch (e) { return 0; }
}

export function noteVibeSkipped() {
  try { localStorage.setItem(SKIP_KEY, String(loadSkipCount() + 1)); } catch (e) {}
}

export function noteVibeAnswered() {
  try { localStorage.setItem(SKIP_KEY, '0'); } catch (e) {}
}
