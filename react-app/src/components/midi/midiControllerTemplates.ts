import { MidiMapping } from '../../store';

export type MidiControllerTemplateId = 'x_touch_mackie' | 'apc40_mk1';

// SuperControl binding: a MIDI input bound to a SuperControl parameter
// (e.g. dimmer/pan/tilt/red/green/blue/gobo/shutter/strobe).
// slotIndex picks the Nth selected fixture; if undefined, applies to all selected.
export interface SuperControlBinding extends MidiMapping {
  controlName:
    | 'masterDimmer'
    | 'dimmer'
    | 'pan'
    | 'tilt'
    | 'fine_pan'
    | 'fine_tilt'
    | 'red'
    | 'green'
    | 'blue'
    | 'gobo'
    | 'shutter'
    | 'strobe'
    | 'lamp'
    | 'reset';
  slotIndex?: number;
  label?: string;
}

export interface MidiControllerTemplateDefinition {
  id: MidiControllerTemplateId;
  title: string;
  description: string;
  details: string;
  mappings: Record<number, MidiMapping>;
  superControlMappings?: SuperControlBinding[];
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

// APC40 abandons the raw-DMX-1-to-8 default in favour of SuperControl
// routing. Hardware buttons (grid / scenes / transport / track-select)
// are wired separately in useApc40Workflow.ts.
const buildApc40SuperControlMappings = (): SuperControlBinding[] => {
  const bindings: SuperControlBinding[] = [];

  // 8 track faders → per-slot dimmer (fader N controls Nth selected fixture)
  for (let trackIndex = 0; trackIndex < 8; trackIndex++) {
    bindings.push({
      controlName: 'dimmer',
      slotIndex: trackIndex,
      channel: trackIndex,
      controller: 7,
      label: `Track ${trackIndex + 1} Fader → Slot ${trackIndex + 1} Dimmer`,
    });
  }

  // Master fader → master dimmer (all selected fixtures)
  bindings.push({
    controlName: 'masterDimmer',
    channel: 0,
    controller: 14,
    label: 'Master Fader → Master Dimmer',
  });

  // Device knobs (top-right cluster, CC16-23 on ch0) → SuperControl params
  const knobMap: Array<{ cc: number; controlName: SuperControlBinding['controlName']; label: string }> = [
    { cc: 16, controlName: 'pan',     label: 'Device Knob 1 → Pan' },
    { cc: 17, controlName: 'tilt',    label: 'Device Knob 2 → Tilt' },
    { cc: 18, controlName: 'red',     label: 'Device Knob 3 → Red' },
    { cc: 19, controlName: 'green',   label: 'Device Knob 4 → Green' },
    { cc: 20, controlName: 'blue',    label: 'Device Knob 5 → Blue' },
    { cc: 21, controlName: 'gobo',    label: 'Device Knob 6 → Gobo' },
    { cc: 22, controlName: 'shutter', label: 'Device Knob 7 → Shutter' },
    { cc: 23, controlName: 'strobe',  label: 'Device Knob 8 → Strobe' },
  ];
  knobMap.forEach(({ cc, controlName, label }) => {
    bindings.push({ controlName, channel: 0, controller: cc, label });
  });

  // Crossfader → fine tilt; cue level → fine pan (handy for trim)
  bindings.push({ controlName: 'fine_tilt', channel: 0, controller: 15, label: 'Crossfader → Fine Tilt' });
  bindings.push({ controlName: 'fine_pan',  channel: 0, controller: 47, label: 'Cue Level Knob → Fine Pan' });

  return bindings;
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
    description: 'Drives SuperControl from the APC40: faders → per-fixture dimmer, knobs → pan/tilt/colour/gobo/shutter/strobe.',
    details: 'Track faders 1-8 control the Nth selected fixture\'s dimmer. Master fader is master dimmer. Device knobs drive pan/tilt/RGB/gobo/shutter/strobe across the selection. Grid/scenes/transport keep their existing roles.',
    mappings: {},
    superControlMappings: buildApc40SuperControlMappings(),
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
