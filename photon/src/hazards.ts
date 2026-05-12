import * as THREE from 'three';
import { PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD } from './constants';
import { WAVELENGTHS, CODEX_ENTRIES, type Epoch } from './cosmology';
import { scene } from './scene';
import { track } from './track';
import { game } from './state';
import { meta, saveMeta } from './meta';
import { runRng } from './seed';
import { particleManager } from './particles';
import { photon } from './photon';
import { audio } from './audio';
import { checkMemoryTriggers, maybeUnlockCodex as maybeUnlockCodexFn } from './memories';
import { triggerWitness } from './witness';
import { funLab } from './funlab/runtime';

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

class HazardManager {
  list: Hazard[] = [];
  group = new THREE.Group();
  geos: Record<string, THREE.BufferGeometry>;
  lastSpawnDist = 0;
  chainCounter = 0;

  constructor() {
    scene.add(this.group);
    this.geos = {
      asteroid: new THREE.IcosahedronGeometry(2.2, 1),
      gluon:    new THREE.TorusGeometry(3.4, 0.45, 8, 24),
      well:     new THREE.SphereGeometry(2.6, 20, 14),
      plasma:   new THREE.SphereGeometry(1.8, 12, 10),
      fluct:    new THREE.OctahedronGeometry(1.6, 0),
      supernova: new THREE.TorusGeometry(8.5, 1.4, 10, 36),
      horizon:   new THREE.CircleGeometry(12, 36),
    };
  }

  reset() {
    for (const h of this.list) this.group.remove(h.mesh);
    this.list.length = 0;
    this.lastSpawnDist = 0;
    this.chainCounter = 0;
  }

  ensureAhead(epoch: Epoch, photonDist: number) {
    const horizon = photonDist + SEGMENT_LEN * SEGMENTS_AHEAD - 20;
    const tutorialEase = (game.tutorialActive && game.tutorialStep < 2) ? 2.0 : 1.0;
    const endlessSqueeze = 1 / (1 + (game.endlessLoop || 0) * 0.22);
    if (epoch.isHeatDeath) {
      while (this.lastSpawnDist < horizon) {
        this.lastSpawnDist += 40 + Math.random() * 50;
        this.spawnAt(epoch, this.lastSpawnDist);
      }
    } else {
      while (this.lastSpawnDist < horizon) {
        const gap = (12 + Math.random() * 22) / epoch.hazardDensity * tutorialEase * endlessSqueeze;
        this.lastSpawnDist += gap;
        this.spawnAt(epoch, this.lastSpawnDist);
        const just = this.list[this.list.length - 1];
        if (just && just.kind === 'gluon' && Math.random() < 0.45) {
          const chainId = ++this.chainCounter;
          just.chainId = chainId;
          for (let i = 1; i <= 2; i++) {
            this.spawnAt(epoch, this.lastSpawnDist + i * 5.5, { forceKind: 'gluon', forceWl: just.wlIdx, chainId });
          }
          this.lastSpawnDist += 11;
        }
        if (Math.random() < 0.55 * epoch.pickupDensity) {
          this.spawnPickup(epoch, this.lastSpawnDist + 2 + Math.random() * 6);
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
      const params = (game.epochParams && game.epochParams[game.epochIndex]) || {};
      const kinds = epoch.hazardKinds;
      const weights = kinds.map(k => k === (params as any).dominantKind ? 2 : 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const r = (runRng ? runRng() : Math.random()) * total;
      let acc = 0;
      kind = kinds[kinds.length - 1];
      for (let i = 0; i < kinds.length; i++) { acc += weights[i]; if (r <= acc) { kind = kinds[i]; break; } }
    }
    let geo: THREE.BufferGeometry, hex: number, wlIdx: number, dmg: number, type: string;
    const wl = chainOpts?.forceWl ?? Math.floor(Math.random() * 3);
    let hitRadius = 2.6;
    let isFrontFacing = false;
    let cannotPhase = false;
    switch (kind) {
      case 'fluctuation': geo = this.geos.fluct;     hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 22; type = 'fluct';        break;
      case 'gravityWell': geo = this.geos.well;      hex = 0x220033;            wlIdx = wl; dmg = 35; type = 'well';         break;
      case 'gluon':       geo = this.geos.gluon;     hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 28; type = 'gluon';        break;
      case 'plasma':      geo = this.geos.plasma;    hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 18; type = 'plasma';       break;
      case 'supernova':   geo = this.geos.supernova; hex = 0xff5020;            wlIdx = -1; dmg = 50; type = 'supernova';    hitRadius = 7.5; isFrontFacing = true; cannotPhase = true; break;
      case 'eventHorizon':geo = this.geos.horizon;   hex = WAVELENGTHS[wl].hex; wlIdx = wl; dmg = 999; type = 'eventHorizon'; hitRadius = 11.5; isFrontFacing = true; break;
      default:            geo = this.geos.fluct;     hex = 0xffffff;            wlIdx = -1; dmg = 20; type = 'fluct';
    }
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: type === 'eventHorizon' ? 0.55 : 0.85, wireframe: type === 'gluon', side: isFrontFacing ? THREE.DoubleSide : THREE.FrontSide });
    const mesh = new THREE.Mesh(geo, mat);
    const lat = isFrontFacing ? 0 : (Math.random() - 0.5) * PLAYFIELD_HALF_WIDTH * 1.7;
    const ver = isFrontFacing ? 0 : (Math.random() - 0.5) * PLAYFIELD_HALF_HEIGHT * 1.7;
    const p = track.pointAt(dist);
    const frame = track.frameAt(dist);
    mesh.position.copy(p).addScaledVector(frame.right, lat).addScaledVector(frame.up, ver);
    if (isFrontFacing) {
      const mtx = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.fwd);
      mesh.quaternion.setFromRotationMatrix(mtx);
      (mesh.userData as any).spinSpeed = type === 'supernova' ? 0.4 : 0;
    } else {
      (mesh.userData as any).spinSpeed = (Math.random() - 0.5) * 2;
    }
    this.group.add(mesh);
    const hazard: Hazard = { kind, type, dist, lateral: lat, vertical: ver, baseLateral: lat, baseVertical: ver, hex, wlIdx, dmg, mesh, hit: false, hitRadius, isFrontFacing, cannotPhase };
    if (chainOpts?.chainId != null) hazard.chainId = chainOpts.chainId;
    if (!hazard.chainId && (type === 'fluct' || type === 'plasma') && Math.random() < 0.35) {
      hazard.movement = {
        amp: 4 + Math.random() * 7,
        freq: 0.5 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        axis: Math.random() < 0.5 ? 'lateral' : 'vertical',
      };
    }
    this.list.push(hazard);
  }

