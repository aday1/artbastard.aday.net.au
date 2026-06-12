/**
 * APC40 demoscene — easter-egg LED animations on the 5x8 clip launch grid.
 *
 * Independent of the regular `useApc40LedFeedback` paint loop: caller starts
 * the demo, the engine takes control of the grid LEDs for the duration, then
 * the regular feedback loop re-paints when the demo stops (via state-change
 * on its end).
 *
 * Palette is limited to the APC40 mk1 RG colour set: green / red / orange /
 * blink variants / off (see ledFeedbackSpec.ts).
 */

import { LED, APC40_GRID } from '../midi/generated';
import { safeMidiSend } from '../midi/midiOutputGuard';

const ROWS = APC40_GRID.rows; // 5
const COLS = APC40_GRID.cols; // 8
const CLIP_ROW_BASE = 0x35; // row 0 = 0x35, row 1 = 0x36, ...

const APC40_NAME_RE = /\b(apc\s?40|apc40)\b/i;
const isApc40Port = (p: WebMidi.MIDIPort) =>
  APC40_NAME_RE.test(p.name || '') || APC40_NAME_RE.test(p.manufacturer || '');

function sendNoteOn(out: WebMidi.MIDIOutput, channel: number, note: number, velocity: number) {
  safeMidiSend(
    out,
    [0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f],
    'apc40-demoscene',
  );
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

export type DemoPatternId = 'plasma' | 'sweep' | 'snake' | 'sparkle' | 'rainfall' | 'knightRider';

export interface DemoPattern {
  id: DemoPatternId;
  label: string;
  /** Build a 5x8 grid of LED velocities (row-major: grid[row * COLS + col]). */
  render: (frame: number) => Uint8Array;
  /** Frame interval in ms. Slower frames = less MIDI traffic. */
  intervalMs: number;
}

const wrap = (n: number, m: number) => ((n % m) + m) % m;

const PATTERNS: DemoPattern[] = [
  {
    id: 'plasma',
    label: 'Plasma',
    intervalMs: 110,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = Math.sin((c + f * 0.3) * 0.7) + Math.cos((r * 1.3 + f * 0.2));
          const idx = (Math.round(v + 2) + f / 7) | 0;
          const choice = wrap(idx, 3);
          grid[r * COLS + c] =
            choice === 0 ? PALETTE.green : choice === 1 ? PALETTE.orange : PALETTE.red;
        }
      }
      return grid;
    },
  },
  {
    id: 'sweep',
    label: 'Column Sweep',
    intervalMs: 90,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const head = wrap(f, COLS);
      for (let c = 0; c < COLS; c++) {
        const dist = wrap(head - c, COLS);
        const colour =
          dist === 0 ? PALETTE.red : dist === 1 ? PALETTE.orange : dist === 2 ? PALETTE.green : PALETTE.off;
        for (let r = 0; r < ROWS; r++) grid[r * COLS + c] = colour;
      }
      return grid;
    },
  },
  {
    id: 'snake',
    label: 'Snake',
    intervalMs: 70,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const total = ROWS * COLS;
      const tailLen = 6;
      for (let i = 0; i < tailLen; i++) {
        const pos = wrap(f - i, total);
        const r = Math.floor(pos / COLS);
        const c = pos % COLS;
        // Serpentine path for visual continuity (reverse on odd rows).
        const cc = r % 2 === 0 ? c : COLS - 1 - c;
        grid[r * COLS + cc] =
          i === 0 ? PALETTE.red : i < 3 ? PALETTE.orange : PALETTE.green;
      }
      return grid;
    },
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    intervalMs: 120,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      // Deterministic PRNG keyed on frame so the grid feels alive but stable.
      let seed = (f * 9301 + 49297) % 233280;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      const sparkles = 6 + Math.floor(rand() * 4);
      for (let i = 0; i < sparkles; i++) {
        const r = Math.floor(rand() * ROWS);
        const c = Math.floor(rand() * COLS);
        const palette = [PALETTE.green, PALETTE.orange, PALETTE.red, PALETTE.greenBlink];
        grid[r * COLS + c] = palette[Math.floor(rand() * palette.length)];
      }
      return grid;
    },
  },
  {
    id: 'rainfall',
    label: 'Rainfall',
    intervalMs: 80,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      for (let c = 0; c < COLS; c++) {
        // Each column has its own seed offset so drops are independent.
        const head = wrap(f + c * 3, ROWS + 4);
        for (let r = 0; r < ROWS; r++) {
          if (head === r) grid[r * COLS + c] = PALETTE.red;
          else if (head === r + 1) grid[r * COLS + c] = PALETTE.orange;
          else if (head === r + 2) grid[r * COLS + c] = PALETTE.green;
        }
      }
      return grid;
    },
  },
  {
    id: 'knightRider',
    label: 'Knight Rider',
    intervalMs: 65,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const period = (COLS - 1) * 2;
      const pos = wrap(f, period);
      const head = pos < COLS ? pos : period - pos;
      for (let c = 0; c < COLS; c++) {
        const dist = Math.abs(c - head);
        const colour =
          dist === 0 ? PALETTE.red : dist === 1 ? PALETTE.orange : dist === 2 ? PALETTE.green : PALETTE.off;
        for (let r = 0; r < ROWS; r++) grid[r * COLS + c] = colour;
      }
      return grid;
    },
  },
];

