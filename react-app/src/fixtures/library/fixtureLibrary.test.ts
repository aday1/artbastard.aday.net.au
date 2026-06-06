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
    [
      ['minibeam-moving-head', 'AB-FIX-002'],
      ['mini-led-moving-head-wash', 'AB-FIX-003'],
      ['uv-dmx-led-par', 'AB-FIX-004'],
      ['small-moving-head-spot', 'AB-FIX-005'],
      ['full-colour-animation-laser', 'AB-FIX-006'],
      ['tiny-led-moving-head-wash', 'AB-FIX-007'],
      ['mini-spider-light', 'AB-FIX-008'],
      ['event-lighting-el1000rgb', 'AB-FIX-009'],
    ].forEach(([id, catalogId]) => {
      expect(getFixtureLibraryEntryById(id)?.catalogId).toBe(catalogId);
      expect(getFixtureLibraryEntryByCatalogId(catalogId)?.id).toBe(id);
    });
  });

  it('keeps docs and gallery paths attached to imported hardware profiles', () => {
    fixtureLibraryEntries.forEach((entry) => {
      expect(entry.documentationPath).toMatch(/^DOCS\/fixtures\/AB-FIX-\d{3}/);
      if (entry.photoUrl) {
        expect(entry.photoUrl).toMatch(/^\/fixtures\//);
      }
    });
  });
});
