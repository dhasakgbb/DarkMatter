import { analyzeRun } from './model';
import { loadFunHistory, loadSkipCount, noteVibeAnswered, noteVibeSkipped, saveRunRecord, updateRunVibe } from './storage';
import type { FunRunEvent, FunRunRecord, VibeRating } from './types';

function runId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999).toString(36)}`;
}

export class FunLabRuntime {
  private currentRunId = '';
  private currentStartedAt = 0;
  private events: FunRunEvent[] = [];
  lastRecordId = '';
  pendingVibeRunId = '';

  startRun(context: Partial<FunRunEvent> = {}) {
    this.currentRunId = runId();
    this.currentStartedAt = performance.now();
    this.events = [];
    this.record('run-start', context);
  }

  record(type: FunRunEvent['type'], event: Partial<FunRunEvent> = {}) {
    if (!this.currentRunId && type !== 'run-start') return;
    const now = performance.now();
    const at = typeof event.at === 'number' ? event.at : now;
    const t = typeof event.t === 'number' ? event.t : (this.currentStartedAt ? (at - this.currentStartedAt) / 1000 : 0);
    this.events.push({
      ...event,
      type,
      at,
      t,
      runId: this.currentRunId || event.runId,
    });
  }

  finishRun(type: 'run-end' | 'death' | 'quit', context: Partial<FunRunEvent> = {}): FunRunRecord | null {
    if (!this.currentRunId) return null;
    this.record(type, context);
    const id = this.currentRunId;
    const analysis = analyzeRun(this.events, undefined, id);
    const record: FunRunRecord = {
      id,
      createdAt: Date.now(),
      events: [...this.events],
      summary: analysis.summary,
      fingerprint: analysis.fingerprint,
      recommendations: analysis.recommendations,
      dopamineEngine: analysis.dopamineEngine,
    };
    saveRunRecord(record);
    this.lastRecordId = id;
    this.currentRunId = '';
    this.currentStartedAt = 0;
    this.events = [];
    this.pendingVibeRunId = '';
    return record;
  }

  shouldAskVibe(record: FunRunRecord) {
    const skipCount = loadSkipCount();
    if (skipCount >= 3 && record.summary.epochReached < 3 && !record.summary.deathCause) return false;
    const history = loadFunHistory();
    if (record.summary.deathCause || record.summary.quit) return true;
    if (record.summary.epochReached >= 3) return true;
    return history.length % 3 === 0;
  }

  attachVibe(runId: string, rating: Omit<VibeRating, 'at'>) {
    const updated = updateRunVibe(runId, { ...rating, at: Date.now() });
    if (updated) {
      noteVibeAnswered();
      if (this.pendingVibeRunId === runId) this.pendingVibeRunId = '';
    }
    return updated;
  }

  skipVibe(runId: string) {
    noteVibeSkipped();
    if (this.pendingVibeRunId === runId) this.pendingVibeRunId = '';
  }

  recentRuns() {
    return loadFunHistory();
  }
}

export const funLab = new FunLabRuntime();
