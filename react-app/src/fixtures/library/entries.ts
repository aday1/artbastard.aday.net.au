import { laserTwinklingRgy } from './laserTwinklingRgy';
import type { FixtureLibraryEntry } from './types';

export const fixtureLibraryEntries: FixtureLibraryEntry[] = [
  laserTwinklingRgy,
];

export function getFixtureLibraryEntryById(id: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.id === id);
}

export function getFixtureLibraryEntryByCatalogId(catalogId: string): FixtureLibraryEntry | undefined {
  return fixtureLibraryEntries.find((entry) => entry.catalogId === catalogId);
}

