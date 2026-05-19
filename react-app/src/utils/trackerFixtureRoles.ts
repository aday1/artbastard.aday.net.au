import type { Fixture } from '../store';
import { getFixtureInfoForChannel, getShortChannelLabel } from './fixturePresentation';

export const MAX_TRACKER_COLUMNS = 64;

export type TrackerFixtureScope = 'all' | 'selected' | 'moving_heads';

export type TrackerLaneId =
  | 'pan_tilt'
  | 'color_rgb'
  | 'color_wheel'
  | 'gobo'
  | 'dimmer'
  | 'beam'
  | 'fx'
  | 'moving_head_all';

export interface TrackerLaneDefinition {
  id: TrackerLaneId;
  label: string;
  shortLabel: string;
  description: string;
  channelTypes: string[];
}

export const TRACKER_LANE_DEFINITIONS: TrackerLaneDefinition[] = [
  {
    id: 'pan_tilt',
    label: 'Pan / Tilt',
    shortLabel: 'P/T',
    description: 'Pan, tilt, and fine movement channels on scoped fixtures',
    channelTypes: ['pan', 'pan_coarse', 'pan_fine', 'tilt', 'tilt_coarse', 'tilt_fine'],
  },
  {
    id: 'color_rgb',
    label: 'RGB + wash',
    shortLabel: 'RGB',
    description: 'Red, green, blue, white, amber, UV',
    channelTypes: ['red', 'green', 'blue', 'white', 'amber', 'uv', 'lime', 'cyan', 'magenta'],
  },
  {
    id: 'color_wheel',
    label: 'Color wheel',
    shortLabel: 'CW',
    description: 'Color wheel and CTO/CTB',
    channelTypes: [
      'color_wheel',
      'color',
      'cto',
      'ctb',
      'color_temperature_orange',
      'color_temperature_blue',
    ],
  },
  {
    id: 'gobo',
    label: 'Gobo',
    shortLabel: 'Gobo',
    description: 'Gobo wheel and rotation',
    channelTypes: ['gobo_wheel', 'gobo', 'gobo_rotation', 'gobo_shake'],
  },
  {
    id: 'dimmer',
    label: 'Dimmer',
    shortLabel: 'Dim',
    description: 'Intensity and dimmer masters',
    channelTypes: ['dimmer', 'intensity', 'master'],
  },
  {
    id: 'beam',
    label: 'Beam',
    shortLabel: 'Beam',
    description: 'Zoom, focus, iris, prism, frost',
    channelTypes: ['zoom', 'focus', 'iris', 'prism', 'frost', 'diffusion', 'animation'],
  },
  {
    id: 'fx',
    label: 'FX',
    shortLabel: 'FX',
    description: 'Strobe, shutter, speed, macro, effect',
    channelTypes: ['strobe', 'shutter', 'speed', 'macro', 'effect', 'reset'],
  },
  {
    id: 'moving_head_all',
    label: 'Full moving head',
    shortLabel: 'Head',
    description: 'Every channel on moving-head fixtures in scope',
    channelTypes: ['*'],
  },
];

const LANE_BY_ID = Object.fromEntries(
  TRACKER_LANE_DEFINITIONS.map((l) => [l.id, l])
) as Record<TrackerLaneId, TrackerLaneDefinition>;

export function normalizeChannelType(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, '_');
}

export function isMovingHeadFixture(fixture: Fixture): boolean {
  const type = (fixture.type ?? '').toLowerCase();
  const tags = (fixture.tags ?? []).map((t) => t.toUpperCase());
  return (
    type.includes('mover') ||
    type.includes('moving') ||
    type.includes('head') ||
    type.includes('beam') ||
    tags.some(
      (t) =>
        t.includes('MOVING') || t.includes('HEAD') || t.includes('MOVER') || t.includes('BEAM')
    )
  );
}

