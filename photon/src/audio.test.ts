import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { audio } from './audio';
import { EPOCHS } from './cosmology';

type MockAudioNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
};

function audioParam(value = 0) {
  return {
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function audioNode(extra: Record<string, unknown> = {}) {
  let node: MockAudioNode;
  node = {
    connect: vi.fn(() => node),
    disconnect: vi.fn(),
    ...extra,
  };
  return node;
}

interface CallCounters {
  oscillator: number;
  buffer: number;
  convolver: number;
}

function installFakeAudio(counters: CallCounters) {
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 48000;
    destination = audioNode();
    listener = {
      positionX: audioParam(),
      positionY: audioParam(),
      positionZ: audioParam(),
    };
    createGain() { return audioNode({ gain: audioParam() }); }
    createBufferSource() {
      return audioNode({
        buffer: null,
        loop: false,
        playbackRate: audioParam(1),
        start: vi.fn(),
        stop: vi.fn(),
      });
    }
    createBiquadFilter() {
      return audioNode({ type: 'lowpass', frequency: audioParam(), Q: audioParam() });
    }
    createDelay() {
      return audioNode({ delayTime: audioParam() });
    }
    createPanner() {
      return audioNode({
        panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0,
        positionX: audioParam(), positionY: audioParam(), positionZ: audioParam(),
      });
    }
    createOscillator() {
      counters.oscillator += 1;
      return audioNode({
        type: 'sine',
        frequency: audioParam(440),
        start: vi.fn(),
        stop: vi.fn(),
      });
    }
    createBuffer(_channels: number, length: number) {
      counters.buffer += 1;
      return { getChannelData: vi.fn(() => new Float32Array(length)) };
    }
    createConvolver() {
      counters.convolver += 1;
      return audioNode({ buffer: null });
    }
    createDynamicsCompressor() {
      return audioNode({
        threshold: audioParam(), knee: audioParam(), ratio: audioParam(),
        attack: audioParam(), release: audioParam(),
      });
    }
    decodeAudioData() { return Promise.resolve({}); }
    resume() { return Promise.resolve(); }
  }

  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    __PHOTON_AUDIO_TRACE: [],
  });
  vi.stubGlobal('document', { baseURI: 'http://127.0.0.1:5175/' });
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    arrayBuffer: async () => new ArrayBuffer(0),
  })));
}

function resetAudio() {
  audio.ctx = null;
  audio.master = null;
  audio.studioMusicNodes = null;
  audio.engineNodes = null;
  audio.manifestPromise = null;
  audio.sfxBuffers.clear();
  audio.musicBuffers.clear();
  audio.lastCueAt.clear();
  audio.pendingMusicKey = null;
  audio.pendingEngine = false;
  audio.assetsReady = false;
  audio.scienceRedshift = 0;
  audio.scienceFlow = 0;
  audio.scienceDarkMatter = 0;
  audio.heatDeathProgress = 0;
  audio.scienceResonanceStreak = 0;
  audio.scienceModeAutomation = false;
}


type TestAudioParam = { setTargetAtTime: ReturnType<typeof vi.fn> };
type TestStudioNodes = {
  filter: { frequency: TestAudioParam; Q: TestAudioParam };
  delay: { delayTime: TestAudioParam };
  delayReturn: { gain: TestAudioParam };
  scienceGain: { gain: TestAudioParam };
  stemGains: Array<{ stem: string; gain: { gain: TestAudioParam }; baseGain: number }>;
};
type TestEngineNodes = {
  source: { playbackRate: TestAudioParam };
  filter: { frequency: TestAudioParam };
  hum: { gain: TestAudioParam };
};

function lastTarget(param: TestAudioParam) {
  const calls = param.setTargetAtTime.mock.calls;
  const call = calls[calls.length - 1];
  if (!call) throw new Error('Expected setTargetAtTime to be called');
  return call[0] as number;
}

function startFakeMusic(epochName = 'Inflationary') {
  audio.ensure();
  audio.assetsReady = true;
  audio.musicBuffers.set(epochName, [
    { buffer: {} as AudioBuffer, gain: 0.5, loop: true, stem: 'texture' },
    { buffer: {} as AudioBuffer, gain: 0.4, loop: true, stem: 'pulse' },
    { buffer: {} as AudioBuffer, gain: 0.3, loop: true, stem: 'danger' },
  ]);
  expect(audio.startStudioMusic(epochName, 0)).toBe(true);
  return audio.studioMusicNodes as unknown as TestStudioNodes;
}

function startFakeEngine() {
  audio.ensure();
  audio.assetsReady = true;
  audio.sfxBuffers.set('engineLoop', [{ buffer: {} as AudioBuffer, gain: 0.5, rate: 1, spatial: false, loop: true }]);
  expect(audio.startAssetEngineLoop(0)).toBe(true);
  return audio.engineNodes as unknown as TestEngineNodes;
}

function fireAllCues() {
  audio.pickup();
  audio.speedPad();
  audio.lineGate(3);
  audio.gateMiss();
  audio.railScrape();
  audio.hit();
  audio.shift(1);
  audio.phaseChime(2);
  audio.death();
  audio.witnessChime();
  audio.memoryUnlock();
  audio.whoosh(new THREE.Vector3(1, 2, 3));
  audio.uiTick();
  audio.uiClick();
  audio.uiSwoosh();
  audio.epochRiser();
  audio.startEngine();
  audio.startDrone(EPOCHS[0]);
  audio.startHeatDeath();
}

