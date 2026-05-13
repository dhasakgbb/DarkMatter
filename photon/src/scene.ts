import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { IS_MOBILE, PIXEL_RATIO } from './constants';
import { EPOCHS } from './cosmology';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000004);
scene.fog = new THREE.Fog(0x080012, 80, 480);

export const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 4, 0);

// Postprocessing pipeline
export const composer = new EffectComposer(renderer);
composer.setPixelRatio(PIXEL_RATIO);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
// Tuned for readable punch: bright enough to feel cosmic without washing out hazards.
export const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.54, 0.62, 0.34);
composer.addPass(bloom);

export const lensingPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.0014 },
    uVignette: { value: 0.85 },
    uBarrel: { value: 0.02 },
    uVignettePower: { value: 1.0 },
    uVignetteColor: { value: new THREE.Vector3(0, 0, 0) },
    uGlow: { value: 0.12 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime, uIntensity, uVignette, uBarrel, uVignettePower, uGlow;
    uniform vec3 uVignetteColor;
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      vec2 c0 = uv - 0.5;
      float r2 = dot(c0, c0);
      uv = 0.5 + c0 * (1.0 - uBarrel * r2);
      vec2 c = uv - 0.5;
      float d = dot(c,c);
      vec2 dir = normalize(c + 1e-6) * d * uIntensity * 8.0;
      float r = texture2D(tDiffuse, uv - dir).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + dir).b;
      vec3 col = vec3(r,g,b);
      float v = smoothstep(0.95, 0.18, d * uVignette);
      v = pow(v, uVignettePower);
        col = mix(uVignetteColor, col, v);
        float rim = smoothstep(0.18, 0.92, d) * (1.0 - smoothstep(0.92, 1.15, d));
        col += vec3(0.02, 0.07, 0.14) * rim * uGlow;
        col = pow(max(col, vec3(0.0)), vec3(0.94));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
composer.addPass(lensingPass);

// Cosmic backdrop: sphere with procedural nebula + starfield + redshift uniform.
const skyGeo = new THREE.SphereGeometry(900, 48, 24);
export const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: EPOCHS[0].paletteA.clone() },
    uColorB: { value: EPOCHS[0].paletteB.clone() },
    uPoint:  { value: EPOCHS[0].palettePoint.clone() },
    uMix:    { value: 0.6 },
    uRedshift: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main(){ vWorld = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform float uTime, uMix, uRedshift;
    uniform vec3 uColorA, uColorB, uPoint;
    varying vec3 vWorld;
    float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 p){
      vec3 i = floor(p); vec3 f = fract(p);
      vec3 u = f*f*(3.0-2.0*f);
      float n000 = hash(i+vec3(0,0,0));
      float n100 = hash(i+vec3(1,0,0));
      float n010 = hash(i+vec3(0,1,0));
      float n110 = hash(i+vec3(1,1,0));
      float n001 = hash(i+vec3(0,0,1));
      float n101 = hash(i+vec3(1,0,1));
      float n011 = hash(i+vec3(0,1,1));
      float n111 = hash(i+vec3(1,1,1));
      return mix(mix(mix(n000,n100,u.x),mix(n010,n110,u.x),u.y),
                 mix(mix(n001,n101,u.x),mix(n011,n111,u.x),u.y), u.z);
    }
    float fbm(vec3 p){
      float v = 0.0; float a = 0.5;
      for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.07 + 11.3; a *= 0.5; }
      return v;
    }
    void main(){
        vec3 d = normalize(vWorld);
        float t = uTime * 0.012;
        float n1 = fbm(d * 1.45 + vec3(t, t*0.7, -t*0.5));
        float n2 = fbm(d * 4.6 + vec3(-t*1.3, t*0.9, t*0.4));
        float n3 = fbm(d * 9.0 + vec3(t*0.35, -t*0.6, t*0.25));
        float nebula = smoothstep(0.38, 0.86, n1);
        float wisps  = smoothstep(0.50, 0.95, n2);
        float filament = pow(max(0.0, 1.0 - abs(n2 - 0.56) * 4.2), 2.2);
        float coldDust = smoothstep(0.46, 0.88, n3) * (1.0 - nebula * 0.35);
        vec3 deep = mix(vec3(0.006, 0.009, 0.025), uColorA * 0.18, 0.42 + n1 * 0.28);
        vec3 col = mix(deep, mix(uColorA, uColorB, n1), nebula * (0.65 + uMix * 0.35));
        col += uPoint * wisps * (0.32 + 0.34 * uMix);
        col += mix(uColorB, uPoint, 0.55) * filament * 0.20;
        col += vec3(0.04, 0.055, 0.095) * coldDust * 0.35;
        float starHash = fract(sin(dot(d.xyz, vec3(127.1,311.7,74.7))) * 43758.5453);
        float stars = smoothstep(0.988, 0.999, starHash);
        col += vec3(1.0, 0.96, 0.84) * stars * (1.0 + 0.35 * sin(uTime * 0.9 + starHash * 18.0));
        col.r += uRedshift * 0.30;
        col.b *= 1.0 - uRedshift * 0.42;
        col.g *= 1.0 - uRedshift * 0.16;
        col *= 0.48 + uMix * 0.20;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

export const starMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uOpacity: { value: 0.9 },
  },
  vertexShader: `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime, uSpeed, uOpacity;
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vOpacity;
    void main(){
      vColor = color;
      vTwinkle = 0.76 + 0.24 * sin(uTime * 1.7 + aPhase);
      vOpacity = uOpacity;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float perspective = clamp(300.0 / max(90.0, -mv.z), 0.36, 2.45);
      gl_PointSize = aSize * perspective * vTwinkle * (1.0 + uSpeed * 0.18);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vOpacity;
    void main(){
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p);
      float core = smoothstep(0.18, 0.015, d);
      float halo = smoothstep(0.50, 0.08, d) * 0.34;
      float spikeX = smoothstep(0.030, 0.0, abs(p.y)) * smoothstep(0.48, 0.03, abs(p.x));
      float spikeY = smoothstep(0.030, 0.0, abs(p.x)) * smoothstep(0.48, 0.03, abs(p.y));
      float alpha = (core + halo + (spikeX + spikeY) * 0.10) * vOpacity;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor * (0.72 + vTwinkle * 0.72), alpha);
    }
  `,
});