export const DEMO_PATTERNS: ReadonlyArray<DemoPattern> = PATTERNS;

export function getDemoPattern(id: DemoPatternId): DemoPattern {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
}

interface Runner {
  stop: () => void;
}

export interface DemoRunOptions {
  patternId: DemoPatternId;
  /** Called once on stop so the UI can flip its toggle back off. */
  onStop?: () => void;
}

let activeRunner: Runner | null = null;

async function getApcOutputs(): Promise<WebMidi.MIDIOutput[]> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return [];
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    return Array.from(access.outputs.values()).filter(isApc40Port);
  } catch {
    return [];
  }
}

function clearGrid(outs: WebMidi.MIDIOutput[]): void {
  for (const out of outs) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        sendNoteOn(out, c, CLIP_ROW_BASE + r, PALETTE.off);
      }
    }
  }
}

/**
 * Start a demoscene pattern. Returns true if at least one APC40 output was
 * found and the loop started. Stops any prior running demo first.
 */
export async function startApc40Demo(opts: DemoRunOptions): Promise<boolean> {
  stopApc40Demo();
  const outs = await getApcOutputs();
  if (outs.length === 0) {
    opts.onStop?.();
    return false;
  }
  const pattern = getDemoPattern(opts.patternId);
  let frame = 0;
  // Per-output last-velocity map so we only send changed pads (avoids
  // blink-reset flicker on cells whose colour didn't change frame-to-frame).
  const last = new Map<WebMidi.MIDIOutput, Uint8Array>();
  for (const o of outs) last.set(o, new Uint8Array(ROWS * COLS).fill(0xff));

  const tick = () => {
    const grid = pattern.render(frame++);
    for (const out of outs) {
      const prev = last.get(out)!;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          if (prev[idx] !== grid[idx]) {
            sendNoteOn(out, c, CLIP_ROW_BASE + r, grid[idx]);
            prev[idx] = grid[idx];
          }
        }
      }
    }
  };

  // Paint once immediately, then schedule.
  tick();
  const handle = window.setInterval(tick, pattern.intervalMs);
  activeRunner = {
    stop: () => {
      window.clearInterval(handle);
      clearGrid(outs);
      activeRunner = null;
      opts.onStop?.();
    },
  };
  return true;
}

export function stopApc40Demo(): void {
  if (activeRunner) activeRunner.stop();
}

export function isApc40DemoRunning(): boolean {
  return activeRunner != null;
}
