import type { Epoch } from './cosmology';
import type * as THREE from 'three';
import audioManifest from './audio-manifest.json';

const bundledAudioAssets = import.meta.glob<string>('./audio-assets/**/*.ogg', {
  eager: true,
  import: 'default',
  query: '?url',
});

interface RuntimeAsset {
  path: string;
  gain?: number;
  rate?: number;
  loop?: boolean;
  enabled?: boolean;
  stem?: string;
}

interface RuntimeMusicEntry {
  enabled?: boolean;
  stems?: RuntimeAsset[];
}

interface RuntimeSfxEntry {
  enabled?: boolean;
  gain?: number;
  rate?: number;
  spatial?: boolean;
  variants?: RuntimeAsset[];
}

interface RuntimeAudioManifest {
  music?: Record<string, RuntimeMusicEntry>;
  sfx?: Record<string, RuntimeSfxEntry>;
}

interface DecodedSfx {
  buffer: AudioBuffer;
  gain: number;
  rate: number;
  spatial: boolean;
  loop: boolean;
}

interface DecodedStem {
  buffer: AudioBuffer;
  gain: number;
  loop: boolean;
  stem: string;
}

interface StudioStemNode {
  stem: string;
  gain: GainNode;
  baseGain: number;
}

interface StudioMusicNodes {
  sources: AudioBufferSourceNode[];
  stemGains: StudioStemNode[];
  out: GainNode;
  scienceGain: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  delayReturn: GainNode;
  heatDeath: boolean;
}

interface AssetEngineNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  hum: GainNode;
  baseGain: number;
}

interface PlaySfxOptions {
  gain?: number;
  rate?: number;
  position?: THREE.Vector3;
  cooldownMs?: number;
}

type AudioTraceEntry = { cue: string; source: 'asset' | 'music' | 'missing'; at: number; detail?: string };

declare global {
  interface Window {
    __PHOTON_AUDIO_TRACE?: AudioTraceEntry[];
    webkitAudioContext?: typeof AudioContext;
  }
}

function traceAudio(cue: string, source: AudioTraceEntry['source'], detail?: string) {
  window.__PHOTON_AUDIO_TRACE ??= [];
  window.__PHOTON_AUDIO_TRACE.push({ cue, source, at: performance.now(), detail });
  if (window.__PHOTON_AUDIO_TRACE.length > 400) window.__PHOTON_AUDIO_TRACE.shift();
}

function stopAudioSource(source: AudioScheduledSourceNode) {
  try {
    source.stop();
  } catch {
    // Source nodes throw if they have already stopped.
  }
}

