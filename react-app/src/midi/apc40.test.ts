import { describe, expect, it } from 'vitest';
import { decodeApc40Message, isApc40Source } from './apc40';

describe('APC40 workflow decoder', () => {
  it('detects APC40 browser or server MIDI source names', () => {
    expect(isApc40Source('Akai APC40')).toBe(true);
    expect(isApc40Source('APC 40 mkII Control')).toBe(true);
    expect(isApc40Source('Browser MIDI')).toBe(false);
  });

  it('decodes original APC40 clip grid from note plus MIDI track channel', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 3,
      note: 0x36,
      velocity: 127,
    })).toEqual({
      type: 'clip-launch',
      model: 'apc40-mk1',
      row: 1,
      column: 3,
      index: 11,
    });
  });

  it('decodes APC40 mkII clip grid from direct note numbers', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40 mkII',
      channel: 0,
      note: 0x12,
      velocity: 100,
    })).toEqual({
      type: 'clip-launch',
      model: 'apc40-mk2',
      row: 2,
      column: 2,
      index: 18,
    });
  });

  it('decodes scene launch buttons', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'APC40 mkII',
      note: 0x54,
      velocity: 1,
    })).toEqual({
      type: 'scene-launch',
      model: 'apc40-mk2',
      sceneIndex: 2,
    });
  });
});

