import * as THREE from 'three';
import { EPOCHS, WAVELENGTHS, CODEX_ENTRIES, UPGRADES, VARIANTS, MEMORIES, TUTORIAL_STEPS, type Epoch } from './cosmology';
import { BASE_SPEED, BOOST_MAX, IS_MOBILE, SEGMENT_LEN } from './constants';
import { game, type GameStateName } from './state';
import { meta, saveMeta, saveCheckpoint, clearCheckpoint, type Checkpoint } from './meta';
import { settings, applySettings } from './settings';
import { newSeed, setRunSeed, computeEpochParams, computeCosmicConstants, seedToLabel, parseSeedLabel } from './seed';
import { audio } from './audio';
import { flowTarget, stepFlow } from './flow';
import { scene, camera, composer, lensingPass, skyMat, stars, starMat, parallaxStarMat, starShells, nebulaDust, nebulaDustMat, cosmicWeb, cosmicWebMat, bloom } from './scene';
import { getActiveRenderProfile, renderPixelRatio } from './renderProfile';
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

const FOAM_COLOR = new THREE.Color(0x99ddff);
const BACKGROUND_COLOR = new THREE.Color();
const DEATH_CORE_COLOR = new THREE.Color(0xff5566);
const SPEED_PAD_COLOR = new THREE.Color(0xff7ad9);
const LINE_GATE_COLOR = new THREE.Color(0x88e0ff);
const LINE_GATE_HOT_COLOR = new THREE.Color(0xff7ad9);
const foamPoint = new THREE.Vector3();
const foamOffset = new THREE.Vector3();
const deathPoint = new THREE.Vector3();
const idlePoint = new THREE.Vector3();
const idleFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
const idleLookPoint = new THREE.Vector3();
const cameraPoint = new THREE.Vector3();
const cameraFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
const cameraTarget = new THREE.Vector3();
const cameraLookBase = new THREE.Vector3();
const cameraLookFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
const cameraLookPoint = new THREE.Vector3();
const lensProjectPoint = new THREE.Vector3();
const MAX_ACTIVE_HAZARD_LENSES = 4;
const HAZARD_LENS_BACK_DISTANCE = 22;
const HAZARD_LENS_FORWARD_DISTANCE = 132;
const GRAVITY_LENSING_ENABLED = false;

interface HazardLensCandidate {
  score: number;
  x: number;
  y: number;
  strength: number;
  radius: number;
}

const hazardLensCandidates: HazardLensCandidate[] = [];
type UpgradeOption = (typeof UPGRADES)[number];

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
    startSeededRun?: (seed: number | string) => string;
  }
}

