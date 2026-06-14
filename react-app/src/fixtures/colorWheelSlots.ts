import type { Fixture } from '../store/types';

export interface ColorWheelSlot {
  label: string;
  value: number;
  min: number;
  max: number;
  hex: string;
  hue: number;
  source: 'manual' | 'estimated';
}

const rgbFromHex = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const midpoint = (min: number, max: number) => Math.round((min + max) / 2);

const slot = (label: string, min: number, max: number, hex: string, hue: number): ColorWheelSlot => ({
  label,
  min,
  max,
  value: midpoint(min, max),
  hex,
  hue,
  source: 'estimated',
});

export const MINIBEAM_COLOR_WHEEL_SLOTS: ColorWheelSlot[] = [
  { ...slot('White', 0, 3, '#ffffff', 0), source: 'manual' },
  slot('Wheel 1 Red', 9, 12, '#ff1717', 0),
  slot('Wheel 2 Orange', 18, 21, '#ff7a00', 28),
  slot('Wheel 3 Amber', 27, 31, '#ffbf00', 43),
  slot('Wheel 4 Yellow', 36, 40, '#fff000', 56),
  slot('Wheel 5 Lime', 45, 49, '#92ff00', 86),
  slot('Wheel 6 Green', 54, 58, '#00e85b', 140),
  slot('Wheel 7 Cyan', 64, 67, '#00ffd5', 172),
  slot('Wheel 8 Sky', 73, 76, '#00a2ff', 204),
  slot('Wheel 9 Blue', 82, 85, '#004dff', 226),
  slot('Wheel 10 Indigo', 91, 95, '#3f00ff', 255),
  slot('Wheel 11 Violet', 100, 104, '#8a00ff', 274),
  slot('Wheel 12 Magenta', 109, 113, '#ff00d4', 310),
  slot('Wheel 13 Pink', 118, 122, '#ff4f8b', 340),
  slot('Wheel 14 Warm', 123, 127, '#ffd0a0', 32),
];

export const MINIBEAM_APC_TRACK_SELECT_SLOTS = [
  MINIBEAM_COLOR_WHEEL_SLOTS[0],
  MINIBEAM_COLOR_WHEEL_SLOTS[1],
  MINIBEAM_COLOR_WHEEL_SLOTS[3],
  MINIBEAM_COLOR_WHEEL_SLOTS[6],
  MINIBEAM_COLOR_WHEEL_SLOTS[7],
  MINIBEAM_COLOR_WHEEL_SLOTS[9],
  MINIBEAM_COLOR_WHEEL_SLOTS[11],
  MINIBEAM_COLOR_WHEEL_SLOTS[12],
];

export function isColorWheelChannel(channel: { name?: string; type?: string }): boolean {
  const type = (channel.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const name = (channel.name || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel', 'color', 'colour'].includes(type)
    || name.includes('color_wheel')
    || name.includes('colour_wheel');
}

export function fixtureHasColorWheel(fixture: Fixture): boolean {
  return fixture.channels.some(isColorWheelChannel);
}

export function fixtureUsesMiniBeamWheel(fixture: Fixture): boolean {
  const template = (fixture.templateId || '').toLowerCase();
  const model = (fixture.model || '').toLowerCase();
  const name = (fixture.name || '').toLowerCase();
  return template === 'minibeam-moving-head' || model.includes('minibeam') || name.includes('minibeam') || name.includes('mini beam');
}

export function getFixtureColorWheelSlots(fixture: Fixture): ColorWheelSlot[] {
  if (!fixtureHasColorWheel(fixture)) return [];
  if (fixtureUsesMiniBeamWheel(fixture)) return MINIBEAM_COLOR_WHEEL_SLOTS;
  return [];
}

export function getFirstFixtureColorWheelSlots(fixtures: Fixture[]): ColorWheelSlot[] {
  for (const fixture of fixtures) {
    const slots = getFixtureColorWheelSlots(fixture);
    if (slots.length > 0) return slots;
  }
  return [];
}

export function nearestColorWheelSlotFromHue(
  slots: ColorWheelSlot[],
  hue: number,
  saturation = 1,
  rgb?: { r: number; g: number; b: number }
): ColorWheelSlot | null {
  if (slots.length === 0) return null;
  const white = slots.find((candidate) => candidate.label.toLowerCase().includes('white'));
  if (white && (saturation < 0.18 || (rgb && rgb.r > 220 && rgb.g > 220 && rgb.b > 220))) return white;

  let best = slots[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of slots) {
    if (candidate === white) continue;
    const delta = Math.abs((((candidate.hue - hue + 540) % 360) - 180));
    let score = delta;
    if (rgb) {
      const [r, g, b] = rgbFromHex(candidate.hex);
      const rgbScore = Math.sqrt(
        ((r - rgb.r) ** 2) +
        ((g - rgb.g) ** 2) +
        ((b - rgb.b) ** 2)
      ) / 8;
      score = (delta * 0.7) + (rgbScore * 0.3);
    }
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function colorWheelSlotForTrackSelect(slots: ColorWheelSlot[], trackIndex: number): ColorWheelSlot | null {
  if (slots.length === 0) return null;
  const bounded = Math.max(0, Math.min(7, Math.floor(trackIndex)));
  if (slots === MINIBEAM_COLOR_WHEEL_SLOTS || slots.length === MINIBEAM_COLOR_WHEEL_SLOTS.length) {
    return MINIBEAM_APC_TRACK_SELECT_SLOTS[bounded] ?? null;
  }
  const index = slots.length <= 8
    ? Math.min(bounded, slots.length - 1)
    : Math.round((bounded / 7) * (slots.length - 1));
  return slots[index] ?? null;
}
