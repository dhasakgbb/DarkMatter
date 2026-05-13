// Procedural audio synthesis layer.
//
// Restores and expands the original photon-racer.html AudioEngine that the
// asset-based loader replaced. Everything here is generated in real time from
// oscillators, noise buffers, and a generated impulse-response reverb so the
// game can sound rich without depending on the placeholder .ogg pack in
// audio-assets/ (those are 5 KB director-temp stubs per docs/audio/director-temp-audio.md).

import type { Epoch } from './cosmology';

interface DroneHandle {
  sources: AudioScheduledSourceNode[];
  pitchVoices: Array<{ osc: OscillatorNode; multiplier: number }>;
  out: GainNode;
  filter?: BiquadFilterNode;
  baseFreq: number;
  baseFilterFreq: number;
}

interface EngineHandle {
  sources: AudioScheduledSourceNode[];
  filter: BiquadFilterNode;
  hum: GainNode;
  boostGain: GainNode;
  boostFilter: BiquadFilterNode;
}

const EPOCH_DRONE_BASE: Record<string, { freq: number; mood: 'bright' | 'warm' | 'cold' | 'dark' }> = {
  Inflationary: { freq: 58, mood: 'bright' },
  'Quark Plasma': { freq: 64, mood: 'warm' },
  Recombination: { freq: 49, mood: 'warm' },
  'First Stars': { freq: 55, mood: 'bright' },
  Galactic: { freq: 47, mood: 'warm' },
  Stellar: { freq: 52, mood: 'bright' },
  Degenerate: { freq: 41, mood: 'cold' },
  'Black Hole': { freq: 33, mood: 'dark' },
  'Heat Death': { freq: 27, mood: 'dark' },
};

function safeStop(node: AudioScheduledSourceNode) {
  try { node.stop(); } catch { /* already stopped */ }
}

function safeDisconnect(node: AudioNode) {
  try { node.disconnect(); } catch { /* already disconnected */ }
}

