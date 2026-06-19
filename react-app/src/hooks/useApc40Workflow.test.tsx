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
    const currentModularAutomation = useStore.getState().modularAutomation;
    useStore.setState({
      fixtures: [fixtureA, fixtureB],
      groups: [groupA],
      selectedFixtures: [],
      scenes: [],
      acts: [],
      midiMessages: [],
      dmxFrozen: false,
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
        blackout: false,
        autoGroups: [],
        deviceRoleLabels: [],
        deviceBankIndex: 0,
        deviceBankCount: 0,
        deviceBankAtStart: true,
        deviceBankAtEnd: true,
        deviceBankFlashDirection: null,
        deviceBankFlashUntil: 0,
        activeTrackIndex: null,
        activeGroupId: null,
        activeFixtureIds: [],
        activeTargetLabel: null,
        lastChange: null,
      },
      modularAutomation: {
        ...currentModularAutomation,
        color: { ...currentModularAutomation.color, enabled: false },
        panTilt: { ...currentModularAutomation.panTilt, enabled: false },
        effects: { ...currentModularAutomation.effects, enabled: false },
        animationIds: { color: null, dimmer: null, panTilt: null, effects: null },
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

  it('uses APC40 PAN ON/OFF state to select and clear all fixtures', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x57, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
    });

    apcMessage({ channel: 0, note: 0x57, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
    });

    apcMessage({ channel: 0, note: 0x57, velocity: 0, timestamp: 2000 });

    await waitFor(() => {
      expect(useStore.getState().selectedFixtures).toEqual([]);
      expect(useStore.getState().apc40CrossfaderState.lastChange?.summary).toContain('Deselected all fixtures');
    });
  });

  it('uses APC40 SEND A/B/C ON/OFF state for modular automation engines', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x58, velocity: 127, timestamp: 1000 });
    apcMessage({ channel: 0, note: 0x59, velocity: 127, timestamp: 1100 });
    apcMessage({ channel: 0, note: 0x5a, velocity: 127, timestamp: 1200 });

    await waitFor(() => {
      const { modularAutomation } = useStore.getState();
      expect(modularAutomation.color.enabled).toBe(true);
      expect(modularAutomation.panTilt.enabled).toBe(true);
      expect(modularAutomation.effects.enabled).toBe(true);
    });

    apcMessage({ channel: 0, note: 0x58, velocity: 127, timestamp: 1300 });
    apcMessage({ channel: 0, note: 0x59, velocity: 127, timestamp: 1400 });
    apcMessage({ channel: 0, note: 0x5a, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      const { modularAutomation } = useStore.getState();
      expect(modularAutomation.color.enabled).toBe(true);
      expect(modularAutomation.panTilt.enabled).toBe(true);
      expect(modularAutomation.effects.enabled).toBe(true);
    });

    apcMessage({ channel: 0, note: 0x58, velocity: 0, timestamp: 2000 });
    apcMessage({ channel: 0, note: 0x59, velocity: 0, timestamp: 2100 });
    apcMessage({ channel: 0, note: 0x5a, velocity: 0, timestamp: 2200 });

    await waitFor(() => {
      const { modularAutomation } = useStore.getState();
      expect(modularAutomation.color.enabled).toBe(false);
      expect(modularAutomation.panTilt.enabled).toBe(false);
      expect(modularAutomation.effects.enabled).toBe(false);
    });
  });

  it('uses APC40 utility ON/OFF state for FULL ON, BLACKOUT, and FREEZE', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 0, note: 0x3a, velocity: 127, timestamp: 1000 });
    apcMessage({ channel: 0, note: 0x3b, velocity: 127, timestamp: 1100 });
    apcMessage({ channel: 0, note: 0x3e, velocity: 127, timestamp: 1200 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.apc40CrossfaderState.fullOn).toBe(true);
      expect(state.apc40CrossfaderState.blackout).toBe(true);
      expect(state.dmxFrozen).toBe(true);
    });

    apcMessage({ channel: 0, note: 0x3a, velocity: 127, timestamp: 1300 });
    apcMessage({ channel: 0, note: 0x3b, velocity: 127, timestamp: 1400 });
    apcMessage({ channel: 0, note: 0x3e, velocity: 127, timestamp: 1500 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.apc40CrossfaderState.fullOn).toBe(true);
      expect(state.apc40CrossfaderState.blackout).toBe(true);
      expect(state.dmxFrozen).toBe(true);
    });

    apcMessage({ channel: 0, note: 0x3a, velocity: 0, timestamp: 2000 });
    apcMessage({ channel: 0, note: 0x3b, velocity: 0, timestamp: 2100 });
    apcMessage({ channel: 0, note: 0x3e, velocity: 0, timestamp: 2200 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.apc40CrossfaderState.fullOn).toBe(false);
      expect(state.apc40CrossfaderState.blackout).toBe(false);
      expect(state.dmxFrozen).toBe(false);
    });
  });

  it('toggles DMX FREEZE from the APC40 Master Select button', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ channel: 8, note: 0x33, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.dmxFrozen).toBe(true);
      expect(state.apc40CrossfaderState.lastChange?.controlLabel).toBe('Master Select');
      expect(state.apc40CrossfaderState.lastChange?.summary).toContain('FROZEN');
    });

    apcMessage({ channel: 8, note: 0x33, velocity: 0, timestamp: 1010 });

    await waitFor(() => {
      expect(useStore.getState().dmxFrozen).toBe(true);
    });

    apcMessage({ channel: 8, note: 0x33, velocity: 0, timestamp: 2000 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.dmxFrozen).toBe(false);
      expect(state.apc40CrossfaderState.lastChange?.controlLabel).toBe('Master Select');
      expect(state.apc40CrossfaderState.lastChange?.summary).toContain('released');
    });

    apcMessage({ channel: 8, note: 0x33, velocity: 127, timestamp: 2500 });

    await waitFor(() => {
      expect(useStore.getState().dmxFrozen).toBe(true);
    });
  });

  it('uses the APC40 footswitch as a momentary DMX FREEZE pedal', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ _type: 'cc', type: 'cc', channel: 0, controller: 0x40, value: 127, timestamp: 1000 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.dmxFrozen).toBe(true);
      expect(state.apc40CrossfaderState.lastChange?.controlLabel).toBe('Footswitch');
      expect(state.apc40CrossfaderState.lastChange?.summary).toContain('FROZEN');
    });

    apcMessage({ _type: 'cc', type: 'cc', channel: 0, controller: 0x40, value: 0, timestamp: 1500 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.dmxFrozen).toBe(false);
      expect(state.apc40CrossfaderState.lastChange?.controlLabel).toBe('Footswitch');
      expect(state.apc40CrossfaderState.lastChange?.summary).toContain('released');
    });
  });

  it('toggles DMX FREEZE from the APC40 channel-9 CC burst Master Select emits', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x12, value: 0, timestamp: 1000 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x13, value: 0, timestamp: 1010 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x14, value: 4, timestamp: 1020 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x15, value: 0, timestamp: 1030 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x16, value: 1, timestamp: 1040 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x17, value: 0, timestamp: 1050 });

    await waitFor(() => {
      const state = useStore.getState();
      expect(state.dmxFrozen).toBe(true);
      expect(state.apc40CrossfaderState.lastChange?.controlLabel).toBe('Master Select');
      expect(state.apc40CrossfaderState.lastChange?.summary).toContain('FROZEN');
    });

    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x14, value: 4, timestamp: 1080 });

    await waitFor(() => {
      expect(useStore.getState().dmxFrozen).toBe(true);
    });

    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x12, value: 0, timestamp: 1700 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x13, value: 0, timestamp: 1710 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x14, value: 4, timestamp: 1720 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x15, value: 0, timestamp: 1730 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x16, value: 1, timestamp: 1740 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x17, value: 0, timestamp: 1750 });

    await waitFor(() => {
      expect(useStore.getState().dmxFrozen).toBe(false);
    });
  });

  it('does not toggle DMX FREEZE from standalone Device Control knob 5 CC20', async () => {
    renderHook(() => useApc40Workflow());

    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x14, value: 4, timestamp: 1000 });
    apcMessage({ _type: 'cc', type: 'cc', channel: 8, controller: 0x14, value: 8, timestamp: 1400 });

    await waitFor(() => {
      expect(useStore.getState().dmxFrozen).toBe(false);
    });
  });

  it('clamps APC40 Device Left/Right banks at first and last pages', async () => {
    renderHook(() => useApc40Workflow());

    act(() => {
      useStore.setState({
        fixtures: [{
          id: 'fixture-rich',
          name: 'Role Rich Spot',
          type: 'Moving Head',
          startAddress: 1,
          channels: [
            { name: 'Gobo', type: 'gobo' },
            { name: 'Gobo Rotate', type: 'gobo_rotation' },
            { name: 'Color Wheel', type: 'color_wheel' },
            { name: 'Prism', type: 'prism' },
            { name: 'Iris', type: 'iris' },
            { name: 'Focus', type: 'focus' },
            { name: 'Zoom', type: 'zoom' },
            { name: 'Strobe', type: 'strobe' },
            { name: 'Macro', type: 'macro' },
            { name: 'Speed', type: 'speed' },
          ],
        }] as any,
        selectedFixtures: ['fixture-rich'],
      } as any);
    });

    apcMessage({ channel: 0, note: 0x3c, velocity: 127, timestamp: 1000 });

    await waitFor(() => {
      const state = useStore.getState().apc40CrossfaderState;
      expect(state.deviceBankIndex).toBe(0);
      expect(state.deviceBankAtStart).toBe(true);
      expect(state.lastChange?.summary).toContain('first');
    });

    for (let index = 0; index < 20; index += 1) {
      apcMessage({ channel: 0, note: 0x3d, velocity: 127, timestamp: 1500 + index * 100 });
    }

    await waitFor(() => {
      const state = useStore.getState().apc40CrossfaderState;
      expect(state.deviceBankIndex).toBe(state.deviceBankCount - 1);
      expect(state.deviceBankAtEnd).toBe(true);
      expect(state.lastChange?.summary).toContain('last');
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
