import { describe, expect, it } from 'vitest';
import {
  isClientSceneTransitionActive,
  sceneTimelineStartDelayMs,
} from './sceneTransitionGuard';

describe('sceneTransitionGuard', () => {
  it('detects active client scene transitions', () => {
    expect(isClientSceneTransitionActive({ isTransitioning: true })).toBe(true);
    expect(isClientSceneTransitionActive({ isTransitioning: false })).toBe(false);
  });

  it('waits for the full scene crossfade before timeline playback', () => {
    expect(sceneTimelineStartDelayMs(0)).toBe(100);
    expect(sceneTimelineStartDelayMs(500)).toBe(550);
    expect(sceneTimelineStartDelayMs(2000)).toBe(2050);
  });
});
