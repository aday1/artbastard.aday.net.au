import { describe, expect, it } from 'vitest';
import { type DmxActivityMessage, mergeDmxActivityMessages } from './dmxActivityMessages';

function message(overrides: Partial<DmxActivityMessage>): DmxActivityMessage {
  return {
    id: `${overrides.timestamp ?? 1000}-${overrides.channel ?? 0}`,
    timestamp: overrides.timestamp ?? 1000,
    firstTimestamp: overrides.firstTimestamp ?? overrides.timestamp ?? 1000,
    channel: overrides.channel ?? 0,
    value: overrides.value ?? 0,
    previousValue: overrides.previousValue ?? 0,
    summary: overrides.summary ?? 'Fixture Dimmer changed 0 -> 1',
    detail: overrides.detail ?? 'CH 1',
    roleLabel: overrides.roleLabel ?? 'Dimmer',
    fixtureName: overrides.fixtureName ?? 'Fixture',
    repeatCount: overrides.repeatCount ?? 1,
  };
}

describe('mergeDmxActivityMessages', () => {
  it('coalesces rapid repeated updates for the same fixture channel', () => {
    const first = message({ timestamp: 1000, channel: 23, value: 10, previousValue: 0 });
    const repeated = message({
      timestamp: 1100,
      channel: 23,
      value: 64,
      previousValue: 10,
      summary: 'Fixture Gobo changed 10 -> 64',
    });

    const result = mergeDmxActivityMessages([first], [repeated]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: first.id,
      timestamp: 1100,
      firstTimestamp: 1000,
      value: 64,
      summary: 'Fixture Gobo changed 10 -> 64',
      repeatCount: 2,
    });
  });

  it('keeps separate rows for different channels or old changes', () => {
    const first = message({ timestamp: 1000, channel: 23 });
    const differentChannel = message({ timestamp: 1100, channel: 24 });
    const oldRepeat = message({ timestamp: 7001, channel: 23 });

    const result = mergeDmxActivityMessages([first], [differentChannel, oldRepeat]);

    expect(result).toHaveLength(3);
  });
});