export function setState(s: GameStateName) {
  const prev = game.state;
  game.state = s;
  document.body.dataset.state = s;
  for (const id of ['title', 'run', 'upgrade', 'death', 'codex', 'pause', 'memories', 'form'] as const) {
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
  if ((meta.darkMatterDetections || 0) >= 1) ensure('xray');
}

function clearRunFieldForHeatDeath() {
  hazards.reset(photon.distance);
  racingLine.reset(photon.distance);
  game.padBoostTime = 0;
  game.padBoostTotal = 0;
  game.lineStreak = 0;
  game.lineEventText = '';
  game.lineEventTime = 0;
  game.railScrapeTime = 0;
  game.railScrapeCooldown = 0;
  game.gravityShear = 0;
  game.gravityShearX = 0;
  game.gravityShearY = 0;
  game.nextRacingCue = null;
  game.darkMatterSignal = 0;
  game.darkMatterSignalTime = 0;
  game.darkMatterMassSolar = 0;
  game.darkMatterDeflectionArcsec = 0;
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
  setSkyRedshift(baseRedshiftForEpoch(idx));
  skyMat.uniforms.uMix.value = 0.6;
  starMat.uniforms.uOpacity.value = 0.9;
  parallaxStarMat.uniforms.uOpacity.value = 0.68;
  nebulaDustMat.uniforms.uOpacity.value = e.isHeatDeath ? 0.06 : 0.18 + getActiveRenderProfile().skyDetail * 0.08;
  cosmicWebMat.color.copy(e.palettePoint).lerp(e.paletteB, 0.28);
  cosmicWebMat.opacity = e.isHeatDeath ? 0.035 : 0.10 + Math.min(0.05, idx * 0.006);
  scene.fog!.color.copy(e.fogColor);
  (scene.fog as THREE.Fog).near = e.fogNear; (scene.fog as THREE.Fog).far = e.fogFar;
  scene.background = BACKGROUND_COLOR.copy(e.fogColor).multiplyScalar(0.4);
  track.setEpoch(e);
  if (e.isHeatDeath) {
    clearRunFieldForHeatDeath();
    audio.startHeatDeath();
    game.heatDeathFade = 0;
    game.heatDeathFinalSpawned = false;
  } else {
    audio.startDrone(e);
  }
  // Cinematic epoch riser plays only on transitions (not the first epoch / not on resume's first epoch)
  if (isTransition) audio.epochRiser();
  maybeUnlockCodex(e.codexKey, CODEX_ENTRIES);
  if (e.isHeatDeath || idx >= 7) maybeUnlockCodex('DARKENERGY', CODEX_ENTRIES);
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
  const inFlow = (game.flowPeak || 0) >= 0.85;
  if (inFlow) {
    if (e.isHeatDeath) return 'You did not stop. You became the background, and the background kept going.';
    if (e.name === 'Black Hole') return 'You folded yourself into the curve so well the curve kept you.';
    return 'You were so much in the moving that matter mistook you for itself.';
  }
  if (e.isHeatDeath) return 'Nothing stops you. That is the wound.';
  if (e.name === 'Black Hole') return 'You are gathered, folded, and made difficult to remember.';
  if (e.name === 'Stellar') return 'An eye catches you. For one instant, you are seen.';
  if (e.name === 'First Stars') return 'A young star takes your motion and spends it as heat.';
  if (e.name === 'Recombination') return 'The fog opens without you. The next photon keeps the route.';
  if (e.name === 'Quark Plasma') return 'You are made and stopped in the same instant.';
  return 'You enter matter and do not come out.';
}

function baseRedshiftForEpoch(idx: number) {
  return Math.min(0.20, idx * 0.022);
}

function setSkyRedshift(amount: number) {
  game.redshiftAmount = THREE.MathUtils.clamp(amount, 0, 1);
  skyMat.uniforms.uRedshift.value = game.redshiftAmount;
  audio.setRedshift(game.redshiftAmount);
}

function updateLateEpochRedshift(dt: number, e: Epoch) {
  const base = baseRedshiftForEpoch(game.epochIndex);
  const progress = THREE.MathUtils.clamp(game.epochTimer / Math.max(1, e.duration), 0, 1);
  const age = progress * progress * (3 - 2 * progress);
  const target = e.isHeatDeath
    ? Math.min(0.96, base + age * 0.74)
    : Math.min(0.54, base + age * 0.34);
  const blend = Math.min(1, dt * 1.8);
  setSkyRedshift(game.redshiftAmount + (target - game.redshiftAmount) * blend);
}

function blackHoleTick(dt: number, e: Epoch) {
  updateLateEpochRedshift(dt, e);
}

function heatDeathTick(dt: number, photonDist: number) {
  const e = EPOCHS[game.epochIndex];
  const t = game.epochTimer;
  const total = e.duration;
  updateLateEpochRedshift(dt, e);
  const visFade = THREE.MathUtils.clamp(1 - (t / 90), 0.05, 1);
  game.heatDeathFade = 1 - visFade;
  if (stars && stars.material) {
    starMat.uniforms.uOpacity.value = 0.9 * visFade;
    parallaxStarMat.uniforms.uOpacity.value = 0.68 * visFade;
    nebulaDustMat.uniforms.uOpacity.value = (0.14 + getActiveRenderProfile().skyDetail * 0.06) * visFade;
  }
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
  audio.suspend();
  if (!meta.pausedOnce) { meta.pausedOnce = true; saveMeta(meta); checkMemoryTriggers(); }
}
export function resume() {
  if (game.state !== 'pause') return;
  setState('run');
  audio.resume();
  last = performance.now();
}

export function startRun(resumeSnapshot?: Checkpoint, overrideSeed?: number) {
  input.left = input.right = input.up = input.down = input.boost = false;
  input.touchTracking = false;
  input.touchTargetLateral = 0;
  input.touchTargetVertical = 0;
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
  game.witnessing = false;
  game.heatDeathFade = 0;
  game.redshiftAmount = 0;
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
  game.gravityShear = 0;
  game.gravityShearX = 0;
  game.gravityShearY = 0;
  game.nextRacingCue = null;
  game.darkMatterSignal = 0;
  game.darkMatterSignalTime = 0;
  game.darkMatterMassSolar = 0;
  game.darkMatterDeflectionArcsec = 0;
  game._anyEpochSetThisRun = false;
  game.runDistance = 0;
  game.runEnergy = (resumeSnapshot && resumeSnapshot.runEnergy) || 0;
  game.startTime = performance.now() - ((resumeSnapshot && resumeSnapshot.startTimeOffset) || 0);
  game.phaseCount = 0;
  game.hitCount = 0;
  game.flowLevel = 0;
  game.flowPeak = 0;
  game.flowPeakDwell = 0;
  game.cleanRunTime = 0;
  game.timeSincePhase = 0;
  game._shiftedThisRun = false;
  if (!resumeSnapshot && (!meta.tutorialDone || meta.totalRuns < 2)) {
    game.tutorialActive = true; game.tutorialStep = 0; game.tutorialTime = 0;
  } else { game.tutorialActive = false; }
  game.trauma = 0; game.timeScale = 1; game.hitStopTime = 0; game.dying = false;
  game.manualEndRequested = false;
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
  deathPoint.copy(photon.group.position);
  particleManager.emitBurst(deathPoint, 'death', 90, DEATH_CORE_COLOR);
  particleManager.emitBurst(deathPoint, 'death', 50, WAVELENGTHS[photon.wavelength].color);
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
  const manualEnd = !!game.manualEndRequested;
  const endCause = manualEnd ? 'manual end run' : absorptionLineFor(e);
  funLab.finishRun(manualEnd ? 'quit' : 'death', {
    epochIndex: reachedIdx,
    epochName: e.name,
    distance: game.runDistance,
    cause: endCause,
    value: game.runEnergy,
  });
  game.lastRunWasPerfect = !!game.perfectEpochThisRun;
  // Cumulative flow dwell persists across runs and gates flow-themed memories.
  if ((game.flowPeakDwell || 0) > 0) meta.flowDwellLifetime = (meta.flowDwellLifetime || 0) + game.flowPeakDwell;
  checkMemoryTriggers();
  if (reachedIdx > meta.bestEpoch) meta.bestEpoch = reachedIdx;
  if (game.runDistance > meta.bestDistance) meta.bestDistance = game.runDistance;
  meta.totalEnergy += Math.floor(game.runEnergy);
  saveMeta(meta);
  document.getElementById('death-where')!.textContent = `${e.name} — ${e.subtitle}`;
  document.getElementById('death-line')!.textContent = manualEnd
    ? 'You release this run before the universe spends the rest of you.'
    : absorptionLineFor(e);
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
}

export function epochCleared() {
  game.epochCleared = true;
  funLab.record('epoch-exit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance });
  audio.stopDrone();
  if (game.perfectEpochThisRun) checkMemoryTriggers();
  game.perfectEpochThisRun = true;
  const pool = UPGRADES.filter(u => (meta.upgrades[u.key] || 0) < u.max);
  const shuffled = pickUpgradeOptions(pool, 3);
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

function pickUpgradeOptions(pool: UpgradeOption[], count: number) {
  const options = pool.slice();
  const take = Math.min(count, options.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (options.length - i));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.slice(0, take);
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
  const duration = 1.65;
  game.padBoostTime = duration;
  game.padBoostTotal = duration;
  photon.boost = Math.min(BOOST_MAX, photon.boost + 24);
  photon.energy = Math.min(photon.maxEnergy(), photon.energy + 6);
  game.runEnergy += 10;
  funLab.record('speed-pad-hit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, value: game.padBoostTime });
  meta.speedPadsHit = (meta.speedPadsHit || 0) + 1;
  saveMeta(meta);
  checkMemoryTriggers();
  setLineEvent('SPEED PAD', 1.15);
  audio.speedPad();
  particleManager.emitBurst(pos, 'pickup', 34, SPEED_PAD_COLOR);
}

function threadRacingGate(pos: THREE.Vector3) {
  game.lineStreak = (game.lineStreak || 0) + 1;
  funLab.record('gate-hit', { epochIndex: game.epochIndex, epochName: EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)].name, distance: game.runDistance, streak: game.lineStreak });
  game.bestLineStreakThisRun = Math.max(game.bestLineStreakThisRun || 0, game.lineStreak);
  meta.gatesThreaded = (meta.gatesThreaded || 0) + 1;
  if (game.lineStreak > (meta.bestLineStreak || 0)) meta.bestLineStreak = game.lineStreak;
  saveMeta(meta);
  checkMemoryTriggers();

  const reward = Math.min(20, 6 + game.lineStreak * 1.6);
  photon.boost = Math.min(BOOST_MAX, photon.boost + reward);
  photon.energy = Math.min(photon.maxEnergy(), photon.energy + 4);
  game.runEnergy += reward;
  setLineEvent(`LINE ×${game.lineStreak}`, 1.2);
  audio.lineGate(game.lineStreak);
  particleManager.emitBurst(pos, 'phase', 26, game.lineStreak >= 5 ? LINE_GATE_HOT_COLOR : LINE_GATE_COLOR);
}

function missRacingGate() {
  if ((game.lineStreak || 0) > 0) {
    setLineEvent('LINE LOST', 0.85);
    audio.gateMiss();
  }
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
  stepFrame(realDt, true);
}

function stepFrame(realDt: number, scheduleNext: boolean) {
  if (game.hitStopTime > 0) {
    game.hitStopTime -= realDt;
    if (game.hitStopTime <= 0) game.timeScale = 1;
  }
  const dt = realDt * game.timeScale;

  skyMat.uniforms.uTime.value += realDt;
  starMat.uniforms.uTime.value += realDt;
  parallaxStarMat.uniforms.uTime.value += realDt;
  nebulaDustMat.uniforms.uTime.value += realDt;
  const visualSpeed = game.state === 'run'
    ? THREE.MathUtils.clamp(((game._speed || BASE_SPEED) - BASE_SPEED) / BASE_SPEED, 0, 1.8)
    : 0;
  starMat.uniforms.uSpeed.value += (visualSpeed - starMat.uniforms.uSpeed.value) * Math.min(1, realDt * 3.2);
  parallaxStarMat.uniforms.uSpeed.value += (visualSpeed * 1.45 - parallaxStarMat.uniforms.uSpeed.value) * Math.min(1, realDt * 3.2);
  lensingPass.uniforms.uTime.value += realDt;
  for (let i = 0; i < starShells.length; i++) {
    starShells[i].rotation.y += realDt * (i === 0 ? 0.003 : 0.0075);
    starShells[i].rotation.x += realDt * (i === 0 ? 0.0004 : -0.0011);
  }
  nebulaDust.rotation.y += realDt * 0.0012;
  nebulaDust.rotation.z += realDt * 0.00045;
  cosmicWeb.rotation.y += realDt * 0.0018;
  cosmicWeb.rotation.x += realDt * 0.0007;

  if (game.state === 'run' && !game.dying && Math.random() < (IS_MOBILE ? 0.028 : 0.05)) {
    const foamD = photon.distance + 35 + Math.random() * 160;
    const p = track.pointAt(foamD, foamPoint);
    foamOffset.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 6);
    particleManager.emitBurst(p.add(foamOffset), 'foam', 3 + Math.floor(Math.random() * 4), FOAM_COLOR);
  }

  particleManager.update(realDt);
  echoSystem.update(realDt);

  if (game.state === 'pause') {
    composer.render();
    drawHud();
    if (scheduleNext) requestAnimationFrame(loop);
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
      if (game.darkMatterSignalTime > 0) game.darkMatterSignalTime = Math.max(0, game.darkMatterSignalTime - realDt);
      if (game.darkMatterSignalTime <= 0) game.darkMatterSignal = Math.max(0, (game.darkMatterSignal || 0) - realDt * 1.4);
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
      // Flow signal: streak × clean-dwell (gated by recent engagement) × activity.
      // Smoothed so a single hit's streak reset doesn't snap the meter to zero.
      // See src/flow.ts for the pure compute (covered by flow.test.ts).
      game.cleanRunTime = (game.cleanRunTime || 0) + dt;
      game.timeSincePhase = (game.timeSincePhase || 0) + dt;
      const target = flowTarget({
        phaseStreak: game.phaseStreak || 0,
        cleanRunTime: game.cleanRunTime,
        timeSincePhase: game.timeSincePhase,
        energyRatio: photon.energy / Math.max(1, photon.maxEnergy()),
        boosting: photon.boosting,
      });
      game.flowLevel = stepFlow(game.flowLevel, target, dt);
      if (game.flowLevel > game.flowPeak) game.flowPeak = game.flowLevel;
      if (game.flowLevel >= 0.85) game.flowPeakDwell += dt;
      audio.setFlow(game.flowLevel);
      if (e.isHeatDeath) heatDeathTick(dt, photon.distance);
      else if (e.name === 'Black Hole') blackHoleTick(dt, e);
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
        const inputting = input.left || input.right || input.up || input.down || input.touchTracking;
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
    const p = track.pointAt(game._idleZ, idlePoint);
    const frame = track.frameAt(game._idleZ, idleFrame);
    camera.position.copy(p).addScaledVector(frame.up, 2);
    const lookP = track.pointAt(game._idleZ + 14, idleLookPoint);
    camera.lookAt(lookP);
    track.updateRings(game._idleZ);
    track.updateDust(game._idleZ);
    lensingPass.uniforms.uVignettePower.value = 1;
    (lensingPass.uniforms.uVignetteColor.value as THREE.Vector3).set(0, 0, 0);
    updateHazardLensing(0);
  }

  composer.render();
  drawHud();
  if (scheduleNext) requestAnimationFrame(loop);
}

function updateCamera(_dt: number, realDt: number, currentSpeed: number) {
  const behind = 8.5;
  const upOffset = 2.4;
  const lookAhead = 14;
  const p = track.pointAt(photon.distance - behind, cameraPoint);
  const frame = track.frameAt(photon.distance - behind, cameraFrame);
  const target = cameraTarget.copy(p)
    .addScaledVector(frame.right, photon.lateral * 0.42)
    .addScaledVector(frame.up, photon.vertical * 0.50 + upOffset);
  camera.position.lerp(target, Math.min(1, realDt * 5.8));
  const look = track.pointAt(photon.distance + lookAhead, cameraLookBase);
  const lookFrame = track.frameAt(photon.distance + lookAhead, cameraLookFrame);
  const lookPoint = cameraLookPoint.copy(look)
    .addScaledVector(lookFrame.right, photon.lateral * 0.26)
    .addScaledVector(lookFrame.up, photon.vertical * 0.30);
  camera.lookAt(lookPoint);
  const speedFactor = Math.max(0, (currentSpeed - BASE_SPEED) / BASE_SPEED);
  // Flow breathe: subliminal fov dilation (±0.4°) when in the zone.
  const flowFovBreathe = ((game.flowLevel || 0) - 0.5) * 0.8;
  const fovTarget = (settings.fov || 72) + (photon.boosting ? 9 : 0) + Math.max(0, currentSpeed - BASE_SPEED) * 0.03 + flowFovBreathe;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, realDt * 8);
  camera.updateProjectionMatrix();
  const renderProfile = getActiveRenderProfile();
  // Gravity lensing disabled — was overwhelming gameplay. Re-enable by
  // flipping GRAVITY_LENSING_ENABLED and restoring nonzero shader defaults / profile multipliers.
  const lensMul = GRAVITY_LENSING_ENABLED ? renderProfile.lensingMul : 0;
  lensingPass.uniforms.uIntensity.value = 0;
  lensingPass.uniforms.uBarrel.value    = 0;
  lensingPass.uniforms.uGlow.value = (0.13 + Math.min(0.08, speedFactor * 0.035) + (photon.boosting ? 0.04 : 0)) * renderProfile.glowMul;
  updateHazardLensing(lensMul);
  const bloomTarget = renderProfile.bloomBase
    + Math.min(0.16, speedFactor * renderProfile.bloomSpeedAdd)
    + (photon.boosting ? renderProfile.bloomBoostAdd : 0)
    + game.trauma * (IS_MOBILE ? 0.04 : 0.07);
  const bloomRadiusTarget = renderProfile.bloomRadius
    + Math.min(IS_MOBILE ? 0.09 : 0.14, speedFactor * (IS_MOBILE ? 0.05 : 0.08))
    + (photon.boosting ? (IS_MOBILE ? 0.04 : 0.07) : 0);
  bloom.strength += (bloomTarget - bloom.strength) * Math.min(1, realDt * 3.5);
  bloom.radius += (bloomRadiusTarget - bloom.radius) * Math.min(1, realDt * 2.8);
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

function updateHazardLensing(visualMul: number) {
  const lensUniforms = lensingPass.uniforms;
  const lensData = lensUniforms.uLenses.value as THREE.Vector4[];
  if (!GRAVITY_LENSING_ENABLED || visualMul <= 0 || game.state !== 'run') {
    lensUniforms.uLensCount.value = 0;
    for (const lens of lensData) lens.set(0.5, 0.5, 0, 0);
    return;
  }

  camera.updateMatrixWorld();
  lensUniforms.uAspect.value = camera.aspect;

  hazardLensCandidates.length = 0;
  const epoch = EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)];
  const epochLensMul = epoch.isHeatDeath ? 2.2 : epoch.name === 'Black Hole' ? 1.6 : 1;

  for (const hazard of hazards.list) {
    if (hazard.hit || (hazard.type !== 'well' && hazard.type !== 'eventHorizon')) continue;
    const dz = hazard.dist - photon.distance;
    if (dz < -HAZARD_LENS_BACK_DISTANCE || dz > HAZARD_LENS_FORWARD_DISTANCE) continue;

    lensProjectPoint.copy(hazard.mesh.position).project(camera);
    if (lensProjectPoint.z < -1 || lensProjectPoint.z > 1) continue;
    if (Math.abs(lensProjectPoint.x) > 1.16 || Math.abs(lensProjectPoint.y) > 1.16) continue;

    const screenX = lensProjectPoint.x * 0.5 + 0.5;
    const screenY = 0.5 - lensProjectPoint.y * 0.5;
    const depthProximity = 1 - THREE.MathUtils.clamp(Math.max(0, dz) / HAZARD_LENS_FORWARD_DISTANCE, 0, 1);
    const edgeFade = 1 - THREE.MathUtils.clamp(Math.max(Math.abs(lensProjectPoint.x), Math.abs(lensProjectPoint.y)) - 0.82, 0, 0.34) / 0.34;
    const baseStrength = hazard.type === 'eventHorizon' ? 0.009 : 0.0035;
    const strength = baseStrength * (0.58 + depthProximity * 0.42) * edgeFade * epochLensMul * visualMul;
    const radius = THREE.MathUtils.clamp(
      (hazard.type === 'eventHorizon' ? 0.35 : 0.25) + depthProximity * (hazard.type === 'eventHorizon' ? 0.12 : 0.09),
      hazard.type === 'eventHorizon' ? 0.30 : 0.20,
      hazard.type === 'eventHorizon' ? 0.52 : 0.40,
    );
    const score = strength * (hazard.type === 'eventHorizon' ? 1.45 : 1) * (0.72 + depthProximity * 0.46);

    hazardLensCandidates.push({ score, x: screenX, y: screenY, strength, radius });
  }

  hazardLensCandidates.sort((a, b) => b.score - a.score);
  const count = Math.min(MAX_ACTIVE_HAZARD_LENSES, hazardLensCandidates.length, lensData.length);
  lensUniforms.uLensCount.value = count;
  for (let i = 0; i < lensData.length; i++) {
    const lens = hazardLensCandidates[i];
    if (i < count && lens) lensData[i].set(lens.x, lens.y, lens.strength, lens.radius);
    else lensData[i].set(0.5, 0.5, 0, 0);
  }
}

