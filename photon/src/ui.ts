import { meta, saveMeta, loadCheckpoint, clearCheckpoint, defaultMeta } from './meta';
import { settings, applySettings, saveSettings } from './settings';
import { EPOCHS, WAVELENGTHS, CODEX_ENTRIES, MEMORIES, VARIANTS } from './cosmology';
import { game } from './state';
import { memoryBody } from './memories';
import { showToast } from './utils';
import { applyMetaUpgrades, setState, startRun, resume, beginDeath, checkVariantUnlocks } from './game';
import { audio } from './audio';
import { parseSeedLabel } from './seed';
import { funLab } from './funlab/runtime';
import { buildVibeControls, clearFunLabAndRender, exportFunLab, readVibeRating, renderFunLabDashboard, renderVibePrompt } from './funlab/ui';

export function refreshTitleStats() {
  const stats = document.getElementById('title-stats')!;
  stats.innerHTML = '';
  const memCount = Object.values(meta.memories || {}).filter(Boolean).length;
  const currentVariant = VARIANTS.find(v => v.key === meta.variant) || VARIANTS[0];
  const unlockedFormCount = VARIANTS.filter(v => v.unlocked || meta.unlockedVariants.includes(v.key)).length;
  const items = [
    ['Witnessed the end', `${meta.witnessedHeatDeath || 0}×`],
    ['Furthest reached', `${meta.bestEpoch + 1} / ${EPOCHS.length}`],
    ['Memories', `${memCount} / ${MEMORIES.length}`],
    ['Codex', `${Object.keys(meta.codex).length} / ${Object.keys(CODEX_ENTRIES).length}`],
    ['Form', `${currentVariant.name}  ·  ${unlockedFormCount}/${VARIANTS.length} unlocked`],
    ['Best racing line', `${meta.bestLineStreak || 0} gates`],
    ['Lives lived', `${meta.totalRuns}`],
  ];
  for (const [k, v] of items) { const d = document.createElement('div'); d.innerHTML = `<span>${k}</span><span>${v}</span>`; stats.appendChild(d); }
  const cp = loadCheckpoint();
  const resumeBtn = document.getElementById('btn-resume')!;
  if (cp && Number.isInteger(cp.epochIndex) && cp.epochIndex < EPOCHS.length) {
    resumeBtn.style.display = '';
    resumeBtn.textContent = `↶ Resume from ${EPOCHS[cp.epochIndex].name}`;
  } else {
    resumeBtn.style.display = 'none';
  }
  // MULTIVERSE row only appears once the player has witnessed the heat death at least once.
  const mv = document.getElementById('multiverse-row');
  if (mv) mv.style.display = (meta.witnessedHeatDeath || 0) >= 1 ? '' : 'none';
}

export function refreshCodex() {
  const list = document.getElementById('codex-list')!;
  list.innerHTML = '';
  for (const [key, entry] of Object.entries(CODEX_ENTRIES)) {
    const div = document.createElement('div');
    const unlocked = !!meta.codex[key];
    div.className = 'codex-entry' + (unlocked ? '' : ' locked');
    div.innerHTML = `<div class="title">${unlocked ? entry.title : '???'}</div><div class="body">${unlocked ? entry.body : 'Phenomenon not yet encountered. Survive longer to unlock.'}</div>`;
    list.appendChild(div);
  }
}

export function refreshMemories() {
  const list = document.getElementById('memories-list')!;
  list.innerHTML = '';
  const unlockedCount = MEMORIES.filter(m => meta.memories[m.id]).length;
  document.getElementById('mem-count')!.textContent = `${unlockedCount} / ${MEMORIES.length} remembered`;
  for (const m of MEMORIES) {
    const unlocked = !!meta.memories[m.id];
    const div = document.createElement('div');
    div.className = 'codex-entry' + (unlocked ? '' : ' locked');
    const tint = m.type === 'threshold' ? '#ff7ad9' : m.type === 'resonance' ? '#88e0ff' : '#aab';
    if (unlocked) {
      const isEvolved = m.evolved && (meta.witnessedHeatDeath || 0) >= (m.evolved.afterWitnesses || 1);
      const evoTag = isEvolved ? `<span style="margin-left:8px; font-size:9px; color:#ff7ad9; opacity:0.7">· REMEMBERED ANEW</span>` : '';
      div.innerHTML = `<div class="title" style="color:${tint}">${m.id.replace(/-/g, ' ')}  ·  ${m.type}${evoTag}</div><div class="body" style="font-style:italic">${memoryBody(m)}</div>`;
    } else {
      div.innerHTML = `<div class="title">···</div><div class="body">An experience the universe has not yet shown you.</div>`;
    }
    list.appendChild(div);
  }
}

