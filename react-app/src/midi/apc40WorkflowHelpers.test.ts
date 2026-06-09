import { describe, expect, it } from 'vitest';
import {
  apc40DeckSceneName,
  blendApc40DeckScenes,
  buildFullOnUpdates,
  midiToDmx,
  resolveApc40DeviceRoleSlots,
} from './apc40WorkflowHelpers';
import type { Fixture, Scene } from '../store';

const scene = (name: string, channelValues: number[]): Scene => ({
  name,
  channelValues,
  oscAddress: `/${name}`,
});

describe('APC40 workflow helpers', () => {
  it('names 40-slot deck scenes with stable A/B names', () => {
    expect(apc40DeckSceneName('A', 0)).toBe('APC40 Deck A 01');
    expect(apc40DeckSceneName('B', 39)).toBe('APC40 Deck B 40');
    expect(apc40DeckSceneName('B', 900)).toBe('APC40 Deck B 40');
  });

  it('maps MIDI CC values to DMX values', () => {
    expect(midiToDmx(0)).toBe(0);
    expect(midiToDmx(127)).toBe(255);
    expect(midiToDmx(64)).toBe(129);
  });

  it('blends active Deck A and Deck B scene channel values', () => {
    expect(blendApc40DeckScenes(
      scene('A', [0, 255, 20]),
      scene('B', [255, 0, 220]),
      64
    )).toEqual({
      0: 129,
      1: 126,
      2: 121,
    });
  });

  it('prioritizes selected fixture gobo and visual roles for Device Control', () => {
    const fixtures: Fixture[] = [
      {
        id: 'wash',
        name: 'Wash',
        type: 'rgb',
        startAddress: 1,
        channels: [
          { name: 'Dimmer', type: 'dimmer' },
          { name: 'Red', type: 'red' },
          { name: 'Green', type: 'green' },
          { name: 'Blue', type: 'blue' },
        ],
      },
      {
        id: 'spot',
        name: 'Spot',
        type: 'moving-head',
        startAddress: 20,
        channels: [
          { name: 'Dimmer', type: 'dimmer' },
          { name: 'Gobo', type: 'gobo_wheel' },
          { name: 'Prism', type: 'prism' },
          { name: 'Focus', type: 'focus' },
        ],
      },
    ];

    const roles = resolveApc40DeviceRoleSlots(fixtures, ['spot']);
    expect(roles.slice(0, 3).map((role) => role.controlName)).toEqual(['gobo', 'prism', 'focus']);
  });

  it('excludes lamp/reset/function channels from full-on safety updates', () => {
    const fixtures: Fixture[] = [{
      id: 'fixture',
      name: 'Fixture',
      type: 'spot',
      startAddress: 10,
      channels: [
        { name: 'Dimmer', type: 'dimmer' },
        { name: 'Lamp', type: 'lamp' },
        { name: 'Reset', type: 'reset' },
        { name: 'Gobo', type: 'gobo' },
      ],
    }];

    expect(buildFullOnUpdates(fixtures)).toEqual({
      9: 255,
      12: 255,
    });
  });
});