export function startLoop() { last = performance.now(); requestAnimationFrame(loop); }

export function advanceTime(ms: number) {
  const steps = Math.max(1, Math.min(600, Math.round(ms / (1000 / 60))));
  for (let i = 0; i < steps; i++) stepFrame(1 / 60, false);
  return renderGameToText();
}

export function startSeededRun(seed: number | string) {
  const parsed = typeof seed === 'number' ? seed >>> 0 : parseSeedLabel(seed);
  if (parsed == null) throw new Error(`Invalid seed: ${seed}`);
  clearCheckpoint();
  startRun(undefined, parsed);
  return renderGameToText();
}

export function renderGameToText() {
  const epoch = EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)];
  const nearHazards = hazards.list
    .filter((h) => !h.hit && h.dist >= photon.distance - 8 && h.dist <= photon.distance + 130)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8)
    .map((h) => ({
      type: h.type,
      dz: Math.round(h.dist - photon.distance),
      lateral: Math.round(h.lateral * 10) / 10,
      vertical: Math.round(h.vertical * 10) / 10,
      radius: h.hitRadius,
      wavelength: h.wlIdx,
    }));
  const racing = racingLine.list
    .filter((e) => !e.hit && !e.missed && e.dist >= photon.distance - 8 && e.dist <= photon.distance + 150)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8)
    .map((e) => ({
      kind: e.kind,
      dz: Math.round(e.dist - photon.distance),
      lateral: Math.round(e.lateral * 10) / 10,
      vertical: Math.round(e.vertical * 10) / 10,
      radius: e.radius,
    }));
  return JSON.stringify({
    coordinateSystem: 'track-relative: dz is units ahead of photon, lateral is right positive, vertical is up positive',
    state: game.state,
    epoch: { index: game.epochIndex, name: epoch.name, timer: Math.round(game.epochTimer * 10) / 10 },
    seed: { value: game.runSeed >>> 0, label: seedToLabel(game.runSeed) },
    photon: {
      distance: Math.round(photon.distance),
      lateral: Math.round(photon.lateral * 10) / 10,
      vertical: Math.round(photon.vertical * 10) / 10,
      wavelength: WAVELENGTHS[photon.wavelength]?.key,
      energy: Math.round(photon.energy),
      boost: Math.round(photon.boost),
      speed: Math.round(game._speed || 0),
      alive: photon.alive,
      boosting: photon.boosting,
    },
    run: {
      energy: Math.round(game.runEnergy),
      lineStreak: game.lineStreak || 0,
      phaseStreak: game.phaseStreak || 0,
      lineEvent: game.lineEventText || '',
      racingCue: game.nextRacingCue
        ? {
            kind: game.nextRacingCue.kind,
            dz: Math.round(game.nextRacingCue.dz),
            lateral: Math.round(game.nextRacingCue.lateral * 10) / 10,
            vertical: Math.round(game.nextRacingCue.vertical * 10) / 10,
            align: Math.round(game.nextRacingCue.align * 100) / 100,
          }
        : null,
      dying: game.dying,
      tutorialStep: game.tutorialActive ? game.tutorialStep : null,
    },
    audio: {
      mode: audio.mode,
      assetsReady: audio.assetsReady,
      engineActive: !!audio.engineNodes,
      droneActive: !!audio.studioMusicNodes,
    },
    science: {
      mode: game.scienceMode,
      redshift: Math.round(game.redshiftAmount * 1000) / 1000,
      darkMatterSignal: Math.round((game.darkMatterSignal || 0) * 1000) / 1000,
      darkMatterSignalTime: Math.round((game.darkMatterSignalTime || 0) * 10) / 10,
      darkMatterMassSolar: Math.round(game.darkMatterMassSolar || 0),
      darkMatterDeflectionArcsec: Math.round((game.darkMatterDeflectionArcsec || 0) * 100) / 100,
    },
    counts: {
      activeHazards: hazards.list.filter((h) => !h.hit).length,
      activeRacing: racingLine.list.filter((e) => !e.hit && !e.missed).length,
      activeEchoes: echoSystem.echoes.length,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      fullscreen: !!document.fullscreenElement,
      pixelRatio: window.devicePixelRatio || 1,
      renderPixelRatio: Math.round(renderPixelRatio() * 100) / 100,
      visualQuality: getActiveRenderProfile().quality,
    },
    inputs: { ...input },
    nearby: { hazards: nearHazards, racing },
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
window.startSeededRun = startSeededRun;
