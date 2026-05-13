import * as THREE from 'three';
import { IS_MOBILE } from './constants';
import { scene } from './scene';

class ParticleSystem {
  max: number;
  cursor = 0;
  positions: Float32Array;
  colors: Float32Array;
  velocities: Float32Array;
  lives: Float32Array;
  maxLives: Float32Array;
  baseColors: Float32Array;
  points: THREE.Points;
  _drag = 0.95;

  constructor(maxParticles: number) {
    this.max = maxParticles;
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.lives = new Float32Array(maxParticles);
    this.maxLives = new Float32Array(maxParticles);
    this.baseColors = new Float32Array(maxParticles * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: IS_MOBILE ? 5.4 : 6.4 } },
      vertexShader: `
          attribute vec3 color;
          uniform float uSize;
          varying vec3 vColor;
          void main(){
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * clamp(260.0 / max(70.0, -mv.z), 0.35, 2.8);
          }
        `,
      fragmentShader: `
          varying vec3 vColor;
          void main(){
            vec2 p = gl_PointCoord - 0.5;
            float d = length(p);
            float core = smoothstep(0.22, 0.02, d);
            float halo = smoothstep(0.50, 0.12, d) * 0.42;
            float alpha = (core + halo) * max(max(vColor.r, vColor.g), vColor.b);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(vColor * (0.85 + core * 0.55), alpha);
          }
        `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(pos: THREE.Vector3, color: THREE.Color, count: number, opts?: { speed?: number; life?: number; drag?: number; dirBias?: THREE.Vector3 }) {
    const speed = opts?.speed ?? 14;
    const life = opts?.life ?? 0.65;
    const drag = opts?.drag ?? 0.95;
    const dirBias = opts?.dirBias;
    for (let i = 0; i < count; i++) {
      const idx = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      this.positions[idx*3+0] = pos.x;
      this.positions[idx*3+1] = pos.y;
      this.positions[idx*3+2] = pos.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const v = speed * (0.4 + Math.random() * 0.8);
      let vx = v * Math.sin(ph) * Math.cos(th);
      let vy = v * Math.sin(ph) * Math.sin(th);
      let vz = v * Math.cos(ph);
      if (dirBias) { vx += dirBias.x * speed * 0.5; vy += dirBias.y * speed * 0.5; vz += dirBias.z * speed * 0.5; }
      this.velocities[idx*3+0] = vx;
      this.velocities[idx*3+1] = vy;
      this.velocities[idx*3+2] = vz;
      this.colors[idx*3+0] = color.r;
      this.colors[idx*3+1] = color.g;
      this.colors[idx*3+2] = color.b;
      this.baseColors[idx*3+0] = color.r;
      this.baseColors[idx*3+1] = color.g;
      this.baseColors[idx*3+2] = color.b;
      this.lives[idx] = life * (0.7 + Math.random() * 0.6);
      this.maxLives[idx] = this.lives[idx];
      this._drag = drag;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  emitBurst(pos: THREE.Vector3, typeKey: string, count: number, color: THREE.Color) {
    const opts: Record<string, { speed: number; life: number; drag: number }> = {
      phase:  { speed: 16, life: 0.7,  drag: 0.95 },
      pickup: { speed: 11, life: 0.55, drag: 0.94 },
      hit:    { speed: 18, life: 0.5,  drag: 0.92 },
      death:  { speed: 22, life: 1.2,  drag: 0.94 },
      foam:   { speed: 4,  life: 0.9,  drag: 0.92 },
    };
    this.emit(pos, color, count, opts[typeKey] || { speed: 14, life: 0.6, drag: 0.95 });
  }

  update(dt: number) {
    const drag = Math.pow(this._drag, dt * 60);
    for (let i = 0; i < this.max; i++) {
      if (this.lives[i] > 0) {
        this.lives[i] -= dt;
        const fade = Math.max(0, this.lives[i] / this.maxLives[i]);
        this.colors[i*3+0] = this.baseColors[i*3+0] * fade;
        this.colors[i*3+1] = this.baseColors[i*3+1] * fade;
        this.colors[i*3+2] = this.baseColors[i*3+2] * fade;
        this.positions[i*3+0] += this.velocities[i*3+0] * dt;
        this.positions[i*3+1] += this.velocities[i*3+1] * dt;
        this.positions[i*3+2] += this.velocities[i*3+2] * dt;
        this.velocities[i*3+0] *= drag;
        this.velocities[i*3+1] *= drag;
        this.velocities[i*3+2] *= drag;
      } else if (this.colors[i*3+0] !== 0 || this.colors[i*3+1] !== 0 || this.colors[i*3+2] !== 0) {
        this.colors[i*3+0] = 0; this.colors[i*3+1] = 0; this.colors[i*3+2] = 0;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  reset() {
    this.lives.fill(0);
    this.colors.fill(0);
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export const particleManager = new ParticleSystem(IS_MOBILE ? 320 : 600);
export const particles = particleManager;
