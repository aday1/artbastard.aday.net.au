/**
 * APC40 demoscene — easter-egg LED animations on the 5x8 clip launch grid
 * plus optional accents on the per-channel Activator row.
 *
 * Independent of the regular `useApc40LedFeedback` paint loop: caller starts
 * the demo, the engine takes control of the grid LEDs for the duration, then
 * the regular feedback loop re-paints when the demo stops.
 *
 * Palette is limited to the APC40 mk1 RG colour set: green / red / orange /
 * blink variants / off (see ledFeedbackSpec.ts).
 */

import { LED, APC40_GRID } from '../midi/generated';
import { safeMidiSend } from '../midi/midiOutputGuard';
import { notifyApc40LedDirty } from '../midi/apc40LedRuntime';

const ROWS = APC40_GRID.rows; // 5
const COLS = APC40_GRID.cols; // 8
const CLIP_ROW_BASE = 0x35; // row 0 = 0x35, row 1 = 0x36, ...
const ACTIVATOR_NOTE = 0x32; // per-track Activator button row

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

export type DemoPatternId =
  | 'plasma' | 'sweep' | 'snake' | 'sparkle' | 'rainfall' | 'knightRider'
  | 'fire' | 'wave' | 'checker' | 'matrixRain' | 'pulseRings' | 'spiral'
  | 'conwayLife' | 'fireworks' | 'vortex';

export interface DemoPattern {
  id: DemoPatternId;
  label: string;
  /** Build a 5x8 grid of LED velocities (row-major: grid[row * COLS + col]). */
  render: (frame: number) => Uint8Array;
  /** Optional 8-velocity row painted on the Activator row (0x32). */
  renderStrip?: (frame: number) => Uint8Array;
  /** Frame interval in ms. Slower frames = less MIDI traffic. */
  intervalMs: number;
}

const wrap = (n: number, m: number) => ((n % m) + m) % m;

