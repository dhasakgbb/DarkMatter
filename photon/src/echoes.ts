import * as THREE from 'three';
import { scene } from './scene';
import { track } from './track';
import { WAVELENGTHS } from './cosmology';
import { BASE_SPEED } from './constants';

interface Echo {
  grp: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  trail: THREE.Line;
  trailMat: THREE.LineBasicMaterial;
  dist: number;
  offset: number;
  verticalOff: number;
  vel: number;
  life: number;
  maxLife: number;
  history: THREE.Vector3[];
  color: THREE.Color;
}

class EchoSystem {
  echoes: Echo[] = [];
  group = new THREE.Group();
  coreGeo = new THREE.IcosahedronGeometry(0.45, 1);
  haloGeo = new THREE.SphereGeometry(1.1, 12, 8);
  trailLen = 16;
  private readonly scratchPoint = new THREE.Vector3();
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchFrame = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };

  constructor() { scene.add(this.group); }

  spawn(dist: number) {
    const wlIdx = Math.floor(Math.random() * 3);
    const color = WAVELENGTHS[wlIdx].color.clone();
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false });
    const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(this.coreGeo, coreMat);
    const halo = new THREE.Mesh(this.haloGeo, haloMat);
    const grp = new THREE.Group(); grp.add(core); grp.add(halo);
    const offset = (Math.random() - 0.5) * 16;
    const verticalOff = (Math.random() - 0.5) * 16;
    const trailGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.trailLen * 3);
    const colors = new Float32Array(this.trailLen * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    const trail = new THREE.Line(trailGeo, trailMat);
    trail.frustumCulled = false;
    this.group.add(grp);
    this.group.add(trail);
    this.echoes.push({
      grp, core, halo, coreMat, haloMat, trail, trailMat,
      dist: dist + (Math.random() - 0.5) * 30,
      offset, verticalOff,
      vel: BASE_SPEED * 0.55 * (0.85 + Math.random() * 0.3),
      life: 14 + Math.random() * 8,
      maxLife: 14 + Math.random() * 8,
      history: [],
      color,
    });
  }

  update(dt: number) {
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const e = this.echoes[i];
      e.life -= dt;
      e.dist += e.vel * dt;
      const p = track.pointAt(e.dist, this.scratchPoint);
      const frame = track.frameAt(e.dist, this.scratchFrame);
      const pos = this.scratchPos.copy(p).addScaledVector(frame.right, e.offset).addScaledVector(frame.up, e.verticalOff);
      e.grp.position.copy(pos);
      const f = e.life / e.maxLife;
      const fadeIn = Math.min(1, (1 - f) * 4);
      const fadeOut = Math.min(1, f * 3);
      const alpha = Math.min(fadeIn, fadeOut) * 0.55;
      e.coreMat.opacity = alpha * 0.9;
      e.haloMat.opacity = alpha * 0.6;
      e.history.unshift(pos.clone());
      if (e.history.length > this.trailLen) e.history.length = this.trailLen;
      const posArr = e.trail.geometry.attributes.position.array as Float32Array;
      const colArr = e.trail.geometry.attributes.color.array as Float32Array;
      for (let j = 0; j < this.trailLen; j++) {
        const h = e.history[Math.min(j, e.history.length - 1)] || pos;
        posArr[j*3+0] = h.x; posArr[j*3+1] = h.y; posArr[j*3+2] = h.z;
        const k = (1 - j / this.trailLen) * alpha;
        colArr[j*3+0] = e.color.r * k;
        colArr[j*3+1] = e.color.g * k;
        colArr[j*3+2] = e.color.b * k;
      }
      e.trail.geometry.attributes.position.needsUpdate = true;
      e.trail.geometry.attributes.color.needsUpdate = true;
      if (e.life <= 0) {
        this.group.remove(e.grp);
        this.group.remove(e.trail);
        this.echoes.splice(i, 1);
      }
    }
  }

  reset() {
    for (const e of this.echoes) { this.group.remove(e.grp); this.group.remove(e.trail); }
    this.echoes.length = 0;
  }
}

export const echoSystem = new EchoSystem();
export function spawnEchoPhoton(photonDist: number) { echoSystem.spawn(photonDist); }
