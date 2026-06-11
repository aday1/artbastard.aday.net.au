import { describe, expect, it } from 'vitest';
import type { Fixture, Group } from '../store';
import { mergeSmartFixtureGroups, suggestFixtureGroups } from './autoGroups';

function fixture(name: string, types: string[], tags: string[] = []): Fixture {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type: 'Test',
    startAddress: 1,
    channels: types.map((type, index) => ({ name: `${type} ${index + 1}`, type })),
    tags,
  };
}

describe('autoGroups', () => {
  it('suggests useful operator groups from fixture channel roles', () => {
    const suggestions = suggestFixtureGroups([
      fixture('Par 1', ['dimmer', 'red', 'green', 'blue'], ['WASH']),
      fixture('Mover 1', ['dimmer', 'pan', 'tilt', 'gobo_wheel', 'strobe', 'zoom']),
    ]);

    expect(suggestions.map((group) => group.name)).toEqual([
      'All Fixtures',
      'Dimmers',
      'RGB / Wash',
      'Movers',
      'Gobo / Texture',
      'Strobe / Shutter',
      'Beam / Focus',
    ]);
    expect(suggestions.find((group) => group.name === 'Movers')?.fixtureIndices).toEqual([1]);
    expect(suggestions.find((group) => group.name === 'RGB / Wash')?.fixtureIndices).toEqual([0]);
  });

  it('prefixes suggestions with the show name when provided', () => {
    const suggestions = suggestFixtureGroups([fixture('Beam', ['pan', 'tilt'])], { showName: 'Warehouse' });
    expect(suggestions.map((group) => group.name)).toContain('Warehouse Movers');
  });

  it('refreshes existing smart groups and creates missing ones', () => {
    const existing: Group[] = [{
      id: 'existing',
      name: 'Dimmers',
      fixtureIndices: [9],
      lastStates: new Array(512).fill(0),
      isMuted: false,
      isSolo: false,
      masterValue: 255,
    }];
    const suggestions = suggestFixtureGroups([
      fixture('Dimmer 1', ['dimmer']),
      fixture('Dimmer 2', ['dimmer']),
    ]);

    const result = mergeSmartFixtureGroups(existing, suggestions);

    expect(result.refreshed).toBe(1);
    expect(result.created).toBeGreaterThan(0);
    expect(result.groups.find((group) => group.name === 'Dimmers')?.fixtureIndices).toEqual([0, 1]);
  });
});