describe('audio runtime contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetAudio();
  });

  it('uses manifest assets only and never constructs generated Web Audio nodes', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);

    fireAllCues();

    expect(audio.mode).toBe('asset');
    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
    expect(counters.convolver).toBe(0);
  });

  it('keeps missing asset cues silent instead of falling back to generated Web Audio', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);

    audio.ensure();
    const played = audio.playSfx('pickup');

    expect(played).toBe(false);
    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
    expect(counters.convolver).toBe(0);
  });

  it('routes phase feedback through the current wavelength asset cue', () => {
    const playSpy = vi.spyOn(audio, 'playSfx').mockReturnValue(false);

    audio.phaseChime(0);

    expect(playSpy).toHaveBeenCalledWith('wavelengthShift', { rate: 1.12, gain: 0.45, cooldownMs: 80 });
  });

  it('maps science signals onto asset music filters, delay, and stem gains', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic();

    audio.setRedshift(0.75);
    audio.setFlow(0.5);
    audio.setDarkMatterSignal(0.6);

    expect(audio.scienceRedshift).toBe(0.75);
    expect(audio.scienceFlow).toBe(0.5);
    expect(audio.scienceDarkMatter).toBe(0.6);
    expect(lastTarget(nodes.filter.frequency)).toBeGreaterThan(3500);
    expect(lastTarget(nodes.filter.frequency)).toBeLessThan(4700);
    expect(lastTarget(nodes.delay.delayTime)).toBeGreaterThan(0.35);
    const textureGain = nodes.stemGains.find((stem) => stem.stem === 'texture')!;
    const dangerGain = nodes.stemGains.find((stem) => stem.stem === 'danger')!;
    expect(lastTarget(textureGain.gain.gain)).toBeGreaterThan(textureGain.baseGain);
    expect(lastTarget(dangerGain.gain.gain)).toBeGreaterThan(dangerGain.baseGain);
    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
    expect(counters.convolver).toBe(0);
  });

  it('uses Heat Death progress to fade asset music toward near-silence', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic('Heat Death');

    audio.setHeatDeathProgress(0.9);

    expect(audio.heatDeathProgress).toBe(0.9);
    expect(lastTarget(nodes.scienceGain.gain)).toBeLessThan(0.4);
    expect(lastTarget(nodes.delayReturn.gain)).toBeLessThan(0.04);
    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
    expect(counters.convolver).toBe(0);
  });

  it('layers science signals into the asset engine loop automation', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeEngine();

    audio.setRedshift(0.7);
    audio.setFlow(0.8);
    audio.setDarkMatterSignal(0.4);
    audio.setHeatDeathProgress(0.9);
    audio.updateEngine(1.2, true);

    expect(lastTarget(nodes.source.playbackRate)).toBeLessThan(1.05);
    expect(lastTarget(nodes.filter.frequency)).toBeGreaterThan(1100);
    expect(lastTarget(nodes.hum.gain)).toBeGreaterThan(0.2);
    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
    expect(counters.convolver).toBe(0);
  });

  it('defaults to linear automation so non-science callers preserve existing behavior', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic();

    expect(audio.scienceModeAutomation).toBe(false);
    audio.setRedshift(0.75);
    audio.setFlow(0.5);
    audio.setDarkMatterSignal(0.6);
    expect(lastTarget(nodes.filter.frequency)).toBeGreaterThan(3500);
    expect(lastTarget(nodes.filter.frequency)).toBeLessThan(4700);
  });

  it('applies the exponential redshift curve when science-mode automation is enabled', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic();

    audio.setScienceModeAutomation(true);
    audio.setFlow(0);
    audio.setDarkMatterSignal(0);
    audio.setRedshift(0);
    const cutoffAtZero = lastTarget(nodes.filter.frequency);
    audio.setRedshift(1);
    const cutoffAtOne = lastTarget(nodes.filter.frequency);

    expect(cutoffAtZero).toBeGreaterThan(7500);
    expect(cutoffAtOne).toBeGreaterThan(4200);
    expect(cutoffAtOne).toBeLessThan(5000);
    expect(cutoffAtOne).toBeLessThan(cutoffAtZero);
    audio.setScienceModeAutomation(false); // reset for other tests
  });

  it('boosts scienceGain proportionally to resonance streak when science automation is on', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic();

    audio.setScienceModeAutomation(true);
    audio.setHeatDeathProgress(0);
    audio.setResonanceStreak(0);
    const gainAtZero = lastTarget(nodes.scienceGain.gain);
    audio.setResonanceStreak(5);
    const gainAtFive = lastTarget(nodes.scienceGain.gain);
    audio.setResonanceStreak(20);
    const gainAtMaxed = lastTarget(nodes.scienceGain.gain);

    expect(gainAtFive).toBeGreaterThan(gainAtZero);
    expect(gainAtMaxed - gainAtZero).toBeLessThanOrEqual(0.26);
    audio.setScienceModeAutomation(false);
  });

  it('fades the resonance boost as Heat Death progresses', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0, convolver: 0 };
    installFakeAudio(counters);
    const nodes = startFakeMusic();

    audio.setScienceModeAutomation(true);
    audio.setResonanceStreak(20);
    audio.setHeatDeathProgress(0);
    const gainBeforeFade = lastTarget(nodes.scienceGain.gain);
    audio.setHeatDeathProgress(1);
    const gainAfterFade = lastTarget(nodes.scienceGain.gain);

    expect(gainAfterFade).toBeLessThan(gainBeforeFade);
    audio.setScienceModeAutomation(false);
    audio.setResonanceStreak(0);
  });
});
