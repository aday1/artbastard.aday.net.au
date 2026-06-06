import { describe, expect, it } from 'vitest';
import {
  fixtureLibraryEntries,
  getFixtureLibraryEntryByCatalogId,
  getFixtureLibraryEntryById,
  validateFixtureLibraryEntries,
} from '.';

describe('source-backed fixture library', () => {
  it('validates every canonical fixture entry', () => {
    expect(validateFixtureLibraryEntries(fixtureLibraryEntries)).toEqual([]);
  });

  it('exposes lookup helpers for fixture and catalog ids', () => {
    expect(getFixtureLibraryEntryById('laser-twinkler')?.catalogId).toBe('AB-FIX-001');
    expect(getFixtureLibraryEntryByCatalogId('AB-FIX-001')?.id).toBe('laser-twinkler');
  });

  it('keeps docs and gallery paths attached to imported hardware profiles', () => {
    fixtureLibraryEntries.forEach((entry) => {
      expect(entry.documentationPath).toMatch(/^DOCS\/fixtures\/AB-FIX-\d{3}/);
      expect(entry.photoUrl).toMatch(/^\/fixtures\//);
    });
  });
});

