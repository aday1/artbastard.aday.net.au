import { describe, expect, it } from 'vitest';
import { isRoliTouchForRole } from './roliRoleGuards';

describe('isRoliTouchForRole', () => {
  it('keeps colour-wheel touches out of the primary pan/tilt handler', () => {
    expect(isRoliTouchForRole({ role: 'colour-wheel' }, 'primary')).toBe(false);
  });

  it('keeps primary touches out of the colour wheel handler', () => {
    expect(isRoliTouchForRole({ role: 'primary' }, 'colour-wheel')).toBe(false);
  });

  it('requires explicit role data so untagged server touches do not fan out to every handler', () => {
    expect(isRoliTouchForRole({}, 'primary')).toBe(false);
  });
});
