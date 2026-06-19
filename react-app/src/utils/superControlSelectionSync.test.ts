import { describe, expect, it } from 'vitest';
import {
  readSuperControlChannelValue,
  readSuperControlValuesFromSelection,
} from './superControlSelectionSync';

describe('superControlSelectionSync', () => {
  const resolveChannel = (controlType: string, channels: Record<string, number>) => channels[controlType];

  it('reads the first matching control channel from affected fixtures', () => {
    const value = readSuperControlChannelValue(
      'dimmer',
      [{ dimmer: 3 }, { dimmer: 7 }],
      resolveChannel,
      (channel) => channel + 10
    );

    expect(value).toBe(13);
  });

  it('returns undefined when the selection has no matching control channel', () => {
    const value = readSuperControlChannelValue(
      'dimmer',
      [{ red: 0, green: 1, blue: 2 }],
      resolveChannel,
      () => 255
    );

    expect(value).toBeUndefined();
  });

  it('reads all available control values from the current selection', () => {
    const values = readSuperControlValuesFromSelection(
      [{ dimmer: 3, red: 0, green: 1, blue: 2 }],
      resolveChannel,
      (channel) => channel * 10
    );

    expect(values).toEqual({
      dimmer: 30,
      red: 0,
      green: 10,
      blue: 20,
    });
  });
});
