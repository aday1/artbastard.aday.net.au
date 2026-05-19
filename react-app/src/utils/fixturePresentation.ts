import type { Fixture } from '../store';
import { getChannelRoleIconName, type ChannelRoleIconName } from './channelRoleIcons';

export interface FixtureChannelInfo {
  fixtureName?: string;
  fixtureType?: string;
  channelFunction?: string;
  channelType?: string;
  shortFunction?: string;
  roleIcon?: ChannelRoleIconName;
  fixtureTypeIcon?: string;
}

const FIXTURE_TYPE_COLORS: Record<string, string> = {
  'moving-head': '#ff6b6b',
  par: '#4ecdc4',
  strip: '#45b7d1',
  laser: '#96ceb4',
  strobe: '#feca57',
  smoke: '#a55eea',
  default: '#fd79a8',
};

const FIXTURE_TYPE_ICONS: Record<string, string> = {
  'moving-head': 'Zap',
  par: 'Circle',
  strip: 'Minus',
  laser: 'Target',
  strobe: 'Flashlight',
  smoke: 'Cloud',
  default: 'Lightbulb',
};

export function getFixtureTypeColor(type: string): string {
  return FIXTURE_TYPE_COLORS[type.toLowerCase()] ?? FIXTURE_TYPE_COLORS.default;
}

export function getFixtureTypeIcon(type: string): string {
  return FIXTURE_TYPE_ICONS[type.toLowerCase()] ?? FIXTURE_TYPE_ICONS.default;
}

export function getShortChannelLabel(channelType: string): string {
  switch (channelType) {
    case 'red':
    case 'green':
    case 'blue':
    case 'white':
    case 'amber':
    case 'uv':
    case 'pan':
    case 'tilt':
      return channelType.toUpperCase();
    case 'pan_fine':
      return 'PAN-F';
    case 'tilt_fine':
      return 'TILT-F';
    case 'dimmer':
      return 'DIM';
    case 'shutter':
      return 'SHUT';
    case 'strobe':
      return 'STRB';
    case 'color_wheel':
      return 'CW';
    case 'gobo_wheel':
      return 'GOBO';
    case 'gobo_rotation':
      return 'G-ROT';
    case 'zoom':
      return 'ZOOM';
    case 'focus':
      return 'FOCUS';
    case 'prism':
      return 'PRISM';
    case 'iris':
      return 'IRIS';
    case 'speed':
      return 'SPEED';
    case 'macro':
      return 'MACRO';
    case 'effect':
      return 'FX';
    case 'frost':
    case 'diffusion':
      return 'FROST';
    case 'animation':
      return 'ANIM';
    case 'animation_speed':
      return 'A-SPD';
    case 'cto':
    case 'color_temperature_orange':
      return 'CTO';
    case 'ctb':
    case 'color_temperature_blue':
      return 'CTB';
    case 'reset':
      return 'RESET';
    case 'lamp_control':
      return 'LAMP';
    case 'fan_control':
      return 'FAN';
    case 'display':
      return 'DISP';
    case 'function':
      return 'FUNC';
    default:
      return channelType.toUpperCase();
  }
}

/** Resolve fixture + channel role for a 0-based DMX channel index. */
export function getFixtureInfoForChannel(
  channelIndex: number,
  fixtures: Fixture[]
): FixtureChannelInfo | null {
  const dmxAddress = channelIndex + 1;

  for (const fixture of fixtures) {
    const fixtureStartAddress = fixture.startAddress;
    const fixtureEndAddress = fixtureStartAddress + fixture.channels.length - 1;

    if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
      const channelOffset = dmxAddress - fixtureStartAddress;
      const channel = fixture.channels[channelOffset];

      if (channel) {
        return {
          fixtureName: fixture.name,
          fixtureType: fixture.type,
          channelFunction: channel.name || `${channel.type} Channel`,
          channelType: channel.type,
          shortFunction: getShortChannelLabel(channel.type),
          roleIcon: getChannelRoleIconName(channel.type),
          fixtureTypeIcon: getFixtureTypeIcon(fixture.type),
        };
      }
    }
  }

  return null;
}
