import { describe, expect, it } from 'vitest';
import {
  getFixtureLibraryEntryById,
  miniBeamMovingHead,
  toCanvasFixtureTemplate,
  toStoreFixtureTemplate,
} from '.';

describe('AB-FIX-002 MiniBeam Moving Head Spot', () => {
  it('preserves the 18-channel moving-head map from the supplied manual', () => {
    const mode = miniBeamMovingHead.modes[0];

    expect(mode.channels).toBe(18);
    expect(mode.channelData.map((channel) => channel.type)).toEqual([
      'color_wheel',
      'strobe',
      'dimmer',
      'gobo',
      'prism',
      'prism_rotation',
      'effect',
      'frost',
      'focus',
      'pan',
      'pan_fine',
      'tilt',
      'tilt_fine',
      'macro',
      'reset',
      'lamp',
      'speed',
      'speed',
    ]);
  });

  it('records the gobo, prism, and movement capabilities', () => {
    const [, , , gobo, prism, prismRotation, , , focus, pan, panFine, tilt, tiltFine] =
      miniBeamMovingHead.modes[0].channelData;

    expect(gobo.ranges?.slice(0, 3)).toEqual([
      { min: 0, max: 7, description: 'White / open' },
      { min: 8, max: 16, description: 'Gobo 1' },
      { min: 17, max: 24, description: 'Gobo 2' },
    ]);
    expect(prism.ranges).toEqual([
      { min: 0, max: 127, description: 'No prism' },
      { min: 128, max: 255, description: 'Insert prism' },
    ]);
    expect(prismRotation.ranges).toContainEqual({
      min: 191,
      max: 192,
      description: 'Stop',
    });
    expect(focus.ranges?.[0].description).toBe('Far to near');
    expect(pan.ranges?.[0].description).toBe('0-540 degrees');
    expect(panFine.ranges?.[0].description).toBe('Fine pan, 0-2 degrees');
    expect(tilt.ranges?.[0].description).toBe('0-270 degrees');
    expect(tiltFine.ranges?.[0].description).toBe('Fine tilt, 0-1 degree');
  });

  it('uses one canonical profile for store and canvas consumers', () => {
    const storeTemplate = toStoreFixtureTemplate(miniBeamMovingHead);
    const canvasTemplate = toCanvasFixtureTemplate(miniBeamMovingHead);

    expect(storeTemplate.id).toBe('minibeam-moving-head');
    expect(storeTemplate.isBuiltIn).toBe(true);
    expect(storeTemplate.modes?.[0].channels).toBe(18);
    expect(storeTemplate.photoUrl).toBe('/fixtures/ab-fix-002-minibeam-moving-head-generated.png');
    expect(storeTemplate.modes).toEqual(canvasTemplate.modes);
  });

  it('keeps the active markdown profile wired to color wheel and coarse pan/tilt roles', () => {
    const activeEntry = getFixtureLibraryEntryById('minibeam-moving-head');
    const channelTypes = activeEntry?.modes[0].channelData.map((channel) => channel.type);

    expect(channelTypes).toEqual([
      'color_wheel',
      'strobe',
      'dimmer',
      'gobo',
      'prism',
      'other',
      'other',
      'other',
      'focus',
      'pan',
      'pan_fine',
      'tilt',
      'tilt_fine',
      'macro',
      'reset',
      'lamp',
      'speed',
      'speed',
    ]);
  });
});
