import * as THREE from 'three';
import { IS_MOBILE, PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD } from './constants';
import type { Epoch } from './cosmology';
import { scene } from './scene';
import { track } from './track';
import { game } from './state';
import { runRng } from './seed';
import { getActiveRenderProfile } from './renderProfile';
import { pickNextRacingCue } from './racingCue';
import { activeTutorialNeed, tutorialRacingTuning } from './tutorial';

type RacingKind = 'gate' | 'pad';

interface RacingMaterialLayer {
  material: THREE.MeshBasicMaterial;
  opacityScale: number;
}

function gameSeedPhase() {
  return ((game.runSeed || 0) % 997) * 0.0063;
}

const INITIAL_ROUTE_SCALE = 0.52;
const ROUTE_MAX_LAT_STEP = 11.5;
const ROUTE_MAX_VER_STEP = 7.4;

export interface RacingEntity {
  kind: RacingKind;
  dist: number;
  lateral: number;
  vertical: number;
  radius: number;
  object: THREE.Object3D;
  materialLayers: RacingMaterialLayer[];
  hit: boolean;
  missed: boolean;
}

class RacingLineManager {
  list: RacingEntity[] = [];
  group = new THREE.Group();
  private lastSpawnDist = 42;
  private gateGeo = new THREE.TorusGeometry(6.3, 0.18, IS_MOBILE ? 6 : 8, IS_MOBILE ? 44 : 64);
  private gateInnerGeo = new THREE.TorusGeometry(2.55, 0.07, IS_MOBILE ? 5 : 6, IS_MOBILE ? 24 : 36);
  private padGeo = new THREE.TorusGeometry(3.4, 0.16, IS_MOBILE ? 6 : 8, IS_MOBILE ? 26 : 36);
  private padStripeGeo = new THREE.TorusGeometry(1.75, 0.07, IS_MOBILE ? 5 : 6, IS_MOBILE ? 18 : 28);
  private readonly scratchPoint = new THREE.Vector3();
  private readonly scratchFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly linePoint = new THREE.Vector3();
  private readonly lineAhead = new THREE.Vector3();
  private readonly lineFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  private readonly detail = getActiveRenderProfile().hazardDetail;
  private routeAnchor: { lateral: number; vertical: number } | null = null;
  private routeAnchorDist = 42;

  constructor() {
    scene.add(this.group);
  }

  reset(startDist = 42) {
    for (const e of this.list) this.group.remove(e.object);
    this.list.length = 0;
    this.lastSpawnDist = startDist;
    this.routeAnchor = null;
    this.routeAnchorDist = startDist;
    game.nextRacingCue = null;
  }