  spawnPickup(_epoch: Epoch, dist: number) {
    const geo = new THREE.IcosahedronGeometry(0.7, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 0.25, depthWrite: false }));
    mesh.add(halo);
    const lat = (Math.random() - 0.5) * PLAYFIELD_HALF_WIDTH * 1.55;
    const ver = (Math.random() - 0.5) * PLAYFIELD_HALF_HEIGHT * 1.55;
    const p = track.pointAt(dist);
    const frame = track.frameAt(dist);
    mesh.position.copy(p).addScaledVector(frame.right, lat).addScaledVector(frame.up, ver);
    this.group.add(mesh);
    this.list.push({ kind: 'pickup', type: 'pickup', dist, lateral: lat, vertical: ver, baseLateral: lat, baseVertical: ver, wlIdx: -1, dmg: 0, mesh, hit: false, hitRadius: 2.6 });
  }

  update(dt: number, photonDist: number, photonLat: number, photonVer: number, photonWL: number,
         onHit: (dmg: number) => boolean, onCollect: (amt: number) => void, _currentEpoch: Epoch) {
    const HIT_WINDOW = 2.6;
    const animTime = performance.now() * 0.001;
    for (const h of this.list) {
      if (!h.isFrontFacing) {
        h.mesh.rotation.y += dt * ((h.mesh.userData as any).spinSpeed || 1.2);
        h.mesh.rotation.x += dt * 0.4;
      } else if (h.type === 'supernova') {
        h.mesh.rotateZ(dt * (h.mesh.userData as any).spinSpeed);
      }
      if (h.movement) {
        const offset = Math.sin(animTime * h.movement.freq * Math.PI * 2 + h.movement.phase) * h.movement.amp;
        if (h.movement.axis === 'lateral') h.lateral = h.baseLateral + offset;
        else                               h.vertical = h.baseVertical + offset;
        h.lateral = THREE.MathUtils.clamp(h.lateral, -PLAYFIELD_HALF_WIDTH + h.hitRadius, PLAYFIELD_HALF_WIDTH - h.hitRadius);
        h.vertical = THREE.MathUtils.clamp(h.vertical, -PLAYFIELD_HALF_HEIGHT + h.hitRadius, PLAYFIELD_HALF_HEIGHT - h.hitRadius);
      }
      const p = track.pointAt(h.dist);
      const frame = track.frameAt(h.dist);
      h.mesh.position.copy(p).addScaledVector(frame.right, h.lateral).addScaledVector(frame.up, h.vertical);
      if (h.isFrontFacing) {
        const mtx = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.fwd);
        h.mesh.quaternion.setFromRotationMatrix(mtx);
      }
      // SPATIAL: emit a Doppler whoosh once as each hazard crosses the photon (4 units ahead → behind).
      // Only for non-pickup hazards (no whoosh on collectibles).
      if (!h.whooshed && h.type !== 'pickup' && h.type !== 'finalPickup') {
        const dzAhead = h.dist - photonDist;
        if (dzAhead < 5 && dzAhead > -2) {
          h.whooshed = true;
          // Quieter for tiny fluctuations, louder for chunky hazards
          const intensity = h.type === 'fluct' ? 0.5 : h.type === 'well' ? 1.4 : h.type === 'supernova' ? 1.6 : 0.8;
          audio.whoosh(h.mesh.position, intensity, h.type);
        }
      }
      if (h.hit) continue;
      const dz = h.dist - photonDist;
      if (Math.abs(dz) > HIT_WINDOW) continue;
      const dx = h.lateral - photonLat;
      const dy = h.vertical - photonVer;
      const dist2 = dx * dx + dy * dy;
      const r = h.hitRadius || 2.6;
      if (dist2 > r * r) {
        if (!h.nearMissed && h.type !== 'pickup' && h.type !== 'finalPickup' && dist2 <= (r + 4.2) * (r + 4.2)) {
          h.nearMissed = true;
          funLab.record('hazard-near-miss', { epochIndex: game.epochIndex, distance: photonDist, cause: h.type });
        }
        continue;
      }
      // Collision
      if (h.type === 'pickup' || h.type === 'finalPickup') {
        h.hit = true; h.mesh.visible = false;
        if (h.type === 'finalPickup') {
          particleManager.emitBurst(h.mesh.position.clone(), 'death', 80, new THREE.Color(0xfafaff));
          particleManager.emitBurst(h.mesh.position.clone(), 'death', 60, new THREE.Color(0xb888ff));
          triggerWitness();
        } else {
          funLab.record('pickup', { epochIndex: game.epochIndex, distance: photonDist, value: 20 });
          onCollect(20);
          particleManager.emitBurst(h.mesh.position.clone(), 'pickup', 18, new THREE.Color(0xfff3a0));
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
        particleManager.emitBurst(h.mesh.position.clone(), 'phase', 14, WAVELENGTHS[h.wlIdx].color);
        if (h.chainId != null) {
          for (const other of this.list) {
            if (other !== h && other.chainId === h.chainId && !other.hit) {
              other.hit = true;
              (other.mesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
              particleManager.emitBurst(other.mesh.position.clone(), 'phase', 12, WAVELENGTHS[h.wlIdx].color);
            }
          }
          if (!meta.firstChainPhased) { meta.firstChainPhased = true; saveMeta(meta); checkMemoryTriggers(); }
        }
        if (h.type === 'well') {
          photon.distance += 95 + Math.random() * 55;
          photon.invulnTimer = Math.max(photon.invulnTimer, 1.15);
          photon.energy = Math.min(photon.maxEnergy(), photon.energy + 12);
          particleManager.emitBurst(h.mesh.position.clone(), 'death', 22, new THREE.Color(0x66ffcc));
          if (!meta.firstWormhole) { meta.firstWormhole = true; saveMeta(meta); checkMemoryTriggers(); }
          game.trauma = Math.min(1, game.trauma + 0.25);
        }
        if (h.wlIdx === 0) maybeUnlockCodexFn('GAMMA', CODEX_ENTRIES);
        if (h.wlIdx === 2) maybeUnlockCodexFn('RADIO', CODEX_ENTRIES);
      } else {
        if (onHit(h.dmg)) {
          funLab.record('hazard-hit', { epochIndex: game.epochIndex, distance: photonDist, cause: h.type, damage: h.dmg, value: h.dmg });
          h.hit = true;
          (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
          const hitColor = h.wlIdx >= 0 ? WAVELENGTHS[h.wlIdx].color : new THREE.Color(0xff5566);
          particleManager.emitBurst(h.mesh.position.clone(), 'hit', 22, hitColor);
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

// Spawned exactly once at t=300s of Heat Death. Triggers the witness ending on collection.
export function spawnFinalPickup(dist: number) {
  const geo = new THREE.IcosahedronGeometry(0.9, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.0, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 0.5, depthWrite: false }));
  mesh.add(halo);
  const halo2 = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfafaff, transparent: true, opacity: 0.18, depthWrite: false }));
  mesh.add(halo2);
  const p = track.pointAt(dist);
  mesh.position.copy(p);
  hazards.group.add(mesh);
  hazards.list.push({ kind: 'pickup', type: 'finalPickup', dist, lateral: 0, vertical: 0, baseLateral: 0, baseVertical: 0, wlIdx: -1, dmg: 0, mesh, hit: false, hitRadius: 2.6 });
}
