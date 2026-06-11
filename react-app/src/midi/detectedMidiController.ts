import { detectTemplateForMidiInterface, MidiControllerTemplateId } from '../components/midi/midiControllerTemplates';

export type DetectedMidiControllerKind = 'apc40' | 'roli-lightpad';
export type DetectedMidiTransport = 'browser' | 'server';

export interface DetectedMidiController {
  id: string;
  name: string;
  kind: DetectedMidiControllerKind;
  transport: DetectedMidiTransport;
  templateId: MidiControllerTemplateId | null;
}

export const MIDI_CONTROLLER_DETECTED_EVENT = 'artbastard:midi-controller-detected';
export const MIDI_CONTROLLER_CONNECTED_EVENT = 'artbastard:midi-controller-connected';
export const MIDI_CONNECT_BROWSER_EVENT = 'artbastard:connect-browser-midi';
export const MIDI_CONNECT_SERVER_EVENT = 'artbastard:connect-server-midi';
export const MIDI_CONNECT_ROLI_EVENT = 'artbastard:connect-roli-lightpad';
export const ROLI_LIGHTPAD_CONNECT_APPROVED_KEY = 'artbastard:roli-lightpad-connect-approved';

export const detectMidiControllerKind = (interfaceName: string): DetectedMidiControllerKind | null => {
  const normalized = interfaceName.toLowerCase();
  if (normalized.includes('apc40') || normalized.includes('apc 40')) return 'apc40';
  if (
    normalized.includes('roli') ||
    normalized.includes('lightpad') ||
    normalized.includes('block') ||
    normalized.includes('seaboard')
  ) {
    return 'roli-lightpad';
  }
  return null;
};

export const describeDetectedMidiController = (
  name: string,
  transport: DetectedMidiTransport,
  id = name,
): DetectedMidiController | null => {
  const kind = detectMidiControllerKind(name);
  if (!kind) return null;
  return {
    id,
    name,
    kind,
    transport,
    templateId: detectTemplateForMidiInterface(name),
  };
};

export const detectedMidiControllerLabel = (kind: DetectedMidiControllerKind): string => {
  if (kind === 'apc40') return 'Akai APC40';
  return 'ROLI Lightpad BLOCK';
};

export const detectedMidiControllerAction = (kind: DetectedMidiControllerKind): string => {
  if (kind === 'apc40') return 'Connect APC40';
  return 'Connect ROLI';
};

export const detectedMidiControllerMessage = (kind: DetectedMidiControllerKind): string => {
  if (kind === 'apc40') {
    return 'Deck A/B scenes, ACT launch, recording, automation, and APC LEDs can be mapped now.';
  }
  return 'Use the Lightpad for pan/tilt XY control and LED feedback.';
};

export const dispatchDetectedMidiController = (controller: DetectedMidiController): void => {
  window.dispatchEvent(new CustomEvent<DetectedMidiController>(MIDI_CONTROLLER_DETECTED_EVENT, { detail: controller }));
};

export const dispatchConnectedMidiController = (controller: DetectedMidiController): void => {
  window.dispatchEvent(new CustomEvent<DetectedMidiController>(MIDI_CONTROLLER_CONNECTED_EVENT, { detail: controller }));
};
