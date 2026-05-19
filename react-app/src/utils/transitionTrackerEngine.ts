import type {
  TransitionEasing,
  TransitionPattern,
  TransitionPatternLine,
  TransitionPatternPage,
  TransitionPatternTrack,
} from '../store/types';
import { MAX_TRACKER_COLUMNS } from './trackerFixtureRoles';

export const TRANSITION_PATTERNS_STORAGE_KEY = 'transitionPatterns';

export const TRANSITION_EASING_OPTIONS: TransitionEasing[] = [
  'linear',
  'easeInOut',
  'easeIn',
  'easeOut',
  'easeInOutCubic',
  'easeInOutQuart',
  'easeInOutSine',
];

export const EASING_CODES: Record<TransitionEasing, string> = {
  linear: 'LN',
  easeInOut: 'IO',
  easeIn: 'EI',
  easeOut: 'EO',
  easeInOutCubic: 'C3',
  easeInOutQuart: 'Q4',
  easeInOutSine: 'SN',
};

export const EASING_FROM_CODE: Record<string, TransitionEasing> = Object.fromEntries(
  Object.entries(EASING_CODES).map(([k, v]) => [v, k as TransitionEasing])
) as Record<string, TransitionEasing>;

/** Legacy factory default; stripped on load so the tracker starts empty. */
const FACTORY_DEFAULT_PAGE_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7];

function isFactoryDefaultPageChannels(channelIndices: number[]): boolean {
  const sorted = sortUniqueChannels(channelIndices);
  if (sorted.length !== FACTORY_DEFAULT_PAGE_CHANNELS.length) return false;
  return sorted.every((ch, i) => ch === FACTORY_DEFAULT_PAGE_CHANNELS[i]);
}

/** Remove implicit CH 1-8 from saved patterns; user adds columns explicitly. */
export function sanitizePageChannelIndices(channelIndices: number[]): number[] {
  const sorted = sortUniqueChannels(channelIndices);
  if (isFactoryDefaultPageChannels(sorted)) return [];
  return sorted;
}

