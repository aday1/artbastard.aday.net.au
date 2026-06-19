export type Apc40Model = 'apc40-mk1' | 'apc40-mk2';

export type Apc40Action =
  | { type: 'clip-launch'; model: Apc40Model; row: number; column: number; index: number }
  | { type: 'scene-launch'; model: Apc40Model; sceneIndex: number }
  | { type: 'select-fixture'; model: Apc40Model; trackIndex: number; pressed: boolean }
  | { type: 'select-group'; model: Apc40Model; trackIndex: number; pressed: boolean }
  | { type: 'color-wheel-slot'; model: Apc40Model; trackIndex: number }
  | { type: 'track-stop'; model: Apc40Model; trackIndex: number }
  | { type: 'activator'; model: Apc40Model; trackIndex: number }
  | { type: 'solo-cue'; model: Apc40Model; trackIndex: number }
  | { type: 'solo-group'; model: Apc40Model; trackIndex: number; pressed: boolean }
  | { type: 'channel-fader'; model: Apc40Model; trackIndex: number; value: number }
  | { type: 'master-fader'; model: Apc40Model; value: number }
  | { type: 'crossfader'; model: Apc40Model; value: number }
  | { type: 'device-control'; model: Apc40Model; slotIndex: number; value: number }
  | { type: 'track-control'; model: Apc40Model; slotIndex: number; value: number }
  | { type: 'cue-level'; model: Apc40Model; value: number }
  | { type: 'blackout'; model: Apc40Model; pressed: boolean }
  | { type: 'full-on'; model: Apc40Model; pressed: boolean }
  | { type: 'bank-prev'; model: Apc40Model }
  | { type: 'bank-next'; model: Apc40Model }
  | { type: 'stop-all-clips'; model: Apc40Model }
  | { type: 'record'; model: Apc40Model }
  | { type: 'play'; model: Apc40Model }
  | { type: 'stop'; model: Apc40Model }
  | { type: 'clear-selection'; model: Apc40Model }
  | { type: 'shift'; model: Apc40Model; pressed: boolean }
  | { type: 'nav-fixture'; model: Apc40Model; direction: 'next' | 'prev' }
  | { type: 'nav-scene'; model: Apc40Model; direction: 'next' | 'prev' }
  | { type: 'select-all'; model: Apc40Model; pressed: boolean }
  | { type: 'tap-tempo'; model: Apc40Model }
  | { type: 'nudge'; model: Apc40Model; direction: 'up' | 'down' }
  | { type: 'freeze-dmx'; model: Apc40Model; pressed: boolean }
  | { type: 'foot-freeze-dmx'; model: Apc40Model; pressed: boolean }
  | { type: 'toggle-freeze-dmx'; model: Apc40Model }
  | { type: 'toggle-color-auto'; model: Apc40Model; pressed: boolean }
  | { type: 'toggle-pan-tilt-auto'; model: Apc40Model; pressed: boolean }
  | { type: 'toggle-effect-auto'; model: Apc40Model; pressed: boolean };

export interface MidiLikeMessage {
  channel?: number;
  note?: number;
  velocity?: number;
  value?: number;
  controller?: number;
  type?: string;
  _type?: string;
  source?: string;
  sourceTransport?: string;
  timestamp?: number;
}

const APC40_SOURCE = /\b(apc\s?40|apc40)\b/i;

export function isApc40Source(source?: string): boolean {
  return APC40_SOURCE.test(source || '');
}

function isButtonPress(message: MidiLikeMessage): boolean {
  const type = message.type || message._type;
  return type === 'noteon' && (message.velocity ?? message.value ?? 0) > 0;
}

function isButtonRelease(message: MidiLikeMessage): boolean {
  const type = message.type || message._type;
  return type === 'noteoff' || (type === 'noteon' && (message.velocity ?? message.value ?? 0) === 0);
}

function isCcMessage(message: MidiLikeMessage): boolean {
  const type = message.type || message._type;
  return type === 'cc' || type === 'controlchange';
}

function isCcButtonPress(message: MidiLikeMessage): boolean {
  return isCcMessage(message) && (message.value ?? message.velocity ?? 0) > 0;
}

