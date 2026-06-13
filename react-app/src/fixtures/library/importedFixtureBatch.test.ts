import { describe, expect, it } from 'vitest';
import {
  eventLightingEl1000Rgb,
  fullColourAnimationLaser,
  miniLedMovingHeadWash,
  miniSpiderLight,
  smallMovingHeadSpot,
  tinyLedMovingHeadWash,
  toCanvasFixtureTemplate,
  toStoreFixtureTemplate,
  uvDmxLedPar,
} from '.';

describe('imported user fixture batch AB-FIX-003 through AB-FIX-009', () => {
  it('records the expected mode sizes for the uploaded manuals', () => {
    expect(miniLedMovingHeadWash.modes.map((mode) => mode.channels)).toEqual([14, 9]);
    expect(uvDmxLedPar.modes.map((mode) => mode.channels)).toEqual([7]);
    expect(smallMovingHeadSpot.modes.map((mode) => mode.channels)).toEqual([9, 11]);
    expect(fullColourAnimationLaser.modes.map((mode) => mode.channels)).toEqual([12, 20]);
    expect(tinyLedMovingHeadWash.modes.map((mode) => mode.channels)).toEqual([13, 11]);
    expect(miniSpiderLight.modes.map((mode) => mode.channels)).toEqual([15, 7]);
    expect(eventLightingEl1000Rgb.modes.map((mode) => mode.channels)).toEqual([16]);
  });

  it('categorises fixtures by controllable hardware capabilities', () => {
    expect(miniLedMovingHeadWash.tags).toEqual(expect.arrayContaining(['MOVING HEAD', 'RGBW']));
    expect(uvDmxLedPar.tags).toEqual(expect.arrayContaining(['UV', 'PAR']));
    expect(smallMovingHeadSpot.tags).toEqual(expect.arrayContaining(['GOBO', 'PARTIAL MANUAL']));
    expect(fullColourAnimationLaser.tags).toEqual(expect.arrayContaining(['LASER', 'PARTIAL MANUAL']));
    expect(tinyLedMovingHeadWash.category).toBe('Moving head / Toy LED wash');
    expect(miniSpiderLight.category).toBe('LED effect / Mini spider derby');
    expect(eventLightingEl1000Rgb.tags).toEqual(expect.arrayContaining(['ILDA', 'SAFETY']));
  });

  it('keeps the small moving head manual-specific gobo and dim-mode ranges', () => {
    const mode = smallMovingHeadSpot.modes.find((candidate) => candidate.name === '11-channel mode');
    const gobo = mode?.channelData.find((channel) => channel.name === 'Gobo Wheel');
    const dimMode = mode?.channelData.find((channel) => channel.name === 'Dim Mode / Reset');

    expect(gobo?.ranges).toEqual(expect.arrayContaining([
      expect.objectContaining({ min: 64, max: 71, description: 'Gobo 1 jitter' }),
      expect.objectContaining({ min: 120, max: 127, description: 'Gobo 8 jitter' }),
    ]));
    expect(dimMode?.ranges).toEqual(expect.arrayContaining([
      expect.objectContaining({ min: 41, max: 60, description: 'TV dim mode' }),
      expect.objectContaining({ min: 61, max: 80, description: 'Building dim mode' }),
    ]));
  });

  it('keeps store and canvas adapters compatible with generated fixture images', () => {
    const withPhoto = toStoreFixtureTemplate(tinyLedMovingHeadWash);
    const laserPhoto = toCanvasFixtureTemplate(eventLightingEl1000Rgb);

    expect(withPhoto.photoUrl).toBe('/fixtures/ab-fix-007-tiny-led-moving-head-wash-generated.png');
    expect(withPhoto.modes?.[0].channels).toBe(13);
    expect(laserPhoto.photoUrl).toBe('/fixtures/ab-fix-009-event-lighting-el1000rgb-generated.png');
    expect(laserPhoto.modes?.[0].channels).toBe(16);
  });
});
