import { describe, expect, it } from 'vitest';
import { MIDI_CONTROLLER_TEMPLATES, detectTemplateForMidiInterface, getTemplateById } from './midiControllerTemplates';

describe('midiControllerTemplates', () => {
  it('provides X-Touch Mackie template with pitch mappings for channels 1-8', () => {
    const template = getTemplateById('x_touch_mackie');
    expect(template).toBeDefined();
    expect(template?.mappings[0]).toEqual({ channel: 0, pitch: true });
    expect(template?.mappings[7]).toEqual({ channel: 7, pitch: true });
    expect(Object.keys(template?.mappings || {})).toHaveLength(8);
  });

  it('provides APC40 MK1 SuperControl fallback mappings for faders and Device Control', () => {
    const template = getTemplateById('apc40_mk1');
    expect(template).toBeDefined();
    expect(Object.keys(template?.mappings || {})).toHaveLength(0);

    const faders = template?.superControlMappings?.filter((binding) => binding.controlName === 'dimmer') ?? [];
    expect(faders).toHaveLength(8);
    expect(faders[0]).toMatchObject({ channel: 0, controller: 7, slotIndex: 0 });
    expect(faders[7]).toMatchObject({ channel: 7, controller: 7, slotIndex: 7 });

    const deviceRoles = template?.superControlMappings?.filter((binding) =>
      binding.controller !== undefined && binding.controller >= 16 && binding.controller <= 23
    ) ?? [];
    expect(deviceRoles.map((binding) => binding.controlName)).toEqual([
      'gobo',
      'gobo_rotation',
      'color_wheel',
      'prism',
      'iris',
      'focus',
      'zoom',
      'strobe',
    ]);
    expect(template?.superControlMappings?.some((binding) => binding.controller === 47)).toBe(false);
    expect(template?.superControlMappings?.some((binding) => binding.controller === 15)).toBe(false);
  });

  it('detects templates by interface name hints', () => {
    expect(detectTemplateForMidiInterface('X-TOUCH INT')).toBe('x_touch_mackie');
    expect(detectTemplateForMidiInterface('APC40 mk1')).toBe('apc40_mk1');
    expect(detectTemplateForMidiInterface('Unknown Controller')).toBeNull();
  });

  it('publishes both built-in templates', () => {
    const ids = MIDI_CONTROLLER_TEMPLATES.map((template) => template.id);
    expect(ids).toEqual(expect.arrayContaining(['x_touch_mackie', 'apc40_mk1']));
  });
});
