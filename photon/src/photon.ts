import * as THREE from 'three';
import { BASE_SPEED, BOOST_MAX, BOOST_DRAIN, BOOST_RECHARGE, BOOST_MUL, ENERGY_MAX, EDGE_STRAIN_START, PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH } from './constants';
import { WAVELENGTHS, type Variant, type Epoch } from './cosmology';
import { scene } from './scene';
import { track } from './track';
import { game } from './state';
import { meta, saveMeta } from './meta';
import { audio } from './audio';
import { settings } from './settings';
import { checkMemoryTriggers } from './memories';
import { funLab } from './funlab/runtime';
import { particleManager } from './particles';

const interferenceLeft = new THREE.Vector3();
const interferenceRight = new THREE.Vector3();

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
  touchTracking?: boolean;
  touchTargetLateral?: number;
  touchTargetVertical?: number;
}

class Photon {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  corona: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  coronaMat: THREE.MeshBasicMaterial;
  trail: THREE.Line;
  trailLen = 64;
  trailHistory: THREE.Vector3[] = Array.from({ length: this.trailLen }, () => new THREE.Vector3());
  trailCursor = 0;
  trailCount = 0;
  private readonly trackPoint = new THREE.Vector3();
  private readonly lookPoint = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly lookOffset = new THREE.Vector3();
  private readonly trackFrame = {
    fwd: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  };

  distance = 0;
  lateral = 0;
  vertical = 0;
  lateralVel = 0;
  verticalVel = 0;
  wavelength = 1;
  boost = BOOST_MAX;
  boosting = false;
  energy = ENERGY_MAX;
  alive = true;
  invulnTimer = 0;
  phaseTimer = 0;
  phaseFlashTime = 0;
  shiftCooldown = 0;
  _currentRoll = 0;
  _variant: Variant | null = null;
  _funStrained = false;
  _funLastStrainAt = 0;

  // Bonuses applied by upgrades / memories
  speedBonus = 1;
  agilityBonus = 1;
  energyMaxBonus = 0;
  damageReduction = 0;
  boostRechargeBonus = 1;
  phaseWindowSec = 0;
  _firstChainFreePerRun = false;
  _firstChainFreeUsed = false;
  _memoryStartEnergyBonus = 0;
  _memoryStartBoostBonus = 0;