/** Pick a colour from a heat ramp 0..1 → off/green/orange/red. */
const heat = (t: number): number => {
  if (t < 0.15) return PALETTE.off;
  if (t < 0.45) return PALETTE.green;
  if (t < 0.75) return PALETTE.orange;
  return PALETTE.red;
};

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
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      const head = wrap(f, COLS);
      for (let c = 0; c < COLS; c++) {
        const dist = wrap(head - c, COLS);
        strip[c] =
          dist === 0 ? PALETTE.red : dist === 1 ? PALETTE.orange : dist === 2 ? PALETTE.green : PALETTE.off;
      }
      return strip;
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
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      const period = (COLS - 1) * 2;
      const pos = wrap(f, period);
      const head = pos < COLS ? pos : period - pos;
      for (let c = 0; c < COLS; c++) {
        const dist = Math.abs(c - head);
        strip[c] =
          dist === 0 ? PALETTE.red : dist === 1 ? PALETTE.orange : dist === 2 ? PALETTE.green : PALETTE.off;
      }
      return strip;
    },
  },
  {
    id: 'fire',
    label: 'Fire',
    intervalMs: 95,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      // Heat rises from bottom row; flicker per cell + per frame.
      let seed = (f * 12345 + 6789) % 99991;
      const rand = () => {
        seed = (seed * 31 + 17) % 99991;
        return (seed / 99991);
      };
      for (let c = 0; c < COLS; c++) {
        const base = 0.7 + 0.3 * Math.sin((c + f * 0.4) * 0.8);
        for (let r = 0; r < ROWS; r++) {
          // Bottom row (r = ROWS-1) is hottest. Heat decays going up.
          const altitude = (ROWS - 1 - r) / (ROWS - 1);
          const heatVal = altitude * (base + rand() * 0.25);
          grid[r * COLS + c] = heat(heatVal);
        }
      }
      return grid;
    },
  },
  {
    id: 'wave',
    label: 'Sine Wave',
    intervalMs: 80,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      for (let c = 0; c < COLS; c++) {
        const y = (Math.sin((c + f * 0.5) * 0.7) + 1) / 2; // 0..1
        const peak = Math.round(y * (ROWS - 1));
        for (let r = 0; r < ROWS; r++) {
          const dist = Math.abs(r - peak);
          grid[r * COLS + c] =
            dist === 0 ? PALETTE.red : dist === 1 ? PALETTE.orange : dist === 2 ? PALETTE.green : PALETTE.off;
        }
      }
      return grid;
    },
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      for (let c = 0; c < COLS; c++) {
        const y = (Math.sin((c + f * 0.5) * 0.7) + 1) / 2;
        strip[c] = heat(y);
      }
      return strip;
    },
  },
  {
    id: 'checker',
    label: 'Checker',
    intervalMs: 220,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const flip = wrap(f, 4); // 4-step rotation of palette
      const palette = [PALETTE.green, PALETTE.orange, PALETTE.red, PALETTE.orange];
      const a = palette[flip];
      const b = palette[(flip + 2) % 4];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          grid[r * COLS + c] = (r + c) % 2 === 0 ? a : b;
        }
      }
      return grid;
    },
  },
  {
    id: 'matrixRain',
    label: 'Matrix Rain',
    intervalMs: 75,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      // Per-column independent drops with varying speeds.
      for (let c = 0; c < COLS; c++) {
        const speed = 1 + (c % 3);
        const head = wrap(Math.floor(f * speed / 2) + c * 7, ROWS + 5);
        for (let r = 0; r < ROWS; r++) {
          if (head === r) grid[r * COLS + c] = PALETTE.greenBlink;
          else if (head === r + 1) grid[r * COLS + c] = PALETTE.green;
          else if (head === r + 2) grid[r * COLS + c] = PALETTE.green;
        }
      }
      return grid;
    },
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      // Per-column drop "footprint" — lit when a head is at the bottom row.
      for (let c = 0; c < COLS; c++) {
        const speed = 1 + (c % 3);
        const head = wrap(Math.floor(f * speed / 2) + c * 7, ROWS + 5);
        strip[c] = head === ROWS - 1 ? PALETTE.green : PALETTE.off;
      }
      return strip;
    },
  },
  {
    id: 'pulseRings',
    label: 'Pulse Rings',
    intervalMs: 90,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const cx = (COLS - 1) / 2;
      const cy = (ROWS - 1) / 2;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dx = c - cx;
          const dy = r - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Ring travels outward; mod by max diagonal length.
          const phase = wrap(Math.round(dist * 2) - f, 6);
          grid[r * COLS + c] =
            phase === 0 ? PALETTE.red : phase === 1 ? PALETTE.orange : phase === 2 ? PALETTE.green : PALETTE.off;
        }
      }
      return grid;
    },
    renderStrip: (f) => {
      // Symmetric expansion from centre outward across the 8 strip cells.
      const strip = new Uint8Array(COLS);
      const half = COLS / 2;
      for (let c = 0; c < COLS; c++) {
        const dist = Math.abs(c - (half - 0.5));
        const phase = wrap(Math.round(dist) - f, 4);
        strip[c] =
          phase === 0 ? PALETTE.red : phase === 1 ? PALETTE.orange : phase === 2 ? PALETTE.green : PALETTE.off;
      }
      return strip;
    },
  },
  {
    id: 'spiral',
    label: 'Spiral',
    intervalMs: 85,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const cx = (COLS - 1) / 2;
      const cy = (ROWS - 1) / 2;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dx = c - cx;
          const dy = r - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          // Spiral arm = angle + radial coordinate, rotated by frame.
          const v = wrap(Math.round((angle * 4) + dist * 1.5 + f), 4);
          grid[r * COLS + c] =
            v === 0 ? PALETTE.red : v === 1 ? PALETTE.orange : v === 2 ? PALETTE.green : PALETTE.off;
        }
      }
      return grid;
    },
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      for (let c = 0; c < COLS; c++) {
        const v = wrap(c + f, 4);
        strip[c] =
          v === 0 ? PALETTE.red : v === 1 ? PALETTE.orange : v === 2 ? PALETTE.green : PALETTE.off;
      }
      return strip;
    },
  },
  {
    id: 'conwayLife',
    // Lazy seeded Conway's Game of Life over the 5x8 grid. Reseeds when the
    // colony dies out or stagnates so the surface never goes flat.
    label: 'Game of Life',
    intervalMs: 280,
    render: (() => {
      let board: Uint8Array | null = null;
      let lastFrame = -1;
      const seed = () => {
        const b = new Uint8Array(ROWS * COLS);
        for (let i = 0; i < b.length; i++) b[i] = Math.random() < 0.35 ? 1 : 0;
        return b;
      };
      const step = (b: Uint8Array): Uint8Array => {
        const next = new Uint8Array(b.length);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            let n = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const rr = wrap(r + dr, ROWS);
                const cc = wrap(c + dc, COLS);
                n += b[rr * COLS + cc];
              }
            }
            const alive = b[r * COLS + c];
            next[r * COLS + c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
          }
        }
        return next;
      };
      const alive = (b: Uint8Array) => {
        let n = 0;
        for (let i = 0; i < b.length; i++) if (b[i]) n++;
        return n;
      };
      return (f: number) => {
        // Advance only when frame changes (handles paused frames).
        if (!board || f === 0) board = seed();
        if (f !== lastFrame) {
          board = step(board);
          if (alive(board) < 3) board = seed();
          lastFrame = f;
        }
        const grid = new Uint8Array(ROWS * COLS);
        for (let i = 0; i < grid.length; i++) {
          grid[i] = board[i] ? PALETTE.green : PALETTE.off;
        }
        return grid;
      };
    })(),
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    intervalMs: 90,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      // Each "rocket" cycle is 8 frames: launch (4) + burst (4).
      const cycle = wrap(f, 8);
      let seed = ((f / 8) | 0) * 7919 + 11;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      const col = Math.floor(rand() * COLS);
      if (cycle < 4) {
        // Rocket rising: bottom (ROWS-1) → top (0) over 4 frames.
        const rocketRow = (ROWS - 1) - cycle;
        if (rocketRow >= 0) grid[rocketRow * COLS + col] = PALETTE.orange;
      } else {
        // Burst: expanding diamond from row 0 at the launch column.
        const radius = cycle - 4; // 0..3
        const cx = col;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const d = Math.abs(r - 1) + Math.abs(c - cx);
            if (d === radius) grid[r * COLS + c] = radius < 2 ? PALETTE.red : PALETTE.green;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'vortex',
    label: 'Vortex',
    intervalMs: 75,
    render: (f) => {
      const grid = new Uint8Array(ROWS * COLS);
      const cx = (COLS - 1) / 2;
      const cy = (ROWS - 1) / 2;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dx = c - cx;
          const dy = r - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Twist angle with distance for the vortex effect.
          const angle = Math.atan2(dy, dx) + dist * 0.6 + f * 0.18;
          const v = (Math.sin(angle * 2) + 1) / 2;
          grid[r * COLS + c] = heat(v);
        }
      }
      return grid;
    },
    renderStrip: (f) => {
      const strip = new Uint8Array(COLS);
      for (let c = 0; c < COLS; c++) {
        const v = (Math.sin((c - f * 0.5) * 0.9) + 1) / 2;
        strip[c] = heat(v);
      }
      return strip;
    },
  },
];

