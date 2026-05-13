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
}

describe('asset-only audio runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudio();
  });

  it('does not synthesize legacy audio while assets are unavailable', () => {
    const legacyCalls = { oscillator: 0, buffer: 0 };

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

      createGain() {
        return audioNode({ gain: audioParam() });
      }

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
        return audioNode({
          type: 'lowpass',
          frequency: audioParam(),
          Q: audioParam(),
        });
      }

      createPanner() {
        return audioNode({
          panningModel: '',
          distanceModel: '',
          refDistance: 0,
          maxDistance: 0,
          rolloffFactor: 0,
          positionX: audioParam(),
          positionY: audioParam(),
          positionZ: audioParam(),
        });
      }

      createOscillator() {
        legacyCalls.oscillator += 1;
        return audioNode();
      }

      createBuffer() {
        legacyCalls.buffer += 1;
        return { getChannelData: vi.fn(() => new Float32Array(0)) };
      }

      decodeAudioData() {
        return Promise.resolve({});
      }

      resume() {
        return Promise.resolve();
      }
    }

    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      webkitAudioContext: FakeAudioContext,
      __PHOTON_AUDIO_TRACE: [],
    });
    vi.stubGlobal('document', { baseURI: 'http://127.0.0.1:5175/' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0),
    })));

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

    expect(legacyCalls.oscillator).toBe(0);
    expect(legacyCalls.buffer).toBe(0);
  });
});
