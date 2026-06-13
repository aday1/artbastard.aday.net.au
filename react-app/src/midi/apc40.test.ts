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

  it('maps all Scene Launch buttons to ACT indexes 1-5', () => {
    for (let sceneIndex = 0; sceneIndex < 5; sceneIndex += 1) {
      expect(decodeApc40Message({
        _type: 'noteon',
        source: 'Akai APC40',
        note: 0x52 + sceneIndex,
        velocity: 127,
      })).toEqual({
        type: 'scene-launch',
        model: 'apc40-mk1',
        sceneIndex,
      });
    }
  });

  it('decodes solo-group, activator, solo-cue, stop-all, and freeze-dmx rows', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 4,
      note: 0x30,
      velocity: 127,
    })).toEqual({
      type: 'solo-group',
      model: 'apc40-mk1',
      trackIndex: 4,
      pressed: true,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 4,
      note: 0x30,
      velocity: 0,
    })).toEqual({
      type: 'solo-group',
      model: 'apc40-mk1',
      trackIndex: 4,
      pressed: false,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 2,
      note: 0x32,
      velocity: 127,
    })).toEqual({
      type: 'select-group',
      model: 'apc40-mk1',
      trackIndex: 2,
      pressed: true,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 1,
      note: 0x31,
      velocity: 127,
    })).toEqual({
      type: 'select-fixture',
      model: 'apc40-mk1',
      trackIndex: 1,
      pressed: true,
    });

    // Track Select row (note 0x33) is intentionally unmapped on channels 0-7
    // since APC40 hardware emits unreliable CCs in some modes.
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 6,
      note: 0x33,
      velocity: 127,
    })).toBeNull();

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

    // Master Select (note 0x33, channel 8) toggles the DMX FREEZE latch.
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 8,
      note: 0x33,
      velocity: 127,
    })).toEqual({
      type: 'toggle-freeze-dmx',
      model: 'apc40-mk1',
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      channel: 8,
      note: 0x33,
      velocity: 0,
    })).toEqual({
      type: 'toggle-freeze-dmx',
      model: 'apc40-mk1',
    });
  });

  it('maps every Record Arm button to its matching solo-group column', () => {
    for (let channel = 0; channel < 8; channel += 1) {
      expect(decodeApc40Message({
        _type: 'noteon',
        source: 'Akai APC40',
        channel,
        note: 0x30,
        velocity: 127,
      })).toEqual({
        type: 'solo-group',
        model: 'apc40-mk1',
        trackIndex: channel,
        pressed: true,
      });
    }
  });

  it('decodes SEND A/B/C as modular automation toggles', () => {
    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x58,
      velocity: 127,
    })).toEqual({
      type: 'toggle-color-auto',
      model: 'apc40-mk1',
      pressed: true,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x58,
      velocity: 0,
    })).toEqual({
      type: 'toggle-color-auto',
      model: 'apc40-mk1',
      pressed: false,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x59,
      velocity: 127,
    })).toEqual({
      type: 'toggle-pan-tilt-auto',
      model: 'apc40-mk1',
      pressed: true,
    });

    expect(decodeApc40Message({
      _type: 'noteon',
      source: 'Akai APC40',
      note: 0x5a,
      velocity: 127,
    })).toEqual({
      type: 'toggle-effect-auto',
      model: 'apc40-mk1',
      pressed: true,
    });
  });

  it('decodes APC40 utility buttons used by ArtBastard healthcheck', () => {
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x3a, velocity: 127 })).toEqual({
      type: 'full-on', model: 'apc40-mk1', pressed: true,
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x3b, velocity: 0 })).toEqual({
      type: 'blackout', model: 'apc40-mk1', pressed: false,
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x3e, velocity: 127 })).toEqual({
      type: 'freeze-dmx', model: 'apc40-mk1', pressed: true,
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x3f, velocity: 127 })).toEqual({
      type: 'record', model: 'apc40-mk1',
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x40, velocity: 127 })).toEqual({
      type: 'stop-all-clips', model: 'apc40-mk1',
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 0, note: 0x41, velocity: 127 })).toEqual({
      type: 'tap-tempo', model: 'apc40-mk1',
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 8, note: 0x33, velocity: 127 })).toEqual({
      type: 'toggle-freeze-dmx', model: 'apc40-mk1',
    });
    expect(decodeApc40Message({ _type: 'noteon', source: 'Akai APC40', channel: 8, note: 0x33, velocity: 0 })).toEqual({
      type: 'toggle-freeze-dmx', model: 'apc40-mk1',
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

    // CC 0x3c (formerly track-encoder-press alias) is unmapped now.
    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x3c,
      value: 127,
    })).toBeNull();

    expect(decodeApc40Message({
      _type: 'cc',
      source: 'Akai APC40',
      channel: 0,
      controller: 0x3c,
      value: 0,
    })).toBeNull();
  });
});
