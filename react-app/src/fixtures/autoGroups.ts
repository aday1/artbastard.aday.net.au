import type { Fixture, Group } from '../store';

export interface SmartFixtureGroupSuggestion {
  key: string;
  name: string;
  reason: string;
  fixtureIndices: number[];
}

interface RoleDefinition {
  key: string;
  label: string;
  reason: string;
  matches: (fixture: Fixture) => boolean;
}

const hasChannel = (fixture: Fixture, types: string[]) =>
  fixture.channels.some((channel) => types.includes(channel.type));

const hasTag = (fixture: Fixture, tags: string[]) => {
  const normalized = (fixture.tags || []).map((tag) => tag.toLowerCase());
  return tags.some((tag) => normalized.includes(tag.toLowerCase()));
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'all',
    label: 'All Fixtures',
    reason: 'Every patched fixture, useful for master looks and blackout checks.',
    matches: () => true,
  },
  {
    key: 'dimmers',
    label: 'Dimmers',
    reason: 'Fixtures with dimmer/intensity control.',
    matches: (fixture) => hasChannel(fixture, ['dimmer']),
  },
  {
    key: 'wash',
    label: 'RGB / Wash',
    reason: 'Color-capable fixtures for wash looks and color seeds.',
    matches: (fixture) =>
      hasChannel(fixture, ['red', 'green', 'blue', 'white', 'amber', 'uv', 'color_wheel']) ||
      hasTag(fixture, ['WASH', 'RGB', 'LED', 'PAR']),
  },
  {
    key: 'movers',
    label: 'Movers',
    reason: 'Pan/tilt fixtures for movement scenes and APC40 fixture selection.',
    matches: (fixture) => hasChannel(fixture, ['pan', 'tilt', 'pan_fine', 'tilt_fine']),
  },
  {
    key: 'gobo',
    label: 'Gobo / Texture',
    reason: 'Fixtures with gobo, prism, or texture channels.',
    matches: (fixture) => hasChannel(fixture, ['gobo_wheel', 'gobo_rotation', 'prism']),
  },
  {
    key: 'strobe',
    label: 'Strobe / Shutter',
    reason: 'Fixtures with strobe or shutter control.',
    matches: (fixture) => hasChannel(fixture, ['strobe', 'shutter']),
  },
  {
    key: 'beam',
    label: 'Beam / Focus',
    reason: 'Beam shaping controls such as zoom, focus, and iris.',
    matches: (fixture) => hasChannel(fixture, ['zoom', 'focus', 'iris']),
  },
  {
    key: 'fx',
    label: 'Macro / FX',
    reason: 'Macro, effect, sound, and speed controls for fast automation experiments.',
    matches: (fixture) => hasChannel(fixture, ['macro', 'effect', 'sound', 'speed']),
  },
];

const smartGroupName = (showName: string | undefined, label: string) => {
  const prefix = showName?.trim();
  return prefix ? `${prefix} ${label}` : label;
};

export function suggestFixtureGroups(
  fixtures: Fixture[],
  options: { showName?: string; minFixtures?: number } = {}
): SmartFixtureGroupSuggestion[] {
  const minFixtures = options.minFixtures ?? 1;
  if (!fixtures.length) return [];

  return ROLE_DEFINITIONS.map((definition) => {
    const fixtureIndices = fixtures
      .map((fixture, index) => (definition.matches(fixture) ? index : -1))
      .filter((index) => index >= 0);

    return {
      key: definition.key,
      name: smartGroupName(options.showName, definition.label),
      reason: definition.reason,
      fixtureIndices,
    };
  }).filter((suggestion) => suggestion.fixtureIndices.length >= minFixtures);
}

function makeSmartGroup(name: string, fixtureIndices: number[]): Group {
  return {
    id: `group-smart-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    fixtureIndices,
    lastStates: new Array(512).fill(0),
    isMuted: false,
    isSolo: false,
    masterValue: 255,
  };
}

export function mergeSmartFixtureGroups(
  existingGroups: Group[],
  suggestions: SmartFixtureGroupSuggestion[]
): { groups: Group[]; created: number; refreshed: number } {
  let created = 0;
  let refreshed = 0;
  const groups = [...existingGroups];

  suggestions.forEach((suggestion) => {
    const existingIndex = groups.findIndex((group) => group.name === suggestion.name);
    const fixtureIndices = Array.from(new Set(suggestion.fixtureIndices)).sort((a, b) => a - b);

    if (existingIndex >= 0) {
      groups[existingIndex] = {
        ...groups[existingIndex],
        fixtureIndices,
      };
      refreshed += 1;
    } else {
      groups.push(makeSmartGroup(suggestion.name, fixtureIndices));
      created += 1;
    }
  });

  return { groups, created, refreshed };
}
