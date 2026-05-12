import type { Epoch } from './cosmology';
import type * as THREE from 'three';
import audioManifest from './audio-manifest.json';

// Per-epoch melody scales for the slow generative arpeggio above the drone.
const MELODIES: Record<string, { freqs: number[]; gap: number; vol: number }> = {
  'Inflationary':  { freqs: [261.63, 392.00, 523.25, 659.25, 783.99], gap: 3.2, vol: 0.05 },
  'Quark Plasma':  { freqs: [220.00, 246.94, 277.18, 369.99, 415.30], gap: 2.6, vol: 0.05 },
  'Recombination': { freqs: [261.63, 329.63, 392.00, 523.25, 659.25], gap: 3.8, vol: 0.06 },
  'First Stars':   { freqs: [233.08, 349.23, 466.16, 622.25],          gap: 2.8, vol: 0.05 },
  'Galactic':      { freqs: [220.00, 261.63, 311.13, 392.00, 466.16], gap: 3.0, vol: 0.05 },
  'Stellar':       { freqs: [261.63, 329.63, 392.00, 466.16, 587.33], gap: 3.4, vol: 0.05 },
  'Degenerate':    { freqs: [220.00, 246.94, 293.66, 349.23, 415.30], gap: 4.5, vol: 0.04 },
  'Black Hole':    { freqs: [110.00, 138.59, 174.61],                   gap: 6.0, vol: 0.04 },
};

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

interface PlaySfxOptions {
  gain?: number;
  rate?: number;
  position?: THREE.Vector3;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  droneNodes: any = null;
  engineNodes: any = null;
  studioMusicNodes: StudioMusicNodes | null = null;
  manifestPromise: Promise<void> | null = null;
  sfxBuffers = new Map<string, DecodedSfx[]>();
  musicBuffers = new Map<string, DecodedStem[]>();
  melodyTimeout: number | null = null;
  melodyKey: string | null = null;
  _boostCurrent = 0;

