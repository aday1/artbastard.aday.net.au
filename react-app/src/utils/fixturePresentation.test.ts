import { describe, expect, it } from 'vitest';
import {
  getFixtureIdentity,
  getFixtureTypeColor,
  getFixtureTypeIcon,
  getFixtureTypeKey,
} from './fixturePresentation';

describe('fixture presentation helpers', () => {
  it('normalizes common fixture type variants before selecting icons', () => {
    expect(getFixtureTypeKey('Moving Head Wash')).toBe('moving-head');
    expect(getFixtureTypeIcon('Moving Head Wash')).toBe('Move3D');
    expect(getFixtureTypeIcon('Moving Head Spot')).toBe('Move3D');
    expect(getFixtureTypeIcon('UV LED Par')).toBe('Aperture');
    expect(getFixtureTypeIcon('RGBW Wash')).toBe('Aperture');
    expect(getFixtureTypeIcon('LED Effect')).toBe('Sparkles');
    expect(getFixtureTypeIcon('Laser')).toBe('Crosshair');
  });

  it('keeps fixture color normalization in sync with icon normalization', () => {
    expect(getFixtureTypeColor('Moving Head Wash')).toBe(getFixtureTypeColor('moving-head'));
    expect(getFixtureTypeColor('Full Colour Animation Laser')).toBe(getFixtureTypeColor('laser'));
  });

  it('builds a compact identity from catalog, mode, and notes data', () => {
    const identity = getFixtureIdentity({
      name: 'Mini Wash 1',
      type: 'Moving Head Wash',
      manufacturer: 'Generic',
      model: 'Mini LED Moving Head',
      notes: 'Catalog: AB-FIX-003',
      mode: '14-channel mode',
      channels: new Array(14).fill({}),
      photoUrl: '/fixtures/ab-fix-003-mini-led-moving-head-wash-generated.png',
    });

    expect(identity.catalogId).toBe('AB-FIX-003');
    expect(identity.channelText).toBe('14ch');
    expect(identity.iconName).toBe('Move3D');
    expect(identity.shortCode).toBe('MW1');
    expect(identity.title).toContain('Mini Wash 1');
  });

  it('uses a non-lighting fallback for unknown profile types', () => {
    const identity = getFixtureIdentity({ name: 'Mystery Box', type: 'Unsorted Hardware' });

    expect(identity.typeKey).toBe('default');
    expect(identity.iconName).toBe('Box');
  });
});
