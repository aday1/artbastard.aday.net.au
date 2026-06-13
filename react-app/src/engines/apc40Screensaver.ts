import { LED } from '../midi/generated';
import {
  APC40_ACTIVATOR_NOTE,
  APC40_CLIP_ROW_BASE,
  APC40_GRID_COLS,
  APC40_GRID_ROWS,
  clearApc40ClipGrid,
  getApc40Outputs,
  notifyApc40LedDirty,
  sendApc40NoteOn,
} from '../midi/apc40LedRuntime';
import { DEMO_PATTERNS, DemoPatternId, getDemoPattern, stopApc40Demo } from './apc40Demoscene';

export interface Apc40ScreensaverConfig {
  enabled: boolean;
  rotateMs: number;
  speed: number;
  patterns: DemoPatternId[];
}

export interface Apc40ScreensaverState {
  active: boolean;
  patternId: DemoPatternId | null;
}

const STORAGE_KEY = 'apc40-screensaver-config-v1';
const VALID_PATTERN_IDS = new Set<DemoPatternId>(DEMO_PATTERNS.map((pattern) => pattern.id));
const DEFAULT_PATTERNS: DemoPatternId[] = [
  'plasma',
  'sweep',
  'sparkle',
  'rainfall',
  'wave',
  'matrixRain',
  'pulseRings',
  'spiral',
  'vortex',
];

const DEFAULT_CONFIG: Apc40ScreensaverConfig = {
  enabled: true,
  rotateMs: 8000,
  speed: 1,
  patterns: DEFAULT_PATTERNS,
};

let configCache: Apc40ScreensaverConfig | null = null;
let active = false;
let currentPatternId: DemoPatternId | null = null;
let frameHandle: number | null = null;
let rotateHandle: number | null = null;
let activeOutputs: WebMidi.MIDIOutput[] = [];

function normalizeConfig(raw: unknown): Apc40ScreensaverConfig {
  const parsed = raw && typeof raw === 'object' ? raw as Partial<Apc40ScreensaverConfig> : {};
  const rotateMs = typeof parsed.rotateMs === 'number' ? parsed.rotateMs : DEFAULT_CONFIG.rotateMs;
  const speed = typeof parsed.speed === 'number' ? parsed.speed : DEFAULT_CONFIG.speed;
  const patterns = Array.isArray(parsed.patterns)
    ? parsed.patterns.filter((patternId): patternId is DemoPatternId => typeof patternId === 'string' && VALID_PATTERN_IDS.has(patternId as DemoPatternId))
    : DEFAULT_CONFIG.patterns;
  return {
    enabled: parsed.enabled == null ? DEFAULT_CONFIG.enabled : parsed.enabled === true,
    rotateMs: Math.max(1500, Math.min(60000, Math.round(rotateMs))),
    speed: Math.max(0.25, Math.min(4, speed)),
    patterns: patterns.length > 0 ? patterns : DEFAULT_CONFIG.patterns,
  };
}

function readConfig(): Apc40ScreensaverConfig {
  if (typeof window === 'undefined') return normalizeConfig(null);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeConfig(null);
  }
}

function writeConfig(config: Apc40ScreensaverConfig): void {
  configCache = normalizeConfig(config);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configCache));
  } catch {
    // Keep the in-memory setting.
  }
}

export function getApc40ScreensaverConfig(): Apc40ScreensaverConfig {
  if (!configCache) configCache = readConfig();
  return { ...configCache, patterns: [...configCache.patterns] };
}

export function setApc40ScreensaverConfig(next: Partial<Apc40ScreensaverConfig>): Apc40ScreensaverConfig {
  const current = getApc40ScreensaverConfig();
  writeConfig({ ...current, ...next });
  return getApc40ScreensaverConfig();
}

export function getApc40ScreensaverState(): Apc40ScreensaverState {
  return { active, patternId: currentPatternId };
}

function pickPattern(config: Apc40ScreensaverConfig, previous: DemoPatternId | null): DemoPatternId {
  const pool = config.patterns.length > 0 ? config.patterns : DEFAULT_PATTERNS;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  if (next === previous) {
    const index = pool.indexOf(next);
    next = pool[(index + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length];
  }
  return next;
}

function stopFrameLoop(): void {
  if (frameHandle != null) {
    window.clearInterval(frameHandle);
    frameHandle = null;
  }
}

function paintPattern(patternId: DemoPatternId, config: Apc40ScreensaverConfig): void {
  stopFrameLoop();
  currentPatternId = patternId;
  const pattern = getDemoPattern(patternId);
  const intervalMs = Math.max(30, Math.round(pattern.intervalMs / config.speed));
  let frame = 0;
  const lastGrid = new Map<WebMidi.MIDIOutput, Uint8Array>();
  const lastStrip = new Map<WebMidi.MIDIOutput, Uint8Array>();
  activeOutputs.forEach((out) => {
    lastGrid.set(out, new Uint8Array(APC40_GRID_ROWS * APC40_GRID_COLS).fill(0xff));
    lastStrip.set(out, new Uint8Array(APC40_GRID_COLS).fill(0xff));
  });

  const tick = () => {
    const grid = pattern.render(frame);
    const strip = pattern.renderStrip?.(frame) ?? null;
    for (const out of activeOutputs) {
      const prevGrid = lastGrid.get(out)!;
      for (let row = 0; row < APC40_GRID_ROWS; row += 1) {
        for (let column = 0; column < APC40_GRID_COLS; column += 1) {
          const index = row * APC40_GRID_COLS + column;
          if (prevGrid[index] !== grid[index]) {
            sendApc40NoteOn(out, column, APC40_CLIP_ROW_BASE + row, grid[index], 'apc40-screensaver');
            prevGrid[index] = grid[index];
          }
        }
      }
      const prevStrip = lastStrip.get(out)!;
      for (let column = 0; column < APC40_GRID_COLS; column += 1) {
        const velocity = strip?.[column] ?? LED.LED_OFF;
        if (prevStrip[column] !== velocity) {
          sendApc40NoteOn(out, column, APC40_ACTIVATOR_NOTE, velocity, 'apc40-screensaver');
          prevStrip[column] = velocity;
        }
      }
    }
    frame += 1;
  };

  tick();
  frameHandle = window.setInterval(tick, intervalMs);
}

export async function startApc40Screensaver(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const config = getApc40ScreensaverConfig();
  if (!config.enabled) return false;
  if (active) return true;
  stopApc40Demo();
  const outs = await getApc40Outputs();
  if (outs.length === 0) return false;
  activeOutputs = outs;
  active = true;
  const rotate = () => paintPattern(pickPattern(config, currentPatternId), config);
  rotate();
  rotateHandle = window.setInterval(rotate, config.rotateMs);
  return true;
}

export function stopApc40Screensaver(): void {
  if (!active && frameHandle == null && rotateHandle == null) return;
  stopFrameLoop();
  if (rotateHandle != null) {
    window.clearInterval(rotateHandle);
    rotateHandle = null;
  }
  clearApc40ClipGrid(activeOutputs, { label: 'apc40-screensaver-clear' });
  activeOutputs = [];
  active = false;
  currentPatternId = null;
  notifyApc40LedDirty('screensaver-stop');
}

export function __resetApc40ScreensaverForTests(): void {
  stopApc40Screensaver();
  configCache = null;
}