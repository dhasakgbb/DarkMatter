import * as THREE from 'three';
import { GUIDE_ARC_RADIUS, PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH, SEGMENT_LEN, SEGMENTS_AHEAD, SEGMENTS_BEHIND, RING_SPACING, IS_MOBILE } from './constants';
import { scene } from './scene';
import type { Epoch } from './cosmology';
import { game } from './state';

class Track {
  points: THREE.Vector3[] = [];
  segIndex = 0;
  curve: THREE.CatmullRomCurve3 | null = null;
  ringPool: THREE.Mesh[] = [];
  ringGroup = new THREE.Group();
  routeGroup = new THREE.Group();
  routeLines: THREE.Line[] = [];
  dustGroup = new THREE.Group();
  dust!: THREE.Points;
  twistFreq = 0.012;
  twistAmp = 10;
  _ringSeed = Math.random() * 1000;

  constructor() {
    scene.add(this.ringGroup);
    scene.add(this.routeGroup);
    scene.add(this.dustGroup);
    const ringGeo = new THREE.RingGeometry(GUIDE_ARC_RADIUS - 0.22, GUIDE_ARC_RADIUS + 0.22, 72, 1, 0, Math.PI * 0.72);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x88e0ff, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 42; i++) {
      const m = new THREE.Mesh(ringGeo, ringMat.clone());
      m.frustumCulled = false;
      (m.userData as any).arcAngle = Math.random() * Math.PI * 2;
      (m.userData as any).arcDrift = (Math.random() - 0.5) * 0.35;
      this.ringGroup.add(m);
      this.ringPool.push(m);
    }
    for (let i = -1; i <= 1; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(54 * 3), 3));
      const m = new THREE.LineBasicMaterial({
        color: i === 0 ? 0x88e0ff : 0xff7ad9,
        transparent: true,
        opacity: i === 0 ? 0.22 : 0.13,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      (line.userData as any).lane = i;
      this.routeGroup.add(line);
      this.routeLines.push(line);
    }
    const N = IS_MOBILE ? 220 : 480;
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      positions[i*3+0] = (Math.random() - 0.5) * PLAYFIELD_HALF_WIDTH * 2.2;
      positions[i*3+1] = (Math.random() - 0.5) * PLAYFIELD_HALF_HEIGHT * 2.2;
      positions[i*3+2] = Math.random() * SEGMENT_LEN * SEGMENTS_AHEAD;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.5, depthWrite: false });
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
      mat.color.copy(epoch.palettePoint).lerp(epoch.paletteB, Math.abs((line.userData as any).lane) * 0.45);
    }
    (this.dust.material as THREE.PointsMaterial).color.copy(epoch.palettePoint).multiplyScalar(0.7);
  }

  ensureAhead(targetSegIdx: number) {
    while (this.segIndex < targetSegIdx + SEGMENTS_AHEAD) {
      const i = this.segIndex;
      const x = Math.sin(i * this.twistFreq) * this.twistAmp + Math.sin(i * this.twistFreq * 0.31 + 1.7) * this.twistAmp * 0.7;
      const y = Math.cos(i * this.twistFreq * 0.83) * this.twistAmp * 0.6 + Math.sin(i * this.twistFreq * 0.27) * this.twistAmp * 0.4;
      const z = i * SEGMENT_LEN;
      this.points.push(new THREE.Vector3(x, y, z));
      this.segIndex++;
    }
    if (this.points.length > SEGMENTS_AHEAD + SEGMENTS_BEHIND + 10) {
      this.points.splice(0, this.points.length - (SEGMENTS_AHEAD + SEGMENTS_BEHIND));
    }
    this.curve = new THREE.CatmullRomCurve3(this.points, false, 'catmullrom', 0.5);
  }

  pointAt(d: number): THREE.Vector3 {
    if (!this.curve) return new THREE.Vector3();
    const firstZ = this.points[0].z;
    const lastZ = this.points[this.points.length - 1].z;
    const u = THREE.MathUtils.clamp((d - firstZ) / (lastZ - firstZ), 0, 1);
    return this.curve.getPoint(u);
  }
  tangentAt(d: number): THREE.Vector3 {
    if (!this.curve) return new THREE.Vector3(0, 0, 1);
    const firstZ = this.points[0].z;
    const lastZ = this.points[this.points.length - 1].z;
    const u = THREE.MathUtils.clamp((d - firstZ) / (lastZ - firstZ), 0, 1);
    return this.curve.getTangent(u).normalize();
  }
  // "right" here means SCREEN-right from the chase-cam's perspective (post lookAt convention).
  frameAt(d: number) {
    const fwd = this.tangentAt(d);
    const worldUp = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(fwd, worldUp);
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { fwd, right, up };
  }

  updateRings(photonZ: number) {
    const startD = photonZ - 30;
    const endD = photonZ + RING_SPACING * (this.ringPool.length - 4);
    const time = performance.now() * 0.0018;
    let idx = 0;
    for (let d = startD; d <= endD && idx < this.ringPool.length; d += RING_SPACING, idx++) {
      const m = this.ringPool[idx];
      const p = this.pointAt(d);
      const frame = this.frameAt(d);
      m.position.copy(p);
      const mtx = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.fwd);
      m.quaternion.setFromRotationMatrix(mtx);
      const distToPhoton = d - photonZ;
      const t = THREE.MathUtils.smoothstep(distToPhoton, -20, 60);
      const farFade = 1 - THREE.MathUtils.clamp((distToPhoton - 200) / 200, 0, 1);
      const shimmer = 0.86 + 0.10 * Math.sin(time * 2.7 + d * 0.09) + 0.06 * Math.sin(time * 7.3 + d * 0.31);
      (m.material as THREE.MeshBasicMaterial).opacity = (0.04 + 0.20 * t * farFade) * shimmer;
      const sc = 1 + Math.sin(d * 0.21 + time * 3.3) * 0.018;
      m.scale.set(sc, sc, 1);
      m.rotateZ(((m.userData as any).arcAngle || 0) + time * ((m.userData as any).arcDrift || 0));
      m.visible = true;
    }
    for (let j = idx; j < this.ringPool.length; j++) this.ringPool[j].visible = false;
    this.updateRouteLines(photonZ);
  }

  updateRouteLines(photonZ: number) {
    const samples = 54;
    const startD = photonZ + 18;
    const step = 8;
    for (const line of this.routeLines) {
      const lane = (line.userData as any).lane || 0;
      const arr = line.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < samples; i++) {
        const d = startD + i * step;
        const p = this.pointAt(d);
        const frame = this.frameAt(d);
        const wave = Math.sin(d * 0.018 + this._ringSeed + lane * 1.9);
        const slow = Math.cos(d * 0.011 + lane * 2.4);
        const lateral = lane * PLAYFIELD_HALF_WIDTH * 0.25 + wave * PLAYFIELD_HALF_WIDTH * 0.20;
        const vertical = slow * PLAYFIELD_HALF_HEIGHT * 0.18;
        const q = p.addScaledVector(frame.right, lateral).addScaledVector(frame.up, vertical);
        arr[i*3+0] = q.x; arr[i*3+1] = q.y; arr[i*3+2] = q.z;
      }
      line.geometry.attributes.position.needsUpdate = true;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = lane === 0 ? 0.20 : 0.12;
      line.visible = true;
    }
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
    const p = this.pointAt(photonZ + span * 0.3);
    this.dustGroup.position.set(p.x * 0.3, p.y * 0.3, 0);
  }
}

export const track = new Track();
