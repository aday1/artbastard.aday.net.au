import { describe, expect, it } from 'vitest';
import {
  dimmerFadeLevel,
  dimmerFadeUpdates,
  findDimmerFadeTargets,
} from './dimmerFade';

describe('dimmerFade', () => {
  const fixtures = [
    {
      name: 'Wash 1',
      startAddress: 1,
      channels: [
        { name: 'Dimmer', type: 'dimmer' },
        { name: 'Red', type: 'red' },
        { name: 'Strobe', type: 'strobe' },
      ],
    },
    {
      name: 'Mover 1',
      startAddress: 21,
      channels: [
        { name: 'Pan', type: 'pan' },
        { name: 'Main Intensity', type: 'other' },
        { name: 'Tilt', type: 'tilt' },
      ],
    },
    {
      name: 'Override',
      startAddress: 100,
      channels: [
        { name: 'Master', type: 'other', dmxAddress: 512 },
      ],
    },
  ];

  it('finds dimmer, intensity, and master channels without including strobe', () => {
    expect(findDimmerFadeTargets(fixtures)).toEqual([
      { dmxAddress: 0, fixtureName: 'Wash 1', channelName: 'Dimmer' },
      { dmxAddress: 21, fixtureName: 'Mover 1', channelName: 'Main Intensity' },
      { dmxAddress: 511, fixtureName: 'Override', channelName: 'Master' },
    ]);
  });

  it('samples a smooth breath waveform', () => {
    expect(dimmerFadeLevel('breath', 0)).toBeCloseTo(0);
    expect(dimmerFadeLevel('breath', 0.25)).toBeCloseTo(0.5);
    expect(dimmerFadeLevel('breath', 0.5)).toBeCloseTo(1);
    expect(dimmerFadeLevel('breath', 0.75)).toBeCloseTo(0.5);
  });

  it('samples a descending saw waveform', () => {
    expect(dimmerFadeLevel('saw', 0)).toBeCloseTo(1);
    expect(dimmerFadeLevel('saw', 0.25)).toBeCloseTo(0.75);
    expect(dimmerFadeLevel('saw', 0.5)).toBeCloseTo(0.5);
    expect(dimmerFadeLevel('saw', 0.75)).toBeCloseTo(0.25);
  });

  it('builds clamped DMX updates for all dimmer fade targets', () => {
    expect(dimmerFadeUpdates(fixtures, 288)).toEqual({
      0: 255,
      21: 255,
      511: 255,
    });
  });
});
