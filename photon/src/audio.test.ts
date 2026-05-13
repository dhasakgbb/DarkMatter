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
    createConvolver() { return audioNode({ buffer: null }); }
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
  audio.synth = null;
  audio.useProcedural = true;
  audio.proceduralEpoch = null;
}

function fireAllCues() {
  audio.pickup();
  audio.speedPad();
  audio.lineGate(3);
  audio.gateMiss();
  audio.railScrape();
  audio.hit();
  audio.shift(1);
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
    vi.unstubAllGlobals();
    resetAudio();
  });

  it('procedural mode synthesizes via oscillators + buffers without needing studio assets', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0 };
    installFakeAudio(counters);

    fireAllCues();

    expect(counters.oscillator).toBeGreaterThan(0);
    expect(counters.buffer).toBeGreaterThan(0);
  });

  it('asset-only mode (proceduralAudio=false) does not synthesize legacy audio while assets are unavailable', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0 };
    installFakeAudio(counters);

    audio.ensure();
    audio.setUseProcedural(false);
    // Procedural setup ran during ensure(); reset to measure only the asset path.
    counters.oscillator = 0;
    counters.buffer = 0;

    fireAllCues();

    expect(counters.oscillator).toBe(0);
    expect(counters.buffer).toBe(0);
  });

  it('audio.setFlow forwards into the procedural synth wet bus + drone filter', () => {
    const counters: CallCounters = { oscillator: 0, buffer: 0 };
    installFakeAudio(counters);

    audio.ensure();
    audio.startDrone(EPOCHS[0]);
    const synth = audio.synth!;
    expect(synth).toBeTruthy();

    const wetGain = synth.wet.gain as unknown as { setTargetAtTime: ReturnType<typeof vi.fn> };
    const droneFilterFreq = synth.droneHandle!.filter!.frequency as unknown as { setTargetAtTime: ReturnType<typeof vi.fn> };
    wetGain.setTargetAtTime.mockClear();
    droneFilterFreq.setTargetAtTime.mockClear();

    audio.setFlow(0.9);

    expect(wetGain.setTargetAtTime).toHaveBeenCalledTimes(1);
    expect(droneFilterFreq.setTargetAtTime).toHaveBeenCalledTimes(1);
    expect(synth.intensity).toBeCloseTo(0.9, 5);

    // Tiny deltas are no-ops to avoid zipper noise.
    wetGain.setTargetAtTime.mockClear();
    audio.setFlow(0.9009);
    expect(wetGain.setTargetAtTime).not.toHaveBeenCalled();
  });
});