export const DEMO_PATTERNS: ReadonlyArray<DemoPattern> = PATTERNS;

export function getDemoPattern(id: DemoPatternId): DemoPattern {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
}

interface Runner {
  stop: () => void;
  /** True if this runner is the shuffle orchestrator (so stopApc40Demo can clear it). */
  isShuffle: boolean;
}

export interface DemoRunOptions {
  patternId: DemoPatternId;
  /** Called once on stop so the UI can flip its toggle back off. */
  onStop?: () => void;
  /** Global speed multiplier (0.25..4). Defaults to current global speed. */
  speed?: number;
}

let activeRunner: Runner | null = null;
let activeInvalidate: (() => void) | null = null;
let globalSpeed = 1;

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
    for (let c = 0; c < COLS; c++) {
      sendNoteOn(out, c, ACTIVATOR_NOTE, PALETTE.off);
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
  return startPatternInternal(outs, opts, false);
}

function startPatternInternal(
  outs: WebMidi.MIDIOutput[],
  opts: DemoRunOptions,
  isShuffle: boolean,
): boolean {
  const pattern = getDemoPattern(opts.patternId);
  let frame = 0;
  const speed = Math.max(0.25, Math.min(4, opts.speed ?? globalSpeed));
  const intervalMs = Math.max(20, Math.round(pattern.intervalMs / speed));

  // Per-output last-velocity maps so we only send changed pads.
  const lastGrid = new Map<WebMidi.MIDIOutput, Uint8Array>();
  const lastStrip = new Map<WebMidi.MIDIOutput, Uint8Array>();
  for (const o of outs) {
    lastGrid.set(o, new Uint8Array(ROWS * COLS).fill(0xff));
    lastStrip.set(o, new Uint8Array(COLS).fill(0xff));
  }

  // Expose invalidation so flourishes can force the next tick to re-paint
  // cells they've overwritten.
  const invalidate = () => {
    for (const arr of lastGrid.values()) arr.fill(0xff);
    for (const arr of lastStrip.values()) arr.fill(0xff);
  };
  activeInvalidate = invalidate;

  const tick = () => {
    const grid = pattern.render(frame);
    const strip = pattern.renderStrip?.(frame) ?? null;
    for (const out of outs) {
      const prevG = lastGrid.get(out)!;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          if (prevG[idx] !== grid[idx]) {
            sendNoteOn(out, c, CLIP_ROW_BASE + r, grid[idx]);
            prevG[idx] = grid[idx];
          }
        }
      }
      if (strip) {
        const prevS = lastStrip.get(out)!;
        for (let c = 0; c < COLS; c++) {
          if (prevS[c] !== strip[c]) {
            sendNoteOn(out, c, ACTIVATOR_NOTE, strip[c]);
            prevS[c] = strip[c];
          }
        }
      }
    }
    frame++;
  };

  tick();
  const handle = window.setInterval(tick, intervalMs);
  activeRunner = {
    isShuffle,
    stop: () => {
      window.clearInterval(handle);
      clearGrid(outs);
      activeInvalidate = null;
      activeRunner = null;
      opts.onStop?.();
      notifyApc40LedDirty('demoscene-stop');
    },
  };
  return true;
}

