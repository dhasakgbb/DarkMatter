import * as THREE from 'three';
import { BOOST_MAX, IS_MOBILE, PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD } from './constants';
import { WAVELENGTHS, CODEX_ENTRIES, type Epoch } from './cosmology';
import { activeTutorialNeed, tutorialHazardGapScale, tutorialPhaseWavelength } from './tutorial';
import { scene } from './scene';
import { track } from './track';
import { game } from './state';
import { skillBias } from './flow';
import { meta, saveMeta } from './meta';
import { runRng } from './seed';
import { particleManager } from './particles';
import { photon } from './photon';
import { audio } from './audio';
import { checkMemoryTriggers, maybeUnlockCodex as maybeUnlockCodexFn } from './memories';
import { triggerWitness } from './witness';
import { funLab } from './funlab/runtime';
import { getActiveRenderProfile } from './renderProfile';

export interface HazardMovement { amp: number; freq: number; phase: number; axis: 'lateral' | 'vertical'; }
export interface Hazard {
  kind: string;
  type: string;
  dist: number;
  lateral: number;
  vertical: number;
  baseLateral: number;
  baseVertical: number;
  hex?: number;
  wlIdx: number;
  dmg: number;
  mesh: THREE.Mesh;
  hit: boolean;
  hitRadius: number;
  isFrontFacing?: boolean;
  cannotPhase?: boolean;
  chainId?: number;
  movement?: HazardMovement;
  whooshed?: boolean;
  nearMissed?: boolean;
}

const GRAVITY_SLING_COLOR = new THREE.Color(0xff5de1);
const FINAL_PICKUP_CORE_COLOR = new THREE.Color(0xfafaff);
const FINAL_PICKUP_RING_COLOR = new THREE.Color(0xb888ff);
const PICKUP_COLOR = new THREE.Color(0xfff3a0);
const WORMHOLE_COLOR = new THREE.Color(0x66ffcc);
const DEFAULT_HIT_COLOR = new THREE.Color(0xff5566);
const GRAVITY_SHEAR_ENABLED = false;

function rand() {
  return runRng ? runRng() : Math.random();
}

interface HazardUserData {
  spinSpeed?: number;
  hazardGlow?: THREE.Mesh;
  hazardGlowBaseScale?: number;
  hazardGlowBaseOpacity?: number;
  pickupRing?: THREE.Mesh;
  detailRings?: THREE.Mesh[];
  detailShell?: THREE.Mesh;
  orbiters?: THREE.Mesh[];
}

function hazardUserData(mesh: THREE.Mesh): HazardUserData {
  return mesh.userData as HazardUserData;
}

class HazardManager {
  list: Hazard[] = [];
  group = new THREE.Group();
  geos: Record<string, THREE.BufferGeometry>;
  lastSpawnDist = 0;
  chainCounter = 0;
  private readonly scratchPoint = new THREE.Vector3();
  private readonly scratchFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor() {
    scene.add(this.group);
    const detail = getActiveRenderProfile().hazardDetail;
    this.geos = {
      asteroid: new THREE.IcosahedronGeometry(2.2, IS_MOBILE ? 0 : detail >= 0.9 ? 2 : 1),
      gluon:    new THREE.TorusGeometry(3.4, 0.45, IS_MOBILE ? 6 : 10, IS_MOBILE ? 18 : detail >= 0.9 ? 42 : 28),
      well:     new THREE.SphereGeometry(2.6, IS_MOBILE ? 16 : detail >= 0.9 ? 32 : 22, IS_MOBILE ? 10 : detail >= 0.9 ? 20 : 14),
      plasma:   new THREE.SphereGeometry(1.8, IS_MOBILE ? 10 : detail >= 0.9 ? 20 : 14, IS_MOBILE ? 8 : detail >= 0.9 ? 14 : 10),
      fluct:    new THREE.OctahedronGeometry(1.6, detail >= 0.9 && !IS_MOBILE ? 1 : 0),
      supernova: new THREE.TorusGeometry(8.5, 1.4, IS_MOBILE ? 8 : 12, IS_MOBILE ? 28 : detail >= 0.9 ? 64 : 42),
      horizon:   new THREE.CircleGeometry(12, IS_MOBILE ? 28 : detail >= 0.9 ? 72 : 44),
      dmFilament: new THREE.CylinderGeometry(0.55, 0.55, 28, IS_MOBILE ? 6 : 10, 1, true),
    };
  }

