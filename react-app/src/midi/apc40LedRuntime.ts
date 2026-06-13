import { APC40_GRID } from './generated';
import { safeMidiSend } from './midiOutputGuard';

export const APC40_CLIP_ROW_BASE = 0x35;
export const APC40_ACTIVATOR_NOTE = 0x32;
export const APC40_GRID_ROWS = APC40_GRID.rows;
export const APC40_GRID_COLS = APC40_GRID.cols;

const APC40_NAME_RE = /\b(apc\s?40|apc40)\b/i;

export type Apc40LedDirtyReason =
  | 'flourish-complete'
  | 'flourish-abort'
  | 'demoscene-stop'
  | 'screensaver-stop'
  | 'xy-crosshair-clear'
  | 'port-refresh'
  | 'manual'
  | string;

type DirtyListener = (reason: Apc40LedDirtyReason) => void;

const dirtyListeners = new Set<DirtyListener>();

export function isApc40Port(port: WebMidi.MIDIPort): boolean {
  return APC40_NAME_RE.test(port.name || '') || APC40_NAME_RE.test(port.manufacturer || '');
}

export async function getApc40Outputs(): Promise<WebMidi.MIDIOutput[]> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return [];
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    return Array.from(access.outputs.values()).filter(isApc40Port);
  } catch {
    return [];
  }
}

export function sendApc40NoteOn(
  out: WebMidi.MIDIOutput,
  channel: number,
  note: number,
  velocity: number,
  label = 'apc40-led',
): boolean {
  return safeMidiSend(
    out,
    [0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f],
    label,
  );
}

export function sendApc40ClipCell(
  out: WebMidi.MIDIOutput,
  row: number,
  column: number,
  velocity: number,
  label = 'apc40-led',
): boolean {
  return sendApc40NoteOn(out, column, APC40_CLIP_ROW_BASE + row, velocity, label);
}

export function clearApc40ClipGrid(
  outs: WebMidi.MIDIOutput[],
  opts: { includeActivator?: boolean; velocity?: number; label?: string } = {},
): void {
  const velocity = opts.velocity ?? 0;
  const label = opts.label ?? 'apc40-clear';
  const includeActivator = opts.includeActivator ?? true;
  for (const out of outs) {
    for (let row = 0; row < APC40_GRID_ROWS; row += 1) {
      for (let column = 0; column < APC40_GRID_COLS; column += 1) {
        sendApc40ClipCell(out, row, column, velocity, label);
      }
    }
    if (includeActivator) {
      for (let column = 0; column < APC40_GRID_COLS; column += 1) {
        sendApc40NoteOn(out, column, APC40_ACTIVATOR_NOTE, velocity, label);
      }
    }
  }
}

export function notifyApc40LedDirty(reason: Apc40LedDirtyReason = 'manual'): void {
  const listeners = Array.from(dirtyListeners);
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch {
      // Listener failures must not break MIDI cleanup paths.
    }
  }
}

export function subscribeApc40LedDirty(listener: DirtyListener): () => void {
  dirtyListeners.add(listener);
  return () => {
    dirtyListeners.delete(listener);
  };
}

export function __resetApc40LedRuntimeForTests(): void {
  dirtyListeners.clear();
}