/**
 * Reset the diff-skip maps so the next demoscene tick re-paints every cell.
 * Flourishes call this after they overwrite cells, so the demoscene snaps
 * back to its true state rather than leaving the flourish pixels stuck.
 */
export function invalidateApc40DemoDiff(): void {
  activeInvalidate?.();
}

export interface DemoShuffleOptions {
  /** ms between pattern swaps. Default 8000. */
  rotateMs?: number;
  /** Speed multiplier (0.25..4). Default current globalSpeed. */
  speed?: number;
  /** Optional callback fired on shuffle stop (UI sync). */
  onStop?: () => void;
}

let shuffleHandle: number | null = null;

export async function startApc40DemoShuffle(opts: DemoShuffleOptions = {}): Promise<boolean> {
  stopApc40Demo();
  const outs = await getApcOutputs();
  if (outs.length === 0) {
    opts.onStop?.();
    return false;
  }
  const rotateMs = Math.max(1500, opts.rotateMs ?? 8000);
  let pickIndex = Math.floor(Math.random() * PATTERNS.length);
  const launchNext = () => {
    pickIndex = (pickIndex + 1 + Math.floor(Math.random() * (PATTERNS.length - 1))) % PATTERNS.length;
    startPatternInternal(outs, { patternId: PATTERNS[pickIndex].id, speed: opts.speed }, true);
  };
  startPatternInternal(outs, { patternId: PATTERNS[pickIndex].id, speed: opts.speed }, true);
  shuffleHandle = window.setInterval(launchNext, rotateMs);
  // Wrap stop so the shuffle interval also clears.
  const inner = activeRunner!;
  activeRunner = {
    isShuffle: true,
    stop: () => {
      if (shuffleHandle != null) {
        window.clearInterval(shuffleHandle);
        shuffleHandle = null;
      }
      inner.stop();
      opts.onStop?.();
    },
  };
  return true;
}

export function setApc40DemoSpeed(multiplier: number): void {
  globalSpeed = Math.max(0.25, Math.min(4, multiplier));
}

export function getApc40DemoSpeed(): number {
  return globalSpeed;
}

export function stopApc40Demo(): void {
  if (shuffleHandle != null) {
    window.clearInterval(shuffleHandle);
    shuffleHandle = null;
  }
  if (activeRunner) activeRunner.stop();
}

export function isApc40DemoRunning(): boolean {
  return activeRunner != null;
}

export function isApc40DemoShuffling(): boolean {
  return activeRunner != null && activeRunner.isShuffle;
}
