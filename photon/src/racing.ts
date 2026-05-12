import * as THREE from 'three';
import { PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD } from './constants';
import type { Epoch } from './cosmology';
import { scene } from './scene';
import { track } from './track';
import { game } from './state';
import { runRng } from './seed';

type RacingKind = 'gate' | 'pad';

function gameSeedPhase() {
  return ((game.runSeed || 0) % 997) * 0.0063;
}

export interface RacingEntity {
  kind: RacingKind;
  dist: number;
  lateral: number;
  vertical: number;
  radius: number;
  object: THREE.Object3D;
  hit: boolean;
  missed: boolean;
}

class RacingLineManager {
  list: RacingEntity[] = [];
  group = new THREE.Group();
  private lastSpawnDist = 70;
  private gateGeo = new THREE.TorusGeometry(5.4, 0.14, 8, 56);
  private gateInnerGeo = new THREE.TorusGeometry(2.1, 0.06, 6, 32);
  private padGeo = new THREE.TorusGeometry(3.4, 0.16, 8, 36);
  private padStripeGeo = new THREE.TorusGeometry(1.75, 0.07, 6, 28);

  constructor() {
    scene.add(this.group);
  }

  reset() {
    for (const e of this.list) this.group.remove(e.object);
    this.list.length = 0;
    this.lastSpawnDist = 70;
  }

  ensureAhead(epoch: Epoch, photonDist: number) {
    const horizon = photonDist + SEGMENT_LEN * SEGMENTS_AHEAD - 42;
    if (!epoch.isHeatDeath) {
      while (this.lastSpawnDist < horizon) {
        const gap = 72 + runRng() * 46;
        this.lastSpawnDist += gap / Math.max(0.75, epoch.speedMul);
        const line = this.racingLineAt(this.lastSpawnDist);
        this.spawnGate(this.lastSpawnDist, line.lateral, line.vertical);

        if (runRng() < 0.78) {
          const padDist = this.lastSpawnDist + 18 + runRng() * 22;
          const padLine = this.racingLineAt(padDist);
          const lateral = THREE.MathUtils.lerp(line.lateral, padLine.lateral, 0.65) + (runRng() - 0.5) * 3;
          const vertical = THREE.MathUtils.lerp(line.vertical, padLine.vertical, 0.65) + (runRng() - 0.5) * 2;
          this.spawnPad(padDist, lateral, vertical);
        }
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dist < photonDist - 32) {
        this.group.remove(e.object);
        this.list.splice(i, 1);
      }
    }
  }

  update(
    dt: number,
    photonDist: number,
    photonLat: number,
    photonVer: number,
    onPad: (pos: THREE.Vector3) => void,
    onGate: (pos: THREE.Vector3) => void,
    onMiss: () => void,
  ) {
    const HIT_WINDOW = 3.2;
    const t = performance.now() * 0.001;
    for (const e of this.list) {
      this.place(e);
      const dz = e.dist - photonDist;
      const nearFade = e.kind === 'pad' ? THREE.MathUtils.smoothstep(dz, -2, 18) : 1;
      const materialOpacity = (e.kind === 'gate' ? 0.78 : 0.68) * nearFade;
      e.object.traverse(obj => {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mat && mat.opacity != null) mat.opacity = e.hit || e.missed ? 0.12 : materialOpacity;
      });
      const pulse = 1 + Math.sin(t * (e.kind === 'gate' ? 5.6 : 9.2) + e.dist * 0.07) * (e.kind === 'gate' ? 0.025 : 0.045);
      e.object.scale.setScalar(pulse);
      e.object.visible = e.kind === 'pad' ? dz > -4 : dz > -24;
      if (e.hit || e.missed) continue;

      const dx = e.lateral - photonLat;
      const dy = e.vertical - photonVer;
      const inside = dx * dx + dy * dy <= e.radius * e.radius;
      if (Math.abs(dz) <= HIT_WINDOW && inside) {
        e.hit = true;
        e.object.visible = false;
        if (e.kind === 'pad') onPad(e.object.position.clone());
        else onGate(e.object.position.clone());
      } else if (e.kind === 'gate' && dz < -HIT_WINDOW) {
        e.missed = true;
        onMiss();
      }
    }
  }

  private racingLineAt(dist: number) {
    const p = track.pointAt(dist);
    const ahead = track.pointAt(dist + 78);
    const frame = track.frameAt(dist);
    const bend = ahead.sub(p);
    const routeWaveA = Math.sin(dist * 0.021 + gameSeedPhase());
    const routeWaveB = Math.sin(dist * 0.013 + 1.8);
    let lateral = -THREE.MathUtils.clamp(bend.dot(frame.right) * 0.72, -15, 15);
    let vertical = -THREE.MathUtils.clamp(bend.dot(frame.up) * 0.58, -10, 10);
    lateral += routeWaveA * PLAYFIELD_HALF_WIDTH * 0.36 + (runRng() - 0.5) * 4.8;
    vertical += routeWaveB * PLAYFIELD_HALF_HEIGHT * 0.30 + (runRng() - 0.5) * 3.6;

    lateral = THREE.MathUtils.clamp(lateral, -PLAYFIELD_HALF_WIDTH * 0.78, PLAYFIELD_HALF_WIDTH * 0.78);
    vertical = THREE.MathUtils.clamp(vertical, -PLAYFIELD_HALF_HEIGHT * 0.78, PLAYFIELD_HALF_HEIGHT * 0.78);
    return { lateral, vertical };
  }

  private spawnGate(dist: number, lateral: number, vertical: number) {
    const group = new THREE.Group();
    group.name = 'racing-line-gate';
    const ring = new THREE.Mesh(
      this.gateGeo,
      new THREE.MeshBasicMaterial({
        color: 0x88e0ff,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const inner = new THREE.Mesh(
      this.gateInnerGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff7ad9,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(ring, inner);
    this.group.add(group);
    const e: RacingEntity = { kind: 'gate', dist, lateral, vertical, radius: 5.8, object: group, hit: false, missed: false };
    this.place(e);
    this.list.push(e);
  }

  private spawnPad(dist: number, lateral: number, vertical: number) {
    const group = new THREE.Group();
    group.name = 'speed-pad';
    const pad = new THREE.Mesh(
      this.padGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff7ad9,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const stripe = new THREE.Mesh(
      this.padStripeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    stripe.position.z = 0.04;
    group.add(pad, stripe);
    this.group.add(group);
    const e: RacingEntity = { kind: 'pad', dist, lateral, vertical, radius: 4.6, object: group, hit: false, missed: false };
    this.place(e);
    this.list.push(e);
  }

  private place(e: RacingEntity) {
    const p = track.pointAt(e.dist);
    const frame = track.frameAt(e.dist);
    e.object.position.copy(p).addScaledVector(frame.right, e.lateral).addScaledVector(frame.up, e.vertical);
    const mtx = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.fwd);
    e.object.quaternion.setFromRotationMatrix(mtx);
  }
}

export const racingLine = new RacingLineManager();