// Foreground starfield (separate from the sky's procedural micro-stars).
function makeStarfield(count: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 200 + Math.random() * 600;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3+0] = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
    const warmth = Math.random();
    const c = 0.62 + Math.random() * 0.42;
    col[i*3+0] = c * (0.86 + warmth * 0.22);
    col[i*3+1] = c * (0.88 + Math.random() * 0.16);
    col[i*3+2] = c * (1.02 + (1 - warmth) * 0.22);
    size[i] = (IS_MOBILE ? 1.6 : 1.9) + Math.random() * (IS_MOBILE ? 1.8 : 2.4);
    phase[i] = Math.random() * Math.PI * 2;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  return new THREE.Points(g, starMat);
}
export const stars = makeStarfield(IS_MOBILE ? 1200 : 2400);
scene.add(stars);

// Large-scale cosmic web filaments. This is a procedural visual asset, not game state.
export const cosmicWebMat = new THREE.LineBasicMaterial({
  color: EPOCHS[0].palettePoint,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function makeCosmicWeb(strands: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(strands * 2 * 3);
  const temp = new THREE.Vector3();
  for (let i = 0; i < strands; i++) {
    const r = 180 + Math.random() * 560;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    temp.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    );
    const j = i * 6;
    pos[j + 0] = temp.x;
    pos[j + 1] = temp.y;
    pos[j + 2] = temp.z;
    pos[j + 3] = temp.x + (Math.random() - 0.5) * 160;
    pos[j + 4] = temp.y + (Math.random() - 0.5) * 110;
    pos[j + 5] = temp.z + (Math.random() - 0.5) * 180;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const web = new THREE.LineSegments(g, cosmicWebMat);
  web.frustumCulled = false;
  return web;
}

export const cosmicWeb = makeCosmicWeb(IS_MOBILE ? 42 : 86);
scene.add(cosmicWeb);

// HUD canvas + sizing
export const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement;
export const hud = hudCanvas.getContext('2d')!;
export function hudResize() {
  hudCanvas.width = window.innerWidth * PIXEL_RATIO;
  hudCanvas.height = window.innerHeight * PIXEL_RATIO;
  hudCanvas.style.width = window.innerWidth + 'px';
  hudCanvas.style.height = window.innerHeight + 'px';
}
hudResize();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  bloom.setSize(w, h);
  hudResize();
});
