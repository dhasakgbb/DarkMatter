import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { IS_MOBILE } from './constants';
import { EPOCHS } from './cosmology';
import { getActiveRenderProfile, renderPixelRatio, setActiveRenderProfile, type RenderProfile, type VisualQuality } from './renderProfile';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
const graphicsStatus = document.getElementById('graphics-status');
let profile = getActiveRenderProfile();
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance', precision: IS_MOBILE ? 'mediump' : 'highp' });
renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = profile.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  graphicsStatus?.classList.add('on');
});

canvas.addEventListener('webglcontextrestored', () => {
  graphicsStatus?.classList.remove('on');
  window.location.reload();
});

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000004);
scene.fog = new THREE.Fog(0x080012, 80, 480);

export const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 4, 0);

// Postprocessing pipeline
export const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderPixelRatio());
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
// Tuned for readable punch: bright enough to feel cosmic without washing out hazards.
export const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  profile.bloomBase,
  profile.bloomRadius,
  profile.bloomThreshold,
);
composer.addPass(bloom);

export const lensingPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uVignette: { value: 0.85 },
    uBarrel: { value: 0 },
    uVignettePower: { value: 1.0 },
    uVignetteColor: { value: new THREE.Vector3(0, 0, 0) },
    uGlow: { value: 0.12 },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uLensCount: { value: 0 },
    uLenses: {
      value: [
        new THREE.Vector4(0.5, 0.5, 0, 0),
        new THREE.Vector4(0.5, 0.5, 0, 0),
        new THREE.Vector4(0.5, 0.5, 0, 0),
        new THREE.Vector4(0.5, 0.5, 0, 0),
      ],
    },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime, uIntensity, uVignette, uBarrel, uVignettePower, uGlow;
    uniform float uAspect;
    uniform int uLensCount;
    uniform vec3 uVignetteColor;
    uniform vec4 uLenses[4];
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      vec2 c0 = uv - 0.5;
      float r2 = dot(c0, c0);
      uv = 0.5 + c0 * (1.0 - uBarrel * r2);
      vec2 localChroma = vec2(0.0);
      float lensGlow = 0.0;
      for (int i = 0; i < 4; i++) {
        if (i >= uLensCount) break;
        vec4 lens = uLenses[i];
        vec2 raw = uv - lens.xy;
        vec2 aspectRaw = vec2(raw.x * uAspect, raw.y);
        float lensRadius = max(lens.w, 0.035);
        float localDist = length(aspectRaw);
        float localR2 = max(dot(aspectRaw, aspectRaw), 1e-6);
        float influence = 1.0 - smoothstep(lensRadius * 0.36, lensRadius, localDist);
        vec2 dir = normalize(raw + 1e-6);
        float deform = min((lens.z * influence) / (localR2 + 0.001), lensRadius * 0.14);
        uv -= dir * deform;
        float ring = smoothstep(lensRadius * 0.16, lensRadius * 0.43, localDist)
          * (1.0 - smoothstep(lensRadius * 0.43, lensRadius * 0.82, localDist))
          * influence;
        localChroma += dir * (ring + deform * 2.8) * lens.z * 0.20;
        lensGlow += ring * (0.025 + lens.z * 2.4);
      }
      vec2 c = uv - 0.5;
      float d = dot(c,c);
      vec2 dir = normalize(c + 1e-6) * d * uIntensity * 8.0 + localChroma;
      float r = texture2D(tDiffuse, uv - dir).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + dir).b;
      vec3 col = vec3(r,g,b);
      float v = smoothstep(0.95, 0.18, d * uVignette);
      v = pow(v, uVignettePower);
        col = mix(uVignetteColor, col, v);
        float rim = smoothstep(0.18, 0.92, d) * (1.0 - smoothstep(0.92, 1.15, d));
        col += vec3(0.02, 0.07, 0.14) * rim * uGlow;
        col += vec3(0.35, 0.75, 1.0) * lensGlow;
        col = pow(max(col, vec3(0.0)), vec3(0.94));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
composer.addPass(lensingPass);

