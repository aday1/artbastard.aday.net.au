import type { Fixture, Scene, SceneTimeline } from '../store';
import { apc40DeckSceneName, type Apc40Deck } from '../midi/apc40WorkflowHelpers';
import { sceneNameToOscPath } from '../utils/sceneCapture';
import { MD_SCENE_SEED_PACKS, MD_SCENE_PACK_TEMPLATE_IDS } from './generated/seedPacks';

export const SCENE_SEED_GENERATOR_ID = 'artbastard-scene-seeder';
export const SCENE_SEED_GENERATOR_VERSION = 1;

export type SceneSeedPackId =
  | 'essential-ab-28'
  | 'operator-rows-ab-48'
  | 'compact-starter'
  | 'smart-starter-40'
  | 'smart-ab-80';
export type SceneSeedTarget = 'deck-a' | 'deck-b' | 'decks-a-b';
export type SceneSeedMode = 'pack' | 'single-slot' | 'capture-selection';
export type SceneSeedFixtureScope = 'all' | 'movers' | 'washes';

export interface SceneSeedMetadata {
  generatedBy: typeof SCENE_SEED_GENERATOR_ID;
  generatorVersion: number;
  packId: SceneSeedPackId;
  templateId: string;
  deck: Apc40Deck;
  slot: number;
  label: string;
  automated: boolean;
}

export interface SceneSeedOptions {
  packId: SceneSeedPackId;
  target: SceneSeedTarget;
  includeAutomation: boolean;
  avoidStrobe: boolean;
  mode?: SceneSeedMode;
  /** APC clip slot number, 1-40. */
  slot?: number;
  templateId?: string;
  fixtureIds?: string[];
  deck?: Apc40Deck;
}

export interface SceneSeedSummary {
  scenes: Scene[];
  generatedScenes: Scene[];
  created: number;
  refreshed: number;
  skipped: number;
  capabilities: string[];
  disabledReason?: string;
}

interface FixtureChannelTarget {
  fixture: Fixture;
  channelIndex: number;
  dmxIndex: number;
  type: string;
  name: string;
  ranges?: Array<{ min: number; max: number; description: string }>;
}

type AnimationKind =
  | 'none'
  | 'dimmer-slow'
  | 'dimmer-fast'
  | 'color-slow'
  | 'color-fast'
  | 'movement-slow'
  | 'movement-fast'
  | 'movement-90'
  | 'gobo-slow'
  | 'gobo-fast'
  | 'strobe'
  | 'strobe-move';

interface SceneSeedTemplate {
  id: string;
  label: string;
  intensity?: number;
  color?: Partial<Record<'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv', number>>;
  colorWheel?: number;
  movement?: { pan: number; tilt: number; spread?: number };
  gobo?: number;
  goboRotation?: number;
  prism?: number;
  iris?: number;
  focus?: number;
  zoom?: number;
  strobe?: number;
  shutter?: number;
  macro?: number;
  speed?: number;
  animation?: AnimationKind;
  durationMs?: number;
  fixtureScope?: SceneSeedFixtureScope;
  /** When set, only writes the listed channel roles (leaves dimmer/shutter/gobo/strobe untouched). */
  writeMode?: 'full' | 'panTiltOnly' | 'colorOnly' | 'colorPanTilt';
}

export interface CaptureSelectionToSlotOptions {
  deck: Apc40Deck;
  /** APC clip slot number, 1-40. */
  slot: number;
  selectedFixtureIds: string[];
  mergeFromExistingSlot?: boolean;
}

const DEFAULT_OPTIONS: SceneSeedOptions = {
  packId: 'essential-ab-28',
  target: 'decks-a-b',
  includeAutomation: false,
  avoidStrobe: false,
};

export const SCENE_BOTH_DECK_PACK_IDS: SceneSeedPackId[] = [
  'essential-ab-28',
  'operator-rows-ab-48',
  'smart-ab-80',
];

export const SCENE_SEED_PACKS: Array<{ id: SceneSeedPackId; label: string; description: string }> =
  MD_SCENE_SEED_PACKS.length
    ? (MD_SCENE_SEED_PACKS as Array<{ id: SceneSeedPackId; label: string; description: string }>)
    : [
        {
          id: 'essential-ab-28',
          label: 'Essential 14+14 (A and B)',
          description: 'Fills APC40 slots 01-14 on Deck A and Deck B with core looks. Slots 15-40 stay empty for your own scenes.',
        },
        {
          id: 'smart-starter-40',
          label: 'Extended 40 (one deck)',
          description: 'Fills all 40 slots on Deck A OR Deck B. Full library of slow/fast color, movement, gobo, beam, wash, and strobe templates.',
        },
        {
          id: 'smart-ab-80',
          label: 'Extended 40+40 (both decks)',
          description: 'Fills all 40 slots on Deck A and again on Deck B with crossfader-friendly scene variants.',
        },
        {
          id: 'compact-starter',
          label: 'Basics 16 (one deck)',
          description: 'First 16 slots on one deck only. Core blackout, washes, slow RGB, spot, sweeps, gobo, plus one strobe-move look.',
        },
      ];

const COLOR_WHEEL_VALUES = {
  open: 0,
  red: 32,
  orange: 64,
  amber: 78,
  yellow: 96,
  green: 128,
  cyan: 160,
  blue: 192,
  magenta: 224,
};

