export type Apc40Model = 'apc40-mk1' | 'apc40-mk2';

export type Apc40Action =
  | { type: 'clip-launch'; model: Apc40Model; row: number; column: number; index: number }
  | { type: 'scene-launch'; model: Apc40Model; sceneIndex: number }
  | { type: 'track-select'; model: Apc40Model; trackIndex: number }
  | { type: 'track-stop'; model: Apc40Model; trackIndex: number }
  | { type: 'record'; model: Apc40Model }
  | { type: 'play'; model: Apc40Model }
  | { type: 'stop'; model: Apc40Model }
  | { type: 'clear-selection'; model: Apc40Model }
  | { type: 'shift'; model: Apc40Model };

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

function sceneLaunch(model: Apc40Model, note: number): Apc40Action | null {
  if (note >= 0x52 && note <= 0x56) {
    return { type: 'scene-launch', model, sceneIndex: note - 0x52 };
  }
  return null;
}

export function decodeApc40Message(message: MidiLikeMessage): Apc40Action | null {
  if (!isApc40Source(message.source) || !isButtonPress(message)) return null;
  const note = message.note;
  if (note === undefined) return null;

  const source = message.source || '';
  const model: Apc40Model = /\b(mk2|mkii|mk\s?ii|apc40ii)\b/i.test(source)
    ? 'apc40-mk2'
    : 'apc40-mk1';
  const trackIndex = Math.max(0, Math.min(7, Math.floor(message.channel ?? 0)));

  const scene = sceneLaunch(model, note);
  if (scene) return scene;

  if (note === 0x30) return { type: 'record', model };
  if (note === 0x33) return { type: 'track-select', model, trackIndex };
  if (note === 0x34) return { type: 'track-stop', model, trackIndex };
  if (note === 0x51) return { type: 'clear-selection', model };
  if (note === 0x5b) return { type: 'play', model };
  if (note === 0x5c) return { type: 'stop', model };
  if (note === 0x5d || note === 0x66) return { type: 'record', model };
  if (note === 0x62) return { type: 'shift', model };

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