  ensure() {
    if (this.ctx) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx!.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx!.destination);
    this.manifestPromise = this.loadStudioAssets();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

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
        }).catch(() => {}));
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
          });
          this.sfxBuffers.set(cue, variants);
        }).catch(() => {}));
      }
    }

    await Promise.all(tasks);
  }

  async decodeAsset(path: string, assetBaseUrl: string) {
    const url = new URL(path, assetBaseUrl).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Audio asset not found: ${path}`);
    const bytes = await res.arrayBuffer();
    return this.ctx!.decodeAudioData(bytes);
  }

  playSfx(cue: string, options: PlaySfxOptions = {}) {
    this.ensure(); if (!this.ctx) return false;
    const variants = this.sfxBuffers.get(cue);
    if (!variants || variants.length === 0) return false;

    const ctx = this.ctx;
    const asset = variants[Math.floor(Math.random() * variants.length)];
    const source = ctx.createBufferSource();
    source.buffer = asset.buffer;
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
    return true;
  }

  startStudioMusic(epochName: string, fadeIn = 2.5) {
    if (!this.ctx) return false;
    const stems = this.musicBuffers.get(epochName);
    if (!stems || stems.length === 0) return false;

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
      for (const source of nodes.sources) {
        try { source.stop(); } catch (e) {}
      }
      try { nodes.out.disconnect(); } catch (e) {}
    }, Math.ceil((fadeOut + 0.1) * 1000));
    this.studioMusicNodes = null;
  }

  startDrone(epoch: Epoch) {
    this.ensure(); if (!this.ctx) return;
    this.stopDrone();
    if (this.startStudioMusic(epoch.name)) return;
    this.startMelody(epoch);
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master!);
    const baseFreq = 50 + epoch.duration * 0.6;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = baseFreq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = baseFreq * 1.005;
    const o3 = ctx.createOscillator(); o3.type = 'sine';     o3.frequency.value = baseFreq * 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.06;
    }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const noiseLp = ctx.createBiquadFilter(); noiseLp.type = 'lowpass'; noiseLp.frequency.value = 700;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.4;
    noise.connect(noiseLp).connect(noiseGain).connect(lp);
    o1.connect(lp); o2.connect(lp); o3.connect(lp);
    lp.connect(out);
    o1.start(); o2.start(); o3.start(); lfo.start(); noise.start();
    out.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2.5);
    this.droneNodes = { o1, o2, o3, lfo, noise, out };
  }
  stopDrone() {
    this.stopMelody();
    this.stopStudioMusic();
    if (!this.droneNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.droneNodes.out.gain.cancelScheduledValues(t);
    this.droneNodes.out.gain.linearRampToValueAtTime(0, t + 1.4);
    const nodes = this.droneNodes;
    setTimeout(() => { try { nodes.o1.stop(); nodes.o2.stop(); nodes.o3.stop(); nodes.lfo.stop(); nodes.noise.stop(); } catch (e) {} }, 1600);
    this.droneNodes = null;
  }
  startMelody(epoch: Epoch) {
    this.ensure(); if (!this.ctx) return;
    this.stopMelody();
    const m = MELODIES[epoch.name];
    if (!m) return;
    const tick = () => {
      if (!this.ctx || this.melodyKey !== epoch.name) return;
      const freq = m.freqs[Math.floor(Math.random() * m.freqs.length)];
      this.pluck(freq, m.vol);
      this.melodyTimeout = window.setTimeout(tick, (m.gap + (Math.random() - 0.5) * 1.2) * 1000);
    };
    this.melodyKey = epoch.name;
    this.melodyTimeout = window.setTimeout(tick, 1500);
  }
  stopMelody() {
    if (this.melodyTimeout != null) { clearTimeout(this.melodyTimeout); this.melodyTimeout = null; }
    this.melodyKey = null;
  }
  pluck(freq: number, vol: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g = this.ctx.createGain(); g.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 4; lp.Q.value = 0.6;
    o.connect(g); o2.connect(g); g.connect(lp); lp.connect(this.master!);
    g.gain.linearRampToValueAtTime(vol || 0.05, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    o.start(t); o.stop(t + 3.0);
    o2.start(t); o2.stop(t + 3.0);
  }
  pickup() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('pickup')) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(this.master!);
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.16);
    g.gain.linearRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.start(t); o.stop(t + 0.25);
  }
  speedPad() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('speedPad')) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const g = this.ctx.createGain(); g.gain.value = 0;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
    o.connect(hp).connect(g).connect(this.master!);
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.34);
    g.gain.linearRampToValueAtTime(0.10, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.start(t); o.stop(t + 0.46);
  }
  lineGate(streak: number) {
    this.ensure(); if (!this.ctx) return;
    const streakLift = Math.min(9, Math.max(0, streak));
    if (this.playSfx('lineGate', { rate: 1 + streakLift * 0.025, gain: 0.78 + streakLift * 0.035 })) return;
    const t = this.ctx.currentTime;
    const root = 440 * Math.pow(2, Math.min(9, streak) / 24);
    [root, root * 1.5].forEach((freq, i) => {
      const o = this.ctx!.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
      const g = this.ctx!.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.master!);
      const start = t + i * 0.035;
      g.gain.linearRampToValueAtTime(0.055, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      o.start(start); o.stop(start + 0.18);
    });
  }
  gateMiss() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('gateMiss')) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const g = this.ctx.createGain(); g.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 720; lp.Q.value = 3.2;
    o.connect(lp).connect(g).connect(this.master!);
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    g.gain.linearRampToValueAtTime(0.045, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    o.start(t); o.stop(t + 0.22);
  }
  railScrape() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('railScrape')) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.18), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.055));
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.6;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.055, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(bp).connect(g).connect(this.master!);
    n.start(t);
  }
  hit() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('damageHit')) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const ng = this.ctx.createGain(); ng.gain.value = 0.5;
    n.connect(ng).connect(this.master!);
    n.start(t);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.master!); o.start(t); o.stop(t + 0.32);
  }
  shift(idx: number) {
    this.ensure(); if (!this.ctx) return;
    const shiftRates = [1.12, 1.0, 0.88];
    if (this.playSfx('wavelengthShift', { rate: shiftRates[idx] || 1 })) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(this.master!);
    const baseFreqs = [1400, 800, 380];
    o.frequency.setValueAtTime(baseFreqs[idx] * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(baseFreqs[idx], t + 0.18);
    g.gain.linearRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.start(t); o.stop(t + 0.22);
  }
  death() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('death')) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.6, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.4)) * 0.6;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.5);
    n.connect(f).connect(this.master!); n.start(t);
  }
  startHeatDeath() {
    this.ensure(); if (!this.ctx) return;
    this.stopDrone();
    if (this.startStudioMusic('Heat Death', 8)) return;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master!);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 40;
    const sub2 = ctx.createOscillator(); sub2.type = 'sine'; sub2.frequency.value = 40.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 1.4;
    sub.connect(lp); sub2.connect(lp); lp.connect(out);
    sub.start(); sub2.start();
    const t = ctx.currentTime;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.18, t + 8);
    out.gain.linearRampToValueAtTime(0.10, t + 240);
    out.gain.linearRampToValueAtTime(0.0, t + 360);
    this.droneNodes = { o1: sub, o2: sub2, o3: { stop: () => {} }, lfo: { stop: () => {} }, noise: { stop: () => {} }, out };
  }
  witnessChime() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('witnessChime')) return;
    const t = this.ctx.currentTime;
    [261.63, 392.00, 523.25, 783.99].forEach((freq, i) => {
      const o = this.ctx!.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = this.ctx!.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.master!);
      const start = t + i * 0.4;
      g.gain.linearRampToValueAtTime(0.10, start + 0.3);
      g.gain.linearRampToValueAtTime(0.0, start + 4.5);
      o.start(start); o.stop(start + 5);
    });
  }
  startEngine() {
    this.ensure(); if (!this.ctx) return;
    if (this.engineNodes) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
    const hum = ctx.createGain(); hum.gain.value = 0;
    noise.connect(lp).connect(hum).connect(this.master!);
    noise.start();
    hum.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.8);
    const boostOsc = ctx.createOscillator(); boostOsc.type = 'sawtooth'; boostOsc.frequency.value = 80;
    const boostFilt = ctx.createBiquadFilter(); boostFilt.type = 'lowpass'; boostFilt.frequency.value = 1200; boostFilt.Q.value = 6;
    const boostGain = ctx.createGain(); boostGain.gain.value = 0;
    boostOsc.connect(boostFilt).connect(boostGain).connect(this.master!);
    boostOsc.start();
    this.engineNodes = { noise, lp, hum, boostOsc, boostFilt, boostGain };
  }
  stopEngine() {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.engineNodes;
    n.hum.gain.cancelScheduledValues(t);
    n.hum.gain.linearRampToValueAtTime(0, t + 0.6);
    n.boostGain.gain.cancelScheduledValues(t);
    n.boostGain.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => { try { n.noise.stop(); n.boostOsc.stop(); } catch (e) {} }, 800);
    this.engineNodes = null;
  }
  updateEngine(speedFactor: number, boosting: boolean) {
    if (!this.engineNodes || !this.ctx) return;
    const n = this.engineNodes;
    const cutoff = 300 + (speedFactor - 1) * 1200;
    n.lp.frequency.setTargetAtTime(Math.max(200, cutoff), this.ctx.currentTime, 0.05);
    const humGain = 0.05 + (speedFactor - 1) * 0.04;
    n.hum.gain.setTargetAtTime(humGain, this.ctx.currentTime, 0.1);
    const targetBoost = boosting ? 0.10 : 0;
    n.boostGain.gain.setTargetAtTime(targetBoost, this.ctx.currentTime, 0.06);
    const boostCut = boosting ? 1800 : 800;
    n.boostFilt.frequency.setTargetAtTime(boostCut, this.ctx.currentTime, 0.1);
  }

  // SPATIAL: tell the AudioContext where the listener is. Call each frame from the main loop.
  // Without this, PannerNode falls back to (0,0,0) and spatial cues are wrong.
  setListenerPosition(p: THREE.Vector3) {
    if (!this.ctx) return;
    const l: any = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
    }
  }

  // SPATIAL: a brief Doppler-falling whoosh emitted from a world position.
  // Used by hazards as they pass the photon. Cheap one-shot — no ambient loops.
  whoosh(pos: THREE.Vector3, intensity = 1, kind = 'generic') {
    this.ensure(); if (!this.ctx) return;
    const cue = kind === 'well' ? 'gravityWellWhoosh' : 'hazardWhoosh';
    if (this.playSfx(cue, { position: pos, gain: intensity })) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = kind === 'well' ? 'sawtooth' : 'sine';
    // Falling pitch — high start, low end (Doppler redshift as it passes)
    const startFreq = kind === 'well' ? 220 : 760;
    const endFreq   = kind === 'well' ? 80  : 240;
    o.frequency.setValueAtTime(startFreq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.38);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'well' ? 700 : 1400; lp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * intensity, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    const pan = this.ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 5;
    pan.maxDistance = 80;
    pan.rolloffFactor = 1.4;
    pan.positionX.value = pos.x;
    pan.positionY.value = pos.y;
    pan.positionZ.value = pos.z;
    o.connect(lp).connect(g).connect(pan).connect(this.master!);
    o.start(t); o.stop(t + 0.45);
  }

  // UI: very subtle hover tick (under-30ms blip)
  uiTick() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('uiTick')) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + 0.05);
  }
  // UI: stronger button press
  uiClick() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('uiClick')) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + 0.12);
  }
  // UI: panel open swoosh
  uiSwoosh() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('uiSwoosh')) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    n.connect(f).connect(g).connect(this.master!);
    n.start(t);
  }
  // UI: 1.2-second rising stinger when crossing into a new epoch.
  epochRiser() {
    this.ensure(); if (!this.ctx) return;
    if (this.playSfx('epochRiser')) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(4000, t + 1.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.7);
    g.gain.linearRampToValueAtTime(0.0, t + 1.3);
    n.connect(lp).connect(g).connect(this.master!);
    n.start(t);
    // Layer a sine sweep on top for tonal anchor
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(480, t + 1.0);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.05, t + 0.6);
    og.gain.linearRampToValueAtTime(0, t + 1.3);
    o.connect(og).connect(this.master!);
    o.start(t); o.stop(t + 1.4);
  }
}

export const audio = new AudioEngine();
