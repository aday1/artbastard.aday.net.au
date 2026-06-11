import type { Fixture, Scene } from '../store';

export type Apc40Deck = 'A' | 'B';

export interface Apc40RoleSlot {
  label: string;
  controlName: string;
  aliases: string[];
}

export const APC40_GRID_SLOT_COUNT = 40;

const DEVICE_ROLE_PRIORITY: Apc40RoleSlot[] = [
  { label: 'Gobo', controlName: 'gobo', aliases: ['gobo', 'gobowheel', 'gobo_wheel'] },
  { label: 'Gobo Rotate', controlName: 'gobo_rotation', aliases: ['gobo_rotation', 'goborotation', 'gobo_rotate', 'gobo_spin'] },
  { label: 'Color Wheel', controlName: 'color_wheel', aliases: ['color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel'] },
  { label: 'Prism', controlName: 'prism', aliases: ['prism', 'prism_rotate', 'prism_rotation'] },
  { label: 'Iris', controlName: 'iris', aliases: ['iris'] },
  { label: 'Focus', controlName: 'focus', aliases: ['focus'] },
  { label: 'Zoom', controlName: 'zoom', aliases: ['zoom'] },
  { label: 'Strobe', controlName: 'strobe', aliases: ['strobe', 'shutter'] },
  { label: 'Macro', controlName: 'macro', aliases: ['macro', 'program', 'pattern', 'effect', 'effects'] },
  { label: 'Speed', controlName: 'speed', aliases: ['speed', 'rate', 'movement_speed', 'effect_speed'] },
  { label: 'Pan Fine', controlName: 'fine_pan', aliases: ['pan_fine', 'finepan', 'pan_lsb'] },
  { label: 'Tilt Fine', controlName: 'fine_tilt', aliases: ['tilt_fine', 'finetilt', 'tilt_lsb'] },
  { label: 'White', controlName: 'white', aliases: ['white', 'w'] },
  { label: 'Amber', controlName: 'amber', aliases: ['amber', 'a'] },
  { label: 'UV', controlName: 'uv', aliases: ['uv', 'ultraviolet'] },
  { label: 'Red', controlName: 'red', aliases: ['red', 'r'] },
  { label: 'Green', controlName: 'green', aliases: ['green', 'g'] },
  { label: 'Blue', controlName: 'blue', aliases: ['blue', 'b'] },
  { label: 'Pan', controlName: 'pan', aliases: ['pan', 'pan_coarse'] },
  { label: 'Tilt', controlName: 'tilt', aliases: ['tilt', 'tilt_coarse'] },
];

export const APC40_TRACK_CONTROL_ROLES: Apc40RoleSlot[] = [
  { label: 'Pan', controlName: 'pan', aliases: ['pan', 'pan_coarse'] },
  { label: 'Tilt', controlName: 'tilt', aliases: ['tilt', 'tilt_coarse'] },
  { label: 'Red', controlName: 'red', aliases: ['red', 'r'] },
  { label: 'Green', controlName: 'green', aliases: ['green', 'g'] },
  { label: 'Blue', controlName: 'blue', aliases: ['blue', 'b'] },
  { label: 'White', controlName: 'white', aliases: ['white', 'w'] },
  { label: 'Strobe', controlName: 'strobe', aliases: ['strobe', 'shutter'] },
  { label: 'Speed', controlName: 'speed', aliases: ['speed', 'rate', 'effect_speed'] },
];

const FULL_ON_EXCLUDED_TYPES = new Set([
  'reset',
  'reset_control',
  'function',
  'lamp',
  'lamp_on',
  'lamp_control',
  'mode',
  'sound',
  'auto',
]);

export function apc40DeckSceneName(deck: Apc40Deck, index: number): string {
  const slot = Math.max(0, Math.min(APC40_GRID_SLOT_COUNT - 1, index));
  return `APC40 Deck ${deck} ${String(slot + 1).padStart(2, '0')}`;
}

export function midiToDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255 / 127)));
}

export function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

export function normalizeChannelType(type?: string): string {
  return (type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function channelMatchesRoleAliases(
  channel: { name?: string; type?: string },
  aliases: string[]
): boolean {
  const type = normalizeChannelType(channel.type);
  const name = normalizeChannelType(channel.name);

  return aliases.some((rawAlias) => {
    const alias = normalizeChannelType(rawAlias);
    if (!alias) return false;
    if (type === alias || name === alias) return true;
    if (alias.length <= 1) return false;
    return type.startsWith(`${alias}_`) || name.startsWith(`${alias}_`) || type.includes(alias) || name.includes(alias);
  });
}

export function fixtureDmxAddress(fixture: Fixture, channelIndex: number): number {
  return fixture.channels[channelIndex]?.dmxAddress !== undefined
    ? fixture.channels[channelIndex].dmxAddress! - 1
    : fixture.startAddress + channelIndex - 1;
}

export function resolveApc40DeviceRoleSlots(
  fixtures: Fixture[],
  selectedFixtureIds: string[],
  bankOffset = 0
): Apc40RoleSlot[] {
  const selected = selectedFixtureIds.length > 0
    ? fixtures.filter((fixture) => selectedFixtureIds.includes(fixture.id))
    : fixtures;

  const matching = DEVICE_ROLE_PRIORITY.filter((slot) =>
    selected.some((fixture) =>
      fixture.channels.some((channel) => channelMatchesRoleAliases(channel, slot.aliases))
    )
  );

  const roles = matching.length > 0 ? matching : DEVICE_ROLE_PRIORITY;
  const offset = roles.length === 0 ? 0 : Math.max(0, bankOffset) % roles.length;
  const rotated = [...roles.slice(offset), ...roles.slice(0, offset)];
  return rotated.slice(0, 8);
}

export function buildRoleUpdates(
  fixtures: Fixture[],
  fixtureIds: string[],
  role: Apc40RoleSlot,
  value: number
): Record<number, number> {
  const targets = fixtureIds.length > 0
    ? fixtures.filter((fixture) => fixtureIds.includes(fixture.id))
    : fixtures;
  const aliases = new Set(role.aliases.map(normalizeChannelType));
  const updates: Record<number, number> = {};

  targets.forEach((fixture) => {
    const channelIndex = fixture.channels.findIndex((channel) =>
      channelMatchesRoleAliases(channel, Array.from(aliases))
    );
    if (channelIndex >= 0) {
      updates[fixtureDmxAddress(fixture, channelIndex)] = value;
    }
  });

  return updates;
}

export function buildFullOnUpdates(fixtures: Fixture[]): Record<number, number> {
  const updates: Record<number, number> = {};

  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      const type = normalizeChannelType(channel.type);
      if (FULL_ON_EXCLUDED_TYPES.has(type)) return;
      if (type.includes('reset') || type.includes('lamp') || type.includes('function')) return;
      updates[fixtureDmxAddress(fixture, channelIndex)] = 255;
    });
  });

  return updates;
}

export function blendApc40DeckScenes(
  sceneA: Scene | undefined,
  sceneB: Scene | undefined,
  midiValue: number
): Record<number, number> {
  if (!sceneA || !sceneB) return {};
  const t = clampMidi(midiValue) / 127;
  const len = Math.max(sceneA.channelValues.length, sceneB.channelValues.length);
  const updates: Record<number, number> = {};

  for (let channel = 0; channel < len; channel += 1) {
    const a = sceneA.channelValues[channel] ?? 0;
    const b = sceneB.channelValues[channel] ?? 0;
    if (a === 0 && b === 0) continue;
    updates[channel] = Math.round(a * (1 - t) + b * t);
  }

  return updates;
}
