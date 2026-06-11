import { Fixture } from '../../store';

export type DmxChannelFilterMode = 'all' | 'active' | 'selected' | 'range' | 'selectedFixtures';
export type DmxFixtureFilterMode = 'all' | 'active' | 'byType' | 'byRange';

interface ChannelFilterParams {
  filter: DmxChannelFilterMode;
  dmxChannels: number[];
  selectedChannels: number[];
  selectedFixtures: string[];
  fixtures: Fixture[];
  range: { start: number; end: number };
  searchTerm: string;
  channelNames: string[];
}

interface FixtureFilterParams {
  fixtures: Fixture[];
  dmxChannels: number[];
  fixtureSearchTerm: string;
  fixtureFilter: DmxFixtureFilterMode;
  fixtureTypeFilter: string;
  fixtureAddressRange: { start: number; end: number };
}

const createFixtureChannelSet = (fixtureIds: string[], fixtures: Fixture[]): Set<number> => {
  const fixtureChannels = new Set<number>();

  fixtureIds.forEach((fixtureId) => {
    const fixture = fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const startAddress = fixture.startAddress;
    const channelCount = fixture.channels?.length || 0;

    for (let i = 0; i < channelCount; i++) {
      const channelIndex = startAddress - 1 + i;
      if (channelIndex >= 0 && channelIndex < 512) {
        fixtureChannels.add(channelIndex);
      }
    }
  });

  return fixtureChannels;
};

export const isFixtureActive = (fixture: Fixture, dmxChannels: number[]): boolean => {
  const startAddress = fixture.startAddress;
  const channelCount = fixture.channels?.length || 0;
  for (let i = 0; i < channelCount; i++) {
    const channelIndex = startAddress - 1 + i;
    if (channelIndex >= 0 && channelIndex < 512 && (dmxChannels[channelIndex] || 0) > 0) {
      return true;
    }
  }
  return false;
};

export const filterDmxChannels = ({
  filter,
  dmxChannels,
  selectedChannels,
  selectedFixtures,
  fixtures,
  range,
  searchTerm,
  channelNames,
}: ChannelFilterParams): number[] => {
  let channels: number[] = [];

  switch (filter) {
    case 'all':
      channels = Array.from({ length: 512 }, (_, i) => i);
      break;
    case 'active':
      channels = Array.from({ length: 512 }, (_, i) => i).filter((i) => (dmxChannels[i] || 0) > 0);
      break;
    case 'selected':
      channels = selectedChannels;
      break;
    case 'range':
      channels = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start - 1 + i);
      break;
    case 'selectedFixtures':
      if (selectedFixtures.length > 0) {
        channels = Array.from(createFixtureChannelSet(selectedFixtures, fixtures)).sort((a, b) => a - b);
      } else {
        channels = Array.from({ length: 512 }, (_, i) => i);
      }
      break;
  }

  if (selectedFixtures.length > 0 && filter !== 'selectedFixtures') {
    const fixtureChannels = createFixtureChannelSet(selectedFixtures, fixtures);
    channels = channels.filter((channel) => fixtureChannels.has(channel));
  }

  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    channels = channels.filter((channel) => {
      const channelName = channelNames[channel] || `Channel ${channel + 1}`;
      return channelName.toLowerCase().includes(searchLower) || (channel + 1).toString().includes(searchTerm);
    });
  }

  return channels;
};

export const filterFixtures = ({
  fixtures,
  dmxChannels,
  fixtureSearchTerm,
  fixtureFilter,
  fixtureTypeFilter,
  fixtureAddressRange,
}: FixtureFilterParams): Fixture[] => {
  let filtered = [...fixtures];

  if (fixtureSearchTerm) {
    const searchLower = fixtureSearchTerm.toLowerCase();
    filtered = filtered.filter(
      (fixture) =>
        fixture.name.toLowerCase().includes(searchLower) ||
        fixture.startAddress.toString().includes(fixtureSearchTerm) ||
        fixture.type?.toLowerCase().includes(searchLower) ||
        fixture.manufacturer?.toLowerCase().includes(searchLower) ||
        fixture.model?.toLowerCase().includes(searchLower)
    );
  }

  if (fixtureFilter === 'active') {
    filtered = filtered.filter((fixture) => isFixtureActive(fixture, dmxChannels));
  }

  if (fixtureFilter === 'byType' && fixtureTypeFilter) {
    const fixtureTypeLower = fixtureTypeFilter.toLowerCase();
    filtered = filtered.filter((fixture) => fixture.type?.toLowerCase() === fixtureTypeLower);
  }

  if (fixtureFilter === 'byRange') {
    filtered = filtered.filter(
      (fixture) => fixture.startAddress >= fixtureAddressRange.start && fixture.startAddress <= fixtureAddressRange.end
    );
  }

  return filtered;
};
