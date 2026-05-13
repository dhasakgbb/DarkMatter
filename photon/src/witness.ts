import * as THREE from 'three';
import { audio } from './audio';
import { meta, saveMeta, clearCheckpoint } from './meta';
import { CODEX_ENTRIES } from './cosmology';
import { game } from './state';
import { skyMat, stars, lensingPass } from './scene';
import { checkMemoryTriggers, maybeUnlockCodex } from './memories';
import { funLab } from './funlab/runtime';

// Forward-declared callbacks set by game.ts to avoid a circular import.
export const witnessHooks: {
  setStateTitle: () => void;
  refreshTitleStats: () => void;
  showVibePrompt: (runId: string) => void;
} = {
  setStateTitle: () => {},
  refreshTitleStats: () => {},
  showVibePrompt: () => {},
};

export function checkVariantUnlocksFromMeta() {
  const ensure = (key: string) => {
    if (!meta.unlockedVariants.includes(key)) {
      meta.unlockedVariants.push(key);
      saveMeta(meta);
    }
  };
  if (meta.witnessedHeatDeath >= 1) ensure('microwave');
  if (meta.bestEpoch >= 5)         ensure('xray');
}

export function triggerWitness() {
  if (game.witnessing) return;
  game.witnessing = true;
  funLab.finishRun('run-end', { epochIndex: game.epochIndex, epochName: 'Heat Death', distance: game.runDistance, cause: 'witnessed heat death' });
  meta.witnessedHeatDeath = (meta.witnessedHeatDeath || 0) + 1;
  saveMeta(meta);
  clearCheckpoint();
  maybeUnlockCodex('WITNESS', CODEX_ENTRIES);
  checkMemoryTriggers();
  checkVariantUnlocksFromMeta();
  audio.stopDrone();
  audio.stopEngine();
  audio.witnessChime();
  const overlay = document.getElementById('witness')!;
  overlay.classList.add('on');
  setTimeout(() => overlay.classList.add('bright'), 1200);
  setTimeout(() => document.getElementById('witness-line')!.classList.add('show'), 4500);
  setTimeout(() => document.getElementById('witness-subline')!.classList.add('show'), 6500);
  setTimeout(() => {
    const c = document.getElementById('witness-count')!;
    c.textContent = `You are photon #${meta.witnessedHeatDeath} to witness this`;
    c.classList.add('show');
  }, 8000);
  setTimeout(() => document.getElementById('witness-hint')!.classList.add('show'), 13000);
}

export function endWitness() {
  const overlay = document.getElementById('witness')!;
  overlay.classList.remove('on', 'bright');
  document.getElementById('witness-line')!.classList.remove('show');
  document.getElementById('witness-subline')!.classList.remove('show');
  document.getElementById('witness-count')!.classList.remove('show');
  document.getElementById('witness-hint')!.classList.remove('show');
  game.witnessing = false;
  if (skyMat && skyMat.uniforms.uMix) skyMat.uniforms.uMix.value = 0.6;
  if (stars && stars.material) (stars.material as THREE.PointsMaterial).opacity = 0.9;
  game.heatDeathFade = 0;
  if (lensingPass) {
    lensingPass.uniforms.uVignettePower.value = 1;
    (lensingPass.uniforms.uVignetteColor.value as THREE.Vector3).set(0, 0, 0);
  }
  if (funLab.pendingVibeRunId) {
    witnessHooks.showVibePrompt(funLab.pendingVibeRunId);
    return;
  }
  witnessHooks.refreshTitleStats();
  witnessHooks.setStateTitle();
}
