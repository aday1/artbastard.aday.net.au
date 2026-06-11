import type { Apc40LastChange, Fixture, Group } from '../../store';
import {
  APC40_TRACK_CONTROL_ROLES,
  fixtureDmxAddress,
  normalizeChannelType,
} from '../../midi/apc40WorkflowHelpers';
import { decodeApc40Message, type MidiLikeMessage } from '../../midi/apc40';

interface ChannelRange {
  min: number;
  max: number;
  description: string;
}

interface FixtureChannel {
  name: string;
  type: string;
  dmxAddress?: number;
  ranges?: ChannelRange[];
}

export interface DmxChangeNarrationInput {
  channel: number;
  previousValue: number;
  value: number;
  channelNames: string[];
  fixtures: Fixture[];
  groups: Group[];
  selectedFixtures: string[];
  sourceLabel?: string;
}

export interface DmxChangeNarration {
  summary: string;
  detail: string;
  fixtureName?: string;
  groupNames: string[];
  roleLabel: string;
}

const ROLE_LABELS: Record<string, string> = {
  master: 'Master dimmer',
  intensity: 'Dimmer',
  dimmer: 'Dimmer',
  pan: 'Pan',
  pan_coarse: 'Pan',
  pan_fine: 'Pan fine',
  finepan: 'Pan fine',
  pan_lsb: 'Pan fine',
  tilt: 'Tilt',
  tilt_coarse: 'Tilt',
  tilt_fine: 'Tilt fine',
  finetilt: 'Tilt fine',
  tilt_lsb: 'Tilt fine',
  red: 'Red',
  r: 'Red',
  green: 'Green',
  g: 'Green',
  blue: 'Blue',
  b: 'Blue',
  white: 'White',
  w: 'White',
  amber: 'Amber',
  a: 'Amber',
  uv: 'UV',
  ultraviolet: 'UV',
  color_wheel: 'Color wheel',
  colour_wheel: 'Color wheel',
  colorwheel: 'Color wheel',
  colourwheel: 'Color wheel',
  gobo: 'Gobo',
  gobowheel: 'Gobo',
  gobo_wheel: 'Gobo',
  gobo_rotation: 'Gobo rotation',
  goborotation: 'Gobo rotation',
  gobo_rotate: 'Gobo rotation',
  gobo_spin: 'Gobo rotation',
  shutter: 'Shutter',
  strobe: 'Strobe',
  prism: 'Prism',
  prism_rotate: 'Prism rotate',
  prism_rotation: 'Prism rotate',
  iris: 'Iris',
  focus: 'Focus',
  zoom: 'Zoom',
  macro: 'Macro',
  program: 'Macro',
  pattern: 'Pattern',
  effect: 'Effect',
  effects: 'Effects',
  speed: 'Speed',
  rate: 'Speed',
  movement_speed: 'Movement speed',
  effect_speed: 'Effect speed',
  lamp: 'Lamp',
  lamp_on: 'Lamp',
  lamp_control: 'Lamp',
  reset: 'Reset',
  reset_control: 'Reset',
  function: 'Function',
};

