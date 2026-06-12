/**
 * APC40 flourish overlays — short LED animations fired on meaningful app
 * events (fixture selection, crossfade, blackout, etc.). Designed to run in
 * parallel with the demoscene and the regular `useApc40LedFeedback` paint
 * loop. After a flourish completes it calls `invalidateApc40DemoDiff()` so
 * the demoscene re-asserts its pixels on the next tick.
 *
 * Pure module — caller invokes `triggerFlourish(kind)`; the engine resolves
 * APC40 outputs lazily and schedules its own intervals.
 */

import { LED, APC40_GRID } from '../midi/generated';
import { safeMidiSend } from '../midi/midiOutputGuard';
import { invalidateApc40DemoDiff } from './apc40Demoscene';

const ROWS = APC40_GRID.rows; // 5
const COLS = APC40_GRID.cols; // 8
const CLIP_ROW_BASE = 0x35;
const ACTIVATOR_NOTE = 0x32;

const APC40_NAME_RE = /\b(apc\s?40|apc40)\b/i;
const isApc40Port = (p: WebMidi.MIDIPort) =>
  APC40_NAME_RE.test(p.name || '') || APC40_NAME_RE.test(p.manufacturer || '');

function sendNoteOn(out: WebMidi.MIDIOutput, channel: number, note: number, velocity: number) {
  safeMidiSend(
    out,
    [0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f],
    'apc40-flourish',
  );
}

async function getApcOutputs(): Promise<WebMidi.MIDIOutput[]> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return [];
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    return Array.from(access.outputs.values()).filter(isApc40Port);
  } catch {
    return [];
  }
}

const PALETTE = {
  off: LED.LED_OFF,
  green: LED.LED_GREEN,
  red: LED.LED_RED,
  orange: LED.LED_ORANGE,
  greenBlink: LED.LED_GREEN_BLINK,
  redBlink: LED.LED_RED_BLINK,
  orangeBlink: LED.LED_ORANGE_BLINK,
} as const;

type Color = 'green' | 'red' | 'orange';
const colorValue = (c: Color) =>
  c === 'green' ? PALETTE.green : c === 'red' ? PALETTE.red : PALETTE.orange;

export type FlourishKind =
  | 'fixtureSelect'
  | 'crossfade'
  | 'clipLaunch'
  | 'blackout'
  | 'tabChange'
  | 'deckSwitchA'
  | 'deckSwitchB'
  | 'connectionUp'
  | 'connectionDown';

export interface FlourishOpts {
  /** Override the default duration. */
  durationMs?: number;
  color?: Color;
  /** For column-aware flourishes (fixtureSelect, clipLaunch). 0..7 */
  column?: number;
  /** For clip-launch flourishes. 0..4 */
  row?: number;
}

const ENABLED_KEY = 'apc40-flourishes-enabled';

let enabled: boolean = (() => {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(ENABLED_KEY);
  return raw == null ? true : raw === '1';
})();

export function isFlourishesEnabled(): boolean {
  return enabled;
}

export function setFlourishesEnabled(on: boolean): void {
  enabled = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  }
}

/**
 * Concurrent flourishes are allowed but we cap the active set to avoid
 * runaway interval timers if events fire faster than animations finish.
 */
const MAX_ACTIVE = 6;
const active = new Set<number>();
let nextId = 1;

function track(
  outs: WebMidi.MIDIOutput[],
  durationMs: number,
  tickMs: number,
  step: (frame: number) => void,
  cleanup: () => void,
): void {
  if (active.size >= MAX_ACTIVE) return;
  const id = nextId++;
  active.add(id);
  let frame = 0;
  const totalFrames = Math.max(1, Math.round(durationMs / tickMs));
  const handle = window.setInterval(() => {
    step(frame);
    frame++;
    if (frame >= totalFrames) {
      window.clearInterval(handle);
      cleanup();
      // Repaint any cells we touched (blank them) so demoscene/feedback
      // re-assert on the next tick.
      for (const out of outs) {
        // local cleanup is per-flourish in the cleanup arg; nothing extra.
        void out;
      }
      invalidateApc40DemoDiff();
      active.delete(id);
    }
  }, tickMs);
}

const blankCells = (outs: WebMidi.MIDIOutput[], cells: Array<[number, number]>) => {
  for (const out of outs) {
    for (const [r, c] of cells) {
      sendNoteOn(out, c, CLIP_ROW_BASE + r, PALETTE.off);
    }
  }
};

const blankStripCols = (outs: WebMidi.MIDIOutput[], cols: number[]) => {
  for (const out of outs) {
    for (const c of cols) sendNoteOn(out, c, ACTIVATOR_NOTE, PALETTE.off);
  }
};