const SMART_TEMPLATES: SceneSeedTemplate[] = [
  { id: 'blackout', label: 'Blackout', intensity: 0, shutter: 0 },
  { id: 'full-open', label: 'Full Open', intensity: 255, color: { red: 255, green: 255, blue: 255, white: 255 }, movement: { pan: 127, tilt: 127 }, shutter: 255 },
  { id: 'warm-wash', label: 'Warm Wash', intensity: 220, color: { red: 255, green: 150, blue: 40, white: 90, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber, movement: { pan: 127, tilt: 135 }, shutter: 255 },
  { id: 'cool-wash', label: 'Cool Wash', intensity: 220, color: { red: 80, green: 150, blue: 255, white: 180 }, colorWheel: COLOR_WHEEL_VALUES.blue, movement: { pan: 127, tilt: 135 }, shutter: 255 },
  { id: 'red-slow', label: 'Red Slow', intensity: 210, color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-slow', durationMs: 6000 },
  { id: 'red-fast', label: 'Red Fast', intensity: 230, color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-fast', durationMs: 1800 },
  { id: 'green-slow', label: 'Green Slow', intensity: 210, color: { red: 0, green: 255, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.green, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-slow', durationMs: 6000 },
  { id: 'green-fast', label: 'Green Fast', intensity: 230, color: { red: 0, green: 255, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.green, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-fast', durationMs: 1800 },
  { id: 'blue-slow', label: 'Blue Slow', intensity: 210, color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-slow', durationMs: 6000 },
  { id: 'blue-fast', label: 'Blue Fast', intensity: 230, color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, movement: { pan: 127, tilt: 127 }, animation: 'dimmer-fast', durationMs: 1800 },
  { id: 'cyan-wash', label: 'Cyan Wash', intensity: 215, color: { red: 0, green: 255, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, movement: { pan: 127, tilt: 130 }, shutter: 255 },
  { id: 'magenta-wash', label: 'Magenta Wash', intensity: 215, color: { red: 255, green: 0, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.magenta, movement: { pan: 127, tilt: 130 }, shutter: 255 },
  { id: 'amber-glow', label: 'Amber Glow', intensity: 190, color: { red: 255, green: 120, blue: 0, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber, movement: { pan: 127, tilt: 140 }, animation: 'dimmer-slow', durationMs: 7200 },
  { id: 'uv-hit', label: 'UV Hit', intensity: 220, color: { red: 40, green: 0, blue: 255, uv: 255 }, colorWheel: COLOR_WHEEL_VALUES.magenta, movement: { pan: 127, tilt: 127 }, shutter: 255 },
  { id: 'white-pulse', label: 'White Pulse', intensity: 235, color: { red: 255, green: 255, blue: 255, white: 255 }, colorWheel: COLOR_WHEEL_VALUES.open, animation: 'dimmer-fast', durationMs: 2200 },
  { id: 'color-chase', label: 'Color Chase', intensity: 225, color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, animation: 'color-fast', durationMs: 3600 },
  { id: 'center-spot', label: 'Center Spot', intensity: 225, color: { red: 255, green: 255, blue: 255, white: 255 }, movement: { pan: 127, tilt: 127 }, gobo: 0, zoom: 120, shutter: 255 },
  { id: 'left-sweep', label: 'Left Sweep', intensity: 220, color: { red: 255, green: 120, blue: 60 }, colorWheel: COLOR_WHEEL_VALUES.orange, movement: { pan: 64, tilt: 127 }, animation: 'movement-slow', durationMs: 7000 },
  { id: 'right-sweep', label: 'Right Sweep', intensity: 220, color: { red: 60, green: 150, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, movement: { pan: 192, tilt: 127 }, animation: 'movement-slow', durationMs: 7000 },
  { id: 'fan-spread', label: 'Fan Spread', intensity: 225, color: { red: 255, green: 255, blue: 255, white: 120 }, movement: { pan: 127, tilt: 130, spread: 56 }, zoom: 160, shutter: 255 },
  { id: 'move-90', label: 'Move 90', intensity: 230, color: { red: 255, green: 255, blue: 255 }, movement: { pan: 192, tilt: 127 }, animation: 'movement-90', durationMs: 4800 },
  { id: 'move-slow', label: 'Move Slow', intensity: 220, color: { red: 90, green: 160, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, movement: { pan: 96, tilt: 150 }, animation: 'movement-slow', durationMs: 9000 },
  { id: 'move-fast', label: 'Move Fast', intensity: 230, color: { red: 255, green: 255, blue: 255 }, movement: { pan: 64, tilt: 192 }, animation: 'movement-fast', durationMs: 2600 },
  { id: 'mirror-sweep', label: 'Mirror Sweep', intensity: 230, color: { red: 255, green: 0, blue: 170 }, colorWheel: COLOR_WHEEL_VALUES.magenta, movement: { pan: 127, tilt: 127, spread: 80 }, animation: 'movement-slow', durationMs: 7600 },
  { id: 'gobo-open', label: 'Gobo Open', intensity: 230, color: { red: 255, green: 255, blue: 255 }, gobo: 0, focus: 130, zoom: 128, movement: { pan: 127, tilt: 127 }, shutter: 255 },
  { id: 'gobo-texture', label: 'Gobo Texture', intensity: 230, color: { red: 255, green: 220, blue: 120, white: 80 }, colorWheel: COLOR_WHEEL_VALUES.amber, gobo: 96, focus: 150, zoom: 120, movement: { pan: 127, tilt: 127 }, shutter: 255 },
  { id: 'gobo-rotate-slow', label: 'Gobo Rotate Slow', intensity: 230, color: { red: 180, green: 220, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, gobo: 128, goboRotation: 80, animation: 'gobo-slow', durationMs: 8000 },
  { id: 'gobo-rotate-fast', label: 'Gobo Rotate Medium', intensity: 235, color: { red: 255, green: 255, blue: 255 }, gobo: 144, goboRotation: 120, animation: 'gobo-fast', durationMs: 5200 },
  { id: 'prism-beam', label: 'Prism Beam', intensity: 235, color: { red: 255, green: 255, blue: 255, white: 140 }, gobo: 128, prism: 190, zoom: 100, focus: 150, shutter: 255 },
  { id: 'narrow-beam', label: 'Narrow Beam', intensity: 230, color: { red: 255, green: 255, blue: 255 }, zoom: 40, iris: 50, focus: 170, movement: { pan: 127, tilt: 120 }, shutter: 255 },
  { id: 'wide-beam', label: 'Wide Beam', intensity: 220, color: { red: 120, green: 180, blue: 255, white: 160 }, zoom: 220, iris: 220, focus: 115, movement: { pan: 127, tilt: 150 }, shutter: 255 },
  { id: 'focus-sweep', label: 'Focus Sweep', intensity: 225, color: { red: 255, green: 255, blue: 255 }, focus: 80, zoom: 140, animation: 'gobo-slow', durationMs: 6800 },
  { id: 'strobe-all', label: 'Strobe All', intensity: 255, color: { red: 255, green: 255, blue: 255, white: 255 }, strobe: 190, shutter: 255, animation: 'strobe', durationMs: 1600 },
  { id: 'strobe-color', label: 'Strobe Color', intensity: 245, color: { red: 255, green: 0, blue: 120 }, colorWheel: COLOR_WHEEL_VALUES.magenta, strobe: 175, shutter: 255, animation: 'strobe', durationMs: 1800 },
  { id: 'strobe-move-90', label: 'Strobe All Move 90', intensity: 255, color: { red: 255, green: 255, blue: 255 }, movement: { pan: 192, tilt: 127 }, strobe: 210, shutter: 255, animation: 'strobe-move', durationMs: 2400 },
  { id: 'blackout-hit', label: 'Blackout Hit', intensity: 0, shutter: 0, strobe: 0 },
  { id: 'wash-slow', label: 'Wash Slow', intensity: 220, color: { red: 255, green: 140, blue: 40, white: 120 }, colorWheel: COLOR_WHEEL_VALUES.orange, movement: { pan: 127, tilt: 150 }, animation: 'color-slow', durationMs: 9000 },
  { id: 'wash-fast', label: 'Wash Fast', intensity: 235, color: { red: 0, green: 160, blue: 255, white: 80 }, colorWheel: COLOR_WHEEL_VALUES.cyan, movement: { pan: 127, tilt: 150 }, animation: 'color-fast', durationMs: 2600 },
  { id: 'warm-gobo-slow', label: 'Warm Gobo Slow', intensity: 225, color: { red: 255, green: 140, blue: 30, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber, gobo: 160, goboRotation: 65, animation: 'gobo-slow', durationMs: 7600 },
  { id: 'finale-full', label: 'Finale Full', intensity: 255, color: { red: 255, green: 255, blue: 255, white: 255, amber: 255, uv: 120 }, movement: { pan: 127, tilt: 127, spread: 70 }, gobo: 128, prism: 200, zoom: 180, shutter: 255 },
];

/** Row 3-5 operator pack: pan/tilt, color, and color+pan/tilt only (slots 17-40). */
const OPERATOR_TEMPLATES: SceneSeedTemplate[] = [
  { id: 'pt-center', label: 'PT Center', writeMode: 'panTiltOnly', movement: { pan: 127, tilt: 127 }, fixtureScope: 'movers' },
  { id: 'pt-left', label: 'PT Left', writeMode: 'panTiltOnly', movement: { pan: 64, tilt: 127 }, fixtureScope: 'movers' },
  { id: 'pt-right', label: 'PT Right', writeMode: 'panTiltOnly', movement: { pan: 192, tilt: 127 }, fixtureScope: 'movers' },
  { id: 'pt-up', label: 'PT Up', writeMode: 'panTiltOnly', movement: { pan: 127, tilt: 80 }, fixtureScope: 'movers' },
  { id: 'pt-down', label: 'PT Down', writeMode: 'panTiltOnly', movement: { pan: 127, tilt: 190 }, fixtureScope: 'movers' },
  { id: 'pt-fan', label: 'PT Fan', writeMode: 'panTiltOnly', movement: { pan: 127, tilt: 130, spread: 56 }, fixtureScope: 'movers' },
  { id: 'pt-sweep-slow', label: 'PT Sweep Slow', writeMode: 'panTiltOnly', movement: { pan: 96, tilt: 150 }, animation: 'movement-slow', durationMs: 8000, fixtureScope: 'movers' },
  { id: 'pt-corner-90', label: 'PT Corner 90', writeMode: 'panTiltOnly', movement: { pan: 192, tilt: 127 }, animation: 'movement-90', durationMs: 4800, fixtureScope: 'movers' },
  { id: 'col-red', label: 'Color Red', writeMode: 'colorOnly', color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red },
  { id: 'col-blue', label: 'Color Blue', writeMode: 'colorOnly', color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue },
  { id: 'col-green', label: 'Color Green', writeMode: 'colorOnly', color: { red: 0, green: 255, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.green },
  { id: 'col-amber', label: 'Color Amber', writeMode: 'colorOnly', color: { red: 255, green: 120, blue: 0, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber },
  { id: 'col-cyan', label: 'Color Cyan', writeMode: 'colorOnly', color: { red: 0, green: 255, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan },
  { id: 'col-magenta', label: 'Color Magenta', writeMode: 'colorOnly', color: { red: 255, green: 0, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.magenta },
  { id: 'col-white', label: 'Color White', writeMode: 'colorOnly', color: { red: 255, green: 255, blue: 255, white: 255 }, colorWheel: COLOR_WHEEL_VALUES.open },
  { id: 'col-cycle', label: 'Color Cycle', writeMode: 'colorOnly', color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, animation: 'color-fast', durationMs: 3600 },
  { id: 'mix-red-center', label: 'Mix Red Center', writeMode: 'colorPanTilt', color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, movement: { pan: 127, tilt: 127 } },
  { id: 'mix-blue-left', label: 'Mix Blue Left', writeMode: 'colorPanTilt', color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, movement: { pan: 64, tilt: 127 } },
  { id: 'mix-green-right', label: 'Mix Green Right', writeMode: 'colorPanTilt', color: { red: 0, green: 255, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.green, movement: { pan: 192, tilt: 127 } },
  { id: 'mix-amber-up', label: 'Mix Amber Up', writeMode: 'colorPanTilt', color: { red: 255, green: 120, blue: 0, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber, movement: { pan: 127, tilt: 80 } },
  { id: 'mix-cyan-down', label: 'Mix Cyan Down', writeMode: 'colorPanTilt', color: { red: 0, green: 255, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, movement: { pan: 127, tilt: 190 } },
  { id: 'mix-warm-sweep', label: 'Mix Warm Sweep', writeMode: 'colorPanTilt', color: { red: 255, green: 140, blue: 40, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.orange, movement: { pan: 96, tilt: 150 }, animation: 'movement-slow', durationMs: 9000 },
  { id: 'mix-cool-90', label: 'Mix Cool 90', writeMode: 'colorPanTilt', color: { red: 60, green: 150, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, movement: { pan: 192, tilt: 127 }, animation: 'movement-90', durationMs: 4800 },
  { id: 'mix-fan-cycle', label: 'Mix Fan Cycle', writeMode: 'colorPanTilt', color: { red: 255, green: 255, blue: 255, white: 120 }, colorWheel: COLOR_WHEEL_VALUES.open, movement: { pan: 127, tilt: 130, spread: 56 }, animation: 'color-slow', durationMs: 7200 },
];

const PICK_ONLY_TEMPLATES: SceneSeedTemplate[] = [
  { id: 'full-red', label: 'Full Red', intensity: 255, color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, shutter: 255 },
  { id: 'full-blue', label: 'Full Blue', intensity: 255, color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, shutter: 255 },
  { id: 'full-green', label: 'Full Green', intensity: 255, color: { red: 0, green: 255, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.green, shutter: 255 },
  { id: 'solid-amber', label: 'Solid Amber', intensity: 255, color: { red: 255, green: 120, blue: 0, amber: 255 }, colorWheel: COLOR_WHEEL_VALUES.amber, shutter: 255 },
  { id: 'solid-cyan', label: 'Solid Cyan', intensity: 255, color: { red: 0, green: 255, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.cyan, shutter: 255 },
  { id: 'heads-move-slow', label: 'Heads Move Slow', intensity: 235, color: { red: 220, green: 230, blue: 255, white: 180 }, colorWheel: COLOR_WHEEL_VALUES.open, movement: { pan: 80, tilt: 140 }, gobo: 0, zoom: 140, shutter: 255, animation: 'movement-slow', durationMs: 12000, fixtureScope: 'movers' },
  { id: 'heads-move-wide', label: 'Heads Move Wide', intensity: 230, color: { red: 255, green: 255, blue: 255, white: 120 }, movement: { pan: 127, tilt: 130, spread: 64 }, zoom: 160, shutter: 255, animation: 'movement-slow', durationMs: 10000, fixtureScope: 'movers' },
  { id: 'washes-full-red', label: 'Washes Full Red', intensity: 255, color: { red: 255, green: 0, blue: 0 }, colorWheel: COLOR_WHEEL_VALUES.red, shutter: 255, fixtureScope: 'washes' },
  { id: 'washes-full-blue', label: 'Washes Full Blue', intensity: 255, color: { red: 0, green: 20, blue: 255 }, colorWheel: COLOR_WHEEL_VALUES.blue, shutter: 255, fixtureScope: 'washes' },
];

export const SCENE_SEED_PICK_TEMPLATE_IDS = [
  'full-red',
  'full-blue',
  'full-green',
  'solid-amber',
  'solid-cyan',
  'washes-full-red',
  'washes-full-blue',
  'warm-wash',
  'cool-wash',
  'heads-move-slow',
  'heads-move-wide',
  'move-slow',
  'left-sweep',
  'right-sweep',
  'center-spot',
  'gobo-texture',
  'wash-slow',
  'amber-glow',
  'blackout',
  'full-open',
] as const;

const ALL_SCENE_TEMPLATES: SceneSeedTemplate[] = [
  ...SMART_TEMPLATES,
  ...OPERATOR_TEMPLATES,
  ...PICK_ONLY_TEMPLATES,
];

const PACK_TEMPLATE_LOOKUP: SceneSeedTemplate[] = [...SMART_TEMPLATES, ...OPERATOR_TEMPLATES];

const COMPACT_TEMPLATE_IDS = new Set([
  'blackout',
  'full-open',
  'warm-wash',
  'cool-wash',
  'red-slow',
  'green-slow',
  'blue-slow',
  'cyan-wash',
  'magenta-wash',
  'amber-glow',
  'uv-hit',
  'center-spot',
  'left-sweep',
  'right-sweep',
  'gobo-texture',
  'strobe-move-90',
]);

function normalizeChannelType(type?: string): string {
  return (type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isUnsafeChannelType(type: string): boolean {
  return (
    type.includes('reset') ||
    type.includes('lamp') ||
    type.includes('function') ||
    type.includes('mode') ||
    type.includes('sound') ||
    type === 'auto'
  );
}

function fixtureDmxIndex(fixture: Fixture, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

function allTargets(fixtures: Fixture[]): FixtureChannelTarget[] {
  const targets: FixtureChannelTarget[] = [];
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      const type = normalizeChannelType(channel.type);
      if (isUnsafeChannelType(type)) return;
      const dmxIndex = fixtureDmxIndex(fixture, channelIndex);
      if (dmxIndex < 0 || dmxIndex >= 512) return;
      targets.push({
        fixture,
        channelIndex,
        dmxIndex,
        type,
        name: channel.name || channel.type,
        ranges: channel.ranges,
      });
    });
  });
  return targets;
}

function filterFixturesByIds(fixtures: Fixture[], fixtureIds?: string[]): Fixture[] {
  if (!fixtureIds || fixtureIds.length === 0) return fixtures;
  const allowed = new Set(fixtureIds);
  return fixtures.filter((fixture) => allowed.has(fixture.id));
}

function isMoverFixture(fixture: Fixture): boolean {
  const types = fixture.channels.map((channel) => normalizeChannelType(channel.type));
  return types.some((type) => type === 'pan' || type.includes('pan'))
    && types.some((type) => type === 'tilt' || type.includes('tilt'));
}

function isWashFixture(fixture: Fixture): boolean {
  if (isMoverFixture(fixture)) return false;
  return fixture.channels.some((channel) => {
    const type = normalizeChannelType(channel.type);
    return type === 'red' || type === 'green' || type === 'blue' || type === 'dimmer' || type.includes('intensity');
  });
}

function scopeTargets(
  targets: FixtureChannelTarget[],
  scope: SceneSeedFixtureScope = 'all'
): FixtureChannelTarget[] {
  if (scope === 'all') return targets;
  return targets.filter((target) => {
    if (scope === 'movers') return isMoverFixture(target.fixture);
    return isWashFixture(target.fixture);
  });
}

function resolveDeck(options: SceneSeedOptions): Apc40Deck {
  if (options.deck) return options.deck;
  return options.target === 'deck-b' ? 'B' : 'A';
}

function resolveSlotIndex(slot?: number): number {
  const slotNumber = slot ?? 1;
  return Math.max(0, Math.min(39, slotNumber - 1));
}

function findSceneSeedTemplate(templateId?: string): SceneSeedTemplate | undefined {
  if (!templateId) return undefined;
  return ALL_SCENE_TEMPLATES.find((template) => template.id === templateId);
}

function matchesRole(target: FixtureChannelTarget, aliases: string[]): boolean {
  return aliases.some((alias) => {
    const normalized = normalizeChannelType(alias);
    if (target.type === normalized) return true;
    if (normalized.length <= 2) {
      return (
        target.type.startsWith(`${normalized}_`) ||
        target.type.endsWith(`_${normalized}`) ||
        target.type === `${normalized}1`
      );
    }
    return target.type.includes(normalized) || normalized.includes(target.type);
  });
}

const ROLE_ALIASES: Record<string, string[]> = {
  dimmer: ['dimmer', 'intensity', 'master'],
  red: ['red', 'r'],
  green: ['green', 'g'],
  blue: ['blue', 'b'],
  white: ['white', 'w'],
  amber: ['amber', 'a'],
  uv: ['uv', 'ultraviolet'],
  colorWheel: ['color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel', 'color'],
  pan: ['pan', 'pan_coarse'],
  tilt: ['tilt', 'tilt_coarse'],
  gobo: ['gobo', 'gobo_wheel', 'gobowheel'],
  goboRotation: ['gobo_rotation', 'gobo_rotate', 'gobo_spin', 'goborotation'],
  prism: ['prism', 'prism_rotate', 'prism_rotation'],
  iris: ['iris'],
  focus: ['focus'],
  zoom: ['zoom'],
  strobe: ['strobe'],
  shutter: ['shutter'],
  macro: ['macro', 'program', 'pattern', 'effect', 'effects'],
  speed: ['speed', 'rate', 'movement_speed', 'effect_speed'],
};

function targetsForRole(targets: FixtureChannelTarget[], role: keyof typeof ROLE_ALIASES): FixtureChannelTarget[] {
  return targets.filter((target) => matchesRole(target, ROLE_ALIASES[role]));
}

function clampDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function writeTargets(values: number[], targets: FixtureChannelTarget[], value: number): void {
  const safeValue = clampDmx(value);
  targets.forEach((target) => {
    values[target.dmxIndex] = safeValue;
  });
}

function midpoint(min: number, max: number): number {
  return clampDmx((min + max) / 2);
}

function rangeValue(target: FixtureChannelTarget, keywords: string[], fallback: number): number {
  const range = target.ranges?.find((candidate) => {
    const text = candidate.description.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
  return range ? midpoint(range.min, range.max) : fallback;
}

function nthRangeValue(target: FixtureChannelTarget, n: number, fallback: number): number {
  if (!target.ranges || target.ranges.length < 2) return fallback;
  const range = target.ranges[Math.max(0, Math.min(target.ranges.length - 1, n))];
  return midpoint(range.min, range.max);
}

function writeRangeAware(values: number[], targets: FixtureChannelTarget[], value: number, keywords: string[] = []): void {
  targets.forEach((target, index) => {
    values[target.dmxIndex] = keywords.length
      ? rangeValue(target, keywords, value)
      : nthRangeValue(target, Math.max(0, Math.floor(index % 6) + 1), value);
  });
}

function writeNoStrobe(values: number[], targets: FixtureChannelTarget[]): void {
  targets.forEach((target) => {
    values[target.dmxIndex] = rangeValue(target, ['no strobe', 'strobe off', 'open', 'off'], 0);
  });
}

function fixtureOffset(target: FixtureChannelTarget): number {
  const fixtureNumber = target.fixture.name.match(/(\d+)/)?.[1];
  return fixtureNumber ? Number(fixtureNumber) : Math.abs(hashString(target.fixture.id || target.fixture.name));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function writeMovement(
  values: number[],
  panTargets: FixtureChannelTarget[],
  tiltTargets: FixtureChannelTarget[],
  movement: SceneSeedTemplate['movement']
): void {
  if (!movement) return;
  panTargets.forEach((target) => {
    const offset = movement.spread ? ((fixtureOffset(target) % 2 === 0 ? 1 : -1) * movement.spread) : 0;
    values[target.dmxIndex] = clampDmx(movement.pan + offset);
  });
  tiltTargets.forEach((target) => {
    const offset = movement.spread ? ((fixtureOffset(target) % 3) - 1) * Math.round(movement.spread / 2) : 0;
    values[target.dmxIndex] = clampDmx(movement.tilt + offset);
  });
}

function animationAllowedForWriteMode(
  animation: AnimationKind,
  writeMode: SceneSeedTemplate['writeMode']
): boolean {
  const mode = writeMode ?? 'full';
  if (mode === 'full') return true;
  if (mode === 'panTiltOnly') {
    return animation === 'movement-slow' || animation === 'movement-fast' || animation === 'movement-90';
  }
  if (mode === 'colorOnly') {
    return animation === 'color-slow' || animation === 'color-fast';
  }
  if (mode === 'colorPanTilt') {
    return (
      animation === 'movement-slow' ||
      animation === 'movement-fast' ||
      animation === 'movement-90' ||
      animation === 'color-slow' ||
      animation === 'color-fast'
    );
  }
  return false;
}

function createTimeline(
  template: SceneSeedTemplate,
  values: number[],
  targets: FixtureChannelTarget[],
  includeAutomation: boolean,
  avoidStrobe: boolean
): SceneTimeline | undefined {
  if (!includeAutomation || !template.animation || template.animation === 'none') return undefined;
  if (!animationAllowedForWriteMode(template.animation, template.writeMode)) return undefined;
  if (avoidStrobe && (template.animation === 'strobe' || template.animation === 'strobe-move')) return undefined;

  const duration = template.durationMs ?? 4000;
  const dimmer = targetsForRole(targets, 'dimmer').map((target) => target.dmxIndex);
  const red = targetsForRole(targets, 'red').map((target) => target.dmxIndex);
  const green = targetsForRole(targets, 'green').map((target) => target.dmxIndex);
  const blue = targetsForRole(targets, 'blue').map((target) => target.dmxIndex);
  const colorWheel = targetsForRole(targets, 'colorWheel').map((target) => target.dmxIndex);
  const pan = targetsForRole(targets, 'pan').map((target) => target.dmxIndex);
  const tilt = targetsForRole(targets, 'tilt').map((target) => target.dmxIndex);
  const goboRotation = targetsForRole(targets, 'goboRotation').map((target) => target.dmxIndex);
  const gobo = targetsForRole(targets, 'gobo').map((target) => target.dmxIndex);
  const focus = targetsForRole(targets, 'focus').map((target) => target.dmxIndex);
  const strobe = targetsForRole(targets, 'strobe').map((target) => target.dmxIndex);

  const frame = (id: string, time: number, channelValues: Record<number, number>) => ({
    id,
    time,
    channelValues,
    easing: 'smooth' as const,
  });

  const byChannels = (channels: number[], value: number) =>
    Object.fromEntries(channels.map((channel) => [channel, clampDmx(value)]));

  const colorFrame = (r: number, g: number, b: number, wheel: number) => ({
    ...byChannels(red, r),
    ...byChannels(green, g),
    ...byChannels(blue, b),
    ...byChannels(colorWheel, wheel),
  });

  let keyframes: SceneTimeline['keyframes'] = [];

  if (template.animation === 'dimmer-slow' || template.animation === 'dimmer-fast') {
    if (dimmer.length === 0) return undefined;
    const peak = template.intensity ?? 230;
    keyframes = [
      frame(`${template.id}-dim-0`, 0, byChannels(dimmer, Math.max(30, peak - 120))),
      frame(`${template.id}-dim-1`, duration / 2, byChannels(dimmer, peak)),
      frame(`${template.id}-dim-2`, duration, byChannels(dimmer, Math.max(30, peak - 120))),
    ];
  } else if (template.animation === 'color-slow' || template.animation === 'color-fast') {
    if (red.length === 0 && green.length === 0 && blue.length === 0 && colorWheel.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-color-0`, 0, colorFrame(255, 0, 0, COLOR_WHEEL_VALUES.red)),
      frame(`${template.id}-color-1`, duration / 3, colorFrame(0, 255, 0, COLOR_WHEEL_VALUES.green)),
      frame(`${template.id}-color-2`, (duration * 2) / 3, colorFrame(0, 40, 255, COLOR_WHEEL_VALUES.blue)),
      frame(`${template.id}-color-3`, duration, colorFrame(255, 0, 0, COLOR_WHEEL_VALUES.red)),
    ];
  } else if (template.animation === 'movement-slow' || template.animation === 'movement-fast') {
    if (pan.length === 0 && tilt.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-move-0`, 0, { ...byChannels(pan, 64), ...byChannels(tilt, 120) }),
      frame(`${template.id}-move-1`, duration / 2, { ...byChannels(pan, 192), ...byChannels(tilt, 180) }),
      frame(`${template.id}-move-2`, duration, { ...byChannels(pan, 64), ...byChannels(tilt, 120) }),
    ];
  } else if (template.animation === 'movement-90') {
    if (pan.length === 0 && tilt.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-90-0`, 0, { ...byChannels(pan, 127), ...byChannels(tilt, 127) }),
      frame(`${template.id}-90-1`, duration / 2, { ...byChannels(pan, 192), ...byChannels(tilt, 127) }),
      frame(`${template.id}-90-2`, duration, { ...byChannels(pan, 127), ...byChannels(tilt, 127) }),
    ];
  } else if (template.animation === 'gobo-slow' || template.animation === 'gobo-fast') {
    if (goboRotation.length === 0 && gobo.length === 0 && focus.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-gobo-0`, 0, { ...byChannels(goboRotation, 50), ...byChannels(gobo, template.gobo ?? 96), ...byChannels(focus, 90) }),
      frame(`${template.id}-gobo-1`, duration / 2, { ...byChannels(goboRotation, 190), ...byChannels(gobo, template.gobo ?? 160), ...byChannels(focus, 180) }),
      frame(`${template.id}-gobo-2`, duration, { ...byChannels(goboRotation, 50), ...byChannels(gobo, template.gobo ?? 96), ...byChannels(focus, 90) }),
    ];
  } else if (template.animation === 'strobe') {
    if (strobe.length === 0 && dimmer.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-strobe-0`, 0, { ...byChannels(strobe, template.strobe ?? 190), ...byChannels(dimmer, template.intensity ?? 255) }),
      frame(`${template.id}-strobe-1`, duration / 2, { ...byChannels(strobe, 0), ...byChannels(dimmer, 80) }),
      frame(`${template.id}-strobe-2`, duration, { ...byChannels(strobe, template.strobe ?? 190), ...byChannels(dimmer, template.intensity ?? 255) }),
    ];
  } else if (template.animation === 'strobe-move') {
    if (strobe.length === 0 && pan.length === 0 && tilt.length === 0) return undefined;
    keyframes = [
      frame(`${template.id}-smove-0`, 0, { ...byChannels(strobe, template.strobe ?? 210), ...byChannels(pan, 127), ...byChannels(tilt, 127) }),
      frame(`${template.id}-smove-1`, duration / 2, { ...byChannels(strobe, 0), ...byChannels(pan, 192), ...byChannels(tilt, 127) }),
      frame(`${template.id}-smove-2`, duration, { ...byChannels(strobe, template.strobe ?? 210), ...byChannels(pan, 127), ...byChannels(tilt, 127) }),
    ];
  }

  if (keyframes.length === 0) return undefined;

  return {
    enabled: true,
    duration,
    loop: true,
    keyframes,
    playbackMode: 'loop',
    playbackSpeed: 1,
  };
}

function applyTemplate(
  template: SceneSeedTemplate,
  fixtureTargets: FixtureChannelTarget[],
  includeAutomation: boolean,
  avoidStrobe: boolean
): Pick<Scene, 'channelValues' | 'timeline'> {
  const scopedTargets = scopeTargets(fixtureTargets, template.fixtureScope ?? 'all');
  const values = new Array(512).fill(0);
  const dimmer = targetsForRole(scopedTargets, 'dimmer');
  const red = targetsForRole(scopedTargets, 'red');
  const green = targetsForRole(scopedTargets, 'green');
  const blue = targetsForRole(scopedTargets, 'blue');
  const white = targetsForRole(scopedTargets, 'white');
  const amber = targetsForRole(scopedTargets, 'amber');
  const uv = targetsForRole(scopedTargets, 'uv');
  const colorWheel = targetsForRole(scopedTargets, 'colorWheel');
  const pan = targetsForRole(scopedTargets, 'pan');
  const tilt = targetsForRole(scopedTargets, 'tilt');
  const gobo = targetsForRole(scopedTargets, 'gobo');
  const goboRotation = targetsForRole(scopedTargets, 'goboRotation');
  const prism = targetsForRole(scopedTargets, 'prism');
  const iris = targetsForRole(scopedTargets, 'iris');
  const focus = targetsForRole(scopedTargets, 'focus');
  const zoom = targetsForRole(scopedTargets, 'zoom');
  const strobe = targetsForRole(scopedTargets, 'strobe');
  const shutter = targetsForRole(scopedTargets, 'shutter');
  const macro = targetsForRole(scopedTargets, 'macro');
  const speed = targetsForRole(scopedTargets, 'speed');
  const writeMode = template.writeMode ?? 'full';

  if (writeMode === 'full') {
    if ((template.intensity ?? 0) > 0) {
      writeTargets(values, dimmer, template.intensity ?? 220);
      writeRangeAware(values, shutter, template.shutter ?? 255, avoidStrobe ? ['open', 'on', 'no strobe'] : ['open', 'on']);
    } else {
      writeTargets(values, dimmer, 0);
      writeTargets(values, shutter, template.shutter ?? 0);
    }
  }

  if (writeMode === 'full' || writeMode === 'colorOnly' || writeMode === 'colorPanTilt') {
    if (template.color) {
      writeTargets(values, red, template.color.red ?? 0);
      writeTargets(values, green, template.color.green ?? 0);
      writeTargets(values, blue, template.color.blue ?? 0);
      writeTargets(values, white, template.color.white ?? 0);
      writeTargets(values, amber, template.color.amber ?? 0);
      writeTargets(values, uv, template.color.uv ?? 0);
    }

    if (template.colorWheel !== undefined) writeRangeAware(values, colorWheel, template.colorWheel);
  }

  if (writeMode === 'full' || writeMode === 'panTiltOnly' || writeMode === 'colorPanTilt') {
    writeMovement(values, pan, tilt, template.movement);
  }

  if (writeMode === 'full') {
    if (template.gobo !== undefined) writeRangeAware(values, gobo, template.gobo);
    if (template.goboRotation !== undefined) writeRangeAware(values, goboRotation, template.goboRotation);
    if (template.prism !== undefined) writeRangeAware(values, prism, template.prism);
    if (template.iris !== undefined) writeRangeAware(values, iris, template.iris);
    if (template.focus !== undefined) writeTargets(values, focus, template.focus);
    if (template.zoom !== undefined) writeTargets(values, zoom, template.zoom);
    if (avoidStrobe) {
      writeNoStrobe(values, strobe);
    } else if (template.strobe !== undefined) {
      writeRangeAware(values, strobe, template.strobe, ['strobe', 'flash']);
    }
    if (template.macro !== undefined) writeRangeAware(values, macro, template.macro);
    if (template.speed !== undefined) writeTargets(values, speed, template.speed);
  }

  const timelineTargets = avoidStrobe
    ? scopedTargets.filter((target) => !matchesRole(target, ROLE_ALIASES.strobe))
    : scopedTargets;
  const timeline = createTimeline(template, values, timelineTargets, includeAutomation, avoidStrobe);
  return { channelValues: values, timeline };
}

function compactTemplates(): SceneSeedTemplate[] {
  return SMART_TEMPLATES.filter((template) => COMPACT_TEMPLATE_IDS.has(template.id));
}

function selectedTemplates(packId: SceneSeedPackId): SceneSeedTemplate[] {
  const ids = MD_SCENE_PACK_TEMPLATE_IDS[packId];
  if (ids && ids.length) {
    const byId = new Map(PACK_TEMPLATE_LOOKUP.map((t) => [t.id, t] as const));
    const picked = ids.map((id) => byId.get(id)).filter((t): t is SceneSeedTemplate => Boolean(t));
    if (picked.length) return picked;
  }
  if (packId === 'operator-rows-ab-48') return OPERATOR_TEMPLATES;
  if (packId === 'compact-starter') return compactTemplates();
  return SMART_TEMPLATES;
}

function slotIndexForPackTemplate(packId: SceneSeedPackId, templateIndex: number): number {
  if (packId === 'operator-rows-ab-48') {
    return 16 + templateIndex;
  }
  return templateIndex;
}

function isStrobeTemplate(template: SceneSeedTemplate): boolean {
  return (
    template.animation === 'strobe' ||
    template.animation === 'strobe-move' ||
    (template.strobe ?? 0) > 0 ||
    /\bstrobe\b/i.test(`${template.id} ${template.label}`)
  );
}

export function listSceneSeedPickTemplates(avoidStrobe: boolean): SceneSeedTemplate[] {
  const byId = new Map(ALL_SCENE_TEMPLATES.map((template) => [template.id, template] as const));
  const templates = SCENE_SEED_PICK_TEMPLATE_IDS
    .map((id) => byId.get(id))
    .filter((template): template is SceneSeedTemplate => Boolean(template));
  return avoidStrobe ? templates.filter((template) => !isStrobeTemplate(template)) : templates;
}

function templatesForOptions(options: SceneSeedOptions): SceneSeedTemplate[] {
  const templates = selectedTemplates(options.packId);
  return options.avoidStrobe ? templates.filter((template) => !isStrobeTemplate(template)) : templates;
}

function decksForOptions(options: SceneSeedOptions): Apc40Deck[] {
  if (SCENE_BOTH_DECK_PACK_IDS.includes(options.packId) || options.target === 'decks-a-b') {
    return ['A', 'B'];
  }
  return [options.target === 'deck-b' ? 'B' : 'A'];
}

function deckBVariant(template: SceneSeedTemplate): SceneSeedTemplate {
  const writeMode = template.writeMode ?? 'full';
  const color = template.color && writeMode !== 'panTiltOnly'
    ? {
        red: template.color.blue ?? template.color.red ?? 0,
        green: template.color.red ?? template.color.green ?? 0,
        blue: template.color.green ?? template.color.blue ?? 0,
        white: template.color.white,
        amber: template.color.uv ? Math.max(template.color.uv, template.color.amber ?? 0) : template.color.amber,
        uv: template.color.amber ? Math.max(template.color.amber, template.color.uv ?? 0) : template.color.uv,
      }
    : undefined;

  const movement = template.movement && writeMode !== 'colorOnly'
    ? { ...template.movement, pan: 255 - template.movement.pan, tilt: Math.max(40, Math.min(220, template.movement.tilt + 24)) }
    : undefined;

  return {
    ...template,
    id: `${template.id}-b`,
    label: `${template.label} B`,
    color,
    colorWheel: template.colorWheel !== undefined && writeMode !== 'panTiltOnly'
      ? (template.colorWheel + 96) % 256
      : undefined,
    movement,
    intensity:
      writeMode === 'full' && template.intensity !== undefined
        ? template.intensity === 0
          ? 0
          : Math.max(120, Math.min(255, (template.intensity ?? 220) - 25))
        : template.intensity,
  };
}

function isSeedScene(scene: Scene | undefined): boolean {
  return scene?.seed?.generatedBy === SCENE_SEED_GENERATOR_ID;
}

function isStrobeSeedScene(scene: Scene): boolean {
  return /\bstrobe\b/i.test(`${scene.seed?.templateId || ''} ${scene.seed?.label || ''} ${scene.name}`);
}

function buildScene(
  template: SceneSeedTemplate,
  fixtureTargets: FixtureChannelTarget[],
  options: SceneSeedOptions,
  deck: Apc40Deck,
  slot: number
): Scene {
  const sceneData = applyTemplate(template, fixtureTargets, options.includeAutomation, options.avoidStrobe);
  const name = apc40DeckSceneName(deck, slot);
  const seed: SceneSeedMetadata = {
    generatedBy: SCENE_SEED_GENERATOR_ID,
    generatorVersion: SCENE_SEED_GENERATOR_VERSION,
    packId: options.packId,
    templateId: template.id,
    deck,
    slot: slot + 1,
    label: template.label,
    automated: Boolean(sceneData.timeline?.enabled),
  };

  return {
    name,
    oscAddress: sceneNameToOscPath(name),
    channelValues: sceneData.channelValues,
    timeline: sceneData.timeline,
    seed,
  };
}

function capabilityLabels(targets: FixtureChannelTarget[], avoidStrobe: boolean, packId?: SceneSeedPackId): string[] {
  if (packId === 'operator-rows-ab-48') {
    return [
      'Row 3 (slots 17-24): pan/tilt only on movers',
      'Row 4 (slots 25-32): color only — layer with Deck A/B rows 1-2',
      'Row 5 (slots 33-40): color + pan/tilt — no gobo or strobe',
      'Dimmers, shutter, and strobe are never written — dial those yourself',
    ];
  }

  const labels = [
    ['Dimmer', targetsForRole(targets, 'dimmer')],
    ['RGB', [...targetsForRole(targets, 'red'), ...targetsForRole(targets, 'green'), ...targetsForRole(targets, 'blue')]],
    ['White / Amber / UV', [...targetsForRole(targets, 'white'), ...targetsForRole(targets, 'amber'), ...targetsForRole(targets, 'uv')]],
    ['Color Wheel', targetsForRole(targets, 'colorWheel')],
    ['Pan / Tilt', [...targetsForRole(targets, 'pan'), ...targetsForRole(targets, 'tilt')]],
    ['Gobo', [...targetsForRole(targets, 'gobo'), ...targetsForRole(targets, 'goboRotation')]],
    ['Beam', [...targetsForRole(targets, 'prism'), ...targetsForRole(targets, 'iris'), ...targetsForRole(targets, 'focus'), ...targetsForRole(targets, 'zoom')]],
    [avoidStrobe ? 'Shutter gate, no strobe' : 'Strobe / Shutter', avoidStrobe ? targetsForRole(targets, 'shutter') : [...targetsForRole(targets, 'strobe'), ...targetsForRole(targets, 'shutter')]],
  ];
  return labels.filter(([, roleTargets]) => roleTargets.length > 0).map(([label]) => label as string);
}

function mergeGeneratedScenes(
  existingScenes: Scene[],
  generatedScenes: Scene[],
  options: SceneSeedOptions
): SceneSeedSummary {
  const seedNames = new Set(generatedScenes.map((scene) => scene.name));
  const existingByName = new Map(existingScenes.map((scene) => [scene.name, scene]));
  const handmadeScenes = existingScenes.filter((scene) => {
    if (!isSeedScene(scene)) return true;
    if (options.avoidStrobe && isStrobeSeedScene(scene)) return false;
    return !seedNames.has(scene.name);
  });
  const blockedByHandmade = generatedScenes.filter((scene) => {
    const existing = existingByName.get(scene.name);
    return existing && !isSeedScene(existing);
  });
  const allowedGeneratedScenes = generatedScenes.filter((scene) => {
    const existing = existingByName.get(scene.name);
    return !existing || isSeedScene(existing);
  });
  const refreshed = allowedGeneratedScenes.filter((scene) => isSeedScene(existingByName.get(scene.name))).length;
  const created = allowedGeneratedScenes.filter((scene) => !existingByName.has(scene.name)).length;

  return {
    scenes: [...handmadeScenes, ...allowedGeneratedScenes],
    generatedScenes: allowedGeneratedScenes,
    created,
    refreshed,
    skipped: blockedByHandmade.length,
    capabilities: [],
  };
}

export function captureSelectionToApcSlot(
  fixtures: Fixture[],
  dmxChannels: number[],
  existingScenes: Scene[],
  options: CaptureSelectionToSlotOptions
): SceneSeedSummary {
  if (fixtures.length === 0 || options.selectedFixtureIds.length === 0) {
    return {
      scenes: existingScenes,
      generatedScenes: [],
      created: 0,
      refreshed: 0,
      skipped: 0,
      capabilities: [],
      disabledReason: 'Select fixtures before capturing a scene slot.',
    };
  }

  const slotIndex = resolveSlotIndex(options.slot);
  const deck = options.deck;
  const name = apc40DeckSceneName(deck, slotIndex);
  const existing = existingScenes.find((scene) => scene.name === name);
  const baseValues = options.mergeFromExistingSlot !== false && existing
    ? [...existing.channelValues]
    : [...dmxChannels];
  const channelValues = baseValues.length >= 512 ? baseValues.slice(0, 512) : [...baseValues, ...new Array(512 - baseValues.length).fill(0)];

  const selectedFixtures = filterFixturesByIds(fixtures, options.selectedFixtureIds);
  selectedFixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      const type = normalizeChannelType(channel.type);
      if (isUnsafeChannelType(type)) return;
      const dmxIndex = fixtureDmxIndex(fixture, channelIndex);
      if (dmxIndex < 0 || dmxIndex >= 512) return;
      channelValues[dmxIndex] = dmxChannels[dmxIndex] ?? 0;
    });
  });

  const scene: Scene = {
    name,
    oscAddress: sceneNameToOscPath(name),
    channelValues,
    seed: {
      generatedBy: SCENE_SEED_GENERATOR_ID,
      generatorVersion: SCENE_SEED_GENERATOR_VERSION,
      packId: 'smart-starter-40',
      templateId: 'capture-selection',
      deck,
      slot: slotIndex + 1,
      label: `Capture ${selectedFixtures.length} fixture${selectedFixtures.length === 1 ? '' : 's'}`,
      automated: false,
    },
  };

  const merged = mergeGeneratedScenes(existingScenes, [scene], {
    packId: 'smart-starter-40',
    target: deck === 'B' ? 'deck-b' : 'deck-a',
    includeAutomation: false,
    avoidStrobe: false,
    mode: 'capture-selection',
    slot: options.slot,
    deck,
  });

  return {
    ...merged,
    capabilities: [`Captured ${selectedFixtures.length} selected fixture${selectedFixtures.length === 1 ? '' : 's'}`],
  };
}

export function generateSeededSceneList(
  fixtures: Fixture[],
  existingScenes: Scene[],
  partialOptions: Partial<SceneSeedOptions> = {}
): SceneSeedSummary {
  const options: SceneSeedOptions = { ...DEFAULT_OPTIONS, ...partialOptions };
  const scopedFixtures = filterFixturesByIds(fixtures, options.fixtureIds);
  const fixtureTargets = allTargets(scopedFixtures);

  if (fixtures.length === 0 || fixtureTargets.length === 0) {
    return {
      scenes: existingScenes,
      generatedScenes: [],
      created: 0,
      refreshed: 0,
      skipped: 0,
      capabilities: [],
      disabledReason: options.fixtureIds?.length
        ? 'Selected fixtures have no writable DMX channels.'
        : 'Add fixtures before seeding scenes.',
    };
  }

  if (options.mode === 'single-slot') {
    const template = findSceneSeedTemplate(options.templateId);
    if (!template) {
      return {
        scenes: existingScenes,
        generatedScenes: [],
        created: 0,
        refreshed: 0,
        skipped: 0,
        capabilities: [],
        disabledReason: 'Choose a look template before seeding this slot.',
      };
    }
    if (options.avoidStrobe && isStrobeTemplate(template)) {
      return {
        scenes: existingScenes,
        generatedScenes: [],
        created: 0,
        refreshed: 0,
        skipped: 0,
        capabilities: [],
        disabledReason: 'That look is blocked while NO STROBE safety mode is enabled.',
      };
    }

    const deck = resolveDeck(options);
    const slotIndex = resolveSlotIndex(options.slot);
    const scene = buildScene(template, fixtureTargets, options, deck, slotIndex);
    const merged = mergeGeneratedScenes(existingScenes, [scene], options);
    return {
      ...merged,
      capabilities: capabilityLabels(fixtureTargets, options.avoidStrobe),
    };
  }

  const generatedScenes: Scene[] = [];
  const templates = templatesForOptions(options);
  decksForOptions(options).forEach((deck) => {
    templates.forEach((template, index) => {
      const slotIndex = slotIndexForPackTemplate(options.packId, index);
      const deckTemplate = deck === 'B' ? deckBVariant(template) : template;
      generatedScenes.push(buildScene(deckTemplate, fixtureTargets, options, deck, slotIndex));
    });
  });

  const merged = mergeGeneratedScenes(existingScenes, generatedScenes, options);
  return {
    ...merged,
    capabilities: capabilityLabels(fixtureTargets, options.avoidStrobe, options.packId),
  };
}

export function getSceneSeedLabel(scene: Scene): string {
  return scene.seed?.label || scene.name;
}