export class ProceduralSynth {
  ctx: AudioContext;
  master: GainNode;            // wet+dry sum into the engine master
  dry: GainNode;               // direct send
  wet: GainNode;               // reverb send
  reverb: ConvolverNode;
  compressor: DynamicsCompressorNode;
  pinkBuffer: AudioBuffer;
  whiteBuffer: AudioBuffer;
  droneHandle: DroneHandle | null = null;
  engineHandle: EngineHandle | null = null;
  redshift = 0;                // 0..1, drives global pitch droop
  intensity = 0;               // 0..1 hidden flow signal — opens drone filter + reverb send
  baseWetGain = 0.32;

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.18;
    this.compressor.connect(destination);

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.compressor);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.78;
    this.dry.connect(this.master);

    this.wet = ctx.createGain();
    this.wet.gain.value = this.baseWetGain;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulseResponse(2.6, 2.0);
    this.wet.connect(this.reverb).connect(this.master);

    this.whiteBuffer = this.makeWhiteNoise(2);
    this.pinkBuffer = this.makePinkNoise(2);
  }

  // ---- buffer factories -----------------------------------------------------

  private makeImpulseResponse(seconds: number, decay: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const ir = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // dense early reflections folding into long pink tail
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return ir;
  }

  private makeWhiteNoise(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makePinkNoise(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  // ---- routing helpers ------------------------------------------------------

  /** Plug a node into both dry and wet sends with given wet ratio (0..1). */
  private send(node: AudioNode, wetMix = 0.35) {
    const taps: AudioNode[] = [];
    if (wetMix > 0) {
      const wetTap = this.ctx.createGain();
      wetTap.gain.value = wetMix;
      taps.push(wetTap);
      node.connect(wetTap).connect(this.wet);
    }
    if (wetMix < 1) {
      const dryTap = this.ctx.createGain();
      dryTap.gain.value = 1 - wetMix;
      taps.push(dryTap);
      node.connect(dryTap).connect(this.dry);
    }
    return () => {
      safeDisconnect(node);
      for (const tap of taps) safeDisconnect(tap);
    };
  }

  private sendTransient(node: AudioNode, wetMix: number, seconds: number) {
    const cleanup = this.send(node, wetMix);
    setTimeout(cleanup, Math.ceil(seconds * 1000));
  }

  // ---- public state -------------------------------------------------------

  /** 0..1 cosmological redshift — droops drone pitch and softens highs. */
  setRedshift(amount: number) {
    this.redshift = Math.max(0, Math.min(1, amount));
    if (this.droneHandle) {
      const droop = 1 - this.redshift * 0.28;
      const t = this.ctx.currentTime;
      for (const voice of this.droneHandle.pitchVoices) {
        voice.osc.frequency.setTargetAtTime(this.droneHandle.baseFreq * voice.multiplier * droop, t, 0.5);
      }
    }
  }

  /** 0..1 hidden flow signal. Opens drone lowpass + boosts reverb send. */
  setIntensity(amount: number) {
    const next = Math.max(0, Math.min(1, amount));
    if (Math.abs(next - this.intensity) < 0.005) return;
    this.intensity = next;
    const t = this.ctx.currentTime;
    this.wet.gain.setTargetAtTime(this.baseWetGain + next * 0.32, t, 0.4);
    if (this.droneHandle?.filter) {
      const target = this.droneHandle.baseFilterFreq * (1 + next * 0.6);
      this.droneHandle.filter.frequency.setTargetAtTime(target, t, 0.5);
    }
  }

  // ---- drones ---------------------------------------------------------------

  startDrone(epoch: Epoch) {
    this.stopDrone(0.4);
    const ctx = this.ctx;
    const conf = EPOCH_DRONE_BASE[epoch.name] ?? { freq: 50, mood: 'warm' as const };
    const baseFreq = conf.freq + Math.min(40, epoch.duration * 0.18);

    const out = ctx.createGain();
    out.gain.value = 0;

    // Two detuned saws, sub sine, and a fifth above for richness
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = baseFreq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = baseFreq * 1.0055;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = baseFreq * 0.5;
    const o4 = ctx.createOscillator(); o4.type = 'triangle'; o4.frequency.value = baseFreq * 1.4983;
    const o4Gain = ctx.createGain();
    o4Gain.gain.value = conf.mood === 'bright' ? 0.22 : conf.mood === 'warm' ? 0.16 : 0.08;
    o4.connect(o4Gain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = conf.mood === 'bright' ? 620 : conf.mood === 'warm' ? 480 : conf.mood === 'cold' ? 320 : 220;
    lp.Q.value = conf.mood === 'dark' ? 2.4 : 5.5;

    // Slow filter LFO for life
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lp.frequency.value * 0.45;
    lfo.connect(lfoGain).connect(lp.frequency);

    // Pink-noise air bed
    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkBuffer;
    noise.loop = true;
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 900;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = conf.mood === 'dark' ? 0.55 : 0.3;
    noise.connect(noiseLp).connect(noiseGain);

    // Sum into filter
    o1.connect(lp); o2.connect(lp); o3.connect(lp); o4Gain.connect(lp); noiseGain.connect(lp);
    lp.connect(out);

    this.send(out, 0.5);

    const t = ctx.currentTime;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(conf.mood === 'dark' ? 0.22 : 0.28, t + 2.4);

    o1.start(); o2.start(); o3.start(); o4.start(); lfo.start(); noise.start();

    this.droneHandle = {
      sources: [o1, o2, o3, o4, lfo, noise],
      pitchVoices: [
        { osc: o1, multiplier: 1 },
        { osc: o2, multiplier: 1.0055 },
        { osc: o3, multiplier: 0.5 },
        { osc: o4, multiplier: 1.4983 },
      ],
      out,
      filter: lp,
      baseFreq,
      baseFilterFreq: lp.frequency.value,
    };

    if (this.redshift > 0) this.setRedshift(this.redshift);
    if (this.intensity > 0) {
      // Re-apply intensity to the freshly-built drone filter + wet bus.
      const target = this.droneHandle.baseFilterFreq * (1 + this.intensity * 0.6);
      lp.frequency.setTargetAtTime(target, ctx.currentTime, 0.5);
    }
  }

  stopDrone(fade = 1.4) {
    if (!this.droneHandle) return;
    const handle = this.droneHandle;
    this.droneHandle = null;
    const t = this.ctx.currentTime;
    handle.out.gain.cancelScheduledValues(t);
    handle.out.gain.setValueAtTime(handle.out.gain.value, t);
    handle.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => {
      for (const s of handle.sources) safeStop(s);
      safeDisconnect(handle.out);
    }, Math.ceil((fade + 0.1) * 1000));
  }

  startHeatDeath() {
    this.stopDrone(0.6);
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;

    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 36;
    const sub2 = ctx.createOscillator(); sub2.type = 'sine'; sub2.frequency.value = 36.7;
    const ghost = ctx.createOscillator(); ghost.type = 'sine'; ghost.frequency.value = 144;
    const ghostGain = ctx.createGain(); ghostGain.gain.value = 0.04;
    ghost.connect(ghostGain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 110;
    lp.Q.value = 1.6;

    sub.connect(lp); sub2.connect(lp); ghostGain.connect(lp);
    lp.connect(out);

    this.send(out, 0.7);

    const t = ctx.currentTime;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.22, t + 8);
    out.gain.linearRampToValueAtTime(0.12, t + 240);
    out.gain.linearRampToValueAtTime(0, t + 360);

    sub.start(); sub2.start(); ghost.start();

    this.droneHandle = {
      sources: [sub, sub2, ghost],
      pitchVoices: [
        { osc: sub, multiplier: 1 },
        { osc: sub2, multiplier: 36.7 / 36 },
        { osc: ghost, multiplier: 4 },
      ],
      out,
      filter: lp,
      baseFreq: 36,
      baseFilterFreq: lp.frequency.value,
    };
  }

  // ---- engine loop ----------------------------------------------------------

  startEngine() {
    if (this.engineHandle) return;
    const ctx = this.ctx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    filter.Q.value = 2.6;

    const hum = ctx.createGain();
    hum.gain.value = 0;

    noise.connect(filter).connect(hum);
    this.send(hum, 0.18);

    const boostOsc = ctx.createOscillator();
    boostOsc.type = 'sawtooth';
    boostOsc.frequency.value = 78;
    const boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'lowpass';
    boostFilter.frequency.value = 900;
    boostFilter.Q.value = 6;
    const boostGain = ctx.createGain();
    boostGain.gain.value = 0;
    boostOsc.connect(boostFilter).connect(boostGain);
    this.send(boostGain, 0.22);

    const t = ctx.currentTime;
    hum.gain.setValueAtTime(0, t);
    hum.gain.linearRampToValueAtTime(0.07, t + 0.8);

    noise.start(); boostOsc.start();
    this.engineHandle = {
      sources: [noise, boostOsc],
      filter,
      hum,
      boostGain,
      boostFilter,
    };
  }

  stopEngine() {
    if (!this.engineHandle) return;
    const handle = this.engineHandle;
    this.engineHandle = null;
    const t = this.ctx.currentTime;
    handle.hum.gain.cancelScheduledValues(t);
    handle.hum.gain.linearRampToValueAtTime(0, t + 0.6);
    handle.boostGain.gain.cancelScheduledValues(t);
    handle.boostGain.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => {
      for (const s of handle.sources) safeStop(s);
      safeDisconnect(handle.hum);
      safeDisconnect(handle.filter);
      safeDisconnect(handle.boostGain);
      safeDisconnect(handle.boostFilter);
    }, 800);
  }

  updateEngine(speedFactor: number, boosting: boolean) {
    if (!this.engineHandle) return;
    const t = this.ctx.currentTime;
    const cutoff = 380 + (speedFactor - 1) * 1600 + (boosting ? 600 : 0);
    this.engineHandle.filter.frequency.setTargetAtTime(Math.max(220, cutoff), t, 0.05);
    const humTarget = 0.05 + (speedFactor - 1) * 0.05 + (boosting ? 0.025 : 0);
    this.engineHandle.hum.gain.setTargetAtTime(humTarget, t, 0.1);
    this.engineHandle.boostGain.gain.setTargetAtTime(boosting ? 0.11 : 0, t, 0.06);
    this.engineHandle.boostFilter.frequency.setTargetAtTime(boosting ? 1700 : 700, t, 0.1);
  }

  // ---- short cues -----------------------------------------------------------

  pickup() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const jitter = (Math.random() - 0.5) * 80;
    const baseHi = 1760 + jitter;
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.setValueAtTime(880 + jitter * 0.5, t);
    o1.frequency.exponentialRampToValueAtTime(baseHi, t + 0.16);
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(1320, t);
    o2.frequency.exponentialRampToValueAtTime(baseHi * 1.5, t + 0.18);
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(g); o2.connect(g);
    this.sendTransient(g, 0.45, 0.45);
    g.gain.linearRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o1.start(t); o2.start(t);
    o1.stop(t + 0.34); o2.stop(t + 0.34);
  }

  /** Wavelength shift cue. idx 0=gamma (bright FM bell), 1=visible (warm balanced), 2=radio (low FM bloom). */
  shift(idx: number) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const carrierBase = [1480, 760, 320][idx] ?? 760;
    const ratio = [3.0, 2.0, 1.5][idx] ?? 2.0;
    const modIndex = [620, 360, 220][idx] ?? 360;

    const carrier = ctx.createOscillator(); carrier.type = idx === 0 ? 'triangle' : 'sine';
    carrier.frequency.setValueAtTime(carrierBase * 1.6, t);
    carrier.frequency.exponentialRampToValueAtTime(carrierBase, t + 0.18);

    const modulator = ctx.createOscillator(); modulator.type = 'sine';
    modulator.frequency.value = carrierBase * ratio;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(modIndex, t);
    modGain.gain.exponentialRampToValueAtTime(modIndex * 0.05, t + 0.32);
    modulator.connect(modGain).connect(carrier.frequency);

    const g = ctx.createGain(); g.gain.value = 0;
    carrier.connect(g);
    this.sendTransient(g, 0.55, 0.55);
    g.gain.linearRampToValueAtTime(0.18, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    carrier.start(t); modulator.start(t);
    carrier.stop(t + 0.42); modulator.stop(t + 0.42);
  }

  hit() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteBuffer;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 1400;
    nFilter.Q.value = 1.2;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.55, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(nFilter).connect(nGain);
    this.sendTransient(nGain, 0.4, 0.45);

    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(42, t + 0.32);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    sub.connect(subGain);
    this.sendTransient(subGain, 0.25, 0.5);

    noise.start(t); sub.start(t);
    setTimeout(() => safeStop(noise), 260);
    sub.stop(t + 0.36);
  }

  death() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
    noise.connect(filter).connect(g);
    this.sendTransient(g, 0.6, 1.9);

    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 1.4);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    sub.connect(subGain);
    this.sendTransient(subGain, 0.3, 1.9);

    noise.start(t); sub.start(t);
    setTimeout(() => safeStop(noise), 1900);
    sub.stop(t + 1.7);
  }

  lineGate(streak: number) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const lift = Math.min(9, Math.max(0, streak));
    const root = 523.25 * Math.pow(2, lift / 24); // up to a fifth
    [1, 1.5, 2].forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = root * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10 / (i + 1), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55 - i * 0.08);
      o.connect(g);
      this.sendTransient(g, 0.5, 0.75);
      o.start(t); o.stop(t + 0.6);
    });
  }

  gateMiss() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(96, t + 0.4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(f).connect(g);
    this.sendTransient(g, 0.45, 0.6);
    o.start(t); o.stop(t + 0.5);
  }

  speedPad() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(820, t + 0.28);
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.frequency.setValueAtTime(360, t);
    o2.frequency.exponentialRampToValueAtTime(1640, t + 0.3);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(f); o2.connect(f); f.connect(g);
    this.sendTransient(g, 0.5, 0.65);
    o.start(t); o2.start(t);
    o.stop(t + 0.5); o2.stop(t + 0.5);
  }

  railScrape() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteBuffer;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 2400 + Math.random() * 600;
    f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    noise.connect(f).connect(g);
    this.sendTransient(g, 0.35, 0.45);
    noise.start(t);
    setTimeout(() => safeStop(noise), 360);
  }

  witnessChime() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [261.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.type = 'sine';
      o2.frequency.value = freq * 2.001;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g); o2.connect(g);
      this.sendTransient(g, 0.65, 6.2);
      const start = t + i * 0.32;
      g.gain.linearRampToValueAtTime(0.09, start + 0.4);
      g.gain.linearRampToValueAtTime(0, start + 4.6);
      o.start(start); o2.start(start);
      o.stop(start + 4.8); o2.stop(start + 4.8);
    });
  }

  memoryUnlock() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const root = 392;
    [1, 1.25, 1.5, 2].forEach((mult, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = root * mult;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g);
      this.sendTransient(g, 0.6, 2.0);
      const start = t + i * 0.05;
      g.gain.linearRampToValueAtTime(0.10 / (i + 1), start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
      o.start(start); o.stop(start + 1.7);
    });
  }

  uiTick() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g);
    this.sendTransient(g, 0.15, 0.12);
    o.start(t); o.stop(t + 0.08);
  }

  uiClick() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g);
    this.sendTransient(g, 0.25, 0.25);
    o.start(t); o.stop(t + 0.18);
  }

  uiSwoosh() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteBuffer;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.32);
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(f).connect(g);
    this.sendTransient(g, 0.45, 0.55);
    noise.start(t);
    setTimeout(() => safeStop(noise), 480);
  }

  epochRiser() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkBuffer;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 2.2);
    f.Q.value = 3.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    noise.connect(f).connect(g);
    this.sendTransient(g, 0.7, 2.8);

    const tone = ctx.createOscillator(); tone.type = 'sine';
    tone.frequency.setValueAtTime(110, t);
    tone.frequency.exponentialRampToValueAtTime(440, t + 2.2);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0, t);
    toneGain.gain.linearRampToValueAtTime(0.14, t + 1.6);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    tone.connect(toneGain);
    this.sendTransient(toneGain, 0.5, 2.8);

    noise.start(t); tone.start(t);
    setTimeout(() => safeStop(noise), 2700);
    tone.stop(t + 2.7);
  }

  /** Spatial whoosh approximation — proximity-driven bandpass noise sweep. */
  whoosh(distance: number, intensity: number, kind: 'well' | 'generic') {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteBuffer;
    const proximity = Math.max(0.05, 1 - distance / 80);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = (kind === 'well' ? 320 : 900) + proximity * 800;
    f.Q.value = kind === 'well' ? 9 : 3.2;
    const g = ctx.createGain();
    const peak = (kind === 'well' ? 0.18 : 0.12) * intensity * proximity;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'well' ? 0.7 : 0.4));
    noise.connect(f).connect(g);
    this.sendTransient(g, kind === 'well' ? 0.65 : 0.4, kind === 'well' ? 0.9 : 0.6);
    noise.start(t);
    setTimeout(() => safeStop(noise), kind === 'well' ? 800 : 480);
  }
}
