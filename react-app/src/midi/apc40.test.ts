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

  it('decodes record-arm, activator, solo, stop-all, and master-button rows', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 4,
      note: 0x30,
      velocity: 127,
    })).toEqual({
      type: 'record-arm',
      model: 'apc40-mk1',
      trackIndex: 4,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 2,
      note: 0x32,
      velocity: 127,
    })).toEqual({
      type: 'activator',
      model: 'apc40-mk1',
      trackIndex: 2,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 1,
      note: 0x31,
      velocity: 127,
    })).toEqual({
      type: 'solo-cue',
      model: 'apc40-mk1',
      trackIndex: 1,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 6,
      note: 0x33,
      velocity: 127,
    })).toEqual({
      type: 'track-select',
      model: 'apc40-mk1',
      trackIndex: 6,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 0,
      note: 0x51,
      velocity: 127,
    })).toEqual({
      type: 'stop-all-clips',
      model: 'apc40-mk1',
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 8,
      note: 0x33,
      velocity: 127,
    })).toEqual({
      type: 'master-button',
      model: 'apc40-mk1',
    });
  });

  it('decodes device control, cue level, and shift press/release', () => {
    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x12,
      value: 64,
    })).toEqual({
      type: 'device-control',
      model: 'apc40-mk1',
      slotIndex: 2,
      value: 64,
    });

    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x2f,
      value: 32,
    })).toEqual({
      type: 'cue-level',
      model: 'apc40-mk1',
      value: 32,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x62,
      velocity: 127,
    })).toEqual({
      type: 'shift',
      model: 'apc40-mk1',
      pressed: true,
    });

    expect(decodeApc40Message({
      _type: 'noteoff',
      source: 'Akai APC40',
      note: 0x62,
      velocity: 0,
    })).toEqual({
      type: 'shift',
      model: 'apc40-mk1',
      pressed: false,
    });
  });

  it('decodes transport play as a reserved transport control', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x5b,
      velocity: 127,
    })).toEqual({
      type: 'play',
      model: 'apc40-mk1',
    });
  });

  it('decodes APC40 Track Control encoders separately from encoder button selection aliases', () => {
    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x34,
      value: 74,
    })).toEqual({
      type: 'track-control',
      model: 'apc40-mk1',
      slotIndex: 4,
      value: 74,
    });

    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x3c,
      value: 127,
    })).toEqual({
      type: 'track-select',
      model: 'apc40-mk1',
      trackIndex: 4,
    });

    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x3c,
      value: 0,
    })).toBeNull();
  });
});
