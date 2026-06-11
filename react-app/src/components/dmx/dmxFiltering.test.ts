import { describe, expect, it } from 'vitest';
import { Fixture } from '../../store';
import { filterDmxChannels, filterFixtures, isFixtureActive } from './dmxFiltering';

const fixtures: Fixture[] = [
  {
    id: 'fix-1',
    name: 'Front Wash',
    type: 'wash',
    startAddress: 1,
    channels: [
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
    ],
  },
  {
    id: 'fix-2',
    name: 'Back Spot',
    type: 'spot',
    startAddress: 101,
    channels: [
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Pan', type: 'pan' },
    ],
  },
];

describe('dmxFiltering', () => {
  it('filters channels by selected fixtures and search term', () => {
    const dmxChannels = new Array(512).fill(0);
    const channelNames = new Array(512).fill('').map((_, i) => `Channel ${i + 1}`);

    const filtered = filterDmxChannels({
      filter: 'all',
      dmxChannels,
      selectedChannels: [],
      selectedFixtures: ['fix-2'],
      fixtures,
      range: { start: 1, end: 512 },
      searchTerm: '102',
      channelNames,
    });

    expect(filtered).toEqual([101]);
  });

  it('returns only active channels when active filter is selected', () => {
    const dmxChannels = new Array(512).fill(0);
    dmxChannels[0] = 64;
    dmxChannels[100] = 255;

    const filtered = filterDmxChannels({
      filter: 'active',
      dmxChannels,
      selectedChannels: [],
      selectedFixtures: [],
      fixtures,
      range: { start: 1, end: 512 },
      searchTerm: '',
      channelNames: [],
    });

    expect(filtered).toEqual([0, 100]);
  });

  it('identifies active fixtures and applies fixture filters', () => {
    const dmxChannels = new Array(512).fill(0);
    dmxChannels[100] = 150;

    expect(isFixtureActive(fixtures[0], dmxChannels)).toBe(false);
    expect(isFixtureActive(fixtures[1], dmxChannels)).toBe(true);

    const filtered = filterFixtures({
      fixtures,
      dmxChannels,
      fixtureSearchTerm: 'spot',
      fixtureFilter: 'active',
      fixtureTypeFilter: '',
      fixtureAddressRange: { start: 1, end: 512 },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('fix-2');
  });
});