  private decorateGravityWell(mesh: THREE.Mesh) {
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(0x7d5cff);
    material.opacity = 0.42;
    material.wireframe = true;
  }

  private addMaterialDetail(mesh: THREE.Mesh, type: string, hex: number) {
    const detail = getActiveRenderProfile().hazardDetail;
    if (detail < 0.7 && type !== 'supernova' && type !== 'eventHorizon') return;
    const data = hazardUserData(mesh);
    if (type === 'plasma' || type === 'fluct') {
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(type === 'plasma' ? 2.9 : 2.35, IS_MOBILE ? 10 : 18, IS_MOBILE ? 8 : 12),
        new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: 0.14 * detail,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          wireframe: type === 'fluct',
        }),
      );
      mesh.add(shell);
      data.detailShell = shell;
      return;
    }
    if (type === 'gluon') {
      const rings = [0, 1].map((i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.2 + i * 1.2, 0.045, IS_MOBILE ? 5 : 7, IS_MOBILE ? 24 : 44),
          new THREE.MeshBasicMaterial({
            color: i === 0 ? 0xffffff : hex,
            transparent: true,
            opacity: (i === 0 ? 0.24 : 0.18) * detail,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        ring.rotation.x = Math.PI * (0.28 + i * 0.21);
        ring.rotation.y = Math.PI * (0.14 + i * 0.19);
        mesh.add(ring);
        return ring;
      });
      data.detailRings = rings;
      return;
    }
    if (type === 'dmFilament') {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55, 1.55, 31, IS_MOBILE ? 6 : 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x7d5cff,
          transparent: true,
          opacity: 0.10 * detail,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          wireframe: true,
        }),
      );
      mesh.add(shell);
      data.detailShell = shell;
      return;
    }
    if (type === 'supernova') {      const rings = [0, 1, 2].map((i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(9.7 + i * 2.4, 0.07, IS_MOBILE ? 6 : 8, IS_MOBILE ? 32 : 72),
          new THREE.MeshBasicMaterial({
            color: i === 0 ? 0xfff0b0 : i === 1 ? 0xff7a28 : 0xff245c,
            transparent: true,
            opacity: (0.22 - i * 0.045) * detail,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          }),
        );
        ring.rotation.x = Math.PI * 0.5;
        ring.rotation.z = i * Math.PI * 0.18;
        mesh.add(ring);
        return ring;
      });
      data.detailRings = rings;
      return;
    }
    if (type === 'eventHorizon') {
      const rings = [0, 1].map((i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(9.2 + i * 2.5, 0.08, IS_MOBILE ? 6 : 8, IS_MOBILE ? 38 : 84),
          new THREE.MeshBasicMaterial({
            color: i === 0 ? hex : 0xff7ad9,
            transparent: true,
            opacity: (0.30 - i * 0.08) * detail,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        ring.rotation.x = Math.PI * 0.5;
        ring.rotation.y = i * Math.PI * 0.13;
        mesh.add(ring);
        return ring;
      });
      data.detailRings = rings;
    }
  }

  private addHazardGlow(mesh: THREE.Mesh, type: string, hex: number) {
    if (type === 'well' || (IS_MOBILE && type !== 'supernova' && type !== 'eventHorizon' && type !== 'dmFilament')) return;
    const material = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: type === 'supernova' ? 0.20 : type === 'eventHorizon' ? 0.16 : 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(mesh.geometry, material);
    const scale = type === 'supernova' ? 1.18 : type === 'eventHorizon' ? 1.12 : type === 'gluon' ? 1.22 : 1.34;
    glow.scale.setScalar(scale);
    mesh.add(glow);
    const data = hazardUserData(mesh);
    data.hazardGlow = glow;
    data.hazardGlowBaseScale = scale;
    data.hazardGlowBaseOpacity = material.opacity;
  }

  private canRadioTransmit(h: Hazard, photonWL: number) {
    return photonWL === 2 && h.wlIdx !== 2 && (h.type === 'plasma' || h.type === 'fluct');
  }

  private ionizeNearby(source: Hazard, currentEpoch: Epoch) {
    if (source.wlIdx !== 0) return 0;
    let ionized = 0;
    for (const other of this.list) {
      if (other === source || other.hit || other.type === 'pickup' || other.type === 'finalPickup') continue;
      if (other.type !== 'plasma' && other.type !== 'fluct' && other.type !== 'gluon') continue;
      if (Math.abs(other.dist - source.dist) > 11) continue;
      const dx = other.lateral - source.lateral;
      const dy = other.vertical - source.vertical;
      if (dx * dx + dy * dy > 8.5 * 8.5) continue;
      other.hit = true;
      (other.mesh.material as THREE.MeshBasicMaterial).opacity = 0.16;
      particleManager.emitBurst(other.mesh.position, 'phase', 10, WAVELENGTHS[0].color);
      funLab.record('gamma-ionization', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: source.dist, cause: other.type, value: 1 });
      ionized++;
      if (ionized >= 2) break;
    }
    if (ionized > 0) {
      game.lineEventText = 'IONIZATION CASCADE';
      game.lineEventTime = 0.95;
      game.trauma = Math.min(1, game.trauma + 0.08 * ionized);
    }
    return ionized;
  }

  reset(startDist = 0) {
    for (const h of this.list) this.group.remove(h.mesh);
    this.list.length = 0;
    this.lastSpawnDist = startDist;
    this.chainCounter = 0;
  }

  ensureAhead(epoch: Epoch, photonDist: number) {
    const horizon = photonDist + SEGMENT_LEN * SEGMENTS_AHEAD - 20;
    const tutorialNeed = activeTutorialNeed(game.tutorialActive, game.tutorialStep);
    const tutorialEase = tutorialHazardGapScale(tutorialNeed);
    if (epoch.isHeatDeath) {
      while (this.lastSpawnDist < horizon) {
        this.lastSpawnDist += 40 + rand() * 50;
        this.spawnAt(epoch, this.lastSpawnDist);
      }
    } else {
      // Adaptive difficulty: skill bias derived from flow signal nudges hazard
      // gap shorter when player is in the zone, wider when struggling.
      // Tutorial epoch (idx 0) is exempt so onboarding stays in the easy lane.
      const bias = skillBias(game.flowLevel || 0, game.epochIndex);
      const flowDensityScale = 1 - bias; // bias ∈ [-0.2, +0.2] → scale ∈ [0.8, 1.2]
      while (this.lastSpawnDist < horizon) {
        const gap = (16 + rand() * 26) / epoch.hazardDensity * tutorialEase * flowDensityScale;
        this.lastSpawnDist += gap;
        this.spawnAt(epoch, this.lastSpawnDist);
        const just = this.list[this.list.length - 1];
        if (just && just.kind === 'gluon' && rand() < 0.45) {
          const chainId = ++this.chainCounter;
          just.chainId = chainId;
          for (let i = 1; i <= 2; i++) {
            this.spawnAt(epoch, this.lastSpawnDist + i * 5.5, { forceKind: 'gluon', forceWl: just.wlIdx, chainId });
          }
          this.lastSpawnDist += 11;
        }
        if (rand() < 0.55 * epoch.pickupDensity) {
          this.spawnPickup(epoch, this.lastSpawnDist + 2 + rand() * 6);
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      if (h.dist < photonDist - 25) {
        this.group.remove(h.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  spawnAt(epoch: Epoch, dist: number, chainOpts?: { forceKind?: string; forceWl?: number; chainId?: number }) {
    let kind: string;
    if (chainOpts?.forceKind) kind = chainOpts.forceKind;
    else {
      const params = game.epochParams?.[game.epochIndex];
      const kinds = epoch.hazardKinds;
      const weights = kinds.map(k => {
        const base = k === params?.dominantKind ? 2 : 1;
        return k === 'darkMatterFilament' ? base * 0.22 : base;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      const r = rand() * total;
      let acc = 0;
      kind = kinds[kinds.length - 1];
      for (let i = 0; i < kinds.length; i++) { acc += weights[i]; if (r <= acc) { kind = kinds[i]; break; } }
    }
    let geo: THREE.BufferGeometry, hex: number, wlIdx: number, dmg: number, type: string;
    const tutorialNeed = activeTutorialNeed(game.tutorialActive, game.tutorialStep);
    const fallbackWavelength = chainOpts?.forceWl ?? Math.floor(rand() * 3);
    const wl = tutorialPhaseWavelength(tutorialNeed, photon.wavelength, fallbackWavelength);
    let hitRadius = 2.6;
    let isFrontFacing = false;
    let cannotPhase = false;
    switch (kind) {
      case 'fluctuation': geo = this.geos.fluct;     hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 22; type = 'fluct';        break;
      case 'gravityWell': geo = this.geos.well;      hex = 0x220033;            wlIdx = wl; dmg = 35; type = 'well';         break;
      case 'darkMatterFilament': geo = this.geos.dmFilament; hex = 0x241333;   wlIdx = -1; dmg = 0; type = 'dmFilament'; hitRadius = 5.2; cannotPhase = true; break;
      case 'gluon':       geo = this.geos.gluon;     hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 28; type = 'gluon';        break;
      case 'plasma':      geo = this.geos.plasma;    hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 18; type = 'plasma';       break;
      case 'supernova':   geo = this.geos.supernova; hex = 0xff5020;            wlIdx = -1; dmg = 50; type = 'supernova';    hitRadius = 7.5; isFrontFacing = true; cannotPhase = true; break;
      case 'eventHorizon':geo = this.geos.horizon;   hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 999; type = 'eventHorizon'; hitRadius = 11.5; isFrontFacing = true; break;
      default:            geo = this.geos.fluct;     hex = 0xffffff;            wlIdx = -1; dmg = 20; type = 'fluct';
    }
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: type === 'eventHorizon' ? 0.55 : 0.85, wireframe: type === 'gluon', side: isFrontFacing ? THREE.DoubleSide : THREE.FrontSide });
    const mesh = new THREE.Mesh(geo, mat);
    if (type === 'well') this.decorateGravityWell(mesh);
    else this.addHazardGlow(mesh, type, hex);
    if (type === 'dmFilament') {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.setHex(0x7d5cff);
      material.opacity = 0.32;
      material.wireframe = true;
      material.depthWrite = false;
      material.blending = THREE.AdditiveBlending;
    }
    this.addMaterialDetail(mesh, type, hex);
    let lat = isFrontFacing ? 0 : (rand() - 0.5) * PLAYFIELD_HALF_WIDTH * 1.7;
    let ver = isFrontFacing ? 0 : (rand() - 0.5) * PLAYFIELD_HALF_HEIGHT * 1.7;
    if (tutorialNeed === 'phase' && !isFrontFacing) {
      lat = THREE.MathUtils.clamp(photon.lateral + (rand() - 0.5) * 8, -PLAYFIELD_HALF_WIDTH * 0.55, PLAYFIELD_HALF_WIDTH * 0.55);
      ver = THREE.MathUtils.clamp(photon.vertical + (rand() - 0.5) * 6, -PLAYFIELD_HALF_HEIGHT * 0.55, PLAYFIELD_HALF_HEIGHT * 0.55);
    }
    const p = track.pointAt(dist, this.scratchPoint);
    const frame = track.frameAt(dist, this.scratchFrame);
    mesh.position.copy(p).addScaledVector(frame.right, lat).addScaledVector(frame.up, ver);
    if (type === 'dmFilament') {
      mesh.rotation.z = rand() * Math.PI;
      mesh.rotation.x = Math.PI * (0.18 + rand() * 0.22);
    }
    if (isFrontFacing) {      const mtx = this.scratchMatrix.makeBasis(frame.right, frame.up, frame.fwd);
      mesh.quaternion.setFromRotationMatrix(mtx);
      hazardUserData(mesh).spinSpeed = type === 'supernova' ? 0.4 : 0;
    } else {
      hazardUserData(mesh).spinSpeed = (rand() - 0.5) * 2;
    }
    this.group.add(mesh);
    const hazard: Hazard = { kind, type, dist, lateral: lat, vertical: ver, baseLateral: lat, baseVertical: ver, hex, wlIdx, dmg, mesh, hit: false, hitRadius, isFrontFacing, cannotPhase };
    if (chainOpts?.chainId != null) hazard.chainId = chainOpts.chainId;
    if (!hazard.chainId && (type === 'fluct' || type === 'plasma') && rand() < 0.35) {
      hazard.movement = {
        amp: 4 + rand() * 7,
        freq: 0.5 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
        axis: rand() < 0.5 ? 'lateral' : 'vertical',
      };
    }
    this.list.push(hazard);
  }

  spawnPickup(_epoch: Epoch, dist: number) {
    const geo = new THREE.IcosahedronGeometry(0.7, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.4, IS_MOBILE ? 8 : 12, IS_MOBILE ? 6 : 8), new THREE.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 0.25, depthWrite: false }));
    const ring = IS_MOBILE ? null : new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.045, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    if (ring) ring.rotation.x = Math.PI * 0.5;
    mesh.add(halo);
    if (ring) {
      mesh.add(ring);
      hazardUserData(mesh).pickupRing = ring;
    }
    const lat = (rand() - 0.5) * PLAYFIELD_HALF_WIDTH * 1.55;
    const ver = (rand() - 0.5) * PLAYFIELD_HALF_HEIGHT * 1.55;
    const p = track.pointAt(dist, this.scratchPoint);
    const frame = track.frameAt(dist, this.scratchFrame);
    mesh.position.copy(p).addScaledVector(frame.right, lat).addScaledVector(frame.up, ver);
    this.group.add(mesh);
    this.list.push({ kind: 'pickup', type: 'pickup', dist, lateral: lat, vertical: ver, baseLateral: lat, baseVertical: ver, wlIdx: -1, dmg: 0, mesh, hit: false, hitRadius: 2.6 });
  }

  update(dt: number, photonDist: number, photonLat: number, photonVer: number, photonWL: number,
         onHit: (dmg: number) => boolean, onCollect: (amt: number) => void, currentEpoch: Epoch) {
    const HIT_WINDOW = 2.6;
    const animTime = performance.now() * 0.001;
    for (const h of this.list) {
      const data = hazardUserData(h.mesh);
      if (!h.isFrontFacing) {
        h.mesh.rotation.y += dt * (data.spinSpeed || 1.2);
        h.mesh.rotation.x += dt * 0.4;
      } else if (h.type === 'supernova') {
        h.mesh.rotateZ(dt * (data.spinSpeed || 0));
      }
      if (data.detailShell) {
        const shellMat = data.detailShell.material as THREE.MeshBasicMaterial;
        data.detailShell.scale.setScalar(1.0 + Math.sin(animTime * 5.8 + h.dist * 0.05) * 0.055);
        shellMat.opacity = (h.hit ? 0.04 : 0.12) * getActiveRenderProfile().hazardDetail;
      }
      if (data.detailRings) {
        data.detailRings.forEach((ring, i) => {
          ring.rotation.z += dt * (0.9 + i * 0.42) * (i % 2 ? -1 : 1);
          const ringMat = ring.material as THREE.MeshBasicMaterial;
          ringMat.opacity *= h.hit ? 0.96 : 1;
        });
      }
      const hazardGlow = data.hazardGlow;
      if (hazardGlow) {
        const baseScale = data.hazardGlowBaseScale || 1.2;
        const baseOpacity = data.hazardGlowBaseOpacity || 0.16;
        const glowPulse = 1 + Math.sin(animTime * 5.2 + h.dist * 0.041) * 0.055;
        hazardGlow.scale.setScalar(baseScale * glowPulse);
        (hazardGlow.material as THREE.MeshBasicMaterial).opacity = baseOpacity * (h.hit ? 0.38 : 1);
      }
      const pickupRing = data.pickupRing;
      if (pickupRing) pickupRing.rotation.z += dt * 2.4;
      if (h.movement) {
        const offset = Math.sin(animTime * h.movement.freq * Math.PI * 2 + h.movement.phase) * h.movement.amp;
        if (h.movement.axis === 'lateral') h.lateral = h.baseLateral + offset;
        else                               h.vertical = h.baseVertical + offset;
        h.lateral = THREE.MathUtils.clamp(h.lateral, -PLAYFIELD_HALF_WIDTH + h.hitRadius, PLAYFIELD_HALF_WIDTH - h.hitRadius);
        h.vertical = THREE.MathUtils.clamp(h.vertical, -PLAYFIELD_HALF_HEIGHT + h.hitRadius, PLAYFIELD_HALF_HEIGHT - h.hitRadius);
      }
      const p = track.pointAt(h.dist, this.scratchPoint);
      const frame = track.frameAt(h.dist, this.scratchFrame);
      h.mesh.position.copy(p).addScaledVector(frame.right, h.lateral).addScaledVector(frame.up, h.vertical);
      if (h.isFrontFacing) {
        const mtx = this.scratchMatrix.makeBasis(frame.right, frame.up, frame.fwd);
        h.mesh.quaternion.setFromRotationMatrix(mtx);
      }
      const dz = h.dist - photonDist;
      if (GRAVITY_SHEAR_ENABLED && !h.hit && h.type === 'well' && dz > -14 && dz < 86) {
        const dx = h.lateral - photonLat;
        const dy = h.vertical - photonVer;
        const lateralDist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
        const zFalloff = 1 - Math.min(1, Math.abs(dz) / 86);
        const lateralFalloff = 1 - Math.min(1, lateralDist / (PLAYFIELD_HALF_WIDTH * 1.18));
        const strength = Math.max(0, zFalloff * lateralFalloff);
        if (strength > 0) {
          game.gravityShearX += (dx / lateralDist) * strength;
          game.gravityShearY += (dy / lateralDist) * strength;
          game.gravityShear = Math.min(1, Math.max(game.gravityShear || 0, strength));
        }
      }
      if (!h.hit && h.type === 'dmFilament' && dz > -18 && dz < 118) {
        const dx = h.lateral - photonLat;
        const dy = h.vertical - photonVer;
        const lateralDist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
        const zFalloff = 1 - Math.min(1, Math.abs(dz - 22) / 96);
        const lateralFalloff = 1 - Math.min(1, lateralDist / (PLAYFIELD_HALF_WIDTH * 1.05));
        const strength = Math.max(0, zFalloff * lateralFalloff);
        if (strength > 0.015) {
          game.gravityShearX += (dx / lateralDist) * strength * 0.72;
          game.gravityShearY += (dy / lateralDist) * strength * 0.64;
          game.gravityShear = Math.min(1, Math.max(game.gravityShear || 0, strength * 0.82));
          game.darkMatterSignal = Math.max(game.darkMatterSignal || 0, strength);
          game.darkMatterSignalTime = Math.max(game.darkMatterSignalTime || 0, 0.62 + strength * 0.72);
          game.darkMatterMassSolar = 4e11 + Math.abs(Math.sin(h.dist * 0.011)) * 1.6e12;
          game.darkMatterDeflectionArcsec = 0.18 + strength * 2.4;
        }
        if (!h.nearMissed && dz < 18 && dz > -4 && strength > 0.06) {
          h.nearMissed = true;
          game.lineEventText = 'MASS DETECTED';
          game.lineEventTime = 1.1;
          meta.darkMatterDetections = (meta.darkMatterDetections || 0) + 1;
          saveMeta(meta);
          checkMemoryTriggers();
          maybeUnlockCodexFn('DARKMATTER', CODEX_ENTRIES);
          funLab.record('dark-matter-detection', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: photonDist, value: strength });
        }
      }
      // SPATIAL: emit a Doppler whoosh once as each hazard crosses the photon (4 units ahead → behind).
      // Only for non-pickup hazards (no whoosh on collectibles).
      if (!h.whooshed && h.type !== 'pickup' && h.type !== 'finalPickup') {
        const dzAhead = h.dist - photonDist;
        if (dzAhead < 5 && dzAhead > -2) {
          h.whooshed = true;
          const dx = h.lateral - photonLat;
          const dy = h.vertical - photonVer;
          const lateralDist = Math.sqrt(dx * dx + dy * dy);
          const acousticRadius = h.type === 'well' || h.type === 'dmFilament'
            ? PLAYFIELD_HALF_WIDTH * 0.82
            : h.type === 'supernova'
              ? (h.hitRadius || 2.6) + 8
              : (h.hitRadius || 2.6) + 5;
          if (lateralDist <= acousticRadius) {
            const proximity = 1 - Math.min(1, lateralDist / Math.max(1, acousticRadius));
            const base = h.type === 'fluct' ? 0.35 : h.type === 'well' || h.type === 'dmFilament' ? 1.0 : h.type === 'supernova' ? 1.25 : 0.65;
            audio.whoosh(h.mesh.position, base * (0.35 + proximity * 0.65), h.type === 'dmFilament' ? 'well' : h.type);
          }
        }
      }
      if (h.hit) continue;
      if (Math.abs(dz) > HIT_WINDOW) continue;
      const dx = h.lateral - photonLat;
      const dy = h.vertical - photonVer;
      const dist2 = dx * dx + dy * dy;
      const r = h.hitRadius || 2.6;
      if (dist2 > r * r) {
        if (!h.nearMissed && h.type !== 'pickup' && h.type !== 'finalPickup' && dist2 <= (r + 4.2) * (r + 4.2)) {
          h.nearMissed = true;
          const skim = THREE.MathUtils.clamp(1 - (Math.sqrt(dist2) - r) / 4.2, 0, 1);
          funLab.record('hazard-near-miss', { epochIndex: game.epochIndex, distance: photonDist, cause: h.type, value: skim });
          if (h.type !== 'well') {
            photon.boost = Math.min(BOOST_MAX, photon.boost + 4 + skim * 6);
            photon.energy = Math.min(photon.maxEnergy(), photon.energy + 1 + skim * 2);
            game.runEnergy += 2 + skim * 4;
            if ((game.lineEventTime || 0) <= 0.2) {
              game.lineEventText = 'CLOSE PASS';
              game.lineEventTime = 0.62 + skim * 0.36;
            }
            const color = h.wlIdx >= 0 ? WAVELENGTHS[h.wlIdx].color : DEFAULT_HIT_COLOR;
            particleManager.emitBurst(h.mesh.position, 'foam', 8, color);
          }
          if (h.type === 'well') {
            const skim = THREE.MathUtils.clamp(1 - (Math.sqrt(dist2) - r) / 4.2, 0, 1);
            const duration = 0.58 + skim * 0.64;
            game.padBoostTime = Math.max(game.padBoostTime || 0, duration);
            game.padBoostTotal = Math.max(game.padBoostTotal || 0, duration);
            photon.boost = Math.min(BOOST_MAX, photon.boost + 10 + skim * 8);
            photon.energy = Math.min(photon.maxEnergy(), photon.energy + 3 + skim * 4);
            game.runEnergy += 7 + skim * 7;
            game.lineEventText = 'GRAVITY SLING';
            game.lineEventTime = 1.05;
            funLab.record('gravity-sling', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: photonDist, cause: h.type, value: skim });
            audio.speedPad();
            particleManager.emitBurst(h.mesh.position, 'phase', 30, GRAVITY_SLING_COLOR);
          }
        }
        continue;
      }
      // Collision
      if (h.type === 'dmFilament') {
        h.hit = true;
        (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.12;
        const skim = THREE.MathUtils.clamp(1 - Math.sqrt(dist2) / Math.max(1, r), 0, 1);
        game.padBoostTime = Math.max(game.padBoostTime || 0, 0.34 + skim * 0.36);
        game.padBoostTotal = Math.max(game.padBoostTotal || 0, 0.70);
        photon.boost = Math.min(BOOST_MAX, photon.boost + 5 + skim * 7);
        game.runEnergy += 4 + skim * 5;
        game.lineEventText = 'LENSING SLING';
        game.lineEventTime = 0.9;
        particleManager.emitBurst(h.mesh.position, 'phase', 26, new THREE.Color(0x7d5cff));
        audio.speedPad();
        maybeUnlockCodexFn('DARKMATTER', CODEX_ENTRIES);
        continue;
      }
      if (h.type === 'pickup' || h.type === 'finalPickup') {        h.hit = true; h.mesh.visible = false;
        if (h.type === 'finalPickup') {
          particleManager.emitBurst(h.mesh.position, 'death', 80, FINAL_PICKUP_CORE_COLOR);
          particleManager.emitBurst(h.mesh.position, 'death', 60, FINAL_PICKUP_RING_COLOR);
          triggerWitness();
        } else {
          funLab.record('pickup', { epochIndex: game.epochIndex, distance: photonDist, value: 20 });
          onCollect(20);
          particleManager.emitBurst(h.mesh.position, 'pickup', 18, PICKUP_COLOR);
          meta.pickupsLifetime = (meta.pickupsLifetime || 0) + 1;
          saveMeta(meta);
          checkMemoryTriggers();
        }
      } else if (h.wlIdx >= 0 && h.wlIdx === photonWL) {
        h.hit = true;
        funLab.record('phase-through', { epochIndex: game.epochIndex, distance: photonDist, cause: h.type, value: h.dmg });
        (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
        onCollect(6);
        photon.phaseFlash();
        audio.phaseChime(h.wlIdx);
        particleManager.emitBurst(h.mesh.position, 'phase', 14, WAVELENGTHS[h.wlIdx].color);
        if (h.chainId != null) {
          for (const other of this.list) {
            if (other !== h && other.chainId === h.chainId && !other.hit) {
              other.hit = true;
              (other.mesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
              particleManager.emitBurst(other.mesh.position, 'phase', 12, WAVELENGTHS[h.wlIdx].color);
            }
          }
          if (!meta.firstChainPhased) { meta.firstChainPhased = true; saveMeta(meta); checkMemoryTriggers(); }
        }
        if (h.type === 'well') {
          photon.distance += 95 + rand() * 55;
          photon.invulnTimer = Math.max(photon.invulnTimer, 1.15);
          photon.energy = Math.min(photon.maxEnergy(), photon.energy + 12);
          particleManager.emitBurst(h.mesh.position, 'death', 22, WORMHOLE_COLOR);
          if (!meta.firstWormhole) { meta.firstWormhole = true; saveMeta(meta); checkMemoryTriggers(); }
          game.trauma = Math.min(1, game.trauma + 0.25);
        }
        const ionized = this.ionizeNearby(h, currentEpoch);
        if (ionized > 0) onCollect(3 * ionized);
        if (h.wlIdx === 0) maybeUnlockCodexFn('GAMMA', CODEX_ENTRIES);
        if (h.wlIdx === 2) maybeUnlockCodexFn('RADIO', CODEX_ENTRIES);
      } else if (this.canRadioTransmit(h, photonWL)) {
        h.hit = true;
        funLab.record('radio-transmission', { epochIndex: game.epochIndex, epochName: currentEpoch.name, distance: photonDist, cause: h.type, value: h.dmg });
        (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.14;
        onCollect(3);
        photon.phaseFlash();
        audio.phaseChime(2);
        game.lineEventText = 'RADIO TRANSMISSION';
        game.lineEventTime = 0.85;
        particleManager.emitBurst(h.mesh.position, 'phase', 12, WAVELENGTHS[2].color);
        maybeUnlockCodexFn('RADIO', CODEX_ENTRIES);
      } else {
        if (onHit(h.dmg)) {
          funLab.record('hazard-hit', { epochIndex: game.epochIndex, distance: photonDist, cause: h.type, damage: h.dmg, value: h.dmg });
          h.hit = true;
          (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
          const hitColor = h.wlIdx >= 0 ? WAVELENGTHS[h.wlIdx].color : DEFAULT_HIT_COLOR;
          particleManager.emitBurst(h.mesh.position, 'hit', 22, hitColor);
        }
        if (h.type === 'well') maybeUnlockCodexFn('GRAVWELL', CODEX_ENTRIES);
        if (h.type === 'gluon') maybeUnlockCodexFn('GLUON', CODEX_ENTRIES);
        if (h.type === 'supernova') maybeUnlockCodexFn('SUPERNOVA', CODEX_ENTRIES);
        if (h.type === 'eventHorizon') maybeUnlockCodexFn('HORIZON', CODEX_ENTRIES);
      }
    }
  }
}

export const hazards = new HazardManager();
const finalPickupPoint = new THREE.Vector3();

// Spawned exactly once at t=300s of Heat Death. Triggers the witness ending on collection.
export function spawnFinalPickup(dist: number) {
  const geo = new THREE.IcosahedronGeometry(0.9, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.0, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 0.5, depthWrite: false }));
  mesh.add(halo);
  const halo2 = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 0.18, depthWrite: false }));
  mesh.add(halo2);
  const p = track.pointAt(dist, finalPickupPoint);
  mesh.position.copy(p);
  hazards.group.add(mesh);
  hazards.list.push({ kind: 'pickup', type: 'finalPickup', dist, lateral: 0, vertical: 0, baseLateral: 0, baseVertical: 0, wlIdx: -1, dmg: 0, mesh, hit: false, hitRadius: 2.6 });
}
