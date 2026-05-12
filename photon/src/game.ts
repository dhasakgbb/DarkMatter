import * as THREE from 'three';
import { EPOCHS, WAVELENGTHS, CODEX_ENTRIES, UPGRADES, VARIANTS, MEMORIES, TUTORIAL_STEPS, type Epoch } from './cosmology';
import { BASE_SPEED, BOOST_MAX, SEGMENT_LEN } from './constants';
import { game, type GameStateName } from './state';
import { meta, saveMeta, saveCheckpoint, clearCheckpoint, type Checkpoint } from './meta';
import { settings, applySettings } from './settings';
import { newSeed, setRunSeed, computeEpochParams, computeCosmicConstants } from './seed';
import { audio } from './audio';
import { scene, camera, composer, lensingPass, skyMat, stars } from './scene';
import { track } from './track';
import { particleManager } from './particles';
import { echoSystem, spawnEchoPhoton } from './echoes';
import { photon } from './photon';
import { hazards, spawnFinalPickup } from './hazards';
import { racingLine } from './racing';
import { applyMemoryResonances, checkMemoryTriggers, maybeUnlockCodex, memoryBody } from './memories';
import { triggerWitness, witnessHooks } from './witness';
import { input } from './input';
import { drawHud, showEpochToast } from './hud';
import { comboMultiplier, showToast } from './utils';
import { refreshTitleStats, refreshSettingsUI } from './ui';
import { funLab } from './funlab/runtime';
import { renderVibePrompt } from './funlab/ui';

export function setState(s: GameStateName) {
  const prev = game.state;
  game.state = s;
  for (const id of ['title', 'run', 'upgrade', 'death', 'codex', 'pause', 'memories', 'form', 'vibe', 'funlab'] as const) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', id === s);
  }
  // UI AUDIO: subtle swoosh when an overlay panel slides in. Skip transitions that go to/from RUN
  // (those are gameplay state shifts, not menu chrome).
  if (prev !== s && s !== 'run' && prev !== 'run' && s !== 'pause' && prev !== 'pause') audio.uiSwoosh();
}

export function applyMetaUpgrades() {
  photon.speedBonus = 1; photon.agilityBonus = 1; photon.energyMaxBonus = 0;
  photon.damageReduction = 0; photon.boostRechargeBonus = 1; photon.phaseWindowSec = 0;
  for (const u of UPGRADES) {
    const lvl = meta.upgrades[u.key] || 0;
    if (lvl > 0) u.apply(photon, lvl);
  }
}

export function checkVariantUnlocks() {
  const ensure = (key: string) => {
    if (!meta.unlockedVariants.includes(key)) {
      meta.unlockedVariants.push(key);
      const v = VARIANTS.find(x => x.key === key);
      if (v) showToast(`◆ Form unlocked: ${v.name} photon`);
      saveMeta(meta);
    }
  };
  if (meta.witnessedHeatDeath >= 1) ensure('microwave');
  if (meta.bestEpoch >= 5)         ensure('xray');
}

export function setEpoch(idx: number) {
  const isTransition = game._anyEpochSetThisRun;
  if (isTransition) {
    const flash = document.getElementById('epoch-flash')!;
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 1300);
  }
  game._anyEpochSetThisRun = true;
  game.epochIndex = idx;
  game.epochTimer = 0;
  game.epochCleared = false;
  computeEpochParams(idx);
  const e = EPOCHS[Math.min(idx, EPOCHS.length - 1)];
  funLab.record('epoch-enter', { epochIndex: idx, epochName: e.name, distance: game.runDistance });
  skyMat.uniforms.uColorA.value.copy(e.paletteA);
  skyMat.uniforms.uColorB.value.copy(e.paletteB);
  skyMat.uniforms.uPoint.value.copy(e.palettePoint);
  skyMat.uniforms.uRedshift.value = idx / Math.max(1, EPOCHS.length);
  scene.fog!.color.copy(e.fogColor);
  (scene.fog as THREE.Fog).near = e.fogNear; (scene.fog as THREE.Fog).far = e.fogFar;
  scene.background = e.fogColor.clone().multiplyScalar(0.4);
  track.setEpoch(e);
  if (e.isHeatDeath) {
    audio.startHeatDeath();
    game.heatDeathFade = 0;
    game.heatDeathFinalSpawned = false;
  } else {
    audio.startDrone(e);
  }
  // Cinematic epoch riser plays only on transitions (not the first epoch / not on resume's first epoch)
  if (isTransition) audio.epochRiser();
  maybeUnlockCodex(e.codexKey, CODEX_ENTRIES);
  if (idx > meta.bestEpoch) meta.bestEpoch = idx;
  saveMeta(meta);
  checkMemoryTriggers();
  checkVariantUnlocks();
  const chapter = idx === 0 ? runStartChapter() : e.chapter;
  showEpochToast(idx + 1, e.name, e.subtitle, chapter);
  if (game.state === 'run' || idx === 0) {
    saveCheckpoint({
      epochIndex: idx,
      runEnergy: game.runEnergy || 0,
      energy: photon.energy,
      maxEnergyAtSave: photon.maxEnergy(),
      boost: photon.boost,
      wavelength: photon.wavelength,
      variant: meta.variant,
      runSeed: game.runSeed,
      phaseStreak: 0,
      perfectEpochThisRun: true,
      startTimeOffset: performance.now() - (game.startTime || performance.now()),
      savedAt: Date.now(),
      epochName: e.name,
    });
  }
}