  constructor() {
    const coreGeo = new THREE.IcosahedronGeometry(0.9, 2);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xccd8e8 });
    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    const haloGeo = new THREE.SphereGeometry(1.8, 24, 16);
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0x88e0ff, transparent: true, opacity: 0.18, depthWrite: false });
    this.halo = new THREE.Mesh(haloGeo, this.haloMat);
    const coronaGeo = new THREE.SphereGeometry(2.55, 32, 18);
    this.coronaMat = new THREE.MeshBasicMaterial({
      color: 0x88e0ff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.corona = new THREE.Mesh(coronaGeo, this.coronaMat);
    this.group = new THREE.Group();
    this.group.add(this.corona); this.group.add(this.core); this.group.add(this.halo);
    scene.add(this.group);
    const trailGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.trailLen * 3);
    const colors = new Float32Array(this.trailLen * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.trail = new THREE.Line(trailGeo, trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);
  }

  reset(variant: Variant) {
    this.distance = 0; this.lateral = 0; this.vertical = 0;
    this.lateralVel = 0; this.verticalVel = 0;
    this.boost = BOOST_MAX; this.boosting = false;
    this.shiftCooldown = 0;
    this._variant = variant;
    this.energy = this.maxEnergy();
    this.alive = true; this.invulnTimer = 0; this.phaseTimer = 0;
    this.wavelength = variant.startWavelength;
    this.setColorFromWavelength(true);
    this.trailCursor = 0;
    this.trailCount = 0;
  }

  maxEnergy(): number {
    const m = (this._variant?.mods.energyMul) || 1;
    return Math.floor((ENERGY_MAX + this.energyMaxBonus) * m);
  }

  setColorFromWavelength(immediate = false) {
    const w = WAVELENGTHS[this.wavelength];
    if (immediate) { this.coreMat.color.copy(w.color); this.haloMat.color.copy(w.color); this.coronaMat.color.copy(w.color); }
    else { this.coreMat.color.lerp(w.color, 0.4); this.haloMat.color.lerp(w.color, 0.4); this.coronaMat.color.lerp(w.color, 0.4); }
  }

  shift(idx: number): boolean {
    if (idx === this.wavelength) return false;
    if (this.shiftCooldown > 0) return false;
    if (this.energy < 3) return false;
    this.wavelength = idx;
    this.setColorFromWavelength(true);
    this.phaseTimer = this.phaseWindowSec;
    this.energy = Math.max(0, this.energy - 3);
    this.shiftCooldown = 0.4;
    audio.shift(idx);
    game.coherenceTime = 0;
    return true;
  }

  update(dt: number, input: InputState, currentEpoch: Epoch, variant: Variant): number {
    const wasBoosting = this.boosting;
    const wasInvulnerable = this.invulnTimer > 0;
    const sens = settings.sensitivity || 1.0;
    // MULTIVERSE: cosmic constants apply per-run agility modulation
    const cosmicAgi = game.cosmicConstants.agilityMul;
    const lateralAcc = 180 * this.agilityBonus * sens * (variant.mods.agilityMul || 1) * cosmicAgi;
    const lateralMax = 52 * this.agilityBonus * Math.min(1.5, sens) * cosmicAgi;
    const verticalMax = 36 * this.agilityBonus * Math.min(1.5, sens) * cosmicAgi;
    const edgeX = PLAYFIELD_HALF_WIDTH;
    const edgeY = PLAYFIELD_HALF_HEIGHT;
    const hasTouchTarget = input.touchTracking
      && Number.isFinite(input.touchTargetLateral)
      && Number.isFinite(input.touchTargetVertical);
    let ax = 0, ay = 0;
    if (!hasTouchTarget) {
      if (input.left)  ax -= lateralAcc;
      if (input.right) ax += lateralAcc;
      if (input.up)    ay += lateralAcc * 0.85;
      if (input.down)  ay -= lateralAcc * 0.85;
    }
    const shear = game.gravityShear || 0;
    if (shear > 0) {
      ax += (game.gravityShearX || 0) * 118;
      ay += (game.gravityShearY || 0) * 106;
      this.boost = Math.max(0, this.boost - 2.2 * shear * dt);
      this.energy = Math.max(0, this.energy - 0.7 * shear * dt);
    }
    game.gravityShear = 0;
    game.gravityShearX = 0;
    game.gravityShearY = 0;
    this.lateralVel += ax * dt;
    this.verticalVel += ay * dt;
    if (hasTouchTarget) {
      const targetLateral = THREE.MathUtils.clamp(input.touchTargetLateral!, -edgeX * 0.94, edgeX * 0.94);
      const targetVertical = THREE.MathUtils.clamp(input.touchTargetVertical!, -edgeY * 0.92, edgeY * 0.92);
      const desiredLateralVel = THREE.MathUtils.clamp((targetLateral - this.lateral) * 7.4, -lateralMax * 1.35, lateralMax * 1.35);
      const desiredVerticalVel = THREE.MathUtils.clamp((targetVertical - this.vertical) * 7.4, -verticalMax * 1.45, verticalMax * 1.45);
      const followBlend = Math.min(1, dt * (11 + sens * 4));
      this.lateralVel += (desiredLateralVel - this.lateralVel) * followBlend;
      this.verticalVel += (desiredVerticalVel - this.verticalVel) * followBlend;
    }
    if (!hasTouchTarget && !input.left && !input.right) this.lateralVel *= Math.pow(0.0008, dt);
    if (!hasTouchTarget && !input.up && !input.down)    this.verticalVel *= Math.pow(0.0015, dt);
    this.lateralVel = THREE.MathUtils.clamp(this.lateralVel, -lateralMax, lateralMax);
    this.verticalVel = THREE.MathUtils.clamp(this.verticalVel, -verticalMax, verticalMax);
    this.lateral += this.lateralVel * dt;
    this.vertical += this.verticalVel * dt;

    const xRatio = Math.abs(this.lateral) / edgeX;
    const yRatio = Math.abs(this.vertical) / edgeY;
    const xStrain = THREE.MathUtils.smoothstep(xRatio, EDGE_STRAIN_START, 1);
    const yStrain = THREE.MathUtils.smoothstep(yRatio, EDGE_STRAIN_START, 1);
    const edgeStrain = Math.max(xStrain, yStrain);
    game.fieldStrain = edgeStrain;
    game.fieldStrainX = this.lateral / edgeX;
    game.fieldStrainY = this.vertical / edgeY;
    if (edgeStrain > 0) {
      this.energy = Math.max(0, this.energy - (1.8 + game._speed * 0.004) * edgeStrain * dt);
      this.boost = Math.max(0, this.boost - 2.5 * edgeStrain * dt);
    }
    const now = performance.now();
    if (edgeStrain > 0.25 && !this._funStrained) {
      this._funStrained = true;
      funLab.record('field-strain-enter', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance, strain: edgeStrain });
    }
    if (edgeStrain > 0.72 && now - this._funLastStrainAt > 900) {
      this._funLastStrainAt = now;
      funLab.record('field-strain-peak', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance, strain: edgeStrain });
    }
    if (edgeStrain <= 0.08 && this._funStrained) {
      this._funStrained = false;
      funLab.record('field-strain-recovery', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance, strain: edgeStrain });
    }
    const outsideX = Math.abs(this.lateral) > edgeX;
    const outsideY = Math.abs(this.vertical) > edgeY;
    if (outsideX || outsideY) {
      this.lateral = THREE.MathUtils.clamp(this.lateral, -edgeX, edgeX);
      this.vertical = THREE.MathUtils.clamp(this.vertical, -edgeY, edgeY);
      this.lateralVel *= -0.35; this.verticalVel *= -0.35;
      game.railScrapeTime = 0.28;
      this.energy = Math.max(0, this.energy - (5.5 + game._speed * 0.018) * dt);
      this.boost = Math.max(0, this.boost - 10 * dt);
      game.phaseStreak = 0;
      game.lineStreak = 0;
      game.perfectEpochThisRun = false;
      if (game.railScrapeCooldown <= 0) {
        game.railScrapeCooldown = 0.36;
        game.lineEventText = 'FIELD STRAIN';
        game.lineEventTime = 0.75;
        audio.railScrape();
      }
      if (this.energy <= 0) { this.energy = 0; this.alive = false; }
    }

    if (input.boost && this.boost > 0) {
      this.boosting = true; this.boost -= BOOST_DRAIN * dt;
      if (this.boost <= 0) { this.boost = 0; this.boosting = false; }
      if (!meta.boostedOnce) { meta.boostedOnce = true; saveMeta(meta); checkMemoryTriggers(); }
    } else {
      this.boosting = false;
      this.boost = Math.min(BOOST_MAX, this.boost + BOOST_RECHARGE * this.boostRechargeBonus * dt);
    }
    if (!wasBoosting && this.boosting) funLab.record('boost-start', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance });
    if (wasBoosting && !this.boosting) funLab.record(this.boost <= 0 ? 'boost-depleted' : 'boost-end', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance });

    // MULTIVERSE: this universe's effective speed-of-light multiplier
    const cosmicSpeed = game.cosmicConstants.speedMul;
    const padBoost = game.padBoostTime > 0
      ? 1 + 0.42 * Math.min(1, game.padBoostTime / Math.max(0.1, game.padBoostTotal || 1.35))
      : 1;
    const speed = BASE_SPEED * this.speedBonus * currentEpoch.speedMul * (variant.mods.speedMul || 1) * (this.boosting ? BOOST_MUL : 1) * cosmicSpeed * padBoost;
    this.distance += speed * dt;

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (wasInvulnerable && this.invulnTimer <= 0) funLab.record('recovery', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: this.distance });
    if (this.phaseTimer > 0) this.phaseTimer -= dt;
    if (this.shiftCooldown > 0) this.shiftCooldown -= dt;

    const p = track.pointAt(this.distance, this.trackPoint);
    const frame = track.frameAt(this.distance, this.trackFrame);
    const offset = this.offset.set(0, 0, 0)
      .addScaledVector(frame.right, this.lateral)
      .addScaledVector(frame.up, this.vertical);
    this.group.position.copy(p).add(offset);
    const lookAhead = track.pointAt(this.distance + 8, this.lookPoint)
      .add(this.lookOffset.set(0, 0, 0)
        .addScaledVector(frame.right, this.lateral + this.lateralVel * 0.05)
        .addScaledVector(frame.up, this.vertical + this.verticalVel * 0.05));
    this.group.lookAt(lookAhead);
    const targetRoll = -THREE.MathUtils.clamp(this.lateralVel / 52, -1, 1) * 0.55;
    this._currentRoll += (targetRoll - this._currentRoll) * Math.min(1, dt * 9);
    this.group.rotateZ(this._currentRoll);

    if (this.phaseFlashTime > 0) this.phaseFlashTime -= dt;
    const flashBoost = this.phaseFlashTime > 0 ? this.phaseFlashTime / 0.45 : 0;
    const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.05 + (this.boosting ? 0.18 : 0) + flashBoost * 0.35;
    this.halo.scale.setScalar(pulse);
    this.corona.scale.setScalar(1.02 + (pulse - 1) * 0.48 + flashBoost * 0.22);
    const rawHalo = 0.14 + (this.boosting ? 0.07 : 0) + (this.phaseTimer > 0 ? 0.10 : 0) + flashBoost * 0.12;
    this.haloMat.opacity = Math.min(0.34, rawHalo);
    this.coronaMat.opacity = Math.min(0.14, 0.045 + (this.boosting ? 0.03 : 0) + flashBoost * 0.05 + (this.phaseTimer > 0 ? 0.025 : 0));

    this.trailCursor = (this.trailCursor + this.trailLen - 1) % this.trailLen;
    this.trailHistory[this.trailCursor].copy(this.group.position);
    this.trailCount = Math.min(this.trailCount + 1, this.trailLen);
    const posArr = this.trail.geometry.attributes.position.array as Float32Array;
    const colArr = this.trail.geometry.attributes.color.array as Float32Array;
    const baseColor = WAVELENGTHS[this.wavelength].color;
    for (let i = 0; i < this.trailLen; i++) {
      const h = i < this.trailCount ? this.trailHistory[(this.trailCursor + i) % this.trailLen] : this.group.position;
      posArr[i*3+0] = h.x; posArr[i*3+1] = h.y; posArr[i*3+2] = h.z;
      const fade = 1 - i / this.trailLen;
      colArr[i*3+0] = baseColor.r * fade;
      colArr[i*3+1] = baseColor.g * fade;
      colArr[i*3+2] = baseColor.b * fade;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
    return speed;
  }

  hit(dmg: number): boolean {
    if (this.invulnTimer > 0 || this.phaseTimer > 0) return false;
    const finalDmg = dmg * (1 - this.damageReduction);
    funLab.record('damage', { epochIndex: game.epochIndex, distance: this.distance, damage: finalDmg, value: finalDmg });
    this.energy -= finalDmg;
    this.invulnTimer = 0.55;
    audio.hit();
    game.trauma = Math.min(1, game.trauma + 0.55);
    game.timeScale = 0.05;
    game.hitStopTime = 0.085;
    game.hitCount++;
    game.phaseStreak = 0;
    game.cleanRunTime = 0;
    game.perfectEpochThisRun = false;
    if (this.energy <= 0) { this.energy = 0; this.alive = false; }
    return true;
  }

  collect(amount: number) {
    this.energy = Math.min(this.maxEnergy(), this.energy + amount);
    this.boost = Math.min(BOOST_MAX, this.boost + amount * 0.5);
    audio.pickup();
  }

  phaseFlash() {
    game.phaseCount++;
    game.phaseStreak = (game.phaseStreak || 0) + 1;
    game.timeSincePhase = 0;
    // Chain reward: longer flash + brighter audio cue every 3 phases.
    const streakBoost = Math.min(8, game.phaseStreak);
    this.phaseFlashTime = 0.45 * (1 + streakBoost * 0.08);
    if (game.phaseStreak >= 2) {
      const lobeCount = settings.reducedMotion ? 2 : (game.phaseStreak % 3 === 0 ? 7 : 4);
      const spread = Math.min(1.3, 0.45 + game.phaseStreak * 0.08);
      interferenceLeft.set(-spread, 0.16, -0.35);
      interferenceRight.set(spread, -0.16, -0.35);
      particleManager.emit(this.group.position, WAVELENGTHS[this.wavelength].color, lobeCount, { speed: 8, life: settings.reducedMotion ? 0.22 : 0.38, drag: 0.93, dirBias: interferenceLeft });
      particleManager.emit(this.group.position, WAVELENGTHS[this.wavelength].color, lobeCount, { speed: 8, life: settings.reducedMotion ? 0.22 : 0.38, drag: 0.93, dirBias: interferenceRight });
    }
    if (game.phaseStreak >= 3 && game.phaseStreak % 3 === 0) {
      particleManager.emitBurst(this.group.position, 'phase', settings.reducedMotion ? 4 : 12, WAVELENGTHS[this.wavelength].color);
      audio.lineGate(game.phaseStreak);
    }
    meta.phasesLifetime = (meta.phasesLifetime || 0) + 1;
    if (meta.colorPhases) meta.colorPhases[this.wavelength] = (meta.colorPhases[this.wavelength] || 0) + 1;
    if ((game.phaseStreak || 0) > (meta.bestStreak || 0)) meta.bestStreak = game.phaseStreak;
    saveMeta(meta);
    checkMemoryTriggers();
  }
}

export const photon = new Photon();