const MOVEMENT_ROLES = new Set(['pan', 'pan_coarse', 'pan_fine', 'finepan', 'pan_lsb', 'tilt', 'tilt_coarse', 'tilt_fine', 'finetilt', 'tilt_lsb']);
const COLOR_ROLES = new Set(['red', 'r', 'green', 'g', 'blue', 'b', 'white', 'w', 'amber', 'a', 'uv', 'ultraviolet', 'color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel']);

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function roleLabel(channel?: FixtureChannel, fallbackName?: string): string {
  const normalized = normalizeChannelType(channel?.type || '');
  if (normalized && ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  if (channel?.name) return channel.name;
  return fallbackName || 'DMX channel';
}

function verbFor(channel?: FixtureChannel): string {
  const normalized = normalizeChannelType(channel?.type || '');
  if (MOVEMENT_ROLES.has(normalized)) return 'moved';
  if (COLOR_ROLES.has(normalized)) return 'changed color';
  if (normalized.includes('gobo')) return 'changed gobo';
  if (normalized.includes('strobe') || normalized.includes('shutter')) return 'changed strobe/shutter';
  return 'changed';
}

function valueText(channel: FixtureChannel | undefined, value: number): string {
  const range = channel?.ranges?.find(candidate => value >= candidate.min && value <= candidate.max);
  return range ? `${value} (${range.description})` : `${value}`;
}

function fixtureGroupsFor(groups: Group[], fixtures: Fixture[], fixtureIndex: number): Group[] {
  return groups.filter(group => group.fixtureIndices.includes(fixtureIndex));
}

function selectedGroupNamesFor(groups: Group[], fixtures: Fixture[], selectedFixtureIds: Set<string>, fixtureId: string): string[] {
  if (selectedFixtureIds.size === 0) return [];
  return groups
    .filter(group => {
      const ids = group.fixtureIndices
        .map(index => fixtures[index]?.id)
        .filter((id): id is string => Boolean(id));
      return ids.length > 0 && ids.includes(fixtureId) && ids.every(id => selectedFixtureIds.has(id));
    })
    .map(group => group.name);
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function describeApc40DmxSource(
  latestMidiMessage: MidiLikeMessage | undefined,
  deviceRoleLabels: string[] = [],
  lastChange?: Apc40LastChange | null
): string | undefined {
  if (lastChange && Date.now() - lastChange.at <= 2500) {
    return `APC40 ${lastChange.controlLabel}: ${lastChange.summary}`;
  }

  if (!latestMidiMessage) return undefined;
  const timestamp = latestMidiMessage.timestamp;
  if (timestamp !== undefined && Date.now() - timestamp > 750) return undefined;

  const action = decodeApc40Message(latestMidiMessage);
  if (!action) return undefined;

  switch (action.type) {
    case 'track-control': {
      const role = APC40_TRACK_CONTROL_ROLES[action.slotIndex];
      return `APC40 Track Control ${action.slotIndex + 1}${role ? `: ${role.label}` : ''}`;
    }
    case 'device-control': {
      const role = deviceRoleLabels[action.slotIndex];
      return `APC40 Device Control ${action.slotIndex + 1}${role ? `: ${role}` : ''}`;
    }
    case 'channel-fader':
      return `APC40 Track ${action.trackIndex + 1} fader: Dimmer`;
    case 'master-fader':
      return 'APC40 Master fader: Master dimmer';
    case 'crossfader':
      return 'APC40 crossfader: Deck A/B blend';
    case 'master-button':
      return 'APC40 Master Select: FREEZE DMX latch';
    case 'freeze-dmx':
      return 'APC40 Master Select: FREEZE DMX latch';
    case 'tap-tempo':
      return 'APC40 Tap Tempo: Auto Scene BPM tap';
    case 'nudge':
      return `APC40 Nudge${action.direction === 'up' ? '+' : '\u2212'}: Auto Scene BPM`;
    case 'toggle-color-auto':
      return 'APC40 SEND A: toggle color automation';
    case 'toggle-pan-tilt-auto':
      return 'APC40 SEND B: toggle pan/tilt automation';
    case 'toggle-effect-auto':
      return 'APC40 SEND C: toggle effects automation';
    case 'solo-group':
      return `APC40 Solo Group ${action.trackIndex + 1}: solo-latch group blackout`;
    case 'clip-launch':
      return `APC40 clip grid row ${action.row + 1}, column ${action.column + 1}`;
    case 'scene-launch':
      return `APC40 Scene Launch ${action.sceneIndex + 1}: ACT trigger`;
    case 'activator':
      return `APC40 Activator ${action.trackIndex + 1}: group auto-control`;
    case 'select-group':
      return `APC40 Activator ${action.trackIndex + 1}: select fixture group`;
    case 'track-select':
      return `APC40 Track Select ${action.trackIndex + 1}: fixture/group selection`;
    case 'solo-cue':
      return `APC40 Solo/Cue ${action.trackIndex + 1}: fixture isolation`;
    case 'select-fixture':
      return `APC40 Solo/Cue ${action.trackIndex + 1}: select fixture`;
    default:
      return undefined;
  }
}

export function narrateDmxChange(input: DmxChangeNarrationInput): DmxChangeNarration {
  const {
    channel,
    previousValue,
    value,
    channelNames,
    fixtures,
    groups,
    selectedFixtures,
    sourceLabel,
  } = input;

  for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex += 1) {
    const fixture = fixtures[fixtureIndex];
    for (let channelIndex = 0; channelIndex < fixture.channels.length; channelIndex += 1) {
      if (fixtureDmxAddress(fixture, channelIndex) !== channel) continue;

      const fixtureChannel = fixture.channels[channelIndex];
      const normalizedType = normalizeChannelType(fixtureChannel.type || '');
      const label = roleLabel(fixtureChannel, channelNames[channel]);
      const verb = verbFor(fixtureChannel);
      const memberGroups = fixtureGroupsFor(groups, fixtures, fixtureIndex).map(group => group.name);
      const selectedIds = new Set(selectedFixtures);
      const selectedGroupNames = selectedGroupNamesFor(groups, fixtures, selectedIds, fixture.id);
      const isSelected = selectedIds.has(fixture.id);
      const target =
        selectedGroupNames.length > 0
          ? `targeting selected group ${formatList(selectedGroupNames.map(name => `"${name}"`))}`
          : isSelected
            ? 'targeting selected fixture'
            : selectedIds.size > 0
              ? 'outside current selection'
              : 'no active fixture selection';
      const from = valueText(fixtureChannel, previousValue);
      const to = valueText(fixtureChannel, value);
      const summary = `${fixture.name} ${label} ${verb} ${from} -> ${to}`;
      const details = [
        `CH ${channel + 1}`,
        fixtureChannel.name && fixtureChannel.name !== label ? fixtureChannel.name : undefined,
        normalizedType && !ROLE_LABELS[normalizedType] ? humanize(normalizedType) : undefined,
        memberGroups.length > 0 ? `in ${formatList(memberGroups.map(name => `"${name}"`))}` : undefined,
        target,
        sourceLabel,
      ].filter((part): part is string => Boolean(part));

      return {
        summary,
        detail: details.join(' · '),
        fixtureName: fixture.name,
        groupNames: memberGroups,
        roleLabel: label,
      };
    }
  }

  const name = channelNames[channel] || `CH ${channel + 1}`;
  return {
    summary: `${name} changed ${previousValue} -> ${value}`,
    detail: [`CH ${channel + 1}`, 'no fixture patch match', sourceLabel].filter(Boolean).join(' · '),
    groupNames: [],
    roleLabel: name,
  };
}
