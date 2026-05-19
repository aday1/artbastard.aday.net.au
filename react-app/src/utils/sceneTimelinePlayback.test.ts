import { describe, expect, it } from 'vitest';
import {
  computeSceneTimelineDmxUpdates,
  getEffectiveTimelineDuration,
  interpolateTimelineValue,
} from './sceneTimelinePlayback';
import type { SceneTimeline } from '../store';

const baseTimeline = (overrides: Partial<SceneTimeline> = {}): SceneTimeline => ({
  enabled: true,
  duration: 10000,
  loop: false,
  keyframes: [
    {
      id: 'a',
      time: 0,
      channelValues: { 0: 0 },
      easing: 'linear',
    },
    {
      id: 'b',
      time: 10000,
      channelValues: { 0: 255 },
      easing: 'linear',
    },
  ],
  ...overrides,
});

describe('sceneTimelinePlayback', () => {
  it('interpolates linearly at midpoint', () => {
    expect(interpolateTimelineValue(0, 255, 0.5, 'linear')).toBe(128);
  });

  it('respects BPM-synced duration', () => {
    const timeline = baseTimeline({ syncToBpm: true, bpmMultiplier: 4 });
    expect(getEffectiveTimelineDuration(timeline, 120)).toBe(2000);
  });

  it('computes channel updates with mute/solo lanes', () => {
    const timeline = baseTimeline({
      channelLanes: {
        0: { muted: false, soloed: true },
        1: { muted: false, soloed: false },
      },
      keyframes: [
        { id: 'a', time: 0, channelValues: { 0: 0, 1: 100 }, easing: 'linear' },
        { id: 'b', time: 10000, channelValues: { 0: 200, 1: 200 }, easing: 'linear' },
      ],
    });
    const updates = computeSceneTimelineDmxUpdates(timeline, 5000, 10000);
    expect(updates[0]).toBe(100);
    expect(updates[1]).toBeUndefined();
  });
});
