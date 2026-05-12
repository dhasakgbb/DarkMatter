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
renderer.toneMappingExposure = 1.05;
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
// Tuned for readability — see the visual-blowout fix
export const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.35);
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
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime, uIntensity, uVignette, uBarrel, uVignettePower;
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
      float n1 = fbm(d * 1.6 + vec3(t, t*0.7, -t*0.5));
      float n2 = fbm(d * 4.0 + vec3(-t*1.3, t*0.9, t*0.4));
      float nebula = smoothstep(0.45, 0.85, n1);
      float wisps  = smoothstep(0.6, 0.95, n2);
      vec3 col = mix(uColorA, uColorB, n1);
      col = mix(col * 0.18, col, nebula);
      col += uPoint * wisps * 0.6;
      float stars = step(0.985, fract(sin(dot(d.xyz, vec3(127.1,311.7,74.7))) * 43758.5453));
      col += vec3(1.0) * stars * 1.6;
      col.r += uRedshift * 0.35;
      col.b *= 1.0 - uRedshift * 0.5;
      col.g *= 1.0 - uRedshift * 0.2;
      col *= 0.55;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// Foreground starfield (separate from the sky's procedural micro-stars).
function makeStarfield(count: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 200 + Math.random() * 600;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3+0] = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
    const c = 0.6 + Math.random() * 0.4;
    col[i*3+0] = c; col[i*3+1] = c; col[i*3+2] = c + Math.random() * 0.2;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  return new THREE.Points(g, m);
}
export const stars = makeStarfield(IS_MOBILE ? 1200 : 2400);
scene.add(stars);

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