function runStartChapter() {
  if ((meta.witnessedHeatDeath || 0) > 0) return 'You know how this ends. You go anyway.';
  if ((meta.totalRuns || 0) > 0) return 'You are born again. The universe is less empty than before.';
  return EPOCHS[0].chapter;
}

function absorptionLineFor(e: Epoch) {
  if (e.isHeatDeath) return 'Nothing stops you. That is the wound.';
  if (e.name === 'Black Hole') return 'You are gathered, folded, and made difficult to remember.';
  if (e.name === 'Stellar') return 'An eye catches you. For one instant, you are seen.';
  if (e.name === 'First Stars') return 'A young star takes your motion and spends it as heat.';
  if (e.name === 'Recombination') return 'The fog opens without you. The next photon keeps the route.';
  if (e.name === 'Quark Plasma') return 'You are made and stopped in the same instant.';
  return 'You enter matter and do not come out.';
}

function heatDeathTick(dt: number, photonDist: number) {
  const e = EPOCHS[game.epochIndex];
  const t = game.epochTimer;
  const total = e.duration;
  const visFade = THREE.MathUtils.clamp(1 - (t / 90), 0.05, 1);
  game.heatDeathFade = 1 - visFade;
  if (stars && stars.material) (stars.material as THREE.PointsMaterial).opacity = 0.9 * visFade;
  if (skyMat && skyMat.uniforms.uMix) skyMat.uniforms.uMix.value = 0.6 * visFade;
  if ((meta.witnessedHeatDeath || 0) >= 1) {
    game._echoTime = (game._echoTime || 0) + dt;
    const echoInterval = Math.max(1.0, 3.6 - meta.witnessedHeatDeath * 0.22);
    if (game._echoTime >= echoInterval) { game._echoTime = 0; spawnEchoPhoton(photonDist); }
  }
  if (t >= 300 && !game.heatDeathFinalSpawned) {
    game.heatDeathFinalSpawned = true;
    spawnFinalPickup(photonDist + 60);
  }
  if (t >= total && !game.witnessing && photon.alive) photon.alive = false;
}

export function pause() {
  if (game.state !== 'run') return;
  refreshSettingsUI();
  setState('pause');
  if (audio.ctx) try { audio.ctx.suspend(); } catch (e) {}
  if (!meta.pausedOnce) { meta.pausedOnce = true; saveMeta(meta); checkMemoryTriggers(); }
}
export function resume() {
  if (game.state !== 'pause') return;
  setState('run');
  if (audio.ctx) try { audio.ctx.resume(); } catch (e) {}
  last = performance.now();
}

