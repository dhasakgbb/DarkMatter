import * as THREE from 'three';
import { GUIDE_ARC_RADIUS, PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD, SEGMENTS_BEHIND, RING_SPACING, IS_MOBILE } from './constants';
import { scene } from './scene';
import type { Epoch } from './cosmology';
import { game } from './state';
import { skillBias } from './flow';
import { getActiveRenderProfile } from './renderProfile';

export interface TrackFrame {
  fwd: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

function makeTrackFrame(): TrackFrame {
  return {
    fwd: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  };
}

interface TrackRingUserData {
  arcAngle: number;
  arcDrift: number;
}

interface RouteLineUserData {
  lane: number;
}

function trackRingData(mesh: THREE.Mesh): TrackRingUserData {
  return mesh.userData as TrackRingUserData;
}

function routeLineData(line: THREE.Line): RouteLineUserData {
  return line.userData as RouteLineUserData;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const INITIAL_PROFILE = getActiveRenderProfile();
const ROUTE_SAMPLES = INITIAL_PROFILE.routeSamples;
const RING_POOL_SIZE = INITIAL_PROFILE.ringPoolSize;
const ROUTE_LANES = INITIAL_PROFILE.quality === 'mobile' ? [-1, 0, 1] : [-2, -1, 0, 1, 2];

class Track {
  points: THREE.Vector3[] = [];
  segIndex = 0;
  curve: THREE.CatmullRomCurve3 | null = null;
  ringPool: THREE.Mesh[] = [];
  ringGroup = new THREE.Group();
  routeGroup = new THREE.Group();
  routeLines: THREE.Line[] = [];
  routeBeads!: THREE.Points;
  dustGroup = new THREE.Group();
  dust!: THREE.Points;
  twistFreq = 0.012;
  twistAmp = 10;
  _ringSeed = Math.random() * 1000;
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly ringPoint = new THREE.Vector3();
  private readonly ringFrame = makeTrackFrame();
  private readonly routePoint = new THREE.Vector3();
  private readonly routeFrame = makeTrackFrame();
  private readonly beadPoint = new THREE.Vector3();
  private readonly beadFrame = makeTrackFrame();
  private readonly dustPoint = new THREE.Vector3();

  constructor() {
    scene.add(this.ringGroup);
    scene.add(this.routeGroup);
    scene.add(this.dustGroup);
    const ringGeo = new THREE.RingGeometry(GUIDE_ARC_RADIUS - 0.22, GUIDE_ARC_RADIUS + 0.22, IS_MOBILE ? 48 : 72, 1, 0, Math.PI * 0.72);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x88e0ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const m = new THREE.Mesh(ringGeo, ringMat.clone());
      m.frustumCulled = false;
      const data = trackRingData(m);
      data.arcAngle = Math.random() * Math.PI * 2;
      data.arcDrift = (Math.random() - 0.5) * 0.35;
      this.ringGroup.add(m);
      this.ringPool.push(m);
    }
    for (const i of ROUTE_LANES) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROUTE_SAMPLES * 3), 3));
      const side = Math.abs(i);
      const m = new THREE.LineBasicMaterial({
        color: i === 0 ? 0x88e0ff : 0xff7ad9,
        transparent: true,
        opacity: i === 0 ? 0.26 : side > 1 ? 0.08 : 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      routeLineData(line).lane = i;
      this.routeGroup.add(line);
      this.routeLines.push(line);
    }
    const beadCount = INITIAL_PROFILE.quality === 'mobile' ? 42 : INITIAL_PROFILE.quality === 'balanced' ? 92 : 132;
    const beadGeo = new THREE.BufferGeometry();
    beadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(beadCount * 3), 3));
    const beadMat = new THREE.PointsMaterial({
      color: 0x88e0ff,
      size: IS_MOBILE ? 1.25 : 1.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.routeBeads = new THREE.Points(beadGeo, beadMat);
    this.routeBeads.frustumCulled = false;
    this.routeGroup.add(this.routeBeads);

    const N = INITIAL_PROFILE.trackDustCount;
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      positions[i*3+0] = (Math.random() - 0.5) * PLAYFIELD_HALF_WIDTH * 2.2;
      positions[i*3+1] = (Math.random() - 0.5) * PLAYFIELD_HALF_HEIGHT * 2.2;
      positions[i*3+2] = Math.random() * SEGMENT_LEN * SEGMENTS_AHEAD;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.72, transparent: true, opacity: 0.58, depthWrite: false, blending: THREE.AdditiveBlending });
    this.dust = new THREE.Points(g, dustMat);
    this.dust.frustumCulled = false;
    this.dustGroup.add(this.dust);
  }

  setEpoch(epoch: Epoch) {
    const params = (game.epochParams && game.epochParams[game.epochIndex]) || { twistFreqMul: 1, twistAmpMul: 1 };
    this.twistFreq = epoch.twistFreq * params.twistFreqMul;
    this.twistAmp  = epoch.twistAmp  * params.twistAmpMul;
    const ringColor = epoch.palettePoint.clone();
    for (const m of this.ringPool) (m.material as THREE.MeshBasicMaterial).color.copy(ringColor);
    for (const line of this.routeLines) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.copy(epoch.palettePoint).lerp(epoch.paletteB, Math.abs(routeLineData(line).lane) * 0.45);
    }
    (this.routeBeads.material as THREE.PointsMaterial).color.copy(epoch.palettePoint).lerp(epoch.paletteA, 0.22);
    (this.dust.material as THREE.PointsMaterial).color.copy(epoch.palettePoint).multiplyScalar(0.7);
  }

  ensureAhead(targetSegIdx: number) {
    let changed = false;
    // Adaptive twist: amplify (or relax) curvature for upcoming segments based
    // on flow signal. Tutorial epoch is exempt to protect onboarding.
    const twistScale = 1 + skillBias(game.flowLevel || 0, game.epochIndex) * 0.6;
    while (this.segIndex < targetSegIdx + SEGMENTS_AHEAD) {
      const i = this.segIndex;
      const amp = this.twistAmp * twistScale;
      const x = Math.sin(i * this.twistFreq) * amp + Math.sin(i * this.twistFreq * 0.31 + 1.7) * amp * 0.7;
      const y = Math.cos(i * this.twistFreq * 0.83) * amp * 0.6 + Math.sin(i * this.twistFreq * 0.27) * amp * 0.4;
      const z = i * SEGMENT_LEN;
      this.points.push(new THREE.Vector3(x, y, z));
      this.segIndex++;
      changed = true;
    }
    if (this.points.length > SEGMENTS_AHEAD + SEGMENTS_BEHIND + 10) {
      this.points.splice(0, this.points.length - (SEGMENTS_AHEAD + SEGMENTS_BEHIND));
      changed = true;
    }
    if (changed || !this.curve) this.curve = new THREE.CatmullRomCurve3(this.points, false, 'catmullrom', 0.5);
  }

  pointAt(d: number, target: THREE.Vector3): THREE.Vector3 {
    if (!this.curve) return target.set(0, 0, 0);
    const firstZ = this.points[0].z;
    const lastZ = this.points[this.points.length - 1].z;
    const u = THREE.MathUtils.clamp((d - firstZ) / (lastZ - firstZ), 0, 1);
    return this.curve.getPoint(u, target);
  }
  tangentAt(d: number, target: THREE.Vector3): THREE.Vector3 {
    if (!this.curve) return target.set(0, 0, 1);
    const firstZ = this.points[0].z;
    const lastZ = this.points[this.points.length - 1].z;
    const u = THREE.MathUtils.clamp((d - firstZ) / (lastZ - firstZ), 0, 1);
    return this.curve.getTangent(u, target).normalize();
  }
  // "right" here means SCREEN-right from the chase-cam's perspective (post lookAt convention).
  frameAt(d: number, target: TrackFrame) {
    this.tangentAt(d, target.fwd);
    target.right.crossVectors(target.fwd, WORLD_UP);
    if (target.right.lengthSq() < 1e-4) target.right.set(1, 0, 0);
    target.right.normalize();
    target.up.crossVectors(target.right, target.fwd).normalize();
    return target;
  }

  updateRings(photonZ: number) {
    const startD = photonZ - 30;
    const endD = photonZ + RING_SPACING * (this.ringPool.length - 4);
    const time = performance.now() * 0.0018;
    let idx = 0;
    for (let d = startD; d <= endD && idx < this.ringPool.length; d += RING_SPACING, idx++) {
      const m = this.ringPool[idx];
      const p = this.pointAt(d, this.ringPoint);
      const frame = this.frameAt(d, this.ringFrame);
      m.position.copy(p);
      const mtx = this.scratchMatrix.makeBasis(frame.right, frame.up, frame.fwd);
      m.quaternion.setFromRotationMatrix(mtx);
      const distToPhoton = d - photonZ;
      const t = THREE.MathUtils.smoothstep(distToPhoton, -20, 60);
      const farFade = 1 - THREE.MathUtils.clamp((distToPhoton - 200) / 200, 0, 1);
      const shimmer = 0.86 + 0.10 * Math.sin(time * 2.7 + d * 0.09) + 0.06 * Math.sin(time * 7.3 + d * 0.31);
      (m.material as THREE.MeshBasicMaterial).opacity = (0.018 + 0.118 * t * farFade) * shimmer;
      const sc = 1 + Math.sin(d * 0.21 + time * 3.3) * 0.018;
      m.scale.set(sc, sc, 1);
      const ring = trackRingData(m);
      m.rotateZ(ring.arcAngle + time * ring.arcDrift);
      m.visible = true;
    }
    for (let j = idx; j < this.ringPool.length; j++) this.ringPool[j].visible = false;
    this.updateRouteLines(photonZ);
  }

  updateRouteLines(photonZ: number) {
    const samples = ROUTE_SAMPLES;
    const startD = photonZ + 18;
    const step = 8;
    for (const line of this.routeLines) {
      const lane = routeLineData(line).lane;
      const arr = line.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < samples; i++) {
        const d = startD + i * step;
        const p = this.pointAt(d, this.routePoint);
        const frame = this.frameAt(d, this.routeFrame);
        const wave = Math.sin(d * 0.018 + this._ringSeed + lane * 1.9);
        const slow = Math.cos(d * 0.011 + lane * 2.4);
        const laneOuter = Math.abs(lane) > 1;
        const lateral = lane * PLAYFIELD_HALF_WIDTH * (laneOuter ? 0.17 : 0.25) + wave * PLAYFIELD_HALF_WIDTH * (laneOuter ? 0.11 : 0.20);
        const vertical = slow * PLAYFIELD_HALF_HEIGHT * (laneOuter ? 0.25 : 0.18) + (laneOuter ? Math.sin(d * 0.006 + lane) * 4.5 : 0);
        const q = p.addScaledVector(frame.right, lateral).addScaledVector(frame.up, vertical);
        arr[i*3+0] = q.x; arr[i*3+1] = q.y; arr[i*3+2] = q.z;
      }
      line.geometry.attributes.position.needsUpdate = true;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = lane === 0 ? 0.30 : Math.abs(lane) > 1 ? 0.09 : 0.17;
      line.visible = true;
    }
    const beads = this.routeBeads.geometry.attributes.position.array as Float32Array;
    const beadCount = beads.length / 3;
    const time = performance.now() * 0.001;
    for (let i = 0; i < beadCount; i++) {
      const d = photonZ + 24 + i * 7.5;
      const p = this.pointAt(d, this.beadPoint);
      const frame = this.frameAt(d, this.beadFrame);
      const wave = Math.sin(d * 0.019 + this._ringSeed);
      const slow = Math.cos(d * 0.012 + 1.6);
      const shimmer = Math.sin(time * 5.0 + i * 0.7) * 0.55 + 0.45;
      const lateral = wave * PLAYFIELD_HALF_WIDTH * 0.18;
      const vertical = slow * PLAYFIELD_HALF_HEIGHT * 0.16 + shimmer * 0.7;
      const q = p.addScaledVector(frame.right, lateral).addScaledVector(frame.up, vertical);
      beads[i*3+0] = q.x;
      beads[i*3+1] = q.y;
      beads[i*3+2] = q.z;
    }
    this.routeBeads.geometry.attributes.position.needsUpdate = true;
    const beadMat = this.routeBeads.material as THREE.PointsMaterial;
    beadMat.opacity = 0.36 + 0.14 * Math.sin(time * 2.6);
    this.routeBeads.visible = true;
  }

  updateDust(photonZ: number) {
    const span = SEGMENT_LEN * SEGMENTS_AHEAD;
    const arr = this.dust.geometry.attributes.position.array as Float32Array;
    const t = performance.now() * 0.001;
    for (let i = 0; i < arr.length; i += 3) {
      let dz = arr[i+2] - photonZ;
      if (dz < -10) {
        arr[i+2] += span;
        arr[i+0] = (Math.random() - 0.5) * PLAYFIELD_HALF_WIDTH * 2.1;
        arr[i+1] = (Math.random() - 0.5) * PLAYFIELD_HALF_HEIGHT * 2.1;
      } else if (dz > span) {
        arr[i+2] -= span;
      } else {
        arr[i+0] += Math.sin(t * 9.1 + i * 0.31) * 0.04;
        arr[i+1] += Math.cos(t * 7.7 + i * 0.27) * 0.04;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    const p = this.pointAt(photonZ + span * 0.3, this.dustPoint);
    this.dustGroup.position.set(p.x * 0.3, p.y * 0.3, 0);
  }
}

export const track = new Track();
