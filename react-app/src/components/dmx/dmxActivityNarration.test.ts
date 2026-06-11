import { describe, expect, it } from 'vitest';
import type { Fixture, Group } from '../../store';
import { describeApc40DmxSource, narrateDmxChange } from './dmxActivityNarration';

const fixtures: Fixture[] = [
  {
    id: 'wash-1',
    name: 'Front Wash',
    type: 'wash',
    startAddress: 1,
    channels: [
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Red', type: 'red', ranges: [{ min: 128, max: 255, description: 'hot red' }] },
    ],
  },
  {
    id: 'spot-1',
    name: 'Back Spot',
    type: 'spot',
    startAddress: 101,
    channels: [
      { name: 'Pan', type: 'pan' },
      { name: 'Gobo Wheel', type: 'gobo', ranges: [{ min: 30, max: 40, description: 'dots' }] },
    ],
  },
];

const groups: Group[] = [
  {
    id: 'group-1',
    name: 'Movers',
    fixtureIndices: [1],
    lastStates: [],
    isMuted: false,
    isSolo: false,
    masterValue: 255,
  },
];

describe('dmxActivityNarration', () => {
  it('describes fixture, role, group, selection, and source for a changed DMX channel', () => {
    const narration = narrateDmxChange({
      channel: 100,
      previousValue: 0,
      value: 64,
      channelNames: [],
      fixtures,
      groups,
      selectedFixtures: ['spot-1'],
      sourceLabel: 'APC40 Track Control 1: Pan',
    });

    expect(narration.summary).toBe('Back Spot Pan moved 0 -> 64');
    expect(narration.detail).toContain('CH 101');
    expect(narration.detail).toContain('in "Movers"');
    expect(narration.detail).toContain('targeting selected group "Movers"');
    expect(narration.detail).toContain('APC40 Track Control 1: Pan');
  });

  it('includes fixture range descriptions when values land in named ranges', () => {
    const narration = narrateDmxChange({
      channel: 101,
      previousValue: 0,
      value: 36,
      channelNames: [],
      fixtures,
      groups,
      selectedFixtures: ['spot-1'],
    });

    expect(narration.summary).toBe('Back Spot Gobo changed gobo 0 -> 36 (dots)');
  });

  it('falls back cleanly for unpatched raw channels', () => {
    const narration = narrateDmxChange({
      channel: 9,
      previousValue: 0,
      value: 255,
      channelNames: ['Dimmer'],
      fixtures,
      groups,
      selectedFixtures: [],
    });

    expect(narration.summary).toBe('CH 10 changed 0 -> 255');
    expect(narration.detail).toContain('no fixture patch match');
  });

  it('labels recent APC40 track and device controls', () => {
    const timestamp = Date.now();

    expect(describeApc40DmxSource({
      type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x30,
      value: 64,
      timestamp,
    })).toBe('APC40 Track Control 1: Pan');

    expect(describeApc40DmxSource({
      type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x12,
      value: 64,
      timestamp,
    }, ['Gobo', 'Gobo Rotate', 'Color Wheel'])).toBe('APC40 Device Control 3: Color Wheel');
  });

  it('prefers rich APC40 last-change context for DMX source labels', () => {
    const source = describeApc40DmxSource(undefined, [], {
      at: Date.now(),
      category: 'scene',
      controlLabel: 'Deck A clip 1',
      summary: 'Launched Deck A scene "APC40 Deck A 01"',
      sceneName: 'APC40 Deck A 01',
    });

    expect(source).toBe('APC40 Deck A clip 1: Launched Deck A scene "APC40 Deck A 01"');
  });
});
