/**
 * APC40 flourish overlays: short, deterministic LED animations fired on
 * meaningful app events. Each flourish kind resolves through persisted
 * settings so operators get a consistent visual language by default, with
 * optional curated randomness.
 */

import { LED } from '../midi/generated';
import {
  APC40_ACTIVATOR_NOTE,
  APC40_CLIP_ROW_BASE,
  APC40_GRID_COLS,
  APC40_GRID_ROWS,
  getApc40Outputs,
  notifyApc40LedDirty,
  sendApc40NoteOn,
} from '../midi/apc40LedRuntime';
import {
  Apc40FlourishKind,
  resolveApc40FlourishPattern,
} from './apc40FlourishSettings';
import {
  DemoPatternId,
  getDemoPattern,
  invalidateApc40DemoDiff,
  isApc40DemoRunning,
} from './apc40Demoscene';

export type FlourishKind = Apc40FlourishKind;

type Color = 'green' | 'red' | 'orange';

export interface FlourishOpts {
  durationMs?: number;
  color?: Color;
  column?: number;
  row?: number;
  patternId?: DemoPatternId;
}

const ENABLED_KEY = 'apc40-flourishes-enabled';
const MAX_ACTIVE = 3;

const COOLDOWN_MS: Record<FlourishKind, number> = {
  fixtureSelect: 180,
  crossfade: 650,
  clipLaunch: 160,
  blackout: 700,
  tabChange: 500,
  deckSwitchA: 450,
  deckSwitchB: 450,
  connectionUp: 2500,
  connectionDown: 2500,
};

const DEFAULT_DURATION_MS: Record<FlourishKind, number> = {
  fixtureSelect: 720,
  crossfade: 1000,
  clipLaunch: 620,
  blackout: 620,
  tabChange: 420,
  deckSwitchA: 620,
  deckSwitchB: 620,
  connectionUp: 520,
  connectionDown: 520,
};

let enabled: boolean = (() => {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(ENABLED_KEY);
  return raw == null ? true : raw === '1';
})();

let nextId = 1;
const activeIds = new Set<number>();
const activeKeys = new Set<string>();
const lastTriggerAt = new Map<string, number>();

export function isFlourishesEnabled(): boolean {
  return enabled;
}

export function setFlourishesEnabled(on: boolean): void {
  enabled = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  }
}

export function getApc40FlourishDiagnostics() {
  return {
    active: activeIds.size,
    activeKeys: Array.from(activeKeys),
    enabled,
  };
}

function triggerKey(kind: FlourishKind, opts: FlourishOpts): string {
  const row = opts.row == null ? '*' : Math.round(opts.row);
  const column = opts.column == null ? '*' : Math.round(opts.column);
  return `${kind}:${row}:${column}`;
}

function shouldRun(kind: FlourishKind, key: string): boolean {
  if (!enabled) return false;
  if (typeof window === 'undefined') return false;
  if (isApc40DemoRunning()) return false;
  if (activeIds.size >= MAX_ACTIVE) return false;
  if (activeKeys.has(key)) return false;
  const now = Date.now();
  const last = lastTriggerAt.get(key) ?? 0;
  if (now - last < COOLDOWN_MS[kind]) return false;
  lastTriggerAt.set(key, now);
  return true;
}

function cleanupCells(
  outs: WebMidi.MIDIOutput[],
  cells: Set<string>,
  stripColumns: Set<number>,
): void {
  for (const out of outs) {
    for (const key of cells) {
      const [rowRaw, columnRaw] = key.split(':');
      const row = Number(rowRaw);
      const column = Number(columnRaw);
      if (!Number.isFinite(row) || !Number.isFinite(column)) continue;
      sendApc40NoteOn(out, column, APC40_CLIP_ROW_BASE + row, LED.LED_OFF, 'apc40-flourish-cleanup');
    }
    for (const column of stripColumns) {
      sendApc40NoteOn(out, column, APC40_ACTIVATOR_NOTE, LED.LED_OFF, 'apc40-flourish-cleanup');
    }
  }
}