// Cosmic backdrop: sphere with procedural nebula + starfield + redshift uniform.
const skyGeo = new THREE.SphereGeometry(900, profile.skySegments, profile.skyRings);
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
    uQuality: { value: profile.skyDetail },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main(){ vWorld = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform float uTime, uMix, uRedshift, uQuality;
    uniform vec3 uColorA, uColorB, uPoint;
    varying vec3 vWorld;
    float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    vec3 desaturate(vec3 color, float amount){ float l = dot(color, vec3(0.299, 0.587, 0.114)); return mix(color, vec3(l), amount); }
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
        float red = clamp(uRedshift, 0.0, 1.0);
        float radial = length(d.xy);
        vec3 stretchedD = normalize(vec3(d.xy * (1.0 + red * (0.10 + radial * 0.30)), d.z));
        float detailDesat = smoothstep(0.12, 0.88, red);
        float t = uTime * 0.012;
        float n1 = fbm(mix(d, stretchedD, red * 0.35) * 1.45 + vec3(t, t*0.7, -t*0.5));
        float n2 = fbm(stretchedD * mix(4.6, 3.45, red) + vec3(-t*1.3, t*0.9, t*0.4));
        float n3 = fbm(stretchedD * mix(9.0, 5.85, red) + vec3(t*0.35, -t*0.6, t*0.25));
        float n4 = fbm(stretchedD * mix(16.0, 8.0, red) + vec3(-t*0.20, t*0.45, -t*0.32));
        float nebula = smoothstep(0.38, 0.86, n1);
        float wisps  = smoothstep(0.50, 0.95, n2);
        float filament = pow(max(0.0, 1.0 - abs(n2 - 0.56) * 4.2), 2.2);
        float coldDust = smoothstep(0.46, 0.88, n3) * (1.0 - nebula * 0.35);
        float fineDust = smoothstep(0.54, 0.97, n4) * uQuality;
        vec3 deep = mix(vec3(0.006, 0.009, 0.025), uColorA * 0.18, 0.42 + n1 * 0.28);
        vec3 col = mix(deep, mix(uColorA, uColorB, n1), nebula * (0.65 + uMix * 0.35));
        vec3 wispColor = uPoint * wisps * (0.32 + 0.34 * uMix);
        vec3 filamentColor = mix(uColorB, uPoint, 0.55) * filament * (0.18 + 0.08 * uQuality);
        vec3 dustColor = vec3(0.04, 0.055, 0.095) * (coldDust * 0.35 + fineDust * 0.10);
        col += desaturate(wispColor, detailDesat * 0.72);
        col += desaturate(filamentColor, detailDesat * 0.82);
        col += desaturate(dustColor, detailDesat * 0.52);
        vec3 starDir = normalize(vec3(d.xy * (1.0 + red * (0.16 + radial * 0.42)), d.z));
        float starHash = fract(sin(dot(starDir.xyz, vec3(127.1,311.7,74.7))) * 43758.5453);
        float stars = smoothstep(mix(0.992, 0.982, clamp(uQuality, 0.0, 1.3)), 0.999, starHash);
        float starBrightness = 1.0 - red * 0.34;
        col += vec3(1.0, 0.96, 0.84) * stars * starBrightness * (1.0 + 0.35 * sin(uTime * 0.9 + starHash * 18.0));
        col = desaturate(col, detailDesat * 0.12);
        col.r += red * 0.30;
        col.b *= 1.0 - red * 0.42;
        col.g *= 1.0 - red * 0.16;
        col *= 0.48 + uMix * (0.20 + 0.04 * uQuality);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
export const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

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
export const parallaxStarMat = starMat.clone();

// Foreground starfields (separate from the sky's procedural micro-stars).
function makeStarfield(count: number, minRadius: number, radiusSpan: number, sizeMul = 1, material = starMat) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = minRadius + Math.random() * radiusSpan;
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
    size[i] = ((IS_MOBILE ? 1.6 : 1.9) + Math.random() * (IS_MOBILE ? 1.8 : 2.4)) * sizeMul;
    phase[i] = Math.random() * Math.PI * 2;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  return new THREE.Points(g, material);
}

export let stars = makeStarfield(profile.starCount, 200, 600, 1, starMat);
export let parallaxStars = makeStarfield(profile.parallaxStarCount, 70, 240, 1.24, parallaxStarMat);
export let starShells: THREE.Points[] = [stars, parallaxStars];
scene.add(stars, parallaxStars);