function getController(message: MidiLikeMessage): number | undefined {
  // Project uses `controller` (see useBrowserMidi.ts:155, MidiVisualizer.tsx:12);
  // fall back to `note`/`value` defensively.
  const raw = message.controller;
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

  // Opt-in raw logger: set `localStorage.apc40Debug = '1'` then watch console.
  // Helps diagnose mode/binding issues (e.g. Track Select emitting CC instead of Note).
  if (typeof localStorage !== 'undefined' && localStorage.getItem('apc40Debug') === '1') {
    // eslint-disable-next-line no-console
    console.log('[APC40-RAW]', {
      type: message.type ?? message._type,
      channel: message.channel,
      note: message.note,
      controller: message.controller,
      value: message.value ?? message.velocity,
      source: message.source,
    });
  }

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
    if (controller >= 0x10 && controller <= 0x17 && (message.channel ?? 0) === 0) {
      return { type: 'device-control', model, slotIndex: controller - 0x10, value };
    }
    // Track Control encoders rotate as CC 0x30-0x37 on channel 0.
    // (The press alias on CC 0x38-0x3f was removed when Track Select was unmapped.)
    if (controller >= 0x30 && controller <= 0x37 && (message.channel ?? 0) === 0) {
      return { type: 'track-control', model, slotIndex: controller - 0x30, value };
    }
    // CC 0x2f (Cue Level encoder): endless rotary, 2's-complement deltas.
    //   value 1..63   = CW step (forward intent)
    //   value 65..127 = CCW step (reverse intent)
    //   value 0 / 64  = no movement, ignored upstream
    if (controller === 0x2f && (message.channel ?? 0) === 0) {
      return { type: 'cue-level', model, value };
    }
    if (controller === 0x0e && (message.channel ?? 0) === 0) {
      return { type: 'master-fader', model, value };
    }
    if (controller === 0x0f && (message.channel ?? 0) === 0) {
      return { type: 'crossfader', model, value };
    }
    // APC40 footswitch input reports as sustain-style CC64. Treat it as
    // momentary freeze: pedal down freezes output, release resumes/flushed DMX.
    if (controller === 0x40) {
      return { type: 'foot-freeze-dmx', model, pressed: value >= 64 };
    }
    return null;
  }

  const note = message.note;
  if (note === undefined) return null;

  if (note === 0x62 && (isButtonPress(message) || isButtonRelease(message))) {
    return { type: 'shift', model, pressed: isButtonPress(message) };
  }

  const pressed = isButtonPress(message);
  const released = isButtonRelease(message);

  if (note === 0x30 && (pressed || released)) return { type: 'solo-group', model, trackIndex, pressed };
  // Solo/Cue row selects FIXTURES (formerly solo-isolation).
  if (note === 0x31 && (pressed || released)) return { type: 'select-fixture', model, trackIndex, pressed };
  // Activator row selects GROUPS (formerly auto-control toggle).
  if (note === 0x32 && (pressed || released)) return { type: 'select-group', model, trackIndex, pressed };
  // Device Control block stateful buttons.
  if (note === 0x3a && (message.channel ?? 0) === 0 && (pressed || released)) return { type: 'full-on', model, pressed };
  if (note === 0x3b && (message.channel ?? 0) === 0 && (pressed || released)) return { type: 'blackout', model, pressed };
  // Detail View remains an explicit ON/OFF freeze control.
  if (note === 0x3e && (message.channel ?? 0) === 0 && (pressed || released)) return { type: 'freeze-dmx', model, pressed };
  // Master Select is a latch-style FREEZE toggle: press once to freeze, press again to release.
  // In APC40 toggle modes, the second physical press may arrive as delayed velocity 0.
  if (note === 0x33 && (message.channel ?? 0) === 8 && (pressed || released)) return { type: 'toggle-freeze-dmx', model };
  if (note === 0x57 && (pressed || released)) return { type: 'select-all', model, pressed };
  if (note === 0x58 && (pressed || released)) return { type: 'toggle-color-auto', model, pressed };
  if (note === 0x59 && (pressed || released)) return { type: 'toggle-pan-tilt-auto', model, pressed };
  if (note === 0x5a && (pressed || released)) return { type: 'toggle-effect-auto', model, pressed };

  if (!pressed) return null;

  const scene = sceneLaunch(model, note);
  if (scene) return scene;

  if (note === 0x33 && trackIndex >= 0 && trackIndex <= 7) return { type: 'color-wheel-slot', model, trackIndex };
  if (note === 0x34) return { type: 'track-stop', model, trackIndex };
  // Device Control cluster (right side of APC40, channel 0):
  // 0x3A = Clip/Track toggle  → Full On latch
  // 0x3B = Device On/Off       → Blackout latch
  // 0x3C = Device Left         → previous device-knob bank
  // 0x3D = Device Right        → next device-knob bank
  // 0x3E = Detail View         → Freeze DMX latch
  // 0x3F = Rec Quantization    → REC/save-mode alias
  // 0x40 = MIDI Overdub        → Stop All Clips / panic stop alias
  // 0x41 = Metronome           → Tap Tempo alias
  if (note === 0x3c && (message.channel ?? 0) === 0) return { type: 'bank-prev', model };
  if (note === 0x3d && (message.channel ?? 0) === 0) return { type: 'bank-next', model };
  if (note === 0x3f && (message.channel ?? 0) === 0) return { type: 'record', model };
  if (note === 0x40 && (message.channel ?? 0) === 0) return { type: 'stop-all-clips', model };
  if (note === 0x41 && (message.channel ?? 0) === 0) return { type: 'tap-tempo', model };
  if (note === 0x51) return { type: 'stop-all-clips', model };
  if (note === 0x5b) return { type: 'play', model };
  if (note === 0x5c) return { type: 'stop', model };
  if (note === 0x5d || note === 0x66) return { type: 'record', model };
  // Navigation cluster (Up / Down arrows → cycle fixtures,
  // Left / Right arrows → cycle scenes). Note numbers match APC40 MK1
  // hardware: Up=0x5E, Down=0x5F, Left=0x60, Right=0x61.
  if (note === 0x5e) return { type: 'nav-fixture', model, direction: 'prev' };
  if (note === 0x5f) return { type: 'nav-fixture', model, direction: 'next' };
  if (note === 0x60) return { type: 'nav-scene', model, direction: 'prev' };
  if (note === 0x61) return { type: 'nav-scene', model, direction: 'next' };
  // SEND row toggles modular automation engines (unshifted = toggle on/off;
  // SHIFT-combo handled in the workflow hook cycles the engine pattern).
  //   SEND A (0x58) = color engine
  //   SEND B (0x59) = pan/tilt engine
  //   SEND C (0x5A) = effects engine

  // Transport block extras on APC40 MK1 hardware:
  //   0x63 = Tap Tempo
  //   0x64 = Nudge+ (faster)
  //   0x65 = Nudge- (slower)
  if (note === 0x63) return { type: 'tap-tempo', model };
  if (note === 0x64) return { type: 'nudge', model, direction: 'up' };
  if (note === 0x65) return { type: 'nudge', model, direction: 'down' };

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
