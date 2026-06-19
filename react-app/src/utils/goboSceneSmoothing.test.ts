import { describe, expect, it } from 'vitest';
import {
  findGoboSceneTransitionChannels,
  smoothGoboSceneTransitionValue,
} from './goboSceneSmoothing';

describe('goboSceneSmoothing', () => {
  const fixtures = [
    {
      startAddress: 11,
      channels: [
        { name: 'Dimmer', type: 'dimmer' },
        { name: 'Gobo Wheel', type: 'gobo' },
        { name: 'Gobo Rotation', type: 'gobo_rotation' },
      ],
    },
    {
      startAddress: 101,
      channels: [
        { name: 'Pattern Selection', type: 'other', dmxAddress: 130 },
      ],
    },
  ];

  it('finds gobo wheel and rotation channels separately', () => {
    const channels = findGoboSceneTransitionChannels(fixtures);

    expect([...channels.wheel].sort((a, b) => a - b)).toEqual([11, 129]);
    expect([...channels.rotation]).toEqual([12]);
  });

  it('holds gobo wheel values until the transition is almost complete', () => {
    const channels = findGoboSceneTransitionChannels(fixtures);

    expect(smoothGoboSceneTransitionValue(0, 160, 0.5, 0.5, 11, channels)).toBe(0);
    expect(smoothGoboSceneTransitionValue(0, 160, 0.89, 0.98, 11, channels)).toBe(0);
    expect(smoothGoboSceneTransitionValue(0, 160, 0.9, 0.99, 11, channels)).toBe(160);
  });

  it('ramps gobo rotation late instead of immediately spinning', () => {
    const channels = findGoboSceneTransitionChannels(fixtures);

    expect(smoothGoboSceneTransitionValue(0, 180, 0.25, 0.4, 12, channels)).toBe(0);
    expect(smoothGoboSceneTransitionValue(0, 180, 0.7, 0.85, 12, channels)).toBeGreaterThan(0);
    expect(smoothGoboSceneTransitionValue(0, 180, 1, 1, 12, channels)).toBe(180);
  });

  it('leaves non-gobo channels on the normal eased transition', () => {
    const channels = findGoboSceneTransitionChannels(fixtures);

    expect(smoothGoboSceneTransitionValue(0, 200, 0.5, 0.25, 10, channels)).toBe(50);
  });
});
