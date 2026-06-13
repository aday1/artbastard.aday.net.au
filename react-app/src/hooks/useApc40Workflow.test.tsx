import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore, type Fixture, type Group } from '../store';
import { useApc40Workflow } from './useApc40Workflow';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

const fixtureA: Fixture = {
  id: 'fixture-a',
  name: 'Wash A',
  type: 'RGB Wash',
  startAddress: 1,
  channels: [{ name: 'Dimmer', type: 'dimmer' }],
};

const fixtureB: Fixture = {
  id: 'fixture-b',
  name: 'Wash B',
  type: 'RGB Wash',
  startAddress: 2,
  channels: [{ name: 'Dimmer', type: 'dimmer' }],
};

const groupA: Group = {
  id: 'group-a',
  name: 'Front Wash',
  fixtureIndices: [0, 1],
  lastStates: [],
  isMuted: false,
  isSolo: false,
  masterValue: 255,
};

function apcMessage(message: Record<string, unknown>) {
  act(() => {
    useStore.getState().addMidiMessage({
        _type: 'noteon',
        source: 'Akai APC40',
        velocity: 127,
        ...message,
        timestamp: Date.now() + useStore.getState().midiMessages.length,
      } as any);
  });
}

describe('useApc40Workflow', () => {
  beforeEach(() => {
    useStore.setState({
      fixtures: [fixtureA, fixtureB],
      groups: [groupA],
      selectedFixtures: [],
      scenes: [],
      acts: [],
      midiMessages: [],
      dmxChannels: [111, 77, ...new Array(510).fill(0)],
      activeSceneName: null,
      apc40CrossfaderState: {
        sceneAName: null,
        sceneBName: null,
        shiftLatched: false,
        mode: null,
        activeDeck: 'A',
        armedColumns: [],
        fullOn: false,
        autoGroups: [],
        deviceRoleLabels: [],
        activeTrackIndex: null,
        activeGroupId: null,
        activeFixtureIds: [],
        activeTargetLabel: null,
        lastChange: null,
      },
    } as any);
  });

  it('publishes live APC target state when Activator chooses a group', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x32 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
      expect(state.apc40CrossfaderState.activeTrackIndex).toBe(0);
      expect(state.apc40CrossfaderState.activeGroupId).toBe('group-a');
      expect(state.apc40CrossfaderState.activeFixtureIds).toEqual(['fixture-a', 'fixture-b']);
      expect(state.apc40CrossfaderState.activeTargetLabel).toBe('Group 1: Front Wash');
    });
  });

  it('saves then recalls a Deck A scene from Record Arm plus clip grid', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 1, note: 0x30 });
    apcMessage({ channel: 1, note: 0x35 });

    await waitFor(() => {
      const scene = useStore.getState().scenes.find((candidate) => candidate.name === 'APC40 Deck A 02');
      expect(scene?.channelValues[0]).toBe(111);
      expect(scene?.channelValues[1]).toBe(77);
      expect(useStore.getState().apc40CrossfaderState.sceneAName).toBe('APC40 Deck A 02');
    });

    act(() => {
      useStore.setState({ dmxChannels: new Array(512).fill(0), activeSceneName: null } as any);
    });
    apcMessage({ channel: 1, note: 0x35 });

    await waitFor(() => {
      expect(useStore.getState().activeSceneName).toBe('APC40 Deck A 02');
    });
  });
});
