import { describe, expect, it } from 'vitest';
import {
  laserTwinklingRgy,
  toCanvasFixtureTemplate,
  toStoreFixtureTemplate,
} from '.';

describe('AB-FIX-001 Twinkling Laser Series RGY', () => {
  it('preserves the five-channel map from the supplied manual', () => {
    const mode = laserTwinklingRgy.modes[0];

    expect(mode.channels).toBe(5);
    expect(mode.channelData.map((channel) => channel.type)).toEqual([
      'macro',
      'effect',
      'speed',
      'speed',
      'color_wheel',
    ]);
    expect(mode.channelData[0].ranges).toEqual([
      { min: 0, max: 49, description: 'Laser off' },
      { min: 50, max: 99, description: 'DMX mode' },
      { min: 100, max: 149, description: 'Sound-active mode' },
      { min: 150, max: 255, description: 'Automatic mode' },
    ]);
    expect(mode.channelData[4].ranges).toEqual([
      { min: 0, max: 99, description: 'Red and green (yellow)' },
      { min: 100, max: 199, description: 'Red' },
      { min: 200, max: 255, description: 'Green' },
    ]);
  });

  it('uses one canonical profile for store and canvas consumers', () => {
    const storeTemplate = toStoreFixtureTemplate(laserTwinklingRgy);
    const canvasTemplate = toCanvasFixtureTemplate(laserTwinklingRgy);

    expect(storeTemplate.id).toBe('laser-twinkler');
    expect(storeTemplate.isBuiltIn).toBe(true);
    expect(storeTemplate.modes).toEqual(canvasTemplate.modes);
    expect(storeTemplate.photoUrl).toBe(canvasTemplate.photoUrl);
  });

  it('records the fixture-specific DIP switch addressing', () => {
    expect(laserTwinklingRgy.addressing?.addressRange.switches).toEqual([
      { switch: 1, value: 1 },
      { switch: 2, value: 2 },
      { switch: 3, value: 4 },
      { switch: 4, value: 8 },
      { switch: 5, value: 16 },
      { switch: 6, value: 32 },
      { switch: 7, value: 64 },
      { switch: 8, value: 128 },
      { switch: 9, value: 256 },
    ]);
  });
});

