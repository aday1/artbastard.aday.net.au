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

const miniBeam: Fixture = {
  id: 'minibeam', name: 'MINIBEAM 1', type: 'Moving Head', startAddress: 1,
  channels: [
    { name: 'Colour Wheel', type: 'color_wheel' }, { name: 'Strobe', type: 'strobe' },
    { name: 'Dimmer', type: 'dimmer' }, { name: 'Gobo', type: 'gobo' },
    { name: 'Prism', type: 'prism' }, { name: 'Prism Rotation', type: 'other' },
    { name: 'Effect', type: 'other' }, { name: 'Frost', type: 'other' },
    { name: 'Focus', type: 'focus' }, { name: 'Pan', type: 'pan' },
    { name: 'Pan Fine', type: 'pan_fine' }, { name: 'Tilt', type: 'tilt' },
    { name: 'Tilt Fine', type: 'tilt_fine' }, { name: 'Macro', type: 'macro' },
    { name: 'Reset', type: 'reset' }, { name: 'Lamp', type: 'lamp' },
    { name: 'Pan/Tilt Speed', type: 'speed' }, { name: 'Effect Speed', type: 'speed' },
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

  it.each([
    ['Solo/Cue fixture', 0x31, (s: any) => s.selectedFixtures.includes('fixture-a')],
    ['Activator group', 0x32, (s: any) => s.selectedFixtures.length === 2],
    ['Record Arm solo', 0x30, (s: any) => s.apc40CrossfaderState.soloedGroups.includes(0)],
    ['PAN all fixtures', 0x57, (s: any) => s.selectedFixtures.length === 2],
    ['SEND A', 0x58, (s: any) => s.modularAutomation.color.enabled],
    ['SEND B', 0x59, (s: any) => s.modularAutomation.panTilt.enabled],
    ['SEND C', 0x5a, (s: any) => s.modularAutomation.effects.enabled],
    ['FULL ON', 0x3a, (s: any) => s.apc40CrossfaderState.fullOn],
    ['BLACKOUT', 0x3b, (s: any) => s.apc40CrossfaderState.blackout],
    ['Detail FREEZE', 0x3e, (s: any) => s.dmxFrozen],
    ['Master FREEZE', 0x50, (s: any) => s.dmxFrozen],
  ])('latches %s once per physical press, retaining state after long release', (_label, note, enabled) => {
    renderHook(() => useApc40Workflow());
    apcMessage({ channel: 0, note, timestamp: 1000 });
    expect(enabled(useStore.getState())).toBe(true);
    apcMessage({ channel: 0, note, timestamp: 1500 }); // repeated positive while held
    expect(enabled(useStore.getState())).toBe(true);
    apcMessage({ _type: 'noteoff', channel: 0, note, velocity: 127, timestamp: 3094 });
    expect(enabled(useStore.getState())).toBe(true);
    apcMessage({ channel: 0, note, timestamp: 3816 });
    expect(enabled(useStore.getState())).toBe(false);
    apcMessage({ channel: 0, note, velocity: 0, timestamp: 6500 });
    expect(enabled(useStore.getState())).toBe(false);
  });

  it('derives latch changes from current UI state and preserves SHIFT+SEND pattern cycling', () => {
    renderHook(() => useApc40Workflow());
    apcMessage({ channel: 0, note: 0x31, timestamp: 1000 });
    apcMessage({ _type: 'noteoff', channel: 0, note: 0x31, timestamp: 3000 });
    act(() => useStore.getState().setSelectedFixtures([]));
    apcMessage({ channel: 0, note: 0x31, timestamp: 4000 });
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);
    const pattern = useStore.getState().modularAutomation.color.type;
    apcMessage({ channel: 0, note: 0x62, timestamp: 5000 });
    apcMessage({ channel: 0, note: 0x58, timestamp: 5010 });
    expect(useStore.getState().modularAutomation.color.type).not.toBe(pattern);
    expect(useStore.getState().modularAutomation.color.enabled).toBe(false);
    const nextPattern = useStore.getState().modularAutomation.color.type;
    apcMessage({ _type: 'noteoff', channel: 0, note: 0x58, timestamp: 9000 });
    expect(useStore.getState().modularAutomation.color.type).toBe(nextPattern);
    apcMessage({ _type: 'noteoff', channel: 0, note: 0x62, timestamp: 9010 });
    expect(useStore.getState().apc40CrossfaderState.shiftLatched).toBe(false);
  });

  it('preserves the existing MK2 explicit OFF semantics', () => {
    renderHook(() => useApc40Workflow());
    apcMessage({ source: 'Akai APC40 MK2', channel: 0, note: 0x31, timestamp: 1000 });
    apcMessage({ source: 'Akai APC40 MK2', channel: 0, note: 0x31, timestamp: 1500 });
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);
    apcMessage({ source: 'Akai APC40 MK2', channel: 0, note: 0x31, velocity: 0, timestamp: 3000 });
    expect(useStore.getState().selectedFixtures).toEqual([]);
  });

  it('allows a second distinct Master press to release freeze immediately', () => {
    renderHook(() => useApc40Workflow());
    apcMessage({ channel: 0, note: 0x50, timestamp: 1000 });
    expect(useStore.getState().dmxFrozen).toBe(true);
    apcMessage({ _type: 'noteoff', channel: 0, note: 0x50, timestamp: 1050 });
    apcMessage({ channel: 0, note: 0x50, timestamp: 1100 });
    expect(useStore.getState().dmxFrozen).toBe(false);
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

  it('keeps the legacy CC64 note-field alias momentary too', () => {
    renderHook(() => useApc40Workflow());
    apcMessage({ _type: 'cc', channel: 0, note: 0x40, value: 127, timestamp: 1000 });
    expect(useStore.getState().dmxFrozen).toBe(true);
    apcMessage({ _type: 'cc', channel: 0, note: 0x40, value: 0, timestamp: 4000 });
    expect(useStore.getState().dmxFrozen).toBe(false);
  });

  it('does not mistake the old Generic Mode Master bank snapshot for a FREEZE press', () => {
    renderHook(() => useApc40Workflow());
    [0, 0, 0, 0, 4, 0, 1, 0].forEach((value, index) => {
      apcMessage({ _type: 'cc', channel: 8, controller: 16 + index, value, timestamp: 1000 + index });
    });
    expect(useStore.getState().dmxFrozen).toBe(false);
  });

  it('rejects each captured complete bank frame even with a fixture already selected', () => {
    vi.useFakeTimers();
    try {
      useStore.setState({ fixtures: [miniBeam], selectedFixtures: ['minibeam'], groups: [], dmxChannels: new Array(512).fill(0) });
      renderHook(() => useApc40Workflow());
      for (const gap of [3378, 1317, 1473]) {
        act(() => vi.advanceTimersByTime(gap));
        [0, 0, 1, 0, 0, 7, 0, 0].forEach((value, index) => {
          apcMessage({ _type: 'cc', channel: 0, controller: 16 + index, value });
          expect(useStore.getState().dmxChannels).toEqual(new Array(512).fill(0));
        });
      }
      act(() => vi.advanceTimersByTime(30));
      expect(useStore.getState().dmxChannels).toEqual(new Array(512).fill(0));
    } finally {
      vi.useRealTimers();
    }
  });

  it('replays recorded MiniBeam bank snapshots without changing any DMX, while the real CC7 ramp affects only dimmer', () => {
    vi.useFakeTimers();
    try {
      useStore.setState({ fixtures: [miniBeam], groups: [], dmxChannels: new Array(512).fill(0) });
      renderHook(() => useApc40Workflow());
      apcMessage({ channel: 0, note: 49, timestamp: 1000 });
      apcMessage({ _type: 'noteoff', channel: 0, note: 49, velocity: 127, timestamp: 3094 });
      expect(useStore.getState().selectedFixtures).toEqual(['minibeam']);
      // Three real frames captured at 10:21:26.256, 27.573, 29.046 UTC.
      for (const gap of [3378, 1317, 1473]) {
        act(() => vi.advanceTimersByTime(gap));
        [0, 0, 1, 0, 0, 7, 0, 0].forEach((value, index) => {
          apcMessage({ _type: 'cc', channel: 0, controller: 16 + index, value });
          expect(useStore.getState().dmxChannels).toEqual(new Array(512).fill(0));
        });
      }
      act(() => vi.advanceTimersByTime(30));
      for (const value of [1, 5, 8, 11, 16, 19, 22, 26, 35, 0]) {
        apcMessage({ _type: 'cc', channel: 0, controller: 7, value });
        const expected = new Array(512).fill(0);
        expected[2] = Math.round(value * 255 / 127);
        expect(useStore.getState().dmxChannels).toEqual(expected);
      }
      // Genuine Device knob 1 movement is still delivered after the bounded gate.
      apcMessage({ _type: 'cc', channel: 0, controller: 16, value: 12 });
      act(() => vi.advanceTimersByTime(20));
      expect(useStore.getState().dmxChannels[3]).toBe(24);
      expect(useStore.getState().dmxChannels[1]).toBe(0); // shutter remains closed
    } finally {
      vi.useRealTimers();
    }
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