export function generatePatternId(): string {
  return `tp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generatePageId(): string {
  return `tpg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateTrackId(): string {
  return `tpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTrackForChannel(channelIndex: number, name?: string): TransitionPatternTrack {
  return {
    id: generateTrackId(),
    channelIndex,
    name,
    envelopeId: null,
  };
}

function sortUniqueChannels(channels: number[]): number[] {
  return [...new Set(channels.filter((c) => c >= 0 && c < 512))].sort((a, b) => a - b);
}

export function getActivePage(pattern: TransitionPattern): TransitionPatternPage | null {
  const pages = pattern.pages ?? [];
  if (pages.length === 0) return null;
  return pages.find((p) => p.id === pattern.activePageId) ?? pages[0];
}

/** Ensure pages/tracks exist on patterns saved before v5.14 tracker UX. */
export function normalizePattern(raw: TransitionPattern): TransitionPattern {
  if (raw.pages?.length && raw.tracks) {
    const activePageId = raw.activePageId ?? raw.pages[0].id;
    const pages = raw.pages.map((pg) => ({
      ...pg,
      channelIndices: sanitizePageChannelIndices(pg.channelIndices ?? []),
    }));
    const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
    const base = {
      ...raw,
      channelsLocked: raw.channelsLocked ?? true,
      followSelection: raw.followSelection ?? false,
      activePageId: activePage.id,
      pages,
      tracks: raw.tracks,
    };
    return {
      ...base,
      tracks: syncTracksToPageChannels(base, activePage),
    };
  }

  const legacyChannels =
    raw.visibleChannels?.length > 0
      ? sanitizePageChannelIndices(raw.visibleChannels)
      : [];

  const channelIndices = sanitizePageChannelIndices(legacyChannels);
  const pageId = generatePageId();
  const page: TransitionPatternPage = {
    id: pageId,
    name: 'Page 1',
    channelIndices,
  };

  return {
    ...raw,
    channelsLocked: raw.channelsLocked ?? true,
    pages: [page],
    activePageId: pageId,
    tracks: channelIndices.map((ch) => createTrackForChannel(ch)),
    visibleChannels: [],
    followSelection: false,
  };
}

export function syncTracksToPageChannels(
  pattern: TransitionPattern,
  page: TransitionPatternPage
): TransitionPatternTrack[] {
  const indices = sortUniqueChannels(page.channelIndices);
  const byChannel = new Map(pattern.tracks.map((t) => [t.channelIndex, t]));
  return indices.map((ch) => byChannel.get(ch) ?? createTrackForChannel(ch));
}

export function createEmptyLine(index: number): TransitionPatternLine {
  return {
    index,
    channelValues: {},
    fx: {
      transitionMs: 1000,
      easing: 'easeInOut',
      snap: false,
    },
  };
}

export function createDefaultPattern(name = 'Pattern 01'): TransitionPattern {
  const length = 16;
  const pageId = generatePageId();
  const channelIndices: number[] = [];
  const page: TransitionPatternPage = {
    id: pageId,
    name: 'Page 1',
    channelIndices,
  };
  return {
    id: generatePatternId(),
    name,
    length,
    linesPerBeat: 4,
    lines: Array.from({ length }, (_, i) => createEmptyLine(i)),
    visibleChannels: [],
    followSelection: false,
    channelsLocked: true,
    pages: [page],
    activePageId: pageId,
    tracks: channelIndices.map((ch) => createTrackForChannel(ch)),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

export function lineDurationMs(bpm: number, linesPerBeat: number, speed = 1): number {
  if (bpm <= 0 || linesPerBeat <= 0) return 1000;
  return (60000 / bpm / linesPerBeat) / Math.max(0.1, speed);
}

export function parseHexCell(text: string): number | null {
  const t = text.trim().toUpperCase();
  if (!t || t === '..' || t === '--') return null;
  const n = parseInt(t, 16);
  if (Number.isNaN(n) || n < 0 || n > 255) return null;
  return n;
}

export function formatHexCell(value: number | null | undefined): string {
  if (value === null || value === undefined) return '..';
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');
}

export function parseEasingCode(code: string): TransitionEasing {
  const c = code.trim().toUpperCase();
  return EASING_FROM_CODE[c] ?? 'easeInOut';
}

export function formatEasingCode(easing: TransitionEasing): string {
  return EASING_CODES[easing] ?? 'IO';
}

/** Grid columns = active page channels (+ optional DMX selection). Never auto-adds pinned or 1-8. */
export function resolveVisibleChannels(
  pattern: TransitionPattern,
  selectedChannels: number[],
  pinnedChannels: number[],
  options?: { includePinned?: boolean }
): number[] {
  const p = normalizePattern(pattern);
  const page = getActivePage(p);
  let cols = [...(page?.channelIndices ?? [])];

  if (p.visibleChannels.length > 0 && !p.followSelection && !p.channelsLocked) {
    cols = [...p.visibleChannels];
  }

  if (p.followSelection && !p.channelsLocked) {
    cols = [...new Set([...cols, ...selectedChannels])];
  }

  if (options?.includePinned) {
    cols = [...new Set([...cols, ...pinnedChannels])];
  }

  return sortUniqueChannels(cols).slice(0, MAX_TRACKER_COLUMNS);
}

export function resolveTrackForChannel(
  pattern: TransitionPattern,
  channelIndex: number
): TransitionPatternTrack | undefined {
  return normalizePattern(pattern).tracks.find((t) => t.channelIndex === channelIndex);
}

export const easingFunctions: Record<TransitionEasing, (t: number) => number> = {
  linear: (t) => t,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInOutQuart: (t) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export function interpolateChannelTargets(
  from: number[],
  targets: Record<number, number>,
  progress: number,
  easing: TransitionEasing
): number[] {
  const ease = easingFunctions[easing] ?? easingFunctions.easeInOut;
  const t = ease(Math.min(1, Math.max(0, progress)));
  const out = [...from];
  for (const [chStr, target] of Object.entries(targets)) {
    const ch = Number(chStr);
    if (ch < 0 || ch >= out.length) continue;
    const start = from[ch] ?? 0;
    out[ch] = Math.round(start + (target - start) * t);
  }
  return out;
}

export function collectLineChannelTargets(line: TransitionPatternLine): Record<number, number> {
  const targets: Record<number, number> = {};
  for (const [chStr, val] of Object.entries(line.channelValues)) {
    if (val !== null && val !== undefined) {
      targets[Number(chStr)] = val;
    }
  }
  return targets;
}

export function persistPatterns(patterns: TransitionPattern[]): void {
  try {
    const normalized = patterns.map(normalizePattern);
    localStorage.setItem(
      TRANSITION_PATTERNS_STORAGE_KEY,
      JSON.stringify({ patterns: normalized, activePatternId: null })
    );
  } catch {
    /* ignore quota */
  }
}

export function loadPatternsFromStorage(): TransitionPattern[] {
  try {
    const raw = localStorage.getItem(TRANSITION_PATTERNS_STORAGE_KEY);
    if (!raw) return [createDefaultPattern()];
    const parsed = JSON.parse(raw) as { patterns?: TransitionPattern[] };
    if (Array.isArray(parsed.patterns) && parsed.patterns.length > 0) {
      return parsed.patterns.map(normalizePattern);
    }
  } catch {
    /* ignore */
  }
  return [createDefaultPattern()];
}