async function runFixtureSelect(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const col = (opts.column ?? Math.floor(Math.random() * COLS)) % COLS;
  const v = colorValue(opts.color ?? 'green');
  const tickMs = 80;
  const duration = opts.durationMs ?? 600;
  const touched: Array<[number, number]> = [];
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const r = f % ROWS;
      for (const out of outs) sendNoteOn(out, col, CLIP_ROW_BASE + r, v);
      touched.push([r, col]);
    },
    () => blankCells(outs, touched),
  );
}

async function runCrossfade(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const v = colorValue(opts.color ?? 'orange');
  const duration = opts.durationMs ?? 1200;
  const tickMs = Math.max(40, Math.round(duration / COLS));
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const c = f % COLS;
      for (const out of outs) sendNoteOn(out, c, ACTIVATOR_NOTE, v);
    },
    () => blankStripCols(outs, [0, 1, 2, 3, 4, 5, 6, 7]),
  );
}

async function runClipLaunch(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const col = (opts.column ?? 0) % COLS;
  const row = (opts.row ?? 0) % ROWS;
  const v = colorValue(opts.color ?? 'orange');
  const tickMs = 100;
  const duration = opts.durationMs ?? 600;
  const ringCells: Array<[number, number]> = [
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
  ].filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS) as Array<[number, number]>;
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const on = f % 2 === 0;
      for (const out of outs) {
        for (const [r, c] of ringCells) {
          sendNoteOn(out, c, CLIP_ROW_BASE + r, on ? v : PALETTE.off);
        }
      }
    },
    () => blankCells(outs, ringCells),
  );
}

async function runBlackout(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const v = colorValue(opts.color ?? 'red');
  const tickMs = 80;
  const duration = opts.durationMs ?? 480;
  const touched: Array<[number, number]> = [];
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const r = f % ROWS;
      for (const out of outs) {
        for (let c = 0; c < COLS; c++) {
          sendNoteOn(out, c, CLIP_ROW_BASE + r, v);
          touched.push([r, c]);
        }
        sendNoteOn(out, r % COLS, ACTIVATOR_NOTE, v);
      }
    },
    () => {
      blankCells(outs, touched);
      blankStripCols(outs, [0, 1, 2, 3, 4, 5, 6, 7]);
    },
  );
}

async function runTabChange(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const v = colorValue(opts.color ?? 'green');
  const tickMs = 50;
  const duration = opts.durationMs ?? 400;
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const c = f % COLS;
      for (const out of outs) sendNoteOn(out, c, ACTIVATOR_NOTE, v);
    },
    () => blankStripCols(outs, [0, 1, 2, 3, 4, 5, 6, 7]),
  );
}

async function runDeckSwitch(side: 'A' | 'B', opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const v = colorValue(opts.color ?? 'green');
  const tickMs = 70;
  const duration = opts.durationMs ?? 560;
  // Chevron animation: pairs of cells form a > or < shape that fires sequentially.
  const chevronA: Array<[number, number]> = [[0, 3], [1, 2], [2, 1], [3, 2], [4, 3]];
  const chevronB: Array<[number, number]> = [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4]];
  const cells = side === 'A' ? chevronA : chevronB;
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const idx = f % cells.length;
      const [r, c] = cells[idx];
      for (const out of outs) sendNoteOn(out, c, CLIP_ROW_BASE + r, v);
    },
    () => blankCells(outs, cells),
  );
}

async function runConnectionFlash(opts: FlourishOpts) {
  const outs = await getApcOutputs();
  if (outs.length === 0) return;
  const v = colorValue(opts.color ?? 'green');
  const tickMs = 120;
  const duration = opts.durationMs ?? 360;
  const touched: Array<[number, number]> = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) touched.push([r, c]);
  track(
    outs,
    duration,
    tickMs,
    (f) => {
      const on = f % 2 === 0;
      for (const out of outs) {
        for (const [r, c] of touched) {
          sendNoteOn(out, c, CLIP_ROW_BASE + r, on ? v : PALETTE.off);
        }
      }
    },
    () => blankCells(outs, touched),
  );
}

export function triggerFlourish(kind: FlourishKind, opts: FlourishOpts = {}): void {
  if (!enabled) return;
  switch (kind) {
    case 'fixtureSelect':
      void runFixtureSelect(opts);
      return;
    case 'crossfade':
      void runCrossfade(opts);
      return;
    case 'clipLaunch':
      void runClipLaunch(opts);
      return;
    case 'blackout':
      void runBlackout(opts);
      return;
    case 'tabChange':
      void runTabChange(opts);
      return;
    case 'deckSwitchA':
      void runDeckSwitch('A', opts);
      return;
    case 'deckSwitchB':
      void runDeckSwitch('B', opts);
      return;
    case 'connectionUp':
      void runConnectionFlash({ color: 'green', ...opts });
      return;
    case 'connectionDown':
      void runConnectionFlash({ color: 'red', ...opts });
      return;
  }
}
