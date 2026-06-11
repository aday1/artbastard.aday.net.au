import { describe, expect, it } from 'vitest';
import {
  describeDetectedMidiController,
  detectMidiControllerKind,
  detectedMidiControllerAction,
  detectedMidiControllerLabel,
} from './detectedMidiController';

describe('detected MIDI controller helpers', () => {
  it('recognizes APC40 controllers and attaches the APC template', () => {
    expect(detectMidiControllerKind('Akai APC40 mk1')).toBe('apc40');
    expect(detectMidiControllerKind('APC 40 mkII Control')).toBe('apc40');

    expect(describeDetectedMidiController('Akai APC40', 'server')).toEqual({
      id: 'Akai APC40',
      name: 'Akai APC40',
      kind: 'apc40',
      transport: 'server',
      templateId: 'apc40_mk1',
    });
  });

  it('recognizes ROLI Lightpad/BLOCK devices without applying an APC template', () => {
    expect(detectMidiControllerKind('ROLI Lightpad BLOCK')).toBe('roli-lightpad');
    expect(detectMidiControllerKind('Lightpad BLOCK 1')).toBe('roli-lightpad');

    expect(describeDetectedMidiController('ROLI Lightpad BLOCK', 'browser', 'roli-input')?.templateId).toBeNull();
    expect(detectedMidiControllerLabel('roli-lightpad')).toBe('ROLI Lightpad BLOCK');
    expect(detectedMidiControllerAction('roli-lightpad')).toBe('Connect ROLI');
  });

  it('ignores generic MIDI ports', () => {
    expect(detectMidiControllerKind('Browser MIDI')).toBeNull();
    expect(describeDetectedMidiController('LoopMIDI Port', 'browser')).toBeNull();
  });
});