  ensureAhead(epoch: Epoch, photonDist: number) {
    const horizon = photonDist + SEGMENT_LEN * SEGMENTS_AHEAD - 42;
    if (!epoch.isHeatDeath) {
      const tutorialNeed = activeTutorialNeed(game.tutorialActive, game.tutorialStep);
      const tutorialTuning = tutorialRacingTuning(tutorialNeed);
      while (this.lastSpawnDist < horizon) {
        const gap = tutorialTuning.gapBase + runRng() * tutorialTuning.gapRange;
        this.lastSpawnDist += gap / Math.max(0.75, epoch.speedMul);
        const targetLine = tutorialTuning.centered ? { lateral: 0, vertical: 0 } : this.racingLineAt(this.lastSpawnDist);
        const line = this.smoothGateTarget(this.lastSpawnDist, targetLine);
        this.spawnGate(this.lastSpawnDist, line.lateral, line.vertical);

        if (runRng() < tutorialTuning.padChance) {
          const padDist = this.lastSpawnDist + (tutorialTuning.centered ? 12 + runRng() * 12 : 16 + runRng() * 20);
          const padLine = tutorialTuning.centered ? line : this.racingLineAt(padDist);
          const padTarget = this.limitRouteStep({
            lateral: THREE.MathUtils.lerp(line.lateral, padLine.lateral, 0.65) + (runRng() - 0.5) * (tutorialTuning.centered ? 0.8 : 2.2),
            vertical: THREE.MathUtils.lerp(line.vertical, padLine.vertical, 0.65) + (runRng() - 0.5) * (tutorialTuning.centered ? 0.6 : 1.6),
          }, line, 9.5, 6.5);
          this.spawnPad(padDist, padTarget.lateral, padTarget.vertical);
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
    const HIT_WINDOW = 4.8;
    const t = performance.now() * 0.001;
    for (const e of this.list) {
      this.place(e);
      const dz = e.dist - photonDist;
      const nearFade = e.kind === 'pad' ? THREE.MathUtils.smoothstep(dz, -2, 18) : 1;
      const materialOpacity = (e.kind === 'gate' ? 0.9 : 0.74) * nearFade;
      const opacity = e.hit || e.missed ? 0.12 : materialOpacity;
      for (const layer of e.materialLayers) layer.material.opacity = opacity * layer.opacityScale;
      const pulse = 1 + Math.sin(t * (e.kind === 'gate' ? 5.6 : 9.2) + e.dist * 0.07) * (e.kind === 'gate' ? 0.025 : 0.045);
      e.object.scale.setScalar(pulse);
      e.object.visible = e.kind === 'pad' ? dz > -4 : dz > -34;
      if (e.hit || e.missed) continue;

      const dx = e.lateral - photonLat;
      const dy = e.vertical - photonVer;
      const inside = dx * dx + dy * dy <= e.radius * e.radius;
      if (Math.abs(dz) <= HIT_WINDOW && inside) {
        e.hit = true;
        e.object.visible = false;
        if (e.kind === 'pad') onPad(e.object.position);
        else onGate(e.object.position);
      } else if (e.kind === 'gate' && dz < -HIT_WINDOW) {
        e.missed = true;
        onMiss();
      }
    }
    game.nextRacingCue = pickNextRacingCue(this.list, photonDist, photonLat, photonVer);
  }

  private limitRouteStep(
    target: { lateral: number; vertical: number },
    anchor: { lateral: number; vertical: number },
    maxLatStep: number,
    maxVerStep: number,
  ) {
    return {
      lateral: THREE.MathUtils.clamp(target.lateral, anchor.lateral - maxLatStep, anchor.lateral + maxLatStep),
      vertical: THREE.MathUtils.clamp(target.vertical, anchor.vertical - maxVerStep, anchor.vertical + maxVerStep),
    };
  }

  private smoothGateTarget(dist: number, target: { lateral: number; vertical: number }) {
    const centered = {
      lateral: THREE.MathUtils.clamp(target.lateral, -PLAYFIELD_HALF_WIDTH * INITIAL_ROUTE_SCALE, PLAYFIELD_HALF_WIDTH * INITIAL_ROUTE_SCALE),
      vertical: THREE.MathUtils.clamp(target.vertical, -PLAYFIELD_HALF_HEIGHT * INITIAL_ROUTE_SCALE, PLAYFIELD_HALF_HEIGHT * INITIAL_ROUTE_SCALE),
    };
    if (!this.routeAnchor) {
      this.routeAnchor = centered;
      this.routeAnchorDist = dist;
      return centered;
    }

    const span = THREE.MathUtils.clamp((dist - this.routeAnchorDist) / 74, 0.75, 1.35);
    const next = this.limitRouteStep(centered, this.routeAnchor, ROUTE_MAX_LAT_STEP * span, ROUTE_MAX_VER_STEP * span);
    this.routeAnchor = next;
    this.routeAnchorDist = dist;
    return next;
  }

  private racingLineAt(dist: number) {
    const p = track.pointAt(dist, this.linePoint);
    const ahead = track.pointAt(dist + 78, this.lineAhead);
    const frame = track.frameAt(dist, this.lineFrame);
    const bend = ahead.sub(p);
    const routeWaveA = Math.sin(dist * 0.021 + gameSeedPhase());
    const routeWaveB = Math.sin(dist * 0.013 + 1.8);
    let lateral = -THREE.MathUtils.clamp(bend.dot(frame.right) * 0.72, -15, 15);
    let vertical = -THREE.MathUtils.clamp(bend.dot(frame.up) * 0.58, -10, 10);
    lateral += routeWaveA * PLAYFIELD_HALF_WIDTH * 0.32 + (runRng() - 0.5) * 3.2;
    vertical += routeWaveB * PLAYFIELD_HALF_HEIGHT * 0.26 + (runRng() - 0.5) * 2.4;

    lateral = THREE.MathUtils.clamp(lateral, -PLAYFIELD_HALF_WIDTH * 0.78, PLAYFIELD_HALF_WIDTH * 0.78);
    vertical = THREE.MathUtils.clamp(vertical, -PLAYFIELD_HALF_HEIGHT * 0.78, PLAYFIELD_HALF_HEIGHT * 0.78);
    return { lateral, vertical };
  }

  private spawnGate(dist: number, lateral: number, vertical: number) {
    const group = new THREE.Group();
    group.name = 'racing-line-gate';
    const outerMat = !IS_MOBILE && this.detail >= 0.8 ? new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }) : null;
    const outer = outerMat ? new THREE.Mesh(this.gateGeo, outerMat) : null;
    if (outer) outer.scale.setScalar(1.34);
    const glowMat = IS_MOBILE ? null : new THREE.MeshBasicMaterial({
      color: 0x88e0ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = glowMat ? new THREE.Mesh(this.gateGeo, glowMat) : null;
    if (glow) glow.scale.setScalar(1.18);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88e0ff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(this.gateGeo, ringMat);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff7ad9,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const inner = new THREE.Mesh(this.gateInnerGeo, innerMat);
    if (outer) group.add(outer);
    if (glow) group.add(glow);
    group.add(ring, inner);
    this.group.add(group);
    const e: RacingEntity = {
      kind: 'gate',
      dist,
      lateral,
      vertical,
      radius: 7.4,
      object: group,
      materialLayers: [
        ...(outerMat ? [{ material: outerMat, opacityScale: 0.42 }] : []),
        ...(glowMat ? [{ material: glowMat, opacityScale: 0.34 }] : []),
        { material: ringMat, opacityScale: 1.0 },
        { material: innerMat, opacityScale: 0.68 },
      ],
      hit: false,
      missed: false,
    };
    this.place(e);
    this.list.push(e);
  }

  private spawnPad(dist: number, lateral: number, vertical: number) {
    const group = new THREE.Group();
    group.name = 'speed-pad';
    const fieldMat = !IS_MOBILE && this.detail >= 0.8 ? new THREE.MeshBasicMaterial({
      color: 0xff7ad9,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }) : null;
    const field = fieldMat ? new THREE.Mesh(this.padGeo, fieldMat) : null;
    if (field) field.scale.setScalar(1.48);
    const glowMat = IS_MOBILE ? null : new THREE.MeshBasicMaterial({
      color: 0xff7ad9,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = glowMat ? new THREE.Mesh(this.padGeo, glowMat) : null;
    if (glow) glow.scale.setScalar(1.26);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0xff7ad9,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pad = new THREE.Mesh(this.padGeo, padMat);
    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stripe = new THREE.Mesh(this.padStripeGeo, stripeMat);
    stripe.position.z = 0.04;
    if (field) group.add(field);
    if (glow) group.add(glow);
    group.add(pad, stripe);
    this.group.add(group);
    const e: RacingEntity = {
      kind: 'pad',
      dist,
      lateral,
      vertical,
      radius: 5.2,
      object: group,
      materialLayers: [
        ...(fieldMat ? [{ material: fieldMat, opacityScale: 0.42 }] : []),
        ...(glowMat ? [{ material: glowMat, opacityScale: 0.34 }] : []),
        { material: padMat, opacityScale: 0.92 },
        { material: stripeMat, opacityScale: 0.82 },
      ],
      hit: false,
      missed: false,
    };
    this.place(e);
    this.list.push(e);
  }

  private place(e: RacingEntity) {
    const p = track.pointAt(e.dist, this.scratchPoint);
    const frame = track.frameAt(e.dist, this.scratchFrame);
    e.object.position.copy(p).addScaledVector(frame.right, e.lateral).addScaledVector(frame.up, e.vertical);
    const mtx = this.scratchMatrix.makeBasis(frame.right, frame.up, frame.fwd);
    e.object.quaternion.setFromRotationMatrix(mtx);
  }
}

export const racingLine = new RacingLineManager();