function channelMatchesLane(channelType: string, lane: TrackerLaneDefinition): boolean {
  if (lane.id === 'moving_head_all') return true;
  const norm = normalizeChannelType(channelType);
  return lane.channelTypes.some((ct) => {
    const key = normalizeChannelType(ct);
    return norm === key || norm.includes(key) || key.includes(norm);
  });
}

export function resolveTrackerFixtureScope(
  fixtures: Fixture[],
  scope: TrackerFixtureScope,
  selectedFixtureIds: string[]
): Fixture[] {
  if (scope === 'selected') {
    const idSet = new Set(selectedFixtureIds);
    return fixtures.filter((f) => idSet.has(f.id));
  }
  if (scope === 'moving_heads') {
    return fixtures.filter(isMovingHeadFixture);
  }
  return fixtures;
}

/** 0-based DMX indices for a fixture lane on scoped fixtures. */
export function collectTrackerLaneChannels(
  fixtures: Fixture[],
  laneId: TrackerLaneId,
  scope: TrackerFixtureScope,
  selectedFixtureIds: string[]
): number[] {
  const lane = LANE_BY_ID[laneId];
  if (!lane) return [];

  let targetFixtures = resolveTrackerFixtureScope(fixtures, scope, selectedFixtureIds);

  if (laneId === 'moving_head_all') {
    targetFixtures = targetFixtures.filter(isMovingHeadFixture);
  }

  const channels: number[] = [];
  for (const fixture of targetFixtures) {
    fixture.channels.forEach((ch, channelIdx) => {
      if (!channelMatchesLane(ch.type, lane)) return;
      const dmxIndex = fixture.startAddress + channelIdx - 1;
      if (dmxIndex >= 0 && dmxIndex < 512) {
        channels.push(dmxIndex);
      }
    });
  }

  return [...new Set(channels)].sort((a, b) => a - b).slice(0, MAX_TRACKER_COLUMNS);
}

export function getLaneForChannelType(channelType: string | undefined): TrackerLaneId | null {
  if (!channelType) return null;
  for (const lane of TRACKER_LANE_DEFINITIONS) {
    if (lane.id === 'moving_head_all') continue;
    if (channelMatchesLane(channelType, lane)) return lane.id;
  }
  return null;
}

export interface TrackerColumnMeta {
  channelIndex: number;
  fixtureShort: string;
  roleLabel: string;
  channelType?: string;
  fixtureType?: string;
  laneId: TrackerLaneId | null;
  title: string;
}

export function getTrackerColumnMeta(
  channelIndex: number,
  fixtures: Fixture[],
  channelNames: Record<number, string> | string[]
): TrackerColumnMeta {
  const info = getFixtureInfoForChannel(channelIndex, fixtures);
  const names = Array.isArray(channelNames) ? {} : channelNames;
  const fallbackName = Array.isArray(channelNames)
    ? channelNames[channelIndex]
    : names[channelIndex];

  const fixtureShort = info?.fixtureName
    ? info.fixtureName.length > 10
      ? `${info.fixtureName.slice(0, 9)}…`
      : info.fixtureName
    : fallbackName?.slice(0, 10) ?? `Ch${channelIndex + 1}`;

  const roleLabel = info?.shortFunction ?? (info?.channelType ? getShortChannelLabel(info.channelType) : 'DMX');
  const laneId = getLaneForChannelType(info?.channelType);

  const title = info
    ? `${info.fixtureName} · ${info.channelFunction} (DMX ${channelIndex + 1})`
    : `DMX channel ${channelIndex + 1}`;

  return {
    channelIndex,
    fixtureShort,
    roleLabel,
    channelType: info?.channelType,
    fixtureType: info?.fixtureType,
    laneId,
    title,
  };
}

export function countLaneChannels(
  fixtures: Fixture[],
  laneId: TrackerLaneId,
  scope: TrackerFixtureScope,
  selectedFixtureIds: string[]
): number {
  return collectTrackerLaneChannels(fixtures, laneId, scope, selectedFixtureIds).length;
}
