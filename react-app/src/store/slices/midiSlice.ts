import { MidiMapping } from '../types';

export interface MidiSlice {
  // MIDI State
  midiInterfaces: string[];
  activeInterfaces: string[];
  midiMappings: Record<number, MidiMapping | undefined>;
  envelopeSpeedMidiMapping: MidiMapping | null;
  midiLearnTarget:
    | { type: 'masterSlider'; id: string }
    | { type: 'dmxChannel'; channelIndex: number }
    | { type: 'placedControl'; fixtureId: string; controlId: string }
    | { type: 'group'; groupId: string }
    | { type: 'superControl'; controlName: string }
    | { type: 'envelopeSpeed' }
    | { type: 'tempoPlayPause' }
    | { type: 'tapTempo' }
    | null;
  midiLearnScene: string | null;
  midiMessages: any[];
  midiActivity: number;

  // MIDI Actions
  startMidiLearn: (target: MidiSlice['midiLearnTarget']) => void;
  cancelMidiLearn: () => void;
  addMidiMessage: (message: any) => void;
  addMidiMapping: (dmxChannel: number, mapping: MidiMapping) => void;
  removeMidiMapping: (dmxChannel: number) => void;
  clearAllMidiMappings: () => void;
  setEnvelopeSpeedMidiMapping: (mapping: MidiMapping | null) => void;
  removeEnvelopeSpeedMidiMapping: () => void;
  setMidiInterfaces: (interfaces: string[]) => void;
  setActiveInterfaces: (interfaces: string[]) => void;
  setMidiActivity: (activity: number) => void;
}

export const createMidiSlice = (set: any, get: any): MidiSlice => ({
  midiInterfaces: [],
  activeInterfaces: [],
  midiMappings: {},
  envelopeSpeedMidiMapping: null,
  midiLearnTarget: null,
  midiLearnScene: null,
  midiMessages: [],
  midiActivity: 0,

  startMidiLearn: (target) => {
    set({ midiLearnTarget: target });
  },

  cancelMidiLearn: () => {
    set({ midiLearnTarget: null });
  },

  addMidiMessage: (message) => {
    const messages = [...get().midiMessages, message].slice(-1000);
    set({ midiMessages: messages });
  },

  addMidiMapping: (dmxChannel, mapping) => {
    const midiMappings = { ...get().midiMappings };
    midiMappings[dmxChannel] = mapping;
    set({ midiMappings, midiLearnTarget: null });
  },

  removeMidiMapping: (dmxChannel) => {
    const midiMappings = { ...get().midiMappings };
    delete midiMappings[dmxChannel];
    set({ midiMappings });
  },

  clearAllMidiMappings: () => {
    set({ midiMappings: {} });
  },

  setEnvelopeSpeedMidiMapping: (mapping) => {
    set({ envelopeSpeedMidiMapping: mapping });
  },

  removeEnvelopeSpeedMidiMapping: () => {
    set({ envelopeSpeedMidiMapping: null });
  },

  setMidiInterfaces: (interfaces) => {
    set({ midiInterfaces: interfaces });
  },

  setActiveInterfaces: (interfaces) => {
    set({ activeInterfaces: interfaces });
  },

  setMidiActivity: (activity) => {
    set({ midiActivity: activity });
  },
});

