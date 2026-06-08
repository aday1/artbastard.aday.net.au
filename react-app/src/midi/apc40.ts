export type Apc40Model = 'apc40-mk1' | 'apc40-mk2';

export type Apc40Action =
  | { type: 'clip-launch'; model: Apc40Model; row: number; column: number; index: number }
  | { type: 'scene-launch'; model: Apc40Model; sceneIndex: number }
  | { type: 'track-select'; model: Apc40Model; trackIndex: number }
  | { type: 'track-stop'; model: Apc40Model; trackIndex: number }
  | { type: 'multi-select-add'; model: Apc40Model; trackIndex: number }
  | { type: 'multi-select-solo'; model: Apc40Model; trackIndex: number }
  | { type: 'channel-fader'; model: Apc40Model; trackIndex: number; value: number }
  | { type: 'master-fader'; model: Apc40Model; value: number }
  | { type: 'crossfader'; model: Apc40Model; value: number }
  | { type: 'record'; model: Apc40Model }
  | { type: 'play'; model: Apc40Model }
  | { type: 'stop'; model: Apc40Model }
  | { type: 'clear-selection'; model: Apc40Model }
  | { type: 'shift'; model: Apc40Model }
  | { type: 'nav-fixture'; model: Apc40Model; direction: 'next' | 'prev' }
  | { type: 'nav-scene'; model: Apc40Model; direction: 'next' | 'prev' }
  | { type: 'select-all'; model: Apc40Model };

export interface MidiLikeMessage {
  channel?: number;
  note?: number;
  velocity?: number;
  value?: number;
  type?: string;
  _type?: string;
  source?: string;
  sourceTransport?: string;
}

const APC40_SOURCE = /\b(apc\s?40|apc40)\b/i;

export function isApc40Source(source?: string): boolean {
  return APC40_SOURCE.test(source || '');
}

function isButtonPress(message: MidiLikeMessage): boolean {
  const type = message.type || message._type;
  return type === 'noteon' && (message.velocity ?? message.value ?? 0) > 0;
}

function isCcMessage(message: MidiLikeMessage): boolean {
  const type = message.type || message._type;
  return type === 'cc' || type === 'controlchange';
}

function getController(message: MidiLikeMessage): number | undefined {
  // Project uses `controller` (see useBrowserMidi.ts:155, MidiVisualizer.tsx:12);
  // fall back to `note`/`value` defensively.
  const raw = (message as { controller?: number }).controller;
  if (raw !== undefined) return raw;
  return message.note;
}

function sceneLaunch(model: Apc40Model, note: number): Apc40Action | null {
  if (note >= 0x52 && note <= 0x56) {
    return { type: 'scene-launch', model, sceneIndex: note - 0x52 };
  }
  return null;
}

export function decodeApc40Message(message: MidiLikeMessage): Apc40Action | null {
  if (!isApc40Source(message.source)) return null;

  const source = message.source || '';
  const model: Apc40Model = /\b(mk2|mkii|mk\s?ii|apc40ii)\b/i.test(source)
    ? 'apc40-mk2'
    : 'apc40-mk1';
  const trackIndex = Math.max(0, Math.min(7, Math.floor(message.channel ?? 0)));

  if (isCcMessage(message)) {
    const controller = getController(message);
    const value = message.value ?? message.velocity ?? 0;
    if (controller === undefined) return null;
    if (controller === 0x07) {
      return { type: 'channel-fader', model, trackIndex, value };
    }
    if (controller === 0x0e && (message.channel ?? 0) === 0) {
      return { type: 'master-fader', model, value };
    }
    if (controller === 0x0f && (message.channel ?? 0) === 0) {
      return { type: 'crossfader', model, value };
    }
    return null;
  }

  if (!isButtonPress(message)) return null;
  const note = message.note;
  if (note === undefined) return null;

  const scene = sceneLaunch(model, note);
  if (scene) return scene;

  if (note === 0x31) return { type: 'multi-select-solo', model, trackIndex };
  if (note === 0x32) return { type: 'multi-select-add', model, trackIndex };
  if (note === 0x33) return { type: 'track-select', model, trackIndex };
  if (note === 0x34) return { type: 'track-stop', model, trackIndex };
  if (note === 0x51) return { type: 'clear-selection', model };
  if (note === 0x5b) return { type: 'play', model };
  if (note === 0x5c) return { type: 'stop', model };
  if (note === 0x5d || note === 0x66) return { type: 'record', model };
  if (note === 0x62) return { type: 'shift', model };
  // Navigation cluster (Up / Down arrows → cycle fixtures,
  // Left / Right arrows → cycle scenes). Note numbers match APC40 MK1
  // hardware: Up=0x5E, Down=0x5F, Left=0x60, Right=0x61.
  if (note === 0x5e) return { type: 'nav-fixture', model, direction: 'prev' };
  if (note === 0x5f) return { type: 'nav-fixture', model, direction: 'next' };
  if (note === 0x60) return { type: 'nav-scene', model, direction: 'prev' };
  if (note === 0x61) return { type: 'nav-scene', model, direction: 'next' };
  // Pan button (note 0x57) doubles as "select all fixtures" — easy to reach
  // and the APC40 hardware LED gives positive feedback when pressed.
  if (note === 0x57) return { type: 'select-all', model };

  if (model === 'apc40-mk1' && note >= 0x35 && note <= 0x39) {
    const row = note - 0x35;
    return {
      type: 'clip-launch',
      model,
      row,
      column: trackIndex,
      index: row * 8 + trackIndex,
    };
  }

  if (model === 'apc40-mk2' && note >= 0x00 && note <= 0x27) {
    const row = Math.floor(note / 8);
    const column = note % 8;
    return {
      type: 'clip-launch',
      model,
      row,
      column,
      index: note,
    };
  }

  return null;
}
