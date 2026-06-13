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

export type FixtureTypeKey =
  | 'moving-head'
  | 'par'
  | 'strip'
  | 'laser'
  | 'led-effect'
  | 'dimmer'
  | 'strobe'
  | 'smoke'
  | 'default';

export interface FixturePresentationInput {
  name?: string;
  templateName?: string;
  defaultNamePrefix?: string;
  type?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  modelConfidence?: 'confirmed' | 'probable' | 'unknown';
  catalogId?: string;
  photoUrl?: string;
  documentationPath?: string;
  notes?: string;
  tags?: string[];
  mode?: string;
  channels?: unknown[];
  modes?: Array<{
    name?: string;
    channels?: number;
    channelData?: unknown[];
  }>;
}

export interface FixtureIdentity {
  accentColor: string;
  catalogId?: string;
  channelCount: number;
  channelText: string;
  iconName: string;
  label: string;
  makeModel?: string;
  modeName?: string;
  photoUrl?: string;
  shortCode: string;
  shortLabel: string;
  title: string;
  typeKey: FixtureTypeKey;
  typeLabel: string;
}

const FIXTURE_TYPE_COLORS: Record<FixtureTypeKey, string> = {
  'moving-head': '#ff6b6b',
  par: '#4ecdc4',
  strip: '#45b7d1',
  laser: '#96ceb4',
  'led-effect': '#f59e0b',
  dimmer: '#feca57',
  strobe: '#feca57',
  smoke: '#a55eea',
  default: '#fd79a8',
};

const FIXTURE_TYPE_ICONS: Record<FixtureTypeKey, string> = {
  'moving-head': 'Move3D',
  par: 'Aperture',
  strip: 'Rows3',
  laser: 'Crosshair',
  'led-effect': 'Sparkles',
  dimmer: 'Lightbulb',
  strobe: 'Flashlight',
  smoke: 'Cloud',
  default: 'Box',
};

const titleCase = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const catalogFromNotes = (notes?: string) => notes?.match(/\bAB-FIX-\d{3}\b/)?.[0];

const initialsFromLabel = (label: string) => {
  const words = label
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'FX';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
};

export function getFixtureTypeKey(type = '', category = '', tags: string[] = []): FixtureTypeKey {
  const haystack = [type, category, ...tags].filter(Boolean).join(' ').toLowerCase();

  if (/\blaser\b|ilda|starfield|twinkl/.test(haystack)) return 'laser';
  if (/moving[\s-]*head|\bmover\b|pan\/tilt|\bpan\b.*\btilt\b|\bbeam\b/.test(haystack)) return 'moving-head';
  if (/spider|derby|led effect|\beffect\b/.test(haystack)) return 'led-effect';
  if (/\bbar\b|\bstrip\b|linear/.test(haystack)) return 'strip';
  if (/dimmer|intensity/.test(haystack)) return 'dimmer';
  if (/strobe|flash/.test(haystack)) return 'strobe';
  if (/smoke|fog|haze/.test(haystack)) return 'smoke';
  if (/\bpar\b|\bwash\b|rgbw?|uv/.test(haystack)) return 'par';
  return 'default';
}

export function getFixtureTypeColor(type: string, category = '', tags: string[] = []): string {
  return FIXTURE_TYPE_COLORS[getFixtureTypeKey(type, category, tags)];
}

export function getFixtureTypeIcon(type: string, category = '', tags: string[] = []): string {
  return FIXTURE_TYPE_ICONS[getFixtureTypeKey(type, category, tags)];
}

export function getFixtureIdentity(fixture: FixturePresentationInput): FixtureIdentity {
  const label = fixture.templateName || fixture.name || fixture.defaultNamePrefix || 'Fixture';
  const shortLabel = fixture.defaultNamePrefix || fixture.templateName || fixture.name || label;
  const typeLabel = fixture.type || fixture.category || 'Fixture';
  const typeKey = getFixtureTypeKey(fixture.type, fixture.category, fixture.tags);
  const mode = fixture.modes?.[0];
  const channelCount = mode?.channels || mode?.channelData?.length || fixture.channels?.length || 0;
  const catalogId = fixture.catalogId || catalogFromNotes(fixture.notes);
  const makeModel = [fixture.manufacturer, fixture.model].filter(Boolean).join(' · ') || undefined;
  const parts = [
    catalogId,
    label,
    makeModel,
    typeLabel !== 'Fixture' ? typeLabel : undefined,
    channelCount ? `${channelCount}ch` : undefined,
  ].filter(Boolean);

  return {
    accentColor: FIXTURE_TYPE_COLORS[typeKey],
    catalogId,
    channelCount,
    channelText: channelCount ? `${channelCount}ch` : 'profile',
    iconName: FIXTURE_TYPE_ICONS[typeKey],
    label,
    makeModel,
    modeName: fixture.mode || mode?.name,
    photoUrl: fixture.photoUrl,
    shortCode: initialsFromLabel(shortLabel),
    shortLabel,
    title: parts.join(' · '),
    typeKey,
    typeLabel: typeLabel === typeKey ? titleCase(typeLabel) : typeLabel,
  };
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