export const nebulaDustMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: IS_MOBILE ? 0.18 : 0.26 },
    uSize: { value: IS_MOBILE ? 7.2 : 10.5 },
  },
  vertexShader: `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime, uSize;
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vColor = color;
      float breathe = 0.76 + 0.24 * sin(uTime * 0.32 + aPhase);
      vAlpha = breathe;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uSize * breathe * clamp(220.0 / max(80.0, -mv.z), 0.38, 1.7);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p);
      float soft = smoothstep(0.50, 0.02, d);
      float hollow = 1.0 - smoothstep(0.00, 0.22, d) * 0.34;
      float alpha = soft * hollow * vAlpha * uOpacity;
      if (alpha < 0.006) discard;
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
});

function makeNebulaDust(count: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 110 + Math.random() * 520;
    const th = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * 0.74;
    const y = Math.sin(band) * r * 0.38;
    pos[i*3+0] = Math.cos(th) * r;
    pos[i*3+1] = y;
    pos[i*3+2] = Math.sin(th) * r;
    const tint = Math.random();
    col[i*3+0] = 0.22 + tint * 0.36;
    col[i*3+1] = 0.28 + Math.random() * 0.26;
    col[i*3+2] = 0.55 + (1 - tint) * 0.34;
    size[i] = 0.45 + Math.random() * 0.9;
    phase[i] = Math.random() * Math.PI * 2;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const dust = new THREE.Points(g, nebulaDustMat);
  dust.frustumCulled = false;
  return dust;
}

export let nebulaDust = makeNebulaDust(profile.nebulaDustCount);
scene.add(nebulaDust);

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

export let cosmicWeb = makeCosmicWeb(profile.cosmicWebStrands);
scene.add(cosmicWeb);

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

function rebuildVisualScenery(next: RenderProfile) {
  for (const shell of starShells) {
    scene.remove(shell);
    disposeObject(shell);
  }
  stars = makeStarfield(next.starCount, 200, 600, 1, starMat);
  parallaxStars = makeStarfield(next.parallaxStarCount, 70, 240, 1.24, parallaxStarMat);
  starShells = [stars, parallaxStars];
  scene.add(stars, parallaxStars);

  scene.remove(nebulaDust);
  disposeObject(nebulaDust);
  nebulaDust = makeNebulaDust(next.nebulaDustCount);
  scene.add(nebulaDust);

  scene.remove(cosmicWeb);
  disposeObject(cosmicWeb);
  cosmicWeb = makeCosmicWeb(next.cosmicWebStrands);
  scene.add(cosmicWeb);
}

export function applyVisualQuality(quality: VisualQuality) {
  const previous = profile;
  profile = setActiveRenderProfile(quality);
  renderer.setPixelRatio(renderPixelRatio());
  composer.setPixelRatio(renderPixelRatio());
  renderer.toneMappingExposure = profile.exposure;
  skyMat.uniforms.uQuality.value = profile.skyDetail;
  bloom.strength = profile.bloomBase;
  bloom.radius = profile.bloomRadius;
  bloom.threshold = profile.bloomThreshold;
  (nebulaDustMat.uniforms.uOpacity.value as number) = IS_MOBILE ? 0.18 : 0.18 + profile.skyDetail * 0.08;
  (nebulaDustMat.uniforms.uSize.value as number) = IS_MOBILE ? 7.2 : 8.5 + profile.skyDetail * 1.8;
  if (
    previous.starCount !== profile.starCount ||
    previous.parallaxStarCount !== profile.parallaxStarCount ||
    previous.nebulaDustCount !== profile.nebulaDustCount ||
    previous.cosmicWebStrands !== profile.cosmicWebStrands
  ) {
    rebuildVisualScenery(profile);
  }
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  hudResize();
}

// HUD canvas + sizing
export const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement;
export const hud = hudCanvas.getContext('2d')!;
export function hudResize() {
  const pr = renderPixelRatio();
  hudCanvas.width = window.innerWidth * pr;
  hudCanvas.height = window.innerHeight * pr;
  hudCanvas.style.width = window.innerWidth + 'px';
  hudCanvas.style.height = window.innerHeight + 'px';
}
hudResize();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(renderPixelRatio());
  composer.setPixelRatio(renderPixelRatio());
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  lensingPass.uniforms.uAspect.value = camera.aspect;
  bloom.setSize(w, h);
  hudResize();
});
