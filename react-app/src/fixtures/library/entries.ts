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
import {
  basicMovingHeadSpot,
  genericDimmer,
  rgbwParCan,
  simpleRgbPar,
} from './coreFixtureLibrary';
import { mdFixtureLibraryEntries } from './generated/mdFixtureLibraryEntries';
import type { FixtureLibraryEntry } from './types';

const legacyTsEntries: FixtureLibraryEntry[] = [
  laserTwinklingRgy,
  miniBeamMovingHead,
  miniLedMovingHeadWash,
  uvDmxLedPar,
  smallMovingHeadSpot,
  fullColourAnimationLaser,
  tinyLedMovingHeadWash,
  miniSpiderLight,
  eventLightingEl1000Rgb,
  genericDimmer,
  simpleRgbPar,
  rgbwParCan,
  basicMovingHeadSpot,
];

// MD-sourced entries (DOCS/fixtures/library/*.md) take precedence over legacy
// TS entries with the same id. Migrate hand-authored entries to MD over time;
// the merge keeps everything addressable until the TS files are removed.
const mdIds = new Set(mdFixtureLibraryEntries.map((entry) => entry.id));
export const fixtureLibraryEntries: FixtureLibraryEntry[] = [
  ...mdFixtureLibraryEntries,
  ...legacyTsEntries.filter((entry) => !mdIds.has(entry.id)),
];

export function getFixtureLibraryEntryById(id: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.id === id);
}

export function getFixtureLibraryEntryByCatalogId(catalogId: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.catalogId === catalogId);
}
