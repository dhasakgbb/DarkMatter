import { MEMORIES, VARIANTS, type Memory } from './cosmology';
import { meta, saveMeta } from './meta';
import { loadSeedBookmarks } from './physicsInsight';
import { game } from './state';
import { showToast } from './utils';
import { audio } from './audio';

// LIVING MEMORIES: returns evolved body if conditions met, else original.
export function memoryBody(m: Memory): string {
  if (m.evolved && (meta.witnessedHeatDeath || 0) >= (m.evolved.afterWitnesses || 1)) return m.evolved.body;
  return m.body;
}

export function unlockMemory(id: string) {
  if (meta.memories[id]) return;
  const m = MEMORIES.find(x => x.id === id);
  if (!m) return;
  meta.memories[id] = true;
  if (m.threshold?.unlockVariant && !meta.unlockedVariants.includes(m.threshold.unlockVariant)) {
    meta.unlockedVariants.push(m.threshold.unlockVariant);
    const v = VARIANTS.find(x => x.key === m.threshold!.unlockVariant);
    if (v) showToast(`◆ Form unlocked: ${v.name} photon`);
  }
  saveMeta(meta);
  game.newMemoriesThisRun = game.newMemoriesThisRun || [];
  game.newMemoriesThisRun.push(id);
  audio.memoryUnlock();
  showToast(`✦ Memory: ${m.id.replace(/-/g, ' ')}`);
}

// Cheap to call repeatedly. Evaluates every memory's `when` against current meta + game state.
export function checkMemoryTriggers() {
  for (const m of MEMORIES) {
    if (meta.memories[m.id]) continue;
    const w = m.when;
    let ok = true;
    if (w.reachedEpoch != null && meta.bestEpoch < w.reachedEpoch) ok = false;
    if (w.runs != null && meta.totalRuns < w.runs) ok = false;
    if (w.witnessed != null && (meta.witnessedHeatDeath || 0) < w.witnessed) ok = false;
    if (w.phasesLifetime != null && (meta.phasesLifetime || 0) < w.phasesLifetime) ok = false;
    if (w.pickupsLifetime != null && (meta.pickupsLifetime || 0) < w.pickupsLifetime) ok = false;
    if (w.peakStreak != null && (meta.bestStreak || 0) < w.peakStreak) ok = false;
    if (w.lineStreak != null && (meta.bestLineStreak || 0) < w.lineStreak) ok = false;
    if (w.speedPadsHit != null && (meta.speedPadsHit || 0) < w.speedPadsHit) ok = false;
    if (w.gatesThreaded != null && (meta.gatesThreaded || 0) < w.gatesThreaded) ok = false;
    if (w.gammaPhases != null && (meta.colorPhases[0] || 0) < w.gammaPhases) ok = false;
    if (w.visiblePhases != null && (meta.colorPhases[1] || 0) < w.visiblePhases) ok = false;
    if (w.radioPhases != null && (meta.colorPhases[2] || 0) < w.radioPhases) ok = false;
    if (w.boostedOnce && !meta.boostedOnce) ok = false;
    if (w.pausedOnce && !meta.pausedOnce) ok = false;
    if (w.mutedOnce && !meta.mutedOnce) ok = false;
    if (w.firstWormhole && !meta.firstWormhole) ok = false;
    if (w.firstChainPhased && !meta.firstChainPhased) ok = false;
    if (w.perfectEpoch && !game.perfectEpochThisRun) ok = false;
    if (w.flowPeakDwell != null && (game.flowPeakDwell || 0) < w.flowPeakDwell) ok = false;
    if (w.flowDwellLifetime != null && (meta.flowDwellLifetime || 0) < w.flowDwellLifetime) ok = false;
    if (w.darkMatterDetections != null && (meta.darkMatterDetections || 0) < w.darkMatterDetections) ok = false;
    if (w.previousSeedBookmark) {
      const bookmarks = loadSeedBookmarks();
      const match = bookmarks.find((b) => b.seed === (game.runSeed >>> 0) && b.insightScore >= 45);
      if (!match) ok = false;
    }
    if (ok) unlockMemory(m.id);
  }
}

interface MemoryResonanceTarget {
  _firstChainFreeUsed: boolean;
  _firstChainFreePerRun: boolean;
  _memoryStartEnergyBonus: number;
  _memoryStartBoostBonus: number;
}

// Apply resonance bonuses at the start of each run without importing the Photon singleton here.
export function applyMemoryResonances(photon: MemoryResonanceTarget) {
  photon._firstChainFreeUsed = false;
  photon._memoryStartEnergyBonus = 0;
  photon._memoryStartBoostBonus = 0;
  for (const m of MEMORIES) {
    if (!meta.memories[m.id] || !m.resonance) continue;
    const r = m.resonance;
    if (r.startEnergyBonus) photon._memoryStartEnergyBonus += r.startEnergyBonus;
    if (r.startBoostBonus) photon._memoryStartBoostBonus += r.startBoostBonus;
    if (r.firstChainFreePerRun) photon._firstChainFreePerRun = true;
    if (r.perfectStartBoost && game.lastRunWasPerfect) photon._memoryStartBoostBonus += r.perfectStartBoost;
  }
}

export function maybeUnlockCodex(key: string, codexEntries: Record<string, { title: string }>) {
  if (!codexEntries[key]) return;
  if (!meta.codex[key]) {
    meta.codex[key] = true;
    saveMeta(meta);
    showToast(`◇ Codex: ${codexEntries[key].title}`);
  }
}
