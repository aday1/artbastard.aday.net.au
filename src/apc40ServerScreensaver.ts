import easymidi from 'easymidi';
import { log } from './logger';

const APC40_NAME_RE = /\b(apc\s?40|apc40)\b/i;
const APC40_GRID_COLS = 8;
const APC40_GRID_ROWS = 5;
const APC40_CLIP_ROW_BASE = 0x35;
const APC40_ACTIVATOR_NOTE = 0x32;
const LED_OFF = 0;
const LED_GREEN = 1;
const LED_RED = 3;
const LED_ORANGE = 5;
const LED_ORANGE_BLINK = 6;
const IDLE_MS = Math.max(1000, Math.min(600000, Number(process.env.APC40_SERVER_SCREENSAVER_IDLE_MS) || 8000));
const FRAME_MS = Math.max(60, Math.min(1000, Number(process.env.APC40_SERVER_SCREENSAVER_FRAME_MS) || 120));
const OPEN_RETRY_MS = Math.max(5000, Math.min(300000, Number(process.env.APC40_SERVER_SCREENSAVER_RETRY_MS) || 30000));

interface Apc40ServerScreensaverState {
  enabled: boolean;
  active: boolean;
  browserClientCount: number;
  browserHiddenRequest: boolean;
  lastBrowserSeenAt: number | null;
  sharedOutputs: any[];
  sharedOutputNames: string[];
  ownedOutputs: any[];
  outputNames: string[];
  frame: number;
  frameTimer: NodeJS.Timeout | null;
  monitorTimer: NodeJS.Timeout | null;
  lastError: string | null;
  nextOpenAttemptAt: number | null;
}

const state: Apc40ServerScreensaverState = {
  enabled: process.env.APC40_SERVER_SCREENSAVER !== '0',
  active: false,
  browserClientCount: 0,
  browserHiddenRequest: false,
  lastBrowserSeenAt: Date.now(),
  sharedOutputs: [],
  sharedOutputNames: [],
  ownedOutputs: [],
  outputNames: [],
  frame: 0,
  frameTimer: null,
  monitorTimer: null,
  lastError: null,
  nextOpenAttemptAt: null,
};

export function isApc40MidiPortName(name: string): boolean {
  return APC40_NAME_RE.test(name || '');
}

function activeOutputs(): any[] {
  return state.sharedOutputs.length > 0 ? state.sharedOutputs : state.ownedOutputs;
}

function activeOutputNames(): string[] {
  return state.sharedOutputs.length > 0 ? state.sharedOutputNames : state.outputNames;
}

function sendNote(out: any, channel: number, note: number, velocity: number): void {
  out.send('noteon', {
    channel: channel & 0x0f,
    note: note & 0x7f,
    velocity: velocity & 0x7f,
  });
}

function clearGrid(): void {
  for (const out of activeOutputs()) {
    for (let row = 0; row < APC40_GRID_ROWS; row += 1) {
      for (let column = 0; column < APC40_GRID_COLS; column += 1) {
        sendNote(out, column, APC40_CLIP_ROW_BASE + row, LED_OFF);
      }
    }
    for (let column = 0; column < APC40_GRID_COLS; column += 1) {
      sendNote(out, column, APC40_ACTIVATOR_NOTE, LED_OFF);
    }
  }
}

