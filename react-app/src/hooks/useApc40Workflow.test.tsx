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
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
  ],
};

const fixtureB: Fixture = {
  id: 'fixture-b',
  name: 'Wash B',
  type: 'RGB Wash',
  startAddress: 3,
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Pan', type: 'pan' },
  ],
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
  const timestamp = typeof message.timestamp === 'number'
    ? message.timestamp
    : Date.now() + useStore.getState().midiMessages.length;
  act(() => {
    useStore.getState().addMidiMessage({
        _type: 'noteon',
        source: 'Akai APC40',
        velocity: 127,
        ...message,
        timestamp,
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

  it('treats delayed APC40 note-on velocity 0 as a toggle-off press, not an ignored release', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x31, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);
    });

    apcMessage({ channel: 0, note: 0x31, velocity: 0, timestamp: 1010 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);
    });

    apcMessage({ channel: 0, note: 0x31, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);
    });

    apcMessage({ channel: 0, note: 0x31, velocity: 0, timestamp: 2000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual([]);
      expect(useStore.getState().apc40CrossfaderState.lastChange?.summary).toContain('Deselected fixture');
    });
  });

  it('uses APC40 activator OFF state to remove a group without double toggling', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x32, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
    });

    apcMessage({ channel: 0, note: 0x32, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
    });

    apcMessage({ channel: 0, note: 0x32, velocity: 0, timestamp: 2000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual([]);
      expect(useStore.getState().apc40CrossfaderState.lastChange?.summary).toContain('Removed group');
    });
  });

  it('uses APC40 record-arm OFF state to release solo group without double toggling', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x30, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      expect(useStore.getState().apc40CrossfaderState.soloedGroups).toEqual([0]);
    });

    apcMessage({ channel: 0, note: 0x30, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      expect(useStore.getState().apc40CrossfaderState.soloedGroups).toEqual([0]);
    });

    apcMessage({ channel: 0, note: 0x30, velocity: 0, timestamp: 2000 });

    await waitFor(() => {
      expect(useStore.getState().apc40CrossfaderState.soloedGroups).toEqual([]);
      expect(useStore.getState().apc40CrossfaderState.lastChange?.summary).toContain('Released solo');
    });
  });

  it('saves then recalls a Deck A scene from transport REC plus clip grid', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x5d });
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

  it('saves Deck B when SHIFT is held for the clip after transport REC', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x5d });
    apcMessage({ channel: 0, note: 0x62 });
    apcMessage({ channel: 1, note: 0x35 });

    await waitFor(() => {
      const scene = useStore.getState().scenes.find((candidate) => candidate.name === 'APC40 Deck B 02');
      expect(scene?.channelValues[0]).toBe(111);
      expect(scene?.channelValues[1]).toBe(77);
      expect(useStore.getState().apc40CrossfaderState.sceneBName).toBe('APC40 Deck B 02');
    });
  });

  it('rolls dice on SHIFT+REC without entering save mode or saving a clip', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x62 });
    apcMessage({ channel: 0, note: 0x5d });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.scenes).toEqual([]);
      expect(state.apc40CrossfaderState.mode).toBeNull();
      expect(state.apc40CrossfaderState.armedColumns).toEqual([]);
      expect(state.dmxChannels.some((value, index) => index < 4 && value !== [111, 77, 77, 0][index])).toBe(true);
    });
  });
});
