import type { DemoPatternId } from './apc40Demoscene';

export type Apc40FlourishKind =
  | 'fixtureSelect'
  | 'crossfade'
  | 'clipLaunch'
  | 'blackout'
  | 'tabChange'
  | 'deckSwitchA'
  | 'deckSwitchB'
  | 'connectionUp'
  | 'connectionDown';

export interface Apc40FlourishSettings {
  random: boolean;
  patterns: Record<Apc40FlourishKind, DemoPatternId>;
}

const STORAGE_KEY = 'apc40-flourish-patterns-v1';

export const APC40_FLOURISH_KIND_LABELS: Record<Apc40FlourishKind, string> = {
  fixtureSelect: 'Fixture select',
  crossfade: 'Crossfade',
  clipLaunch: 'Clip launch',
  blackout: 'Blackout',
  tabChange: 'Tab change',
  deckSwitchA: 'Deck A',
  deckSwitchB: 'Deck B',
  connectionUp: 'Connection up',
  connectionDown: 'Connection down',
};

export const APC40_FLOURISH_KINDS = Object.keys(APC40_FLOURISH_KIND_LABELS) as Apc40FlourishKind[];

export const DEFAULT_APC40_FLOURISH_PATTERNS: Record<Apc40FlourishKind, DemoPatternId> = {
  fixtureSelect: 'sweep',
  crossfade: 'wave',
  clipLaunch: 'pulseRings',
  blackout: 'fire',
  tabChange: 'sweep',
  deckSwitchA: 'knightRider',
  deckSwitchB: 'spiral',
  connectionUp: 'vortex',
  connectionDown: 'rainfall',
};

export const APC40_FLOURISH_PATTERN_OPTIONS: Record<Apc40FlourishKind, DemoPatternId[]> = {
  fixtureSelect: ['sweep', 'knightRider', 'wave', 'snake'],
  crossfade: ['wave', 'sweep', 'knightRider', 'vortex'],
  clipLaunch: ['pulseRings', 'spiral', 'sparkle', 'fireworks'],
  blackout: ['fire', 'pulseRings', 'checker', 'vortex'],
  tabChange: ['sweep', 'wave', 'matrixRain', 'spiral'],
  deckSwitchA: ['knightRider', 'spiral', 'sweep', 'wave'],
  deckSwitchB: ['spiral', 'knightRider', 'sweep', 'wave'],
  connectionUp: ['vortex', 'rainfall', 'matrixRain', 'pulseRings'],
  connectionDown: ['rainfall', 'vortex', 'fire', 'checker'],
};

let cachedSettings: Apc40FlourishSettings | null = null;

function isValidKind(value: string): value is Apc40FlourishKind {
  return (APC40_FLOURISH_KINDS as string[]).includes(value);
}

function isValidPatternForKind(kind: Apc40FlourishKind, patternId: unknown): patternId is DemoPatternId {
  return typeof patternId === 'string' && APC40_FLOURISH_PATTERN_OPTIONS[kind].includes(patternId as DemoPatternId);
}

function normalizeSettings(raw: unknown): Apc40FlourishSettings {
  const next: Apc40FlourishSettings = {
    random: false,
    patterns: { ...DEFAULT_APC40_FLOURISH_PATTERNS },
  };
  if (!raw || typeof raw !== 'object') return next;
  const parsed = raw as Partial<Apc40FlourishSettings>;
  next.random = parsed.random === true;
  const patterns = parsed.patterns && typeof parsed.patterns === 'object'
    ? parsed.patterns as Partial<Record<Apc40FlourishKind, DemoPatternId>>
    : {};
  for (const [kind, patternId] of Object.entries(patterns)) {
    if (isValidKind(kind) && isValidPatternForKind(kind, patternId)) {
      next.patterns[kind] = patternId;
    }
  }
  return next;
}

function readSettings(): Apc40FlourishSettings {
  if (typeof window === 'undefined') return normalizeSettings(null);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSettings(null);
  }
}

function writeSettings(settings: Apc40FlourishSettings): void {
  cachedSettings = normalizeSettings(settings);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
  } catch {
    // Keep in-memory settings even if localStorage is unavailable.
  }
}

export function getApc40FlourishSettings(): Apc40FlourishSettings {
  if (!cachedSettings) cachedSettings = readSettings();
  return {
    random: cachedSettings.random,
    patterns: { ...cachedSettings.patterns },
  };
}

export function setApc40FlourishPattern(kind: Apc40FlourishKind, patternId: DemoPatternId): Apc40FlourishSettings {
  const current = getApc40FlourishSettings();
  const pattern = isValidPatternForKind(kind, patternId)
    ? patternId
    : DEFAULT_APC40_FLOURISH_PATTERNS[kind];
  const next = {
    ...current,
    patterns: { ...current.patterns, [kind]: pattern },
  };
  writeSettings(next);
  return getApc40FlourishSettings();
}

export function setApc40RandomFlourishes(random: boolean): Apc40FlourishSettings {
  const current = getApc40FlourishSettings();
  writeSettings({ ...current, random });
  return getApc40FlourishSettings();
}

export function resolveApc40FlourishPattern(kind: Apc40FlourishKind): DemoPatternId {
  const settings = getApc40FlourishSettings();
  if (!settings.random) {
    return isValidPatternForKind(kind, settings.patterns[kind])
      ? settings.patterns[kind]
      : DEFAULT_APC40_FLOURISH_PATTERNS[kind];
  }
  const pool = APC40_FLOURISH_PATTERN_OPTIONS[kind];
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_APC40_FLOURISH_PATTERNS[kind];
}

export function __resetApc40FlourishSettingsForTests(): void {
  cachedSettings = null;
}