export function startRun(resumeSnapshot?: Checkpoint, overrideSeed?: number) {
  audio.ensure(); audio.resume();
  audio.startEngine();
  hazards.reset();
  racingLine.reset();
  particleManager.reset();
  echoSystem.reset();
  applyMetaUpgrades();
  applyMemoryResonances(photon);
  applySettings();
  game.runSeed = (resumeSnapshot && resumeSnapshot.runSeed != null) ? resumeSnapshot.runSeed
              : (overrideSeed != null) ? (overrideSeed >>> 0)
              : newSeed();
  game.epochParams = {};
  setRunSeed(game.runSeed);
  // MULTIVERSE: derive physical constants from the seed (identity until first witness)
  game.cosmicConstants = computeCosmicConstants(game.runSeed, meta.witnessedHeatDeath);
  game.coherenceTime = 0;
  if (resumeSnapshot && resumeSnapshot.variant) {
    const v = VARIANTS.find(x => x.key === resumeSnapshot.variant);
    if (v && (v.unlocked || meta.unlockedVariants.includes(v.key))) game.variant = v;
  }
  photon.reset(game.variant);
  if (photon._memoryStartEnergyBonus) photon.energy = Math.min(photon.maxEnergy(), photon.energy + photon._memoryStartEnergyBonus);
  if (photon._memoryStartBoostBonus) photon.boost = Math.min(BOOST_MAX, photon.boost + photon._memoryStartBoostBonus);
  game.newMemoriesThisRun = [];
  game.perfectEpochThisRun = true;
  game.lastRunWasPerfect = false;
  game.phaseStreak = 0;
  game.endlessLoop = 0;
  game.witnessing = false;
  game.heatDeathFade = 0;
  game.heatDeathFinalSpawned = false;
  game.padBoostTime = 0;
  game.padBoostTotal = 0;
  game.lineStreak = 0;
  game.bestLineStreakThisRun = 0;
  game.lineEventText = '';
  game.lineEventTime = 0;
  game.railScrapeTime = 0;
  game.railScrapeCooldown = 0;
  game.fieldStrain = 0;
  game.fieldStrainX = 0;
  game.fieldStrainY = 0;
  game._anyEpochSetThisRun = false;
  game.runDistance = 0;
  game.runEnergy = (resumeSnapshot && resumeSnapshot.runEnergy) || 0;
  game.startTime = performance.now() - ((resumeSnapshot && resumeSnapshot.startTimeOffset) || 0);
  game.phaseCount = 0;
  game.hitCount = 0;
  game._shiftedThisRun = false;
  if (!resumeSnapshot && (!meta.tutorialDone || meta.totalRuns < 2)) {
    game.tutorialActive = true; game.tutorialStep = 0; game.tutorialTime = 0;
  } else { game.tutorialActive = false; }
  game.trauma = 0; game.timeScale = 1; game.hitStopTime = 0; game.dying = false;
  const startEpoch = (resumeSnapshot && Number.isInteger(resumeSnapshot.epochIndex) && resumeSnapshot.epochIndex < EPOCHS.length) ? resumeSnapshot.epochIndex : 0;
  funLab.startRun({
    epochIndex: startEpoch,
    epochName: EPOCHS[startEpoch].name,
    distance: game.runDistance,
    note: resumeSnapshot ? 'resumed checkpoint' : `seed:${game.runSeed}`,
  });
  setEpoch(startEpoch);
  if (resumeSnapshot) {
    if (typeof resumeSnapshot.energy === 'number') photon.energy = Math.min(photon.maxEnergy(), resumeSnapshot.energy);
    if (typeof resumeSnapshot.boost === 'number')  photon.boost = Math.min(BOOST_MAX, resumeSnapshot.boost);
    if (Number.isInteger(resumeSnapshot.wavelength)) {
      photon.wavelength = resumeSnapshot.wavelength;
      photon.setColorFromWavelength(true);
    }
  }
  setState('run');
  if (!resumeSnapshot) { meta.totalRuns++; saveMeta(meta); }
  maybeUnlockCodex('PHOTON', CODEX_ENTRIES);
}

export function beginDeath() {
  if (game.dying) return;
  game.dying = true;
  game.dyingTime = 0;
  clearCheckpoint();
  audio.death();
  audio.stopDrone();
  audio.stopEngine();
  game.trauma = Math.min(1, game.trauma + 0.9);
  game.timeScale = 1; game.hitStopTime = 0;
  particleManager.emitBurst(photon.group.position.clone(), 'death', 90, new THREE.Color(0xff5566));
  particleManager.emitBurst(photon.group.position.clone(), 'death', 50, WAVELENGTHS[photon.wavelength].color);
}

