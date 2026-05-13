import type { Epoch } from './cosmology';
import type * as THREE from 'three';
import audioManifest from './audio-manifest.json';
import { ProceduralSynth } from './procedural';

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

interface StudioMusicNodes {
  sources: AudioBufferSourceNode[];
  out: GainNode;
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
  _boostCurrent = 0;

  // Procedural synthesis layer. Default mode — the bundled .ogg assets are
  // 5 KB director-temp placeholders (see docs/audio/director-temp-audio.md);
  // rich procedural synthesis runs through ProceduralSynth instead. Set
  // useProcedural = false to A/B against the studio asset path.
  synth: ProceduralSynth | null = null;
  useProcedural = true;
  proceduralEpoch: Epoch | null = null;

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx!.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx!.destination);
    this.synth = new ProceduralSynth(this.ctx!, this.master);
    this.manifestPromise = this.loadStudioAssets();
  }

  setUseProcedural(on: boolean) {
    if (this.useProcedural === on) return;
    this.useProcedural = on;
    if (on) {
      this.stopStudioMusic(0.4);
      if (this.engineNodes && this.ctx) {
        const t = this.ctx.currentTime;
        this.engineNodes.hum.gain.cancelScheduledValues(t);
        this.engineNodes.hum.gain.linearRampToValueAtTime(0, t + 0.4);
        const e = this.engineNodes;
        setTimeout(() => stopAudioSource(e.source), 500);
        this.engineNodes = null;
      }
      if (this.proceduralEpoch) this.synth?.startDrone(this.proceduralEpoch);
      if (this.pendingEngine) this.synth?.startEngine();
    } else {
      this.synth?.stopDrone(0.4);
      this.synth?.stopEngine();
      if (this.proceduralEpoch) this.startStudioMusic(this.proceduralEpoch.name, 0.6);
      if (this.pendingEngine) this.startAssetEngineLoop(0.4);
    }
  }

  /** 0..1 cosmological redshift forwarded to the procedural drone. */
  setRedshift(amount: number) {
    this.synth?.setRedshift(amount);
  }

  /** 0..1 hidden flow signal — opens drone filter + reverb send when in the zone. */
  setFlow(amount: number) {
    this.synth?.setIntensity(amount);
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
    out.gain.value = 0;
    out.connect(this.master!);

    const startAt = ctx.currentTime + 0.04;
    const sources = stems.map((stem) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = stem.buffer;
      source.loop = stem.loop;
      gain.gain.value = stem.gain;
      source.connect(gain).connect(out);
      source.start(startAt);
      return source;
    });

    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeIn);
    this.studioMusicNodes = { sources, out };
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
    }, Math.ceil((fadeOut + 0.1) * 1000));
    this.studioMusicNodes = null;
  }

  startDrone(epoch: Epoch) {
    this.ensure();
    if (!this.ctx) return;
    this.proceduralEpoch = epoch;
    if (this.useProcedural) {
      this.synth?.startDrone(epoch);
      return;
    }
    this.stopDrone();
    this.pendingMusicKey = epoch.name;
    if (this.startStudioMusic(epoch.name)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey === epoch.name) this.startStudioMusic(epoch.name, 0.45);
    });
  }

  stopDrone() {
    this.pendingMusicKey = null;
    this.proceduralEpoch = null;
    this.synth?.stopDrone();
    this.stopStudioMusic();
  }

  startHeatDeath() {
    this.ensure();
    if (!this.ctx) return;
    this.proceduralEpoch = null;
    if (this.useProcedural) {
      this.synth?.startHeatDeath();
      return;
    }
    this.stopDrone();
    this.pendingMusicKey = 'Heat Death';
    if (this.startStudioMusic('Heat Death', 8)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey === 'Heat Death') this.startStudioMusic('Heat Death', 0.8);
    });
  }

  pickup() {
    if (this.useProcedural) { this.ensure(); this.synth?.pickup(); return; }
    this.playSfx('pickup');
  }

  speedPad() {
    if (this.useProcedural) { this.ensure(); this.synth?.speedPad(); return; }
    this.playSfx('speedPad');
  }

  lineGate(streak: number) {
    if (this.useProcedural) { this.ensure(); this.synth?.lineGate(streak); return; }
    const streakLift = Math.min(9, Math.max(0, streak));
    this.playSfx('lineGate', { rate: 1 + streakLift * 0.025, gain: 0.78 + streakLift * 0.035 });
  }

  gateMiss() {
    if (this.useProcedural) { this.ensure(); this.synth?.gateMiss(); return; }
    this.playSfx('gateMiss');
  }

  railScrape() {
    if (this.useProcedural) { this.ensure(); this.synth?.railScrape(); return; }
    this.playSfx('railScrape');
  }

  hit() {
    if (this.useProcedural) { this.ensure(); this.synth?.hit(); return; }
    this.playSfx('damageHit');
  }

  shift(idx: number) {
    if (this.useProcedural) { this.ensure(); this.synth?.shift(idx); return; }
    const shiftRates = [1.12, 1.0, 0.88];
    this.playSfx('wavelengthShift', { rate: shiftRates[idx] || 1 });
  }

  death() {
    if (this.useProcedural) { this.ensure(); this.synth?.death(); return; }
    this.playSfx('death');
  }

  witnessChime() {
    if (this.useProcedural) { this.ensure(); this.synth?.witnessChime(); return; }
    this.playSfx('witnessChime');
  }

  memoryUnlock() {
    if (this.useProcedural) { this.ensure(); this.synth?.memoryUnlock(); return; }
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
    if (this.useProcedural) { this.synth?.startEngine(); return; }
    if (this.engineNodes) return;
    if (this.startAssetEngineLoop()) return;
    this.manifestPromise?.then(() => {
      if (this.pendingEngine && !this.engineNodes) this.startAssetEngineLoop(0.45);
    });
  }

  stopEngine() {
    this.pendingEngine = false;
    this.synth?.stopEngine();
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const nodes = this.engineNodes;
    nodes.hum.gain.cancelScheduledValues(t);
    nodes.hum.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => stopAudioSource(nodes.source), 800);
    this.engineNodes = null;
  }

  updateEngine(speedFactor: number, boosting: boolean) {
    if (this.useProcedural) { this.synth?.updateEngine(speedFactor, boosting); return; }
    if (!this.engineNodes || !this.ctx) return;
    const nodes = this.engineNodes;
    const rate = Math.min(1.45, Math.max(0.76, 0.84 + (speedFactor - 1) * 0.34 + (boosting ? 0.16 : 0)));
    nodes.source.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.09);
    const cutoff = 620 + (speedFactor - 1) * 1450 + (boosting ? 900 : 0);
    nodes.filter.frequency.setTargetAtTime(Math.max(420, cutoff), this.ctx.currentTime, 0.06);
    const gain = nodes.baseGain * (0.82 + (speedFactor - 1) * 0.34 + (boosting ? 0.18 : 0));
    nodes.hum.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.08);
  }

  setListenerPosition(p: THREE.Vector3) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
    } else {
      const legacyListener = l as AudioListener & { setPosition?: (x: number, y: number, z: number) => void };
      legacyListener.setPosition?.(p.x, p.y, p.z);
    }
  }

  whoosh(pos: THREE.Vector3, intensity = 1, kind = 'generic') {
    if (this.useProcedural) {
      this.ensure();
      const k: 'well' | 'generic' = kind === 'well' ? 'well' : 'generic';
      const cooldownMs = k === 'well' ? 520 : 360;
      const now = performance.now();
      const cueKey = `proc-whoosh-${k}`;
      if (now - (this.lastCueAt.get(cueKey) || 0) < cooldownMs) return;
      this.lastCueAt.set(cueKey, now);
      // Distance is encoded only via intensity here — caller already attenuates.
      const distanceProxy = Math.max(0, Math.min(80, 40 * (1 - intensity)));
      this.synth?.whoosh(distanceProxy, intensity, k);
      return;
    }
    const cue = kind === 'well' ? 'gravityWellWhoosh' : 'hazardWhoosh';
    const cueGain = kind === 'well' ? 0.46 : 0.28;
    const cooldownMs = kind === 'well' ? 520 : 360;
    this.playSfx(cue, { position: pos, gain: intensity * cueGain, cooldownMs });
  }

  uiTick() {
    if (this.useProcedural) { this.ensure(); this.synth?.uiTick(); return; }
    this.playSfx('uiTick');
  }

  uiClick() {
    if (this.useProcedural) { this.ensure(); this.synth?.uiClick(); return; }
    this.playSfx('uiClick');
  }

  uiSwoosh() {
    if (this.useProcedural) { this.ensure(); this.synth?.uiSwoosh(); return; }
    this.playSfx('uiSwoosh');
  }

  epochRiser() {
    if (this.useProcedural) { this.ensure(); this.synth?.epochRiser(); return; }
    this.playSfx('epochRiser');
  }
}

export const audio = new AudioEngine();
