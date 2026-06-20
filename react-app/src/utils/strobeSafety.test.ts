import { describe, expect, it } from 'vitest';
import {
  applyStrobeSafetyToDmxValues,
  findStrobeSafetyTargets,
  strobeSafetyUpdates,
  strobeSafeValue,
} from './strobeSafety';

describe('strobeSafety', () => {
  it('prefers explicit no-strobe ranges', () => {
    expect(strobeSafeValue({
      name: 'Strobe',
      type: 'strobe',
      ranges: [
        { min: 0, max: 15, description: 'No strobe' },
        { min: 16, max: 255, description: 'Strobe slow to fast' },
      ],
    })).toBe(8);
  });

  it('uses open ranges for combined shutter/strobe channels', () => {
    const [target] = findStrobeSafetyTargets([{
      name: 'Mover',
      startAddress: 10,
      channels: [
        { name: 'Dimmer', type: 'dimmer' },
        {
          name: 'Shutter / Strobe',
          type: 'strobe',
          ranges: [
            { min: 0, max: 31, description: 'Shutter closed' },
            { min: 32, max: 63, description: 'Open' },
            { min: 64, max: 255, description: 'Strobe slow to fast' },
          ],
        },
      ],
    }]);

    expect(target.dmxAddress).toBe(10);
    expect(target.safeValue).toBe(48);
  });

  it('does not grab plain shutter channels', () => {
    const targets = findStrobeSafetyTargets([{
      name: 'Wash',
      startAddress: 1,
      channels: [
        { name: 'Shutter', type: 'shutter', ranges: [{ min: 0, max: 255, description: 'Open to closed' }] },
      ],
    }]);

    expect(targets).toHaveLength(0);
  });

  it('does not lock combined dimmer/shutter channels that mention strobe in sub-ranges', () => {
    const targets = findStrobeSafetyTargets([{
      name: 'Mini Wash',
      startAddress: 5,
      channels: [
        {
          name: 'Master Dimmer and Shutter',
          type: 'dimmer',
          ranges: [
            { min: 0, max: 7, description: 'Blackout / closed' },
            { min: 8, max: 134, description: 'Master dimmer' },
            { min: 135, max: 239, description: 'Strobe, slow to fast' },
            { min: 240, max: 255, description: 'Open' },
          ],
        },
      ],
    }]);

    expect(targets).toHaveLength(0);
  });

  it('creates update maps and clamps full DMX arrays', () => {
    const fixtures = [{
      name: 'Fixture',
      startAddress: 20,
      channels: [{ name: 'Strobe', type: 'strobe', ranges: [{ min: 0, max: 0, description: 'Off' }] }],
    }];
    const values = new Array(512).fill(255);

    expect(strobeSafetyUpdates(fixtures)).toEqual({ 19: 0 });
    expect(applyStrobeSafetyToDmxValues(fixtures, values)[19]).toBe(0);
  });
});
