import { describe, expect, it } from 'vitest';
import {
  disableModularAutomationFlags,
  isClientSceneTransitionActive,
  modularAutomationModulesToStart,
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

  it('disables modular automation flags without dropping config', () => {
    const disabled = disableModularAutomationFlags({
      color: { enabled: true },
      dimmer: { enabled: true },
      panTilt: { enabled: false },
      effects: { enabled: true },
    });
    expect(disabled.color.enabled).toBe(false);
    expect(disabled.effects.enabled).toBe(false);
  });

  it('lists enabled modular automation modules to restart', () => {
    expect(
      modularAutomationModulesToStart({
        color: { enabled: true },
        dimmer: { enabled: false },
        panTilt: { enabled: true },
        effects: { enabled: false },
      })
    ).toEqual(['color', 'panTilt']);
  });
});
