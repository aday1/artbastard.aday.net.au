import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Act, Scene } from '../store';
import { useStore } from '../store';
import { useApc40LedFeedback } from './useApc40LedFeedback';

const scene = (name: string): Scene => ({
  name,
  channelValues: [],
  oscAddress: `/${name.toLowerCase().replace(/\s+/g, '-')}`,
});

const act = (id: string, name: string): Act => ({
  id,
  name,
  description: '',
  steps: [{ id: `${id}-step`, sceneName: 'APC40 Deck A 01', duration: 1000, transitionDuration: 100 }],
  loopMode: 'none',
  totalDuration: 1000,
  triggers: [],
  timelineEvents: [],
  createdAt: 1,
  updatedAt: 1,
});

const defaultApc40State = () => ({
  sceneAName: null,
  sceneBName: null,
  shiftLatched: false,
  mode: null,
  activeDeck: 'A' as const,
  armedColumns: [],
  fullOn: false,
  blackout: false,
  autoGroups: [],
  deviceRoleLabels: [],
  deviceBankIndex: 0,
  deviceBankCount: 0,
  deviceBankAtStart: true,
  deviceBankAtEnd: true,
  deviceBankFlashDirection: null,
  deviceBankFlashUntil: 0,
  lastChange: null,
});

const defaultPlaybackState = () => ({
  isPlaying: false,
  currentActId: null,
  currentStepIndex: 0,
  stepStartTime: 0,
  stepProgress: 0,
  loopCount: 0,
  playbackSpeed: 1,
});

describe('useApc40LedFeedback', () => {
  let output: { name: string; manufacturer: string; send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    output = { name: 'Akai APC40 Output', manufacturer: 'Akai', send: vi.fn() };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(() => Promise.resolve({
        outputs: new Map([['apc40', output]]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    useStore.setState({
      scenes: [],
      fixtures: [],
      groups: [],
      selectedFixtures: [],
      acts: [],
      actPlaybackState: defaultPlaybackState(),
      apc40CrossfaderState: defaultApc40State(),
    });
  });

  const sent = () => output.send.mock.calls.map(([message]) => message as number[]);

  it('paints saved, active, armed, record, and ACT LEDs with APC40 blink velocities', async () => {
    useStore.setState({
      scenes: [scene('APC40 Deck A 01'), scene('APC40 Deck A 03')],
      acts: [act('act-1', 'Warmup'), act('act-2', 'Chase')],
      actPlaybackState: { ...defaultPlaybackState(), isPlaying: true, currentActId: 'act-2' },
      apc40CrossfaderState: {
        ...defaultApc40State(),
        sceneAName: 'APC40 Deck A 01',
        activeDeck: 'A',
        mode: 'save',
        armedColumns: [1],
        soloedGroups: [1],
      },
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0x90, 0x35, 6]));

    const messages = sent();
    [
      [0x90, 0x35, 6],
      [0x91, 0x35, 4],
      [0x92, 0x35, 1],
      [0x91, 0x30, 4],
      [0x90, 0x52, 1],
      [0x90, 0x53, 6],
      [0x90, 0x5d, 4],
    ].forEach((message) => expect(messages).toContainEqual(message));
  });

  it('paints PAN, FULL ON, BLACKOUT, Detail View, and Master FREEZE state LEDs', async () => {
    useStore.setState({
      fixtures: [
        { id: 'fixture-a', name: 'Wash A', type: 'RGB Wash', startAddress: 1, channels: [] },
        { id: 'fixture-b', name: 'Wash B', type: 'RGB Wash', startAddress: 3, channels: [] },
      ] as any,
      selectedFixtures: ['fixture-a', 'fixture-b'],
      dmxFrozen: true,
      apc40CrossfaderState: {
        ...defaultApc40State(),
        fullOn: true,
        blackout: true,
      },
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0x90, 0x57, 1]));

    const messages = sent();
    expect(messages).toContainEqual([0x90, 0x3a, 3]);
    expect(messages).toContainEqual([0x90, 0x3b, 3]);
    expect(messages).toContainEqual([0x90, 0x3e, 3]);
    expect(messages).toContainEqual([0x98, 0x33, 3]);
  });

  it('paints device bank arrows as momentary movement and boundary indicators', async () => {
    useStore.setState({
      apc40CrossfaderState: {
        ...defaultApc40State(),
        deviceBankCount: 4,
        deviceBankIndex: 0,
        deviceBankAtStart: true,
        deviceBankAtEnd: false,
        deviceBankFlashDirection: 'next',
        deviceBankFlashUntil: Date.now() + 1000,
      },
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0x90, 0x3c, 3]));

    const messages = sent();
    expect(messages).toContainEqual([0x90, 0x3c, 3]);
    expect(messages).toContainEqual([0x90, 0x3d, 5]);
  });

  it('turns encoder rings off when the selected fixture lacks track/device capabilities', async () => {
    useStore.setState({
      fixtures: [
        {
          id: 'fixture-dimmer',
          name: 'Dimmer Only',
          type: 'Dimmer',
          startAddress: 1,
          channels: [{ name: 'Dimmer', type: 'dimmer' }],
        },
      ] as any,
      selectedFixtures: ['fixture-dimmer'],
      dmxChannels: [255, ...new Array(511).fill(0)],
      apc40CrossfaderState: {
        ...defaultApc40State(),
        deviceBankCount: 0,
        deviceBankAtStart: true,
        deviceBankAtEnd: true,
      },
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0xb0, 0x38, 0]));

    const messages = sent();
    expect(messages).toContainEqual([0xb0, 0x38, 0]);
    expect(messages).toContainEqual([0xb0, 0x39, 0]);
    expect(messages).toContainEqual([0xb0, 0x18, 0]);
  });

  it('paints track encoder rings from selected fixture track-control values', async () => {
    useStore.setState({
      fixtures: [
        {
          id: 'fixture-pan',
          name: 'Pan Only',
          type: 'Moving Head',
          startAddress: 1,
          channels: [{ name: 'Pan', type: 'pan' }],
        },
      ] as any,
      selectedFixtures: ['fixture-pan'],
      dmxChannels: [255, ...new Array(511).fill(0)],
      apc40CrossfaderState: defaultApc40State(),
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0xb0, 0x38, 127]));

    const messages = sent();
    expect(messages).toContainEqual([0xb0, 0x38, 127]);
    expect(messages).toContainEqual([0xb0, 0x39, 0]);
  });

  it('paints device encoder rings from selected fixture device capability values', async () => {
    useStore.setState({
      fixtures: [
        {
          id: 'fixture-gobo',
          name: 'Gobo Spot',
          type: 'Moving Head',
          startAddress: 1,
          channels: [{ name: 'Gobo Wheel', type: 'gobo_wheel' }],
        },
      ] as any,
      selectedFixtures: ['fixture-gobo'],
      dmxChannels: [128, ...new Array(511).fill(0)],
      apc40CrossfaderState: {
        ...defaultApc40State(),
        deviceBankCount: 1,
        deviceBankAtStart: true,
        deviceBankAtEnd: true,
      },
    });

    renderHook(() => useApc40LedFeedback());

    await waitFor(() => expect(sent()).toContainEqual([0xb0, 0x18, 64]));

    const messages = sent();
    expect(messages).toContainEqual([0xb0, 0x18, 64]);
    expect(messages).toContainEqual([0xb0, 0x19, 0]);
    expect(messages).toContainEqual([0xb0, 0x38, 0]);
  });
});