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

  it('keeps store and canvas adapters compatible with photo and no-photo entries', () => {
    const withPhoto = toStoreFixtureTemplate(tinyLedMovingHeadWash);
    const withoutPhoto = toCanvasFixtureTemplate(eventLightingEl1000Rgb);

    expect(withPhoto.photoUrl).toBe('/fixtures/ab-fix-007-tiny-led-moving-head-wash.jpg');
    expect(withPhoto.modes?.[0].channels).toBe(13);
    expect(withoutPhoto.photoUrl).toBeUndefined();
    expect(withoutPhoto.modes?.[0].channels).toBe(16);
  });
});