function finalizeDeath() {
  game.dying = false;
  photon.group.scale.set(1, 1, 1);
  (photon.trail.material as THREE.LineBasicMaterial).opacity = 0.85;
  lensingPass.uniforms.uVignettePower.value = 1;
  (lensingPass.uniforms.uVignetteColor.value as THREE.Vector3).set(0, 0, 0);
  camera.fov = 72; camera.updateProjectionMatrix();
  endRun();
}

export function endRun() {
  const reachedIdx = game.epochIndex;
  const e = EPOCHS[Math.min(reachedIdx, EPOCHS.length - 1)];
  funLab.finishRun('death', {
    epochIndex: reachedIdx,
    epochName: e.name,
    distance: game.runDistance,
    cause: absorptionLineFor(e),
    value: game.runEnergy,
  });
  game.lastRunWasPerfect = !!game.perfectEpochThisRun;
  checkMemoryTriggers();
  if (reachedIdx > meta.bestEpoch) meta.bestEpoch = reachedIdx;
  if (game.runDistance > meta.bestDistance) meta.bestDistance = game.runDistance;
  meta.totalEnergy += Math.floor(game.runEnergy);
  saveMeta(meta);
  document.getElementById('death-where')!.textContent = `${e.name} — ${e.subtitle}`;
  document.getElementById('death-line')!.textContent = absorptionLineFor(e);
  const stats = document.getElementById('death-stats')!;
  stats.innerHTML = '';
  const fmt = (n: number) => Math.floor(n).toLocaleString();
  const items = [
    ['Drift', `${fmt(game.runDistance)} units`],
    ['Light gathered', `${fmt(game.runEnergy)}`],
    ['Best racing line', `${game.bestLineStreakThisRun || 0} gates`],
    ['Era reached', `${reachedIdx + 1} / ${EPOCHS.length}`],
    ['Time existing', `${((performance.now() - game.startTime) / 1000).toFixed(1)} s`],
    ['Furthest reached', `${meta.bestEpoch + 1}`],
    ['Lives lived', `${meta.totalRuns}`],
  ];
  for (const [k, v] of items) {
    const d = document.createElement('div');
    d.innerHTML = `<span>${k}</span><span>${v}</span>`;
    stats.appendChild(d);
  }
  const memWrap = document.getElementById('death-memories')!;
  memWrap.innerHTML = '';
  const newMems = (game.newMemoriesThisRun || []).slice(0, 3);
  if (newMems.length > 0) {
    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:11px;letter-spacing:0.3em;opacity:0.65;text-transform:uppercase;margin:6px 0 8px;text-align:center;color:#ff7ad9';
    heading.textContent = `New ${newMems.length === 1 ? 'memory' : 'memories'}`;
    memWrap.appendChild(heading);
    for (const id of newMems) {
      const m = MEMORIES.find(x => x.id === id);
      if (!m) continue;
      const card = document.createElement('div');
      const tint = m.type === 'threshold' ? '#ff7ad9' : m.type === 'resonance' ? '#88e0ff' : 'rgba(255,255,255,0.6)';
      card.style.cssText = `border-left:2px solid ${tint};padding:10px 14px;margin:8px 0;background:rgba(255,255,255,0.03);font-size:12px;line-height:1.55;font-style:italic;opacity:0.92`;
      card.innerHTML = `<div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;opacity:0.6;margin-bottom:6px;font-style:normal;color:${tint}">${m.type} memory</div>${memoryBody(m)}`;
      memWrap.appendChild(card);
    }
  }
  const dc = document.getElementById('death-codex')!;
  if (CODEX_ENTRIES[e.codexKey]) {
    dc.style.display = ''; dc.textContent = CODEX_ENTRIES[e.codexKey].body;
  } else dc.style.display = 'none';
  setState('death');
  if (funLab.pendingVibeRunId) {
    renderVibePrompt(funLab.pendingVibeRunId);
    setState('vibe');
  }
}

