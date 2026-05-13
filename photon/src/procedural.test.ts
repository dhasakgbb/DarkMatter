import { describe, expect, it, vi } from 'vitest';
import { EPOCHS } from './cosmology';
import { ProceduralSynth } from './procedural';

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
    connect: vi.fn((target) => target),
    disconnect: vi.fn(),
    ...extra,
  };
  return node;
}

function createMockAudioContext() {
  const oscillators: Array<MockAudioNode & { frequency: ReturnType<typeof audioParam> }> = [];
  const ctx = {
    currentTime: 10,
    sampleRate: 48000,
    oscillators,
    createDynamicsCompressor: () => audioNode({
      threshold: audioParam(),
      knee: audioParam(),
      ratio: audioParam(),
      attack: audioParam(),
      release: audioParam(),
    }),
    createGain: () => audioNode({ gain: audioParam() }),
    createConvolver: () => audioNode({ buffer: null }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    }),
    createOscillator: () => {
      const osc = audioNode({
        type: 'sine',
        frequency: audioParam(),
        start: vi.fn(),
        stop: vi.fn(),
      }) as MockAudioNode & { frequency: ReturnType<typeof audioParam> };
      oscillators.push(osc);
      return osc;
    },
    createBufferSource: () => audioNode({
      buffer: null,
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBiquadFilter: () => audioNode({
      type: 'lowpass',
      frequency: audioParam(),
      Q: audioParam(),
    }),
  };
  return ctx;
}

describe('ProceduralSynth', () => {
  it('redshifts drone pitch voices without retuning control oscillators', () => {
    const ctx = createMockAudioContext();
    const destination = audioNode({ gain: audioParam(1) });
    const synth = new ProceduralSynth(ctx as unknown as AudioContext, destination as unknown as GainNode);

    synth.startDrone(EPOCHS[0]);
    synth.setRedshift(0.5);

    expect(ctx.oscillators).toHaveLength(6);
    for (const osc of ctx.oscillators.slice(0, 4)) {
      expect(osc.frequency.setTargetAtTime).toHaveBeenCalled();
    }
    // LFO and ring-mod carrier are not pitch voices — setRedshift must leave them alone.
    expect(ctx.oscillators[4].frequency.setTargetAtTime).not.toHaveBeenCalled();
    expect(ctx.oscillators[5].frequency.setTargetAtTime).not.toHaveBeenCalled();
  });
});