function runTracked(
  key: string,
  outs: WebMidi.MIDIOutput[],
  durationMs: number,
  tickMs: number,
  step: (frame: number) => void,
  cleanup: () => void,
): void {
  const id = nextId++;
  activeIds.add(id);
  activeKeys.add(key);
  let frame = 0;
  const totalFrames = Math.max(1, Math.round(durationMs / tickMs));
  let handle: number | null = null;

  const finish = (reason: 'flourish-complete' | 'flourish-abort') => {
    if (handle != null) {
      window.clearInterval(handle);
      handle = null;
    }
    try {
      cleanup();
      invalidateApc40DemoDiff();
    } finally {
      activeIds.delete(id);
      activeKeys.delete(key);
      notifyApc40LedDirty(reason);
    }
  };

  handle = window.setInterval(() => {
    try {
      step(frame);
      frame += 1;
      if (frame >= totalFrames) finish('flourish-complete');
    } catch {
      finish('flourish-abort');
    }
  }, tickMs);
}

async function runPatternFlourish(kind: FlourishKind, opts: FlourishOpts): Promise<void> {
  const key = triggerKey(kind, opts);
  if (!shouldRun(kind, key)) return;
  const outs = await getApc40Outputs();
  if (outs.length === 0) return;

  const pattern = getDemoPattern(opts.patternId ?? resolveApc40FlourishPattern(kind));
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS[kind];
  const tickMs = Math.max(40, Math.round(pattern.intervalMs));
  const touchedCells = new Set<string>();
  const touchedStripColumns = new Set<number>();
  const lastGrid = new Map<WebMidi.MIDIOutput, Uint8Array>();
  const lastStrip = new Map<WebMidi.MIDIOutput, Uint8Array>();

  for (const out of outs) {
    lastGrid.set(out, new Uint8Array(APC40_GRID_ROWS * APC40_GRID_COLS).fill(0xff));
    lastStrip.set(out, new Uint8Array(APC40_GRID_COLS).fill(0xff));
  }

  runTracked(
    key,
    outs,
    durationMs,
    tickMs,
    (frame) => {
      const grid = pattern.render(frame);
      const strip = pattern.renderStrip?.(frame) ?? null;
      for (const out of outs) {
        const prevGrid = lastGrid.get(out)!;
        for (let row = 0; row < APC40_GRID_ROWS; row += 1) {
          for (let column = 0; column < APC40_GRID_COLS; column += 1) {
            const index = row * APC40_GRID_COLS + column;
            const velocity = grid[index] ?? LED.LED_OFF;
            if (prevGrid[index] !== velocity) {
              sendApc40NoteOn(out, column, APC40_CLIP_ROW_BASE + row, velocity, 'apc40-flourish');
              prevGrid[index] = velocity;
              touchedCells.add(`${row}:${column}`);
            }
          }
        }
        if (strip) {
          const prevStrip = lastStrip.get(out)!;
          for (let column = 0; column < APC40_GRID_COLS; column += 1) {
            const velocity = strip[column] ?? LED.LED_OFF;
            if (prevStrip[column] !== velocity) {
              sendApc40NoteOn(out, column, APC40_ACTIVATOR_NOTE, velocity, 'apc40-flourish');
              prevStrip[column] = velocity;
              touchedStripColumns.add(column);
            }
          }
        }
      }
    },
    () => cleanupCells(outs, touchedCells, touchedStripColumns),
  );
}

export function triggerFlourish(kind: FlourishKind, opts: FlourishOpts = {}): void {
  void runPatternFlourish(kind, opts);
}

export function __resetApc40FlourishesForTests(): void {
  activeIds.clear();
  activeKeys.clear();
  lastTriggerAt.clear();
  enabled = true;
}