export function epochCleared() {
  game.epochCleared = true;
  funLab.record('epoch-exit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance });
  audio.stopDrone();
  if (game.perfectEpochThisRun) checkMemoryTriggers();
  game.perfectEpochThisRun = true;
  const pool = UPGRADES.filter(u => (meta.upgrades[u.key] || 0) < u.max);
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  if (shuffled.length === 0) { game.runEnergy += 30; advanceEpoch(); return; }
  const e = EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)];
  funLab.record('upgrade-options', { epochIndex: game.epochIndex, epochName: e.name, distance: game.runDistance, value: shuffled.length });
  document.getElementById('upgrade-where')!.textContent = `You survived ${e.name}`;
  const wrap = document.getElementById('upgrade-cards')!;
  wrap.innerHTML = '';
  for (const u of shuffled) {
    const lvl = meta.upgrades[u.key] || 0;
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `<div class="name">${u.name}</div><div class="desc">${u.desc}</div><div class="lvl">Level ${lvl} → ${lvl + 1} (max ${u.max})</div>`;
    card.addEventListener('click', () => {
      funLab.record('upgrade-selected', { epochIndex: game.epochIndex, epochName: e.name, distance: game.runDistance, note: u.key });
      meta.upgrades[u.key] = lvl + 1;
      saveMeta(meta);
      applyMetaUpgrades();
      advanceEpoch();
    });
    wrap.appendChild(card);
  }
  setState('upgrade');
}

export function advanceEpoch() {
  const next = game.epochIndex + 1;
  if (next >= EPOCHS.length) { triggerWitness(); return; }
  setEpoch(next);
  setState('run');
}

// Wire callbacks the witness module needs without creating a circular import
witnessHooks.refreshTitleStats = () => refreshTitleStats();
witnessHooks.setStateTitle = () => setState('title');

function setLineEvent(text: string, time = 1.0) {
  game.lineEventText = text;
  game.lineEventTime = time;
}

function activateSpeedPad(pos: THREE.Vector3) {
  const duration = 1.45;
  game.padBoostTime = duration;
  game.padBoostTotal = duration;
  photon.boost = Math.min(BOOST_MAX, photon.boost + 18);
  photon.energy = Math.min(photon.maxEnergy(), photon.energy + 5);
  game.runEnergy += 8;
  funLab.record('speed-pad-hit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, value: game.padBoostTime });
  meta.speedPadsHit = (meta.speedPadsHit || 0) + 1;
  saveMeta(meta);
  checkMemoryTriggers();
  setLineEvent('SPEED PAD', 1.0);
  audio.speedPad();
  particleManager.emitBurst(pos, 'pickup', 28, new THREE.Color(0xff7ad9));
}

function threadRacingGate(pos: THREE.Vector3) {
  game.lineStreak = (game.lineStreak || 0) + 1;
  funLab.record('gate-hit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, streak: game.lineStreak });
  game.bestLineStreakThisRun = Math.max(game.bestLineStreakThisRun || 0, game.lineStreak);
  meta.gatesThreaded = (meta.gatesThreaded || 0) + 1;
  if (game.lineStreak > (meta.bestLineStreak || 0)) meta.bestLineStreak = game.lineStreak;
  saveMeta(meta);
  checkMemoryTriggers();

  const reward = Math.min(18, 5 + game.lineStreak * 1.5);
  photon.boost = Math.min(BOOST_MAX, photon.boost + reward);
  photon.energy = Math.min(photon.maxEnergy(), photon.energy + 3);
  game.runEnergy += reward;
  setLineEvent(`LINE ×${game.lineStreak}`, 1.1);
  audio.lineGate(game.lineStreak);
  particleManager.emitBurst(pos, 'phase', 22, new THREE.Color(game.lineStreak >= 5 ? 0xff7ad9 : 0x88e0ff));
}

function missRacingGate() {
  if ((game.lineStreak || 0) > 0) setLineEvent('LINE LOST', 0.85);
  funLab.record('gate-miss', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, streak: game.lineStreak });
  if ((game.lineStreak || 0) > 0) funLab.record('line-break', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, streak: game.lineStreak });
  game.lineStreak = 0;
}

