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

interface SynthMusicNodes {
  sources: AudioScheduledSourceNode[];
  out: GainNode;
  scienceGain: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  delayReturn: GainNode;
  bass: OscillatorNode;
  harmonic: OscillatorNode;
  pulse: OscillatorNode;
  bassGain: GainNode;
  harmonicGain: GainNode;
  pulseGain: GainNode;
  textureGain: GainNode;
  baseFreq: number;
  heatDeath: boolean;
}

interface SynthEngineNodes {
  carrier: OscillatorNode;
  shimmer: OscillatorNode;
  filter: BiquadFilterNode;
  hum: GainNode;
  shimmerGain: GainNode;
  baseGain: number;
}

interface PlaySfxOptions {
  gain?: number;
  rate?: number;
  position?: THREE.Vector3;
  cooldownMs?: number;
}

type AudioTraceEntry = { cue: string; source: 'synth' | 'asset' | 'music' | 'missing'; at: number; detail?: string };

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

const REDSHIFT_FILTER_EXPONENT = 0.8;
const REDSHIFT_FILTER_CEILING_HZ = 8000;

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  synthMusicNodes: SynthMusicNodes | null = null;
  synthEngineNodes: SynthEngineNodes | null = null;
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
  scienceResonanceStreak = 0;
  scienceModeAutomation = false;
  _boostCurrent = 0;
  effectsMuted = true;

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

  setScienceModeAutomation(enabled: boolean) {
    this.scienceModeAutomation = enabled;
    this.applyScienceAutomation();
  }

  setResonanceStreak(n: number) {
    this.scienceResonanceStreak = Math.max(0, n);
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
    if (this.pendingEngine && !this.engineNodes && this.startAssetEngineLoop(0.45)) this.stopProceduralEngineLoop(0.25);
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
    if (!this.ctx) return false;
    if (this.effectsMuted) return false;

    const now = performance.now();
    if (options.cooldownMs && now - (this.lastCueAt.get(cue) || 0) < options.cooldownMs) return true;

    const variants = this.assetsReady ? this.sfxBuffers.get(cue) : null;
    if (!variants || variants.length === 0) {
      if (this.playSynthCue(cue, options)) {
        this.lastCueAt.set(cue, now);
        return true;
      }
      return false;
    }
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

  makeNoiseBuffer(seconds = 0.75) {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let sample = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.sin(i * 91.23 + Math.sin(i * 0.017) * 13.7) * 0.5;
      sample = sample * 0.92 + white * 0.08;
      channel[i] = sample;
    }
    return buffer;
  }

  startProceduralMusic(epochName: string, fadeIn = 1.2) {
    if (!this.ctx || !this.master) return false;
    this.stopProceduralMusic(0.18);
    this.stopStudioMusic(0.18);

    const ctx = this.ctx;
    const profile = this.epochSynthProfile(epochName);
    const out = ctx.createGain();
    const scienceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const delay = ctx.createDelay(0.9);
    const delayReturn = ctx.createGain();
    const bass = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const pulse = ctx.createOscillator();
    const texture = ctx.createBufferSource();
    const bassGain = ctx.createGain();
    const harmonicGain = ctx.createGain();
    const pulseGain = ctx.createGain();
    const textureGain = ctx.createGain();
    const textureFilter = ctx.createBiquadFilter();

    bass.type = 'sine';
    harmonic.type = profile.bright > 0.7 ? 'triangle' : 'sine';
    pulse.type = 'sine';
    bass.frequency.value = profile.baseFreq;
    harmonic.frequency.value = profile.baseFreq * profile.harmonic;
    pulse.frequency.value = profile.baseFreq * profile.pulse;
    texture.buffer = this.makeNoiseBuffer(profile.noiseSeconds);
    texture.loop = true;

    bassGain.gain.value = profile.bassGain;
    harmonicGain.gain.value = profile.harmonicGain;
    pulseGain.gain.value = profile.pulseGain;
    textureGain.gain.value = profile.textureGain;
    filter.type = 'lowpass';
    filter.frequency.value = profile.cutoff;
    filter.Q.value = profile.q;
    textureFilter.type = 'bandpass';
    textureFilter.frequency.value = profile.textureFreq;
    textureFilter.Q.value = 0.7 + profile.bright * 2.1;
    delay.delayTime.value = profile.delay;
    delayReturn.gain.value = profile.delayGain;

    bass.connect(bassGain).connect(out);
    harmonic.connect(harmonicGain).connect(out);
    pulse.connect(pulseGain).connect(out);
    texture.connect(textureFilter).connect(textureGain).connect(out);
    out.connect(scienceGain);
    scienceGain.connect(filter).connect(this.master);
    scienceGain.connect(delay).connect(delayReturn).connect(this.master);

    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(profile.outGain, ctx.currentTime + fadeIn);
    const startAt = ctx.currentTime + 0.02;
    bass.start(startAt);
    harmonic.start(startAt);
    pulse.start(startAt);
    texture.start(startAt);

    this.synthMusicNodes = {
      sources: [bass, harmonic, pulse, texture],
      out,
      scienceGain,
      filter,
      delay,
      delayReturn,
      bass,
      harmonic,
      pulse,
      bassGain,
      harmonicGain,
      pulseGain,
      textureGain,
      baseFreq: profile.baseFreq,
      heatDeath: epochName === 'Heat Death',
    };
    this.applyScienceAutomation();
    traceAudio(epochName, 'synth', `procedural ${profile.label}`);
    return true;
  }

  epochSynthProfile(epochName: string) {
    const key = epochName.toLowerCase();
    if (key.includes('inflation')) return { label: 'inflation storm', baseFreq: 48, harmonic: 5.01, pulse: 8.02, bassGain: 0.13, harmonicGain: 0.045, pulseGain: 0.025, textureGain: 0.105, cutoff: 7200, textureFreq: 4600, q: 0.95, delay: 0.055, delayGain: 0.035, outGain: 0.9, bright: 1, noiseSeconds: 0.9 };
    if (key.includes('quark')) return { label: 'plasma pressure', baseFreq: 55, harmonic: 3.02, pulse: 5.01, bassGain: 0.14, harmonicGain: 0.04, pulseGain: 0.035, textureGain: 0.09, cutoff: 5400, textureFreq: 3100, q: 1.1, delay: 0.08, delayGain: 0.04, outGain: 0.84, bright: 0.85, noiseSeconds: 1.1 };
    if (key.includes('recombination')) return { label: 'plasma clearing', baseFreq: 66, harmonic: 2.01, pulse: 3.01, bassGain: 0.10, harmonicGain: 0.07, pulseGain: 0.02, textureGain: 0.04, cutoff: 6500, textureFreq: 2500, q: 0.65, delay: 0.18, delayGain: 0.075, outGain: 0.74, bright: 0.72, noiseSeconds: 1.4 };
    if (key.includes('first stars')) return { label: 'first ignition', baseFreq: 73, harmonic: 2.99, pulse: 4.02, bassGain: 0.11, harmonicGain: 0.06, pulseGain: 0.035, textureGain: 0.045, cutoff: 6100, textureFreq: 3300, q: 0.78, delay: 0.14, delayGain: 0.06, outGain: 0.78, bright: 0.76, noiseSeconds: 1.2 };
    if (key.includes('stellar') || key.includes('galactic')) return { label: 'structure tension', baseFreq: 61, harmonic: 2.51, pulse: 6.01, bassGain: 0.145, harmonicGain: 0.055, pulseGain: 0.045, textureGain: 0.06, cutoff: 5000, textureFreq: 2200, q: 1.05, delay: 0.11, delayGain: 0.05, outGain: 0.86, bright: 0.66, noiseSeconds: 1.0 };
    if (key.includes('black hole')) return { label: 'event horizon dread', baseFreq: 37, harmonic: 1.51, pulse: 2.01, bassGain: 0.15, harmonicGain: 0.035, pulseGain: 0.015, textureGain: 0.035, cutoff: 2400, textureFreq: 900, q: 1.6, delay: 0.34, delayGain: 0.10, outGain: 0.75, bright: 0.24, noiseSeconds: 1.7 };
    if (key.includes('heat death')) return { label: 'entropy tone', baseFreq: 40, harmonic: 1.25, pulse: 1.01, bassGain: 0.12, harmonicGain: 0.025, pulseGain: 0.006, textureGain: 0.018, cutoff: 1700, textureFreq: 420, q: 0.9, delay: 0.52, delayGain: 0.11, outGain: 0.62, bright: 0.16, noiseSeconds: 2.0 };
    return { label: 'cosmic drift', baseFreq: 58, harmonic: 2.01, pulse: 3.01, bassGain: 0.12, harmonicGain: 0.05, pulseGain: 0.025, textureGain: 0.05, cutoff: 4200, textureFreq: 1900, q: 0.8, delay: 0.16, delayGain: 0.055, outGain: 0.78, bright: 0.55, noiseSeconds: 1.2 };
  }

  stopProceduralMusic(fadeOut = 0.8) {
    if (!this.synthMusicNodes || !this.ctx) return;
    const nodes = this.synthMusicNodes;
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
    this.synthMusicNodes = null;
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
    this.stopProceduralMusic(0.2);
    this.stopStudioMusic(0.2);
    this.pendingMusicKey = epoch.name;
    if (this.startStudioMusic(epoch.name, 0.45)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey !== epoch.name) return;
      if (!this.startStudioMusic(epoch.name, 0.45)) this.startProceduralMusic(epoch.name, 0.45);
    });
  }

  stopDrone() {
    this.pendingMusicKey = null;
    this.stopProceduralMusic();
    this.stopStudioMusic();
  }

  startHeatDeath() {
    this.ensure();
    if (!this.ctx) return;
    this.heatDeathProgress = 0;
    this.stopProceduralMusic(0.4);
    this.stopStudioMusic(0.4);
    this.pendingMusicKey = 'Heat Death';
    if (this.startStudioMusic('Heat Death', 8)) return;
    this.manifestPromise?.then(() => {
      if (this.pendingMusicKey !== 'Heat Death') return;
      if (!this.startStudioMusic('Heat Death', 0.8)) this.startProceduralMusic('Heat Death', 5.5);
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
    this.playSfx('phaseChime', { rate: shiftRates[idx] || 1, gain: 0.55, cooldownMs: 70 });
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

  startProceduralEngineLoop(fadeIn = 0.8) {
    if (!this.ctx || !this.master) return false;
    if (this.synthEngineNodes) return true;
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    const shimmer = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const hum = ctx.createGain();
    const shimmerGain = ctx.createGain();

    carrier.type = 'sine';
    shimmer.type = 'triangle';
    carrier.frequency.value = 54;
    shimmer.frequency.value = 162;
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = 1.35;
    hum.gain.setValueAtTime(0, ctx.currentTime);
    hum.gain.linearRampToValueAtTime(0.24, ctx.currentTime + fadeIn);
    shimmerGain.gain.value = 0.026;
    carrier.connect(filter).connect(hum).connect(this.master);
    shimmer.connect(shimmerGain).connect(filter);
    carrier.start(ctx.currentTime + 0.02);
    shimmer.start(ctx.currentTime + 0.02);
    this.synthEngineNodes = { carrier, shimmer, filter, hum, shimmerGain, baseGain: 0.24 };
    traceAudio('engineLoop', 'synth', 'procedural photon hum');
    return true;
  }

  stopProceduralEngineLoop(fadeOut = 0.45) {
    if (!this.synthEngineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const nodes = this.synthEngineNodes;
    nodes.hum.gain.cancelScheduledValues(t);
    nodes.hum.gain.linearRampToValueAtTime(0, t + fadeOut);
    setTimeout(() => {
      stopAudioSource(nodes.carrier);
      stopAudioSource(nodes.shimmer);
    }, Math.ceil((fadeOut + 0.1) * 1000));
    this.synthEngineNodes = null;
  }

  startEngine() {
    this.ensure();
    if (!this.ctx) return;
    if (this.effectsMuted) return;
    this.pendingEngine = true;
    if (this.synthEngineNodes || this.engineNodes) return;
    if (this.startAssetEngineLoop()) return;
    if (this.startProceduralEngineLoop()) {
      this.manifestPromise?.then(() => {
        if (this.pendingEngine && !this.engineNodes && this.startAssetEngineLoop(0.45)) this.stopProceduralEngineLoop(0.25);
      });
      return;
    }
    this.manifestPromise?.then(() => {
      if (this.pendingEngine && !this.engineNodes) this.startAssetEngineLoop(0.45);
    });
  }

  stopEngine() {
    this.pendingEngine = false;
    this.stopProceduralEngineLoop(0.45);
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const nodes = this.engineNodes;
    nodes.hum.gain.cancelScheduledValues(t);
    nodes.hum.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => stopAudioSource(nodes.source), 800);
    this.engineNodes = null;
  }

  spawnTone(freq: number, duration: number, gainValue: number, type: OscillatorType = 'sine', endFreq = freq) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (Math.abs(endFreq - freq) > 0.01) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.04);
  }

  spawnNoise(duration: number, gainValue: number, cutoff = 1600, q = 0.8) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.makeNoiseBuffer(duration);
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration + 0.04);
  }

  playSynthCue(cue: string, options: PlaySfxOptions) {
    if (!this.ctx) return false;
    const gain = options.gain ?? 1;
    const rate = options.rate ?? 1;
    const streak = Math.min(10, Math.max(0, this.scienceResonanceStreak));
    switch (cue) {
      case 'pickup':
        this.spawnTone(720 * rate, 0.16, 0.052 * gain, 'sine', 1080 * rate);
        this.spawnTone(1440 * rate, 0.12, 0.024 * gain, 'triangle', 1680 * rate);
        break;
      case 'speedPad':
        this.spawnTone(150 * rate, 0.34, 0.07 * gain, 'sawtooth', 520 * rate);
        this.spawnNoise(0.22, 0.026 * gain, 2200, 1.6);
        break;
      case 'lineGate':
        this.spawnTone((440 + streak * 22) * rate, 0.16, 0.052 * gain, 'sine');
        this.spawnTone((660 + streak * 33) * rate, 0.18, 0.034 * gain, 'triangle');
        this.spawnTone((880 + streak * 44) * rate, 0.20, 0.020 * gain, 'sine');
        break;
      case 'phaseChime':
        this.spawnTone(512 * rate, 0.18, 0.042 * gain, 'sine');
        this.spawnTone(768 * rate, 0.22, 0.034 * gain, 'sine');
        this.spawnTone(1024 * rate, 0.26, 0.022 * gain, 'triangle');
        break;
      case 'gateMiss':
        this.spawnTone(230 * rate, 0.18, 0.045 * gain, 'triangle', 120 * rate);
        this.spawnNoise(0.12, 0.018 * gain, 900, 1.2);
        break;
      case 'railScrape':
        this.spawnNoise(0.18, 0.034 * gain, 3100, 4.0);
        this.spawnTone(180 * rate, 0.14, 0.018 * gain, 'sawtooth', 130 * rate);
        break;
      case 'damageHit':
        this.spawnTone(86 * rate, 0.28, 0.09 * gain, 'sine', 42 * rate);
        this.spawnNoise(0.16, 0.038 * gain, 580, 1.4);
        break;
      case 'wavelengthShift':
        this.spawnTone(360 * rate, 0.13, 0.044 * gain, 'sine', 520 * rate);
        this.spawnTone(720 * rate, 0.11, 0.020 * gain, 'triangle');
        break;
      case 'death':
        this.spawnTone(150 * rate, 1.2, 0.085 * gain, 'sine', 36);
        this.spawnNoise(0.75, 0.026 * gain, 420, 0.6);
        break;
      case 'witnessChime':
        this.spawnTone(523 * rate, 0.48, 0.045 * gain, 'sine');
        this.spawnTone(784 * rate, 0.56, 0.032 * gain, 'sine');
        break;
      case 'memoryUnlock':
        this.spawnTone(392 * rate, 0.28, 0.035 * gain, 'sine');
        this.spawnTone(659 * rate, 0.42, 0.031 * gain, 'triangle');
        this.spawnTone(987 * rate, 0.52, 0.018 * gain, 'sine');
        break;
      case 'hazardWhoosh':
      case 'gravityWellWhoosh':
        this.spawnNoise(cue === 'gravityWellWhoosh' ? 0.42 : 0.26, (cue === 'gravityWellWhoosh' ? 0.038 : 0.026) * gain, cue === 'gravityWellWhoosh' ? 760 : 1450, cue === 'gravityWellWhoosh' ? 1.1 : 1.9);
        this.spawnTone(cue === 'gravityWellWhoosh' ? 72 : 118, cue === 'gravityWellWhoosh' ? 0.44 : 0.22, 0.026 * gain, 'sine', cue === 'gravityWellWhoosh' ? 54 : 180);
        break;
      case 'uiTick':
        this.spawnTone(880, 0.045, 0.018 * gain, 'sine');
        break;
      case 'uiClick':
        this.spawnTone(620, 0.07, 0.024 * gain, 'triangle', 760);
        break;
      case 'uiSwoosh':
        this.spawnNoise(0.16, 0.018 * gain, 2400, 1.2);
        break;
      case 'epochRiser':
        this.spawnTone(180, 0.65, 0.055 * gain, 'sine', 760);
        this.spawnNoise(0.42, 0.024 * gain, 3600, 0.9);
        break;
      default:
        return false;
    }
    traceAudio(cue, 'synth', 'procedural cue');
    return true;
  }

  updateEngine(speedFactor: number, boosting: boolean) {
    if (!this.ctx) return;
    const redshift = this.scienceRedshift;
    const flow = this.scienceFlow;
    const darkMatter = this.scienceDarkMatter;
    const heatFade = this.heatDeathFadeAmount();
    const rate = Math.min(1.5, Math.max(0.68, 0.84 + (speedFactor - 1) * 0.34 + (boosting ? 0.16 : 0) + flow * 0.045 - redshift * 0.11 - heatFade * 0.12));
    const cutoff = 620 + (speedFactor - 1) * 1450 + (boosting ? 900 : 0) + flow * 520 + darkMatter * 260 - redshift * 360 - heatFade * 480;
    const gainMultiplier = Math.max(0.08, 0.82 + (speedFactor - 1) * 0.34 + (boosting ? 0.18 : 0) + flow * 0.10 + darkMatter * 0.08 - redshift * 0.12 - heatFade * 0.42);
    if (this.synthEngineNodes) {
      const nodes = this.synthEngineNodes;
      const gain = nodes.baseGain * gainMultiplier;
      nodes.carrier.frequency.setTargetAtTime(46 + rate * 42, this.ctx.currentTime, 0.09);
      nodes.shimmer.frequency.setTargetAtTime(138 + rate * 118 + flow * 40, this.ctx.currentTime, 0.09);
      nodes.filter.frequency.setTargetAtTime(Math.max(240, cutoff), this.ctx.currentTime, 0.06);
      nodes.hum.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.08);
      nodes.shimmerGain.gain.setTargetAtTime(0.014 + flow * 0.018 + darkMatter * 0.012 + (boosting ? 0.014 : 0), this.ctx.currentTime, 0.08);
    }
    if (this.engineNodes) {
      const nodes = this.engineNodes;
      const gain = nodes.baseGain * gainMultiplier;
      nodes.source.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.09);
      nodes.filter.frequency.setTargetAtTime(Math.max(260, cutoff), this.ctx.currentTime, 0.06);
      nodes.hum.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.08);
    }
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

    if (this.synthMusicNodes) {
      const nodes = this.synthMusicNodes;
      const heatMul = nodes.heatDeath ? 1 - heatFade * 0.92 : 1;
      const expRedshiftCutoff = REDSHIFT_FILTER_CEILING_HZ * Math.pow(1 + redshift, -REDSHIFT_FILTER_EXPONENT);
      const cutoff = clamp(expRedshiftCutoff + flow * 1350 + darkMatter * 560 - heatFade * 1300, 360, 8600);
      const resonanceLift = this.scienceModeAutomation
        ? Math.min(0.22, this.scienceResonanceStreak * 0.042) * (1 - heatFade)
        : 0;
      nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.16);
      nodes.filter.Q.setTargetAtTime(0.58 + flow * 0.34 + darkMatter * 0.42 + heatFade * 0.2, t, 0.18);
      nodes.delay.delayTime.setTargetAtTime(clamp(0.06 + redshift * 0.34 + darkMatter * 0.12 + heatFade * 0.2, 0.04, 0.76), t, 0.24);
      nodes.delayReturn.gain.setTargetAtTime(clamp(0.025 + redshift * 0.06 + darkMatter * 0.05 - heatFade * 0.035, 0.006, 0.20), t, 0.24);
      nodes.scienceGain.gain.setTargetAtTime(Math.max(0.045, heatMul + resonanceLift), t, 0.28);
      nodes.bass.frequency.setTargetAtTime(Math.max(28, nodes.baseFreq * (1 - redshift * 0.12 - heatFade * 0.08 + flow * 0.025)), t, 0.2);
      nodes.harmonicGain.gain.setTargetAtTime(0.018 + flow * 0.05 + darkMatter * 0.028 + resonanceLift * 0.12 - heatFade * 0.025, t, 0.22);
      nodes.pulseGain.gain.setTargetAtTime(0.008 + flow * 0.035 + resonanceLift * 0.1 - redshift * 0.006 - heatFade * 0.01, t, 0.16);
      nodes.textureGain.gain.setTargetAtTime(Math.max(0.004, 0.026 + darkMatter * 0.045 + redshift * 0.014 - flow * 0.012 - heatFade * 0.022), t, 0.28);
    }

    if (this.studioMusicNodes) {
      const nodes = this.studioMusicNodes;
      const heatMul = nodes.heatDeath ? 1 - heatFade * 0.9 : 1;
      const expRedshiftCutoff = REDSHIFT_FILTER_CEILING_HZ * Math.pow(1 + redshift, -REDSHIFT_FILTER_EXPONENT);
      const linearRedshiftCutoff = 6200 - redshift * 4300;
      const redshiftCutoff = this.scienceModeAutomation ? expRedshiftCutoff : linearRedshiftCutoff;
      const cutoff = clamp(redshiftCutoff + flow * 1800 + darkMatter * 700 - heatFade * 1100, 520, 8800);
      nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.18);
      nodes.filter.Q.setTargetAtTime(0.62 + flow * 0.36 + darkMatter * 0.24, t, 0.18);
      nodes.delay.delayTime.setTargetAtTime(clamp(0.08 + redshift * 0.30 + flow * 0.06 + darkMatter * 0.11 + heatFade * 0.18, 0.04, 0.72), t, 0.24);
      nodes.delayReturn.gain.setTargetAtTime(clamp(0.035 + redshift * 0.075 + flow * 0.05 + darkMatter * 0.06 - heatFade * 0.055, 0.008, 0.22), t, 0.24);
      const streakBoost = this.scienceModeAutomation
        ? Math.min(0.25, this.scienceResonanceStreak * 0.05) * (1 - heatFade)
        : 0;
      nodes.scienceGain.gain.setTargetAtTime(Math.max(0.08, heatMul + streakBoost), t, 0.35);

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