function openOwnedOutputs(): boolean {
  const now = Date.now();
  if (state.nextOpenAttemptAt && now < state.nextOpenAttemptAt) {
    return false;
  }

  const outputNames = easymidi.getOutputs().filter(isApc40MidiPortName);
  if (outputNames.length === 0) {
    state.lastError = 'No APC40 MIDI output found';
    state.nextOpenAttemptAt = now + OPEN_RETRY_MS;
    return false;
  }

  const opened: any[] = [];
  const openedNames: string[] = [];
  for (const outputName of outputNames) {
    try {
      opened.push(new (easymidi as any).Output(outputName));
      openedNames.push(outputName);
    } catch (error) {
      log('APC40 server screensaver could not open output', 'WARN', {
        outputName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (opened.length === 0) {
    state.lastError = 'APC40 output exists but could not be opened';
    state.nextOpenAttemptAt = now + OPEN_RETRY_MS;
    return false;
  }

  state.ownedOutputs = opened;
  state.outputNames = openedNames;
  state.lastError = null;
  state.nextOpenAttemptAt = null;
  return true;
}

function ensureOutputs(): boolean {
  if (activeOutputs().length > 0) return true;
  return openOwnedOutputs();
}

function releaseOwnedOutputs(): void {
  for (const out of state.ownedOutputs) {
    try { out.close(); } catch {}
  }
  state.ownedOutputs = [];
  state.outputNames = [];
}

function closeOutputs(): void {
  try {
    clearGrid();
  } catch {
    // Best effort cleanup only.
  }
  releaseOwnedOutputs();
}

function paintFrame(): void {
  const frame = state.frame++;
  for (const out of activeOutputs()) {
    for (let row = 0; row < APC40_GRID_ROWS; row += 1) {
      for (let column = 0; column < APC40_GRID_COLS; column += 1) {
        const wave = (Math.sin((column * 0.9) + frame * 0.22) + Math.cos((row * 1.2) - frame * 0.18) + 2) / 4;
        const sweep = (frame + column + row * 2) % 16;
        const velocity = sweep < 3
          ? LED_ORANGE_BLINK
          : wave > 0.68
          ? LED_ORANGE
          : wave > 0.42
          ? LED_GREEN
          : LED_RED;
        sendNote(out, column, APC40_CLIP_ROW_BASE + row, velocity);
      }
    }
    for (let column = 0; column < APC40_GRID_COLS; column += 1) {
      const velocity = (frame + column) % 8 < 2 ? LED_ORANGE : LED_GREEN;
      sendNote(out, column, APC40_ACTIVATOR_NOTE, velocity);
    }
  }
}

function shouldRun(): boolean {
  if (!state.enabled) return false;
  if (state.browserHiddenRequest) return true;
  return state.browserClientCount === 0;
}

export function syncApc40ServerScreensaverSharedOutputs(outputs: any[], outputNames: string[]): void {
  state.sharedOutputs = outputs;
  state.sharedOutputNames = outputNames.filter(isApc40MidiPortName);
  if (state.sharedOutputs.length > 0) {
    state.lastError = null;
    state.nextOpenAttemptAt = null;
  }
  evaluateApc40ServerScreensaver();
}

export function startApc40ServerScreensaver(reason = 'no-browser'): boolean {
  if (state.active || !shouldRun()) return state.active;
  if (!ensureOutputs()) return false;
  state.active = true;
  state.frame = 0;
  log('APC40 server screensaver started', 'MIDI', {
    reason,
    outputs: activeOutputNames(),
    shared: state.sharedOutputs.length > 0,
    idleMs: IDLE_MS,
    frameMs: FRAME_MS,
  });
  paintFrame();
  state.frameTimer = setInterval(() => {
    if (!shouldRun()) {
      stopApc40ServerScreensaver('browser-connected');
      return;
    }
    try {
      paintFrame();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      log('APC40 server screensaver frame failed', 'WARN', { error: state.lastError });
      stopApc40ServerScreensaver('frame-error');
    }
  }, FRAME_MS);
  return true;
}

export function stopApc40ServerScreensaver(reason = 'manual'): void {
  if (state.frameTimer) {
    clearInterval(state.frameTimer);
    state.frameTimer = null;
  }
  if (!state.active && activeOutputs().length === 0) return;
  state.active = false;
  if (activeOutputs().length > 0) {
    try {
      clearGrid();
    } catch {
      // Best effort cleanup only.
    }
  }
  releaseOwnedOutputs();
  log('APC40 server screensaver stopped', 'MIDI', { reason });
}

function evaluateApc40ServerScreensaver(): void {
  if (!state.enabled || !shouldRun()) {
    stopApc40ServerScreensaver('not-idle');
    return;
  }
  if (state.browserHiddenRequest) {
    startApc40ServerScreensaver('browser-hidden');
    return;
  }
  const lastSeen = state.lastBrowserSeenAt || Date.now();
  if (Date.now() - lastSeen >= IDLE_MS) {
    startApc40ServerScreensaver('no-browser-clients');
  }
}

export function initializeApc40ServerScreensaver(): void {
  if (state.monitorTimer) return;
  state.monitorTimer = setInterval(evaluateApc40ServerScreensaver, 1000);
}

export function setApc40ServerScreensaverBrowserClientCount(count: number): void {
  const nextCount = Math.max(0, Math.floor(Number(count) || 0));
  state.browserClientCount = nextCount;
  if (nextCount > 0 && !state.browserHiddenRequest) {
    state.lastBrowserSeenAt = Date.now();
    stopApc40ServerScreensaver('browser-connected');
  }
  evaluateApc40ServerScreensaver();
}

export function setApc40ServerScreensaverBrowserHidden(hidden: boolean): void {
  state.browserHiddenRequest = hidden === true;
  if (hidden) {
    evaluateApc40ServerScreensaver();
    return;
  }
  stopApc40ServerScreensaver('browser-visible');
  if (state.browserClientCount > 0) {
    state.lastBrowserSeenAt = Date.now();
  }
}

export function getApc40ServerScreensaverStatus() {
  return {
    enabled: state.enabled,
    active: state.active,
    browserClientCount: state.browserClientCount,
    browserHiddenRequest: state.browserHiddenRequest,
    sharedOutputNames: [...state.sharedOutputNames],
    outputNames: [...activeOutputNames()],
    lastBrowserSeenAt: state.lastBrowserSeenAt,
    lastError: state.lastError,
    nextOpenAttemptAt: state.nextOpenAttemptAt,
  };
}
