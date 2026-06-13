import { describe, expect, it } from 'vitest';
import {
  mergeFixtureTemplatesWithCatalog,
  refreshFixtureCatalogPhotos,
} from './fixtureCatalogSync';
import type { Fixture, FixtureTemplate } from './types';

describe('fixture catalog sync', () => {
  it('keeps current built-in catalog profiles authoritative over stale persisted copies', () => {
    const staleBuiltIn: FixtureTemplate = {
      id: 'laser-twinkler',
      catalogId: 'AB-FIX-001',
      templateName: 'Old Laser',
      defaultNamePrefix: 'Laser',
      isBuiltIn: true,
      photoUrl: '/fixtures/ab-fix-001-twinkling-laser-rgy.jpg',
      channels: [{ name: 'Channel 1', type: 'macro' }],
    };
    const custom: FixtureTemplate = {
      id: 'custom-test',
      templateName: 'Custom Test',
      defaultNamePrefix: 'Custom',
      isBuiltIn: false,
      isCustom: true,
      photoUrl: 'data:image/png;base64,custom',
      channels: [{ name: 'Channel 1', type: 'other' }],
    };

    const merged = mergeFixtureTemplatesWithCatalog([staleBuiltIn, custom]);

    expect(merged.find((template) => template.id === 'laser-twinkler')?.photoUrl)
      .toBe('/fixtures/ab-fix-001-twinkling-laser-rgy-generated.png');
    expect(merged.find((template) => template.id === 'custom-test')?.photoUrl)
      .toBe('data:image/png;base64,custom');
  });

  it('refreshes old fixture photo URLs created from catalog templates', () => {
    const fixture: Fixture = {
      id: 'fixture-1',
      name: 'Mini Wash 1',
      type: 'Moving Head Wash',
      templateId: 'mini-led-moving-head-wash',
      startAddress: 1,
      channels: [{ name: 'Dimmer', type: 'dimmer' }],
      photoUrl: '/fixtures/ab-fix-003-mini-led-moving-head-wash.jpg',
    };

    const refreshed = refreshFixtureCatalogPhotos([fixture]);

    expect(refreshed[0].photoUrl)
      .toBe('/fixtures/ab-fix-003-mini-led-moving-head-wash-generated.png');
  });

  it('does not overwrite custom data-url fixture photos', () => {
    const fixture: Fixture = {
      id: 'fixture-1',
      name: 'Mini Wash 1',
      type: 'Moving Head Wash',
      templateId: 'mini-led-moving-head-wash',
      startAddress: 1,
      channels: [{ name: 'Dimmer', type: 'dimmer' }],
      photoUrl: 'data:image/png;base64,custom',
    };

    const refreshed = refreshFixtureCatalogPhotos([fixture]);

    expect(refreshed[0].photoUrl).toBe('data:image/png;base64,custom');
  });
});
