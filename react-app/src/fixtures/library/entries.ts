import { laserTwinklingRgy } from './laserTwinklingRgy';
import { miniBeamMovingHead } from './miniBeamMovingHead';
import {
  eventLightingEl1000Rgb,
  fullColourAnimationLaser,
  miniLedMovingHeadWash,
  miniSpiderLight,
  smallMovingHeadSpot,
  tinyLedMovingHeadWash,
  uvDmxLedPar,
} from './importedFixtureBatch';
import type { FixtureLibraryEntry } from './types';

export const fixtureLibraryEntries: FixtureLibraryEntry[] = [
  laserTwinklingRgy,
  miniBeamMovingHead,
  miniLedMovingHeadWash,
  uvDmxLedPar,
  smallMovingHeadSpot,
  fullColourAnimationLaser,
  tinyLedMovingHeadWash,
  miniSpiderLight,
  eventLightingEl1000Rgb,
];

export function getFixtureLibraryEntryById(id: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.id === id);
}

export function getFixtureLibraryEntryByCatalogId(catalogId: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.catalogId === catalogId);
}