export function refreshForm() {
  const list = document.getElementById('form-list')!;
  list.innerHTML = '';
  for (const v of VARIANTS) {
    const isUnlocked = v.unlocked || meta.unlockedVariants.includes(v.key);
    const isCurrent = meta.variant === v.key;
    const card = document.createElement('div');
    card.style.cssText = `padding: 14px 16px; margin: 10px 0; border: 1px solid ${isCurrent ? '#88e0ff' : isUnlocked ? 'rgba(180,200,255,0.22)' : 'rgba(255,255,255,0.08)'}; border-radius: 3px; cursor: ${isUnlocked ? 'pointer' : 'default'}; transition: all 0.18s; background: ${isCurrent ? 'rgba(120,200,255,0.08)' : 'transparent'}; ${isUnlocked ? '' : 'opacity:0.45'}`;
    const wlColor = WAVELENGTHS[v.startWavelength].color;
    const wlHex = `rgb(${Math.floor(wlColor.r * 255)},${Math.floor(wlColor.g * 255)},${Math.floor(wlColor.b * 255)})`;
    const stats = `speed ×${v.mods.speedMul.toFixed(2)}  ·  agility ×${v.mods.agilityMul.toFixed(2)}  ·  energy ×${v.mods.energyMul.toFixed(2)}  ·  boost ×${v.mods.boostMul.toFixed(2)}`;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px">
        <div style="font-size:14px; letter-spacing:0.25em; text-transform:uppercase; color:${isUnlocked ? wlHex : '#666'}">${v.name} ${isCurrent ? '· current' : ''}</div>
        <div style="font-size:10px; opacity:0.5; letter-spacing:0.15em; text-transform:uppercase">${isUnlocked ? 'unlocked' : 'locked'}</div>
      </div>
      <div style="font-size:12px; opacity:0.85; margin-top:8px; line-height:1.55">${isUnlocked ? v.desc : (v.unlockReq || '')}</div>
      <div style="font-size:10px; opacity:0.55; margin-top:8px; letter-spacing:0.06em">${isUnlocked ? stats : ''}</div>
    `;
    if (isUnlocked) {
      card.addEventListener('mouseenter', () => { if (!isCurrent) card.style.borderColor = '#88e0ff'; });
      card.addEventListener('mouseleave', () => { if (!isCurrent) card.style.borderColor = 'rgba(180,200,255,0.22)'; });
      card.addEventListener('click', () => {
        meta.variant = v.key;
        game.variant = v;
        saveMeta(meta);
        refreshForm();
        refreshTitleStats();
      });
    }
    list.appendChild(card);
  }
}

export function refreshSettingsUI() {
  (document.getElementById('set-master') as HTMLInputElement).value = String(settings.masterVol);
  document.getElementById('set-master-val')!.textContent = String(Math.round(settings.masterVol * 100));
  (document.getElementById('set-fov') as HTMLInputElement).value = String(settings.fov);
  document.getElementById('set-fov-val')!.textContent = String(settings.fov);
  (document.getElementById('set-sens') as HTMLInputElement).value = String(settings.sensitivity);
  document.getElementById('set-sens-val')!.textContent = settings.sensitivity.toFixed(2);
  document.getElementById('set-mute')!.classList.toggle('on', settings.muted);
  document.getElementById('set-contrast')!.classList.toggle('on', settings.highContrast);
  document.getElementById('set-reduced')!.classList.toggle('on', settings.reducedMotion);
}

export function bindUI() {
  // UI AUDIO: global hover tick + click feedback on every button. Cheap and felt.
  document.addEventListener('mouseover', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && tgt.tagName === 'BUTTON') audio.uiTick();
  });
  document.addEventListener('click', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && tgt.tagName === 'BUTTON') audio.uiClick();
  });

  document.getElementById('btn-start')!.addEventListener('click', () => { clearCheckpoint(); startRun(); });
  document.getElementById('btn-resume')!.addEventListener('click', () => { const cp = loadCheckpoint(); if (cp) startRun(cp); });
  // MULTIVERSE: paste-a-seed flow
  const seedBtn = document.getElementById('btn-start-seed');
  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      const inp = document.getElementById('seed-input') as HTMLInputElement;
      const parsed = parseSeedLabel(inp.value);
      if (parsed == null) { showToast('◇ Invalid universe seed'); return; }
      clearCheckpoint();
      startRun(undefined, parsed);
    });
  }
  document.getElementById('btn-again')!.addEventListener('click', () => startRun());
  document.getElementById('btn-menu')!.addEventListener('click', () => { refreshTitleStats(); setState('title'); });
  document.getElementById('btn-codex')!.addEventListener('click', () => { refreshCodex(); setState('codex'); });
  document.getElementById('btn-codex-back')!.addEventListener('click', () => { refreshTitleStats(); setState('title'); });
  document.getElementById('btn-memories')!.addEventListener('click', () => { refreshMemories(); setState('memories'); });
  document.getElementById('btn-memories-back')!.addEventListener('click', () => { refreshTitleStats(); setState('title'); });
  document.getElementById('btn-form')!.addEventListener('click', () => { checkVariantUnlocks(); refreshForm(); setState('form'); });
  document.getElementById('btn-form-back')!.addEventListener('click', () => { refreshTitleStats(); setState('title'); });
  document.getElementById('btn-funlab')!.addEventListener('click', () => {
    const panel = document.getElementById('funlab')!;
    panel.dataset.returnState = 'title';
    renderFunLabDashboard();
    setState('funlab');
  });

  // Settings controls
  document.getElementById('set-master')!.addEventListener('input', (e: any) => {
    settings.masterVol = parseFloat(e.target.value);
    document.getElementById('set-master-val')!.textContent = String(Math.round(settings.masterVol * 100));
    applySettings(); saveSettings(settings);
  });
  document.getElementById('set-fov')!.addEventListener('input', (e: any) => {
    settings.fov = parseInt(e.target.value, 10);
    document.getElementById('set-fov-val')!.textContent = String(settings.fov);
    applySettings(); saveSettings(settings);
  });
  document.getElementById('set-sens')!.addEventListener('input', (e: any) => {
    settings.sensitivity = parseFloat(e.target.value);
    document.getElementById('set-sens-val')!.textContent = settings.sensitivity.toFixed(2);
    applySettings(); saveSettings(settings);
  });
  document.getElementById('set-mute')!.addEventListener('click', () => { settings.muted = !settings.muted; applySettings(); saveSettings(settings); refreshSettingsUI(); });
  document.getElementById('set-contrast')!.addEventListener('click', () => { settings.highContrast = !settings.highContrast; applySettings(); saveSettings(settings); refreshSettingsUI(); });
  document.getElementById('set-reduced')!.addEventListener('click', () => { settings.reducedMotion = !settings.reducedMotion; applySettings(); saveSettings(settings); refreshSettingsUI(); });
  document.getElementById('btn-pause-resume')!.addEventListener('click', resume);
  document.getElementById('btn-pause-funlab')!.addEventListener('click', () => {
    const panel = document.getElementById('funlab')!;
    panel.dataset.returnState = 'pause';
    renderFunLabDashboard();
    setState('funlab');
  });
  document.getElementById('btn-end-run')!.addEventListener('click', () => { game.manualEndRequested = true; resume(); beginDeath(); });
  document.getElementById('btn-reset-meta')!.addEventListener('click', () => {
    if (!confirm('Reset ALL progress (upgrades, codex, runs, best distance)? This cannot be undone.')) return;
    try { localStorage.removeItem('photon-meta-v1'); } catch (e) {}
    Object.assign(meta, defaultMeta());
    saveMeta(meta);
    applyMetaUpgrades();
    refreshTitleStats(); refreshCodex();
    showToast('◇ Progress reset');
  });
  buildVibeControls();
  document.getElementById('btn-vibe-submit')!.addEventListener('click', () => {
    const runId = document.getElementById('vibe-panel')!.dataset.runId || funLab.pendingVibeRunId || funLab.lastRecordId;
    if (runId) funLab.attachVibe(runId, readVibeRating());
    renderFunLabDashboard(runId);
    setState('death');
  });
  document.getElementById('btn-vibe-skip')!.addEventListener('click', () => {
    const runId = document.getElementById('vibe-panel')!.dataset.runId || funLab.pendingVibeRunId || funLab.lastRecordId;
    if (runId) funLab.skipVibe(runId);
    setState('death');
  });
  document.getElementById('btn-vibe-again')!.addEventListener('click', () => {
    const runId = document.getElementById('vibe-panel')!.dataset.runId || funLab.pendingVibeRunId || funLab.lastRecordId;
    if (runId) funLab.skipVibe(runId);
    startRun();
  });
  document.getElementById('btn-funlab-back')!.addEventListener('click', () => {
    const returnState = (document.getElementById('funlab')!.dataset.returnState as any) || 'title';
    if (returnState === 'pause') setState('pause');
    else { refreshTitleStats(); setState('title'); }
  });
  document.getElementById('btn-funlab-export')!.addEventListener('click', exportFunLab);
  document.getElementById('btn-funlab-clear')!.addEventListener('click', () => {
    if (!confirm('Clear local Fun Lab run history? Gameplay progress is untouched.')) return;
    clearFunLabAndRender();
  });
  if (funLab.pendingVibeRunId) renderVibePrompt(funLab.pendingVibeRunId);
  // Silence unused-import warnings in development
  void audio;
}
