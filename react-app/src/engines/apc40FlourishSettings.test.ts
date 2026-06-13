import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetApc40FlourishSettingsForTests,
  DEFAULT_APC40_FLOURISH_PATTERNS,
  getApc40FlourishSettings,
  resolveApc40FlourishPattern,
  setApc40FlourishPattern,
  setApc40RandomFlourishes,
} from './apc40FlourishSettings';

describe('apc40FlourishSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetApc40FlourishSettingsForTests();
  });

  it('defaults to deterministic per-kind patterns', () => {
    const settings = getApc40FlourishSettings();

    expect(settings.random).toBe(false);
    expect(settings.patterns.fixtureSelect).toBe(DEFAULT_APC40_FLOURISH_PATTERNS.fixtureSelect);
    expect(resolveApc40FlourishPattern('fixtureSelect')).toBe(DEFAULT_APC40_FLOURISH_PATTERNS.fixtureSelect);
  });

  it('persists selected patterns', () => {
    setApc40FlourishPattern('fixtureSelect', 'wave');
    __resetApc40FlourishSettingsForTests();

    expect(getApc40FlourishSettings().patterns.fixtureSelect).toBe('wave');
    expect(resolveApc40FlourishPattern('fixtureSelect')).toBe('wave');
  });

  it('uses curated random mode only when enabled', () => {
    setApc40RandomFlourishes(true);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    expect(resolveApc40FlourishPattern('fixtureSelect')).toBe('snake');

    randomSpy.mockRestore();
  });

  it('falls back from invalid saved patterns', () => {
    window.localStorage.setItem('apc40-flourish-patterns-v1', JSON.stringify({
      random: false,
      patterns: { fixtureSelect: 'not-real' },
    }));
    __resetApc40FlourishSettingsForTests();

    expect(getApc40FlourishSettings().patterns.fixtureSelect).toBe(DEFAULT_APC40_FLOURISH_PATTERNS.fixtureSelect);
  });
});