// ============================================================================
// MAIN LOOP
// ============================================================================
let last = performance.now();
function loop() {
  const now = performance.now();
  let realDt = (now - last) / 1000;
  if (realDt > 0.05) realDt = 0.05;
  last = now;

  if (game.hitStopTime > 0) {
    game.hitStopTime -= realDt;
    if (game.hitStopTime <= 0) game.timeScale = 1;
  }
  const dt = realDt * game.timeScale;

  skyMat.uniforms.uTime.value += realDt;
  lensingPass.uniforms.uTime.value += realDt;
  stars.rotation.y += realDt * 0.003;

  if (game.state === 'run' && !game.dying && Math.random() < 0.05) {
    const foamD = photon.distance + 35 + Math.random() * 160;
    const p = track.pointAt(foamD);
    const off = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 6);
    particleManager.emitBurst(p.clone().add(off), 'foam', 3 + Math.floor(Math.random() * 4), new THREE.Color(0x99ddff));
  }

  particleManager.update(realDt);
  echoSystem.update(realDt);

  if (game.state === 'pause') {
    composer.render();
    drawHud();
    requestAnimationFrame(loop);
    return;
  }

  if (game.state === 'run') {
    if (game.dying) {
      game.dyingTime += realDt;
      const t = Math.min(1, game.dyingTime / game.dyingTotal);
      const ease = t * t;
      const s = Math.max(0, 1 - ease * 1.3);
      photon.group.scale.setScalar(s);
      (photon.trail.material as THREE.LineBasicMaterial).opacity = Math.max(0, 0.85 - ease);
      lensingPass.uniforms.uVignettePower.value = 1 + ease * 5;
      (lensingPass.uniforms.uVignetteColor.value as THREE.Vector3).set(0.55 * ease, 0.06 * ease, 0.10 * ease);
      camera.position.y += realDt * 1.6;
      camera.fov += realDt * 5;
      camera.updateProjectionMatrix();
      if (game.dyingTime >= game.dyingTotal) finalizeDeath();
    } else {
      if (game.padBoostTime > 0) game.padBoostTime = Math.max(0, game.padBoostTime - dt);
      if (game.lineEventTime > 0) game.lineEventTime = Math.max(0, game.lineEventTime - realDt);
      if (game.railScrapeTime > 0) game.railScrapeTime = Math.max(0, game.railScrapeTime - realDt);
      if (game.railScrapeCooldown > 0) game.railScrapeCooldown = Math.max(0, game.railScrapeCooldown - realDt);
      const photonSegIdx = Math.floor(photon.distance / SEGMENT_LEN);
      track.ensureAhead(photonSegIdx);
      const e = EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)];
      hazards.ensureAhead(e, photon.distance);
      racingLine.ensureAhead(e, photon.distance);
      const speed = photon.update(dt, input, e, game.variant);
      game._speed = speed;
      audio.updateEngine(speed / BASE_SPEED, photon.boosting);
      // SPATIAL: keep the Web Audio listener glued to the photon for accurate Panner cues
      audio.setListenerPosition(photon.group.position);
      track.updateRings(photon.distance);
      track.updateDust(photon.distance);
      hazards.update(dt, photon.distance, photon.lateral, photon.vertical, photon.wavelength,
        (dmg) => photon.hit(dmg),
        (amt) => {
          const mult = comboMultiplier(game.phaseStreak || 0);
          const total = amt * mult;
          photon.collect(total);
          game.runEnergy += total;
        },
        e
      );
      racingLine.update(
        dt,
        photon.distance,
        photon.lateral,
        photon.vertical,
        activateSpeedPad,
        threadRacingGate,
        missRacingGate,
      );
      game.epochTimer += dt;
      game.runDistance = photon.distance;
      if (e.isHeatDeath) heatDeathTick(dt, photon.distance);
      if (e.isHeatDeath || e.name === 'Black Hole') {
        game.coherenceTime = (game.coherenceTime || 0) + dt;
        const threshold = game.cosmicConstants.coherenceThreshold;
        if (game.coherenceTime > threshold) {
          const ramp = Math.min(3, 1 + (game.coherenceTime - threshold) / 8);
          photon.energy = Math.max(0, photon.energy - ramp * dt);
          if (photon.energy <= 0) photon.alive = false;
        }
      } else {
        game.coherenceTime = 0;
      }
      // Tutorial step machine
      if (game.tutorialActive && game.tutorialStep < TUTORIAL_STEPS.length) {
        game.tutorialTime += realDt;
        const currentTutorial = TUTORIAL_STEPS[game.tutorialStep];
        const step = currentTutorial.needs;
        const max = currentTutorial.max;
        let demonstrated = false;
        const inputting = input.left || input.right || input.up || input.down;
        if (step === 'steer' && (inputting || Math.abs(photon.lateralVel) > 8)) demonstrated = true;
        if (step === 'shift' && game._shiftedThisRun) demonstrated = true;
        if (step === 'phase' && game.phaseCount > 0) demonstrated = true;
        if (step === 'boost' && (input.boost || photon.boost < BOOST_MAX - 5)) demonstrated = true;
        if (step === 'line' && ((game.lineStreak || 0) > 0 || game.padBoostTime > 0)) demonstrated = true;
        if (demonstrated || game.tutorialTime >= max) {
          game.tutorialStep++;
          game.tutorialTime = 0;
          if (game.tutorialStep >= TUTORIAL_STEPS.length) {
            game.tutorialActive = false;
            meta.tutorialDone = true; saveMeta(meta);
          }
        }
      }
      if (game.epochTimer >= e.duration && !game.epochCleared && !e.isHeatDeath && !game.witnessing) epochCleared();
      if (!photon.alive && !game.witnessing) beginDeath();
      updateCamera(dt, realDt, speed);
    }
  } else {
    if (track.points.length === 0) {
      track.ensureAhead(0);
      track.updateRings(0);
    }
    game._idleZ = (game._idleZ || 0) + realDt * 18;
    track.ensureAhead(Math.floor(game._idleZ / SEGMENT_LEN));
    const p = track.pointAt(game._idleZ);
    const frame = track.frameAt(game._idleZ);
    camera.position.copy(p).addScaledVector(frame.up, 2);
    const lookP = track.pointAt(game._idleZ + 14);
    camera.lookAt(lookP);
    track.updateRings(game._idleZ);
    track.updateDust(game._idleZ);
    lensingPass.uniforms.uVignettePower.value = 1;
    (lensingPass.uniforms.uVignetteColor.value as THREE.Vector3).set(0, 0, 0);
  }

  composer.render();
  drawHud();
  requestAnimationFrame(loop);
}

