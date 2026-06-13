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
  autoGroups: [],
  deviceRoleLabels: [],
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
});