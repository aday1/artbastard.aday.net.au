import { MidiMapping } from '../../store';

export type MidiControllerTemplateId = 'x_touch_mackie' | 'apc40_mk1';

export interface MidiControllerTemplateDefinition {
  id: MidiControllerTemplateId;
  title: string;
  description: string;
  details: string;
  mappings: Record<number, MidiMapping>;
}

const buildXTouchMappings = (): Record<number, MidiMapping> => {
  const mappings: Record<number, MidiMapping> = {};
  for (let dmxChannel = 0; dmxChannel < 8; dmxChannel++) {
    mappings[dmxChannel] = {
      channel: dmxChannel,
      pitch: true,
    };
  }
  return mappings;
};

const buildApc40Mappings = (): Record<number, MidiMapping> => {
  const mappings: Record<number, MidiMapping> = {};
  for (let dmxChannel = 0; dmxChannel < 8; dmxChannel++) {
    mappings[dmxChannel] = {
      channel: dmxChannel,
      controller: 7,
    };
  }
  return mappings;
};

export const MIDI_CONTROLLER_TEMPLATES: MidiControllerTemplateDefinition[] = [
  {
    id: 'x_touch_mackie',
    title: 'Behringer X-Touch (Mackie Control)',
    description: 'Maps X-Touch motorized faders in Mackie mode to DMX channels 1-8.',
    details: 'Uses pitch-bend fader messages and updates scribble strips on supported outputs.',
    mappings: buildXTouchMappings(),
  },
  {
    id: 'apc40_mk1',
    title: 'Akai APC40 MK1',
    description: 'Maps APC40 track faders to DMX channels 1-8.',
    details: 'Uses CC7 on MIDI channels 1-8 for quick channel-level control.',
    mappings: buildApc40Mappings(),
  },
];

export const detectTemplateForMidiInterface = (interfaceName: string): MidiControllerTemplateId | null => {
  const normalized = interfaceName.toLowerCase();
  if (normalized.includes('x-touch') || normalized.includes('x touch') || normalized.includes('xtouch')) {
    return 'x_touch_mackie';
  }
  if (normalized.includes('apc40') || normalized.includes('apc 40')) {
    return 'apc40_mk1';
  }
  return null;
};

export const getTemplateById = (templateId: MidiControllerTemplateId): MidiControllerTemplateDefinition | undefined =>
  MIDI_CONTROLLER_TEMPLATES.find((template) => template.id === templateId);
