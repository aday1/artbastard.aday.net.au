import { LED } from '../midi/generated';
import {
  APC40_GRID_COLS,
  APC40_GRID_ROWS,
  getApc40Outputs,
  notifyApc40LedDirty,
  sendApc40ClipCell,
} from '../midi/apc40LedRuntime';
import { isApc40DemoRunning } from './apc40Demoscene';

export interface Apc40CrosshairPoint {
  x: number;
  y: number;
  source?: 'supercontrol' | 'roli' | 'test' | string;
}

const ENABLED_KEY = 'apc40-xy-crosshair-enabled';
const THROTTLE_MS = 90;
const HOLD_MS = 420;

let enabled: boolean = (() => {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(ENABLED_KEY);
  return raw == null ? true : raw === '1';
})();

let pending: Apc40CrosshairPoint | null = null;
let throttleTimer: number | null = null;
let clearTimer: number | null = null;
let lastPaintAt = 0;
let previousCells: Array<[number, number]> = [];

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function isApc40XyCrosshairEnabled(): boolean {
  return enabled;
}

export function setApc40XyCrosshairEnabled(on: boolean): void {
  enabled = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  }
  if (!on) void clearApc40Crosshair();
}

function uniqueCells(cells: Array<[number, number]>): Array<[number, number]> {
  const seen = new Set<string>();
  return cells.filter(([row, column]) => {
    const key = `${row}:${column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cellsForPoint(point: Apc40CrosshairPoint): { cells: Array<[number, number]>; row: number; column: number } {
  const column = Math.round(clamp01(point.x) * (APC40_GRID_COLS - 1));
  const row = Math.round(clamp01(point.y) * (APC40_GRID_ROWS - 1));
  const cells: Array<[number, number]> = [];
  for (let col = 0; col < APC40_GRID_COLS; col += 1) cells.push([row, col]);
  for (let r = 0; r < APC40_GRID_ROWS; r += 1) cells.push([r, column]);
  return { cells: uniqueCells(cells), row, column };
}

export async function clearApc40Crosshair(): Promise<void> {
  if (clearTimer != null) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (previousCells.length === 0) return;
  const cells = previousCells;
  previousCells = [];
  const outs = await getApc40Outputs();
  for (const out of outs) {
    for (const [row, column] of cells) {
      sendApc40ClipCell(out, row, column, LED.LED_OFF, 'apc40-xy-crosshair');
    }
  }
  notifyApc40LedDirty('xy-crosshair-clear');
}

async function paintNow(point: Apc40CrosshairPoint): Promise<void> {
  if (!enabled) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (isApc40DemoRunning()) return;
  const outs = await getApc40Outputs();
  if (outs.length === 0) return;

  const { cells, row, column } = cellsForPoint(point);
  for (const out of outs) {
    for (const [prevRow, prevColumn] of previousCells) {
      if (!cells.some(([cellRow, cellColumn]) => cellRow === prevRow && cellColumn === prevColumn)) {
        sendApc40ClipCell(out, prevRow, prevColumn, LED.LED_OFF, 'apc40-xy-crosshair');
      }
    }
    for (const [cellRow, cellColumn] of cells) {
      const velocity = cellRow === row && cellColumn === column
        ? LED.LED_RED
        : point.source === 'roli'
          ? LED.LED_GREEN
          : LED.LED_ORANGE;
      sendApc40ClipCell(out, cellRow, cellColumn, velocity, 'apc40-xy-crosshair');
    }
  }
  previousCells = cells;
  if (clearTimer != null) window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    clearTimer = null;
    void clearApc40Crosshair();
  }, HOLD_MS);
}

function flushPending(): void {
  throttleTimer = null;
  const next = pending;
  pending = null;
  if (!next) return;
  lastPaintAt = Date.now();
  void paintNow(next);
}

export function paintApc40Crosshair(point: Apc40CrosshairPoint): void {
  if (!enabled || typeof window === 'undefined') return;
  pending = point;
  const delay = Math.max(0, THROTTLE_MS - (Date.now() - lastPaintAt));
  if (delay === 0) {
    if (throttleTimer != null) {
      window.clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    flushPending();
    return;
  }
  if (throttleTimer == null) {
    throttleTimer = window.setTimeout(flushPending, delay);
  }
}

export const paintApc40XyCrosshair = paintApc40Crosshair;

export function __resetApc40XyCrosshairForTests(): void {
  enabled = true;
  pending = null;
  previousCells = [];
  lastPaintAt = 0;
  if (throttleTimer != null) window.clearTimeout(throttleTimer);
  if (clearTimer != null) window.clearTimeout(clearTimer);
  throttleTimer = null;
  clearTimer = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ENABLED_KEY);
  }
}