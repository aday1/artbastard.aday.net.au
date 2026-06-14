import { describe, expect, it } from 'vitest';
import {
  MINIBEAM_COLOR_WHEEL_SLOTS,
  colorWheelSlotForTrackSelect,
  getFixtureColorWheelSlots,
  nearestColorWheelSlotFromHue,
} from './colorWheelSlots';
import type { Fixture } from '../store/types';

describe('MiniBeam color wheel slots', () => {
  const fixture: Fixture = {
    id: 'mini-1',
    name: 'MINIBEAM 1',
    type: 'Moving Head',
    templateId: 'minibeam-moving-head',
    model: 'MiniBeam',
    startAddress: 1,
    channels: [
      { name: 'Colour Wheel', type: 'color_wheel' },
      { name: 'Dimmer', type: 'dimmer' },
    ],
  };

  it('returns fixed manual slots for MiniBeam color wheel fixtures', () => {
    const slots = getFixtureColorWheelSlots(fixture);

    expect(slots).toHaveLength(15);
    expect(slots[0]).toMatchObject({ label: 'White', min: 0, max: 3 });
    expect(slots[1]).toMatchObject({ label: 'Wheel 1 Red', min: 9, max: 12 });
    expect(slots[14]).toMatchObject({ label: 'Wheel 14 Warm', min: 123, max: 127 });
  });

  it('maps APC40 Track Select buttons to practical wheel slots', () => {
    expect(colorWheelSlotForTrackSelect(MINIBEAM_COLOR_WHEEL_SLOTS, 0)?.label).toBe('White');
    expect(colorWheelSlotForTrackSelect(MINIBEAM_COLOR_WHEEL_SLOTS, 1)?.label).toBe('Wheel 1 Red');
    expect(colorWheelSlotForTrackSelect(MINIBEAM_COLOR_WHEEL_SLOTS, 7)?.label).toBe('Wheel 12 Magenta');
  });

  it('snaps ROLI hue touches to nearest wheel slots', () => {
    expect(nearestColorWheelSlotFromHue(MINIBEAM_COLOR_WHEEL_SLOTS, 3, 1)?.label).toBe('Wheel 1 Red');
    expect(nearestColorWheelSlotFromHue(MINIBEAM_COLOR_WHEEL_SLOTS, 178, 1)?.label).toBe('Wheel 7 Cyan');
    expect(nearestColorWheelSlotFromHue(MINIBEAM_COLOR_WHEEL_SLOTS, 0, 0.05, { r: 255, g: 255, b: 255 })?.label).toBe('White');
  });
});
