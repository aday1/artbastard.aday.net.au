import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetApc40ScreensaverForTests,
  getApc40ScreensaverConfig,
  setApc40ScreensaverConfig,
} from './apc40Screensaver';

describe('apc40Screensaver', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetApc40ScreensaverForTests();
  });

  it('defaults to enabled hidden-tab screensaver settings', () => {
    const config = getApc40ScreensaverConfig();

    expect(config.enabled).toBe(true);
    expect(config.rotateMs).toBe(8000);
    expect(config.speed).toBe(1);
    expect(config.patterns).toContain('plasma');
  });

  it('persists and clamps config values', () => {
    setApc40ScreensaverConfig({ enabled: false, rotateMs: 10, speed: 99 });
    __resetApc40ScreensaverForTests();
    const config = getApc40ScreensaverConfig();

    expect(config.enabled).toBe(false);
    expect(config.rotateMs).toBe(1500);
    expect(config.speed).toBe(4);
  });
});