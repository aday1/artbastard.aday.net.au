import type { Fixture, Scene } from '../store';
import {
  DEVICE_ROLE_PRIORITY as GENERATED_DEVICE_ROLE_PRIORITY,
  TRACK_CONTROL_ROLES as GENERATED_TRACK_CONTROL_ROLES,
  FULL_ON_EXCLUDED_TYPES as GENERATED_FULL_ON_EXCLUDED_TYPES,
} from './generated';

export type Apc40Deck = 'A' | 'B';

export interface Apc40RoleSlot {
  label: string;
  controlName: string;
  aliases: string[];
}

export const APC40_GRID_SLOT_COUNT = 40;

const DEVICE_ROLE_PRIORITY: Apc40RoleSlot[] = GENERATED_DEVICE_ROLE_PRIORITY.map((slot) => ({
  label: slot.label,
  controlName: slot.controlName,
  aliases: [...slot.aliases],
}));

export const APC40_TRACK_CONTROL_ROLES: Apc40RoleSlot[] = GENERATED_TRACK_CONTROL_ROLES.map((slot) => ({
  label: slot.label,
  controlName: slot.controlName,
  aliases: [...slot.aliases],
}));

const FULL_ON_EXCLUDED_TYPES = GENERATED_FULL_ON_EXCLUDED_TYPES;

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

function hsvToRgb255(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hh = (h * 6) % 6;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return [
    Math.max(0, Math.min(255, Math.round((r + m) * 255))),
    Math.max(0, Math.min(255, Math.round((g + m) * 255))),
    Math.max(0, Math.min(255, Math.round((b + m) * 255))),
  ];
}

export interface RandomLookResult {
  updates: Record<number, number>;
  touchedFixtures: number;
}

export function buildRandomLookUpdates(fixtures: Fixture[]): RandomLookResult {
  const updates: Record<number, number> = {};
  const dimmerAliases = ['dimmer', 'intensity', 'master_dimmer'];
  const redAliases = ['red', 'r'];
  const greenAliases = ['green', 'g'];
  const blueAliases = ['blue', 'b'];
  const whiteAliases = ['white', 'w'];
  const panAliases = ['pan', 'pan_coarse'];
  const tiltAliases = ['tilt', 'tilt_coarse'];
  const strobeAliases = ['strobe', 'shutter'];

  let touchedFixtures = 0;

  fixtures.forEach((fixture) => {
    const hue = Math.random();
    const sat = 0.6 + Math.random() * 0.4;
    const [r, g, b] = hsvToRgb255(hue, sat, 1);
    const dimmer = 140 + Math.floor(Math.random() * 116);
    const pan = Math.floor(Math.random() * 256);
    const tilt = Math.floor(Math.random() * 256);

    let touched = false;
    const assign = (aliases: string[], value: number) => {
      const idx = fixture.channels.findIndex((channel) =>
        channelMatchesRoleAliases(channel, aliases)
      );
      if (idx >= 0) {
        updates[fixtureDmxAddress(fixture, idx)] = value;
        touched = true;
      }
    };

    assign(dimmerAliases, dimmer);
    assign(redAliases, r);
    assign(greenAliases, g);
    assign(blueAliases, b);
    assign(whiteAliases, 0);
    assign(panAliases, pan);
    assign(tiltAliases, tilt);
    assign(strobeAliases, 0);

    if (touched) touchedFixtures += 1;
  });

  return { updates, touchedFixtures };
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
