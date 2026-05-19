import { describe, expect, it, vi } from 'vitest';
import { captureChannelValues, sceneNameToOscPath } from './sceneCapture';

describe('sceneCapture', () => {
  it('builds OSC paths from scene names', () => {
    expect(sceneNameToOscPath('Warm Wash')).toBe('/scene/warm_wash');
    expect(sceneNameToOscPath('  ')).toBe('/scene/new');
  });

  it('captures channels using 0-based indexing through full channel count', () => {
    const getDmxChannelValue = vi.fn((channel: number) => {
      if (channel === 0) return 10;
      if (channel === 255) return 125;
      if (channel === 511) return 255;
      return 0;
    });

    const values = captureChannelValues(getDmxChannelValue, 512);

    expect(values).toHaveLength(512);
    expect(values[0]).toBe(10);
    expect(values[255]).toBe(125);
    expect(values[511]).toBe(255);
    expect(getDmxChannelValue).toHaveBeenCalledTimes(512);
    expect(getDmxChannelValue).toHaveBeenNthCalledWith(1, 0);
    expect(getDmxChannelValue).toHaveBeenLastCalledWith(511);
  });

  it('supports custom channel counts for narrow captures', () => {
    const getDmxChannelValue = vi.fn((channel: number) => channel + 1);
    const values = captureChannelValues(getDmxChannelValue, 4);

    expect(values).toEqual([1, 2, 3, 4]);
    expect(getDmxChannelValue).toHaveBeenCalledTimes(4);
    expect(getDmxChannelValue).toHaveBeenNthCalledWith(4, 3);
  });
});