function disconnectAudioNode(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Already-disconnected nodes are harmless during fades.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  studioMusicNodes: StudioMusicNodes | null = null;
  engineNodes: AssetEngineNodes | null = null;
  manifestPromise: Promise<void> | null = null;
  sfxBuffers = new Map<string, DecodedSfx[]>();
  musicBuffers = new Map<string, DecodedStem[]>();
  lastCueAt = new Map<string, number>();
  pendingMusicKey: string | null = null;
  pendingEngine = false;
  assetsReady = false;
  scienceRedshift = 0;
  scienceFlow = 0;
  scienceDarkMatter = 0;
  heatDeathProgress = 0;
  _boostCurrent = 0;

  readonly mode = 'asset' as const;

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx!.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx!.destination);
    this.manifestPromise = this.loadStudioAssets();
  }

  setRedshift(amount: number) {
    this.scienceRedshift = clamp01(amount);
    this.applyScienceAutomation();
  }

  setFlow(amount: number) {
    this.scienceFlow = clamp01(amount);
    this.applyScienceAutomation();
  }

  setDarkMatterSignal(amount: number) {
    this.scienceDarkMatter = clamp01(amount);
    this.applyScienceAutomation();
  }

  setHeatDeathProgress(progress: number) {
    this.heatDeathProgress = clamp01(progress);
    this.applyScienceAutomation();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  async loadStudioAssets() {
    if (!this.ctx) return;
    const manifest = audioManifest as RuntimeAudioManifest;
    const assetBaseUrl = new URL('audio/', document.baseURI).href;

    const tasks: Promise<void>[] = [];
    for (const [epochName, entry] of Object.entries(manifest.music || {})) {
      if (entry.enabled === false) continue;
      for (const stem of entry.stems || []) {
        if (stem.enabled === false) continue;
        tasks.push(this.decodeAsset(stem.path, assetBaseUrl).then((buffer) => {
          const stems = this.musicBuffers.get(epochName) || [];
          stems.push({
            buffer,
            gain: stem.gain ?? 1,
            loop: stem.loop !== false,
            stem: stem.stem || 'stem',
          });
          this.musicBuffers.set(epochName, stems);
        }).catch(() => {
          traceAudio(epochName, 'missing', stem.path);
        }));
      }
    }

    for (const [cue, entry] of Object.entries(manifest.sfx || {})) {
      if (entry.enabled === false) continue;
      for (const asset of entry.variants || []) {
        if (asset.enabled === false) continue;
        tasks.push(this.decodeAsset(asset.path, assetBaseUrl).then((buffer) => {
          const variants = this.sfxBuffers.get(cue) || [];
          variants.push({
            buffer,
            gain: (entry.gain ?? 1) * (asset.gain ?? 1),
            rate: (entry.rate ?? 1) * (asset.rate ?? 1),
            spatial: entry.spatial === true,
            loop: asset.loop === true,
          });
          this.sfxBuffers.set(cue, variants);
        }).catch(() => {
          traceAudio(cue, 'missing', asset.path);
        }));
      }
    }

    await Promise.all(tasks);
    this.assetsReady = true;

    if (this.pendingMusicKey) this.startStudioMusic(this.pendingMusicKey, 0.45);
    if (this.pendingEngine && !this.engineNodes) this.startAssetEngineLoop(0.45);
  }

  async decodeAsset(path: string, assetBaseUrl: string) {
    const url = bundledAudioAssets[`./audio-assets/${path}`] || new URL(path, assetBaseUrl).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Audio asset not found: ${path}`);
    const bytes = await res.arrayBuffer();
    return this.ctx!.decodeAudioData(bytes);
  }

  playSfx(cue: string, options: PlaySfxOptions = {}) {
    this.ensure();
    if (!this.ctx || !this.assetsReady) return false;

    const now = performance.now();
    if (options.cooldownMs && now - (this.lastCueAt.get(cue) || 0) < options.cooldownMs) return true;

    const variants = this.sfxBuffers.get(cue);
    if (!variants || variants.length === 0) return false;
    this.lastCueAt.set(cue, now);

    const ctx = this.ctx;
    const asset = variants[Math.floor(Math.random() * variants.length)];
    const source = ctx.createBufferSource();
    source.buffer = asset.buffer;
    source.loop = asset.loop;
    source.playbackRate.value = asset.rate * (options.rate ?? 1);

    const gain = ctx.createGain();
    gain.gain.value = asset.gain * (options.gain ?? 1);
    source.connect(gain);

    if (asset.spatial && options.position) {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = 5;
      pan.maxDistance = 80;
      pan.rolloffFactor = 1.4;
      pan.positionX.value = options.position.x;
      pan.positionY.value = options.position.y;
      pan.positionZ.value = options.position.z;
      gain.connect(pan).connect(this.master!);
    } else {
      gain.connect(this.master!);
    }

    source.start(ctx.currentTime);
    traceAudio(cue, 'asset', `${variants.length} variants`);
    return true;
  }

  startStudioMusic(epochName: string, fadeIn = 2.5) {
    if (!this.ctx || !this.assetsReady) return false;
    const stems = this.musicBuffers.get(epochName);
    if (!stems || stems.length === 0) return false;

    this.stopStudioMusic(0.2);
    const ctx = this.ctx;
    const out = ctx.createGain();
    const scienceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const delay = ctx.createDelay(0.9);
    const delayReturn = ctx.createGain();

    out.gain.value = 0;
    scienceGain.gain.value = 1;
    filter.type = 'lowpass';
    filter.frequency.value = 6200;
    filter.Q.value = 0.7;
    delay.delayTime.value = 0.08;
    delayReturn.gain.value = 0.035;
    out.connect(scienceGain);
    scienceGain.connect(filter).connect(this.master!);
    scienceGain.connect(delay).connect(delayReturn).connect(this.master!);

    const startAt = ctx.currentTime + 0.04;
    const stemGains: StudioStemNode[] = [];
    const sources = stems.map((stem) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = stem.buffer;
      source.loop = stem.loop;
      gain.gain.value = stem.gain;
      source.connect(gain).connect(out);
      source.start(startAt);
      stemGains.push({ stem: stem.stem, gain, baseGain: stem.gain });
      return source;
    });

    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeIn);
    this.studioMusicNodes = { sources, stemGains, out, scienceGain, filter, delay, delayReturn, heatDeath: epochName === 'Heat Death' };
    this.applyScienceAutomation();
    traceAudio(epochName, 'music', `${stems.length} stems`);
    return true;
  }

  stopStudioMusic(fadeOut = 1.4) {
    if (!this.studioMusicNodes || !this.ctx) return;
    const nodes = this.studioMusicNodes;
    const t = this.ctx.currentTime;
    nodes.out.gain.cancelScheduledValues(t);
    nodes.out.gain.setValueAtTime(nodes.out.gain.value, t);
    nodes.out.gain.linearRampToValueAtTime(0, t + fadeOut);
    setTimeout(() => {
      for (const source of nodes.sources) stopAudioSource(source);
      disconnectAudioNode(nodes.out);
      disconnectAudioNode(nodes.scienceGain);
      disconnectAudioNode(nodes.filter);
      disconnectAudioNode(nodes.delay);
      disconnectAudioNode(nodes.delayReturn);
    }, Math.ceil((fadeOut + 0.1) * 1000));
    this.studioMusicNodes = null;
  }

  startDrone(epoch: Epoch) {
    this.ensure();
    if (!this.ctx) return;
    this.heatDeathProgress = 0;
    this.stopStudioMusic(0.2);
    this.pendingMusicKey = epoch.name;
    if (this.startStudioMusic(epoch.name)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey === epoch.name) this.startStudioMusic(epoch.name, 0.45);
    });
  }

  stopDrone() {
    this.pendingMusicKey = null;
    this.stopStudioMusic();
  }

  startHeatDeath() {
    this.ensure();
    if (!this.ctx) return;
    this.heatDeathProgress = 0;
    this.stopStudioMusic(0.4);
    this.pendingMusicKey = 'Heat Death';
    if (this.startStudioMusic('Heat Death', 8)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey === 'Heat Death') this.startStudioMusic('Heat Death', 0.8);
    });
  }

  pickup() {
    this.playSfx('pickup');
  }

  speedPad() {
    this.playSfx('speedPad');
  }

  lineGate(streak: number) {
    const streakLift = Math.min(9, Math.max(0, streak));
    this.playSfx('lineGate', { rate: 1 + streakLift * 0.025, gain: 0.78 + streakLift * 0.035 });
  }

  gateMiss() {
    this.playSfx('gateMiss');
  }

  railScrape() {
    this.playSfx('railScrape');
  }

  hit() {
    this.playSfx('damageHit');
  }

  shift(idx: number) {
    const shiftRates = [1.12, 1.0, 0.88];
    this.playSfx('wavelengthShift', { rate: shiftRates[idx] || 1 });
  }

  phaseChime(idx: number) {
    const shiftRates = [1.12, 1.0, 0.88];
    this.playSfx('wavelengthShift', { rate: shiftRates[idx] || 1, gain: 0.45, cooldownMs: 80 });
  }

  death() {
    this.playSfx('death');
  }

  witnessChime() {
    this.playSfx('witnessChime');
  }

  memoryUnlock() {
    this.playSfx('memoryUnlock', { cooldownMs: 900 });
  }

  startAssetEngineLoop(fadeIn = 0.8) {
    if (!this.ctx || !this.master || !this.assetsReady) return false;
    const variants = this.sfxBuffers.get('engineLoop');
    if (!variants || variants.length === 0) return false;

    const ctx = this.ctx;
    const asset = variants[0];
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const hum = ctx.createGain();

    source.buffer = asset.buffer;
    source.loop = true;
    source.playbackRate.value = asset.rate;
    filter.type = 'lowpass';
    filter.frequency.value = 820;
    filter.Q.value = 1.8;
    hum.gain.setValueAtTime(0, ctx.currentTime);
    hum.gain.linearRampToValueAtTime(asset.gain, ctx.currentTime + fadeIn);
    source.connect(filter).connect(hum).connect(this.master);
    source.start(ctx.currentTime + 0.02);
    this.engineNodes = { source, filter, hum, baseGain: asset.gain };
    traceAudio('engineLoop', 'asset', 'loop');
    return true;
  }

  startEngine() {
    this.ensure();
    if (!this.ctx) return;
    this.pendingEngine = true;
    if (this.engineNodes) return;
    if (this.startAssetEngineLoop()) return;
    this.manifestPromise?.then(() => {
      if (this.pendingEngine && !this.engineNodes) this.startAssetEngineLoop(0.45);
    });
  }

  stopEngine() {
    this.pendingEngine = false;
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const nodes = this.engineNodes;
    nodes.hum.gain.cancelScheduledValues(t);
    nodes.hum.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => stopAudioSource(nodes.source), 800);
    this.engineNodes = null;
  }

  updateEngine(speedFactor: number, boosting: boolean) {
    if (!this.engineNodes || !this.ctx) return;
    const nodes = this.engineNodes;
    const redshift = this.scienceRedshift;
    const flow = this.scienceFlow;
    const darkMatter = this.scienceDarkMatter;
    const heatFade = this.heatDeathFadeAmount();
    const rate = Math.min(1.5, Math.max(0.68, 0.84 + (speedFactor - 1) * 0.34 + (boosting ? 0.16 : 0) + flow * 0.045 - redshift * 0.11 - heatFade * 0.12));
    nodes.source.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.09);
    const cutoff = 620 + (speedFactor - 1) * 1450 + (boosting ? 900 : 0) + flow * 520 + darkMatter * 260 - redshift * 360 - heatFade * 480;
    nodes.filter.frequency.setTargetAtTime(Math.max(260, cutoff), this.ctx.currentTime, 0.06);
    const gain = nodes.baseGain * Math.max(0.08, 0.82 + (speedFactor - 1) * 0.34 + (boosting ? 0.18 : 0) + flow * 0.10 + darkMatter * 0.08 - redshift * 0.12 - heatFade * 0.42);
    nodes.hum.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.08);
  }

  heatDeathFadeAmount() {
    return this.heatDeathProgress <= 2 / 3 ? 0 : clamp01((this.heatDeathProgress - 2 / 3) * 3);
  }

  applyScienceAutomation() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const redshift = this.scienceRedshift;
    const flow = this.scienceFlow;
    const darkMatter = this.scienceDarkMatter;
    const heatFade = this.heatDeathFadeAmount();

    if (this.studioMusicNodes) {
      const nodes = this.studioMusicNodes;
      const heatMul = nodes.heatDeath ? 1 - heatFade * 0.9 : 1;
      const cutoff = clamp(6200 - redshift * 4300 + flow * 1800 + darkMatter * 700 - heatFade * 1100, 520, 8800);
      nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.18);
      nodes.filter.Q.setTargetAtTime(0.62 + flow * 0.36 + darkMatter * 0.24, t, 0.18);
      nodes.delay.delayTime.setTargetAtTime(clamp(0.08 + redshift * 0.30 + flow * 0.06 + darkMatter * 0.11 + heatFade * 0.18, 0.04, 0.72), t, 0.24);
      nodes.delayReturn.gain.setTargetAtTime(clamp(0.035 + redshift * 0.075 + flow * 0.05 + darkMatter * 0.06 - heatFade * 0.055, 0.008, 0.22), t, 0.24);
      nodes.scienceGain.gain.setTargetAtTime(Math.max(0.08, heatMul), t, 0.35);

      for (const stem of nodes.stemGains) {
        const key = stem.stem.toLowerCase();
        let multiplier = 1;
        if (key.includes('texture') || key.includes('vanishing')) multiplier *= 0.86 + redshift * 0.28 + darkMatter * 0.12 - flow * 0.04;
        if (key.includes('pulse') || key.includes('motion') || key.includes('reward')) multiplier *= 0.88 + flow * 0.30 - redshift * 0.08;
        if (key.includes('bass') || key.includes('low-tone')) multiplier *= 0.96 + redshift * 0.16 - flow * 0.05 - heatFade * 0.18;
        if (key.includes('danger')) multiplier *= 0.92 + flow * 0.18 + darkMatter * 0.34;
        stem.gain.gain.setTargetAtTime(stem.baseGain * clamp(multiplier, 0.18, 1.42), t, 0.22);
      }
    }
  }

  setListenerPosition(p: THREE.Vector3) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
    } else {
      const fallbackListener = l as AudioListener & { setPosition?: (x: number, y: number, z: number) => void };
      fallbackListener.setPosition?.(p.x, p.y, p.z);
    }
  }

  whoosh(pos: THREE.Vector3, intensity = 1, kind = 'generic') {
    const cue = kind === 'well' ? 'gravityWellWhoosh' : 'hazardWhoosh';
    const cueGain = kind === 'well' ? 0.46 : 0.28;
    const cooldownMs = kind === 'well' ? 520 : 360;
    this.playSfx(cue, { position: pos, gain: intensity * cueGain, cooldownMs });
  }

  uiTick() {
    this.playSfx('uiTick');
  }

  uiClick() {
    this.playSfx('uiClick');
  }

  uiSwoosh() {
    this.playSfx('uiSwoosh');
  }

  epochRiser() {
    this.playSfx('epochRiser');
  }
}

export const audio = new AudioEngine();