function updateCamera(_dt: number, realDt: number, currentSpeed: number) {
  const behind = 8.5;
  const upOffset = 2.4;
  const lookAhead = 14;
  const p = track.pointAt(photon.distance - behind);
  const frame = track.frameAt(photon.distance - behind);
  const target = new THREE.Vector3()
    .copy(p)
    .addScaledVector(frame.right, photon.lateral * 0.42)
    .addScaledVector(frame.up, photon.vertical * 0.50 + upOffset);
  camera.position.lerp(target, Math.min(1, realDt * 5.8));
  const look = track.pointAt(photon.distance + lookAhead);
  const lookFrame = track.frameAt(photon.distance + lookAhead);
  const lookPoint = new THREE.Vector3()
    .copy(look)
    .addScaledVector(lookFrame.right, photon.lateral * 0.26)
    .addScaledVector(lookFrame.up, photon.vertical * 0.30);
  camera.lookAt(lookPoint);
  const fovTarget = (settings.fov || 72) + (photon.boosting ? 9 : 0) + Math.max(0, currentSpeed - BASE_SPEED) * 0.03;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, realDt * 8);
  camera.updateProjectionMatrix();
  const motionMul = settings.reducedMotion ? 0 : 1;
  lensingPass.uniforms.uIntensity.value = (0.0014 + (photon.boosting ? 0.0020 : 0)) * motionMul;
  lensingPass.uniforms.uBarrel.value    = (0.020 + (photon.boosting ? 0.060 : 0))  * motionMul;
  if (game.trauma > 0 && !settings.reducedMotion) {
    const t2 = game.trauma * game.trauma;
    const time = performance.now() * 0.06;
    const amp = 0.85 * t2;
    camera.position.x += (Math.sin(time * 1.7) + Math.sin(time * 2.4)) * 0.5 * amp;
    camera.position.y += (Math.cos(time * 1.4) + Math.sin(time * 1.9)) * 0.5 * amp;
    camera.rotation.z += Math.sin(time * 2.1) * amp * 0.04;
  }
  if (game.trauma > 0) game.trauma = Math.max(0, game.trauma - realDt * 1.7);
}

export function startLoop() { last = performance.now(); requestAnimationFrame(loop); }
