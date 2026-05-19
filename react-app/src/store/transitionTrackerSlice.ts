import type { StateCreator } from 'zustand';
import type {
  ChannelEnvelope,
  TransitionPattern,
  TransitionPatternLine,
  TransitionPatternTrack,
  TransitionTrackerPlaybackState,
  PendingSceneTransitionOverride,
} from './types';
import {
  bakeEnvelopeToPatternLines,
  envelopeDraftFromPatternTrack,
} from '../utils/automationEnvelopeTrackerSync';
import {
  createDefaultPattern,
  createEmptyLine,
  createTrackForChannel,
  generatePageId,
  generatePatternId,
  getActivePage,
  loadPatternsFromStorage,
  normalizePattern,
  syncTracksToPageChannels,
  TRANSITION_PATTERNS_STORAGE_KEY,
} from '../utils/transitionTrackerEngine';
import { MAX_TRACKER_COLUMNS } from '../utils/trackerFixtureRoles';

export interface TransitionTrackerSlice {
  transitionPatterns: TransitionPattern[];
  activeTransitionPatternId: string | null;
  transitionTrackerPlayback: TransitionTrackerPlaybackState;
  pendingSceneTransitionOverride: PendingSceneTransitionOverride | null;

  setActiveTransitionPattern: (id: string | null) => void;
  addTransitionPattern: (name?: string) => string;
  updateTransitionPattern: (id: string, updates: Partial<TransitionPattern>) => void;
  deleteTransitionPattern: (id: string) => void;
  duplicateTransitionPattern: (id: string) => string;
  updateTransitionPatternLine: (
    patternId: string,
    lineIndex: number,
    updates: Partial<TransitionPatternLine>
  ) => void;
  setPatternLength: (patternId: string, length: number) => void;
  captureLineFromDmx: (patternId: string, lineIndex: number, channels: number[]) => void;
  captureLineFromScene: (
    patternId: string,
    lineIndex: number,
    sceneName: string,
    scenes: Array<{ name: string; channelValues: number[] }>
  ) => void;
  setPatternChannelsLocked: (patternId: string, locked: boolean) => void;
  addPatternChannel: (patternId: string, channelIndex: number) => void;
  removePatternChannel: (patternId: string, channelIndex: number) => void;
  mergeSelectionIntoPattern: (patternId: string, channelIndices: number[]) => void;
  setPatternPageChannels: (
    patternId: string,
    channelIndices: number[],
    mode?: 'replace' | 'merge'
  ) => void;
  clearPatternPageChannels: (patternId: string) => void;
  addPatternPage: (patternId: string, name?: string) => string;
  setActivePatternPage: (patternId: string, pageId: string) => void;
  renamePatternPage: (patternId: string, pageId: string, name: string) => void;
  deletePatternPage: (patternId: string, pageId: string) => void;
  linkTrackEnvelope: (patternId: string, trackId: string, envelopeId: string | null) => void;
  previewTrackerChannel: (channelIndex: number, value: number) => void;
  previewTrackerLine: (patternId: string, lineIndex: number) => void;
  bakeEnvelopeToPatternTrack: (
    patternId: string,
    channelIndex: number,
    envelopeId: string,
    lineStart?: number,
    lineCount?: number
  ) => void;
  importPatternTrackToEnvelope: (
    patternId: string,
    channelIndex: number,
    envelopeId?: string
  ) => string;
  startTransitionTrackerPlayback: (patternId?: string) => void;
  stopTransitionTrackerPlayback: () => void;
  setTransitionTrackerLine: (line: number) => void;
  setTransitionTrackerPlaybackOptions: (
    options: Partial<TransitionTrackerPlaybackState>
  ) => void;
  setPendingSceneTransitionOverride: (override: PendingSceneTransitionOverride | null) => void;
  applyActStepPlayback: (step: {
    sceneName: string;
    patternId?: string;
    transitionDuration: number;
    autopilotSettings?: {
      enabled: boolean;
      groups: Array<{
        groupId: string;
        autopilotType: 'color' | 'dimmer' | 'panTilt' | 'custom';
        intensity: number;
        speed: number;
        pattern?: 'wave' | 'random' | 'chase' | 'pulse';
      }>;
    };
  }) => void;
}

const defaultPlayback = (): TransitionTrackerPlaybackState => ({
  active: false,
  patternId: null,
  currentLine: 0,
  lineStartTime: null,
  loop: true,
  speed: 1,
  syncToBpm: true,
  livePreview: false,
});

function savePatterns(patterns: TransitionPattern[], activeId: string | null) {
  try {
    const normalized = patterns.map(normalizePattern);
    localStorage.setItem(
      TRANSITION_PATTERNS_STORAGE_KEY,
      JSON.stringify({ patterns: normalized, activePatternId: activeId })
    );
  } catch {
    /* ignore */
  }
}

function resizeLines(lines: TransitionPatternLine[], length: number): TransitionPatternLine[] {
  const next = [...lines];
  while (next.length < length) {
    next.push(createEmptyLine(next.length));
  }
  return next.slice(0, length).map((l, i) => ({ ...l, index: i }));
}

function patchPattern(
  patterns: TransitionPattern[],
  patternId: string,
  mutator: (p: TransitionPattern) => TransitionPattern
): TransitionPattern[] {
  return patterns.map((p) => {
    if (p.id !== patternId) return p;
    const normalized = normalizePattern(p);
    return { ...mutator(normalized), modifiedAt: Date.now() };
  });
}

export const createTransitionTrackerSlice = (
  set: Parameters<StateCreator<TransitionTrackerSlice>>[0],
  get: Parameters<StateCreator<TransitionTrackerSlice>>[1]
): TransitionTrackerSlice => {
  const initialPatterns = loadPatternsFromStorage();
  const initialActive = initialPatterns[0]?.id ?? null;

  return {
    transitionPatterns: initialPatterns,
    activeTransitionPatternId: initialActive,
    transitionTrackerPlayback: defaultPlayback(),
    pendingSceneTransitionOverride: null,

    setActiveTransitionPattern: (id) => {
      set({ activeTransitionPatternId: id });
      savePatterns(get().transitionPatterns as TransitionPattern[], id);
    },

    addTransitionPattern: (name) => {
      const pattern = createDefaultPattern(name);
      set((state) => {
        const patterns = [...(state.transitionPatterns as TransitionPattern[]), pattern];
        savePatterns(patterns, pattern.id);
        return {
          transitionPatterns: patterns,
          activeTransitionPatternId: pattern.id,
        };
      });
      return pattern.id;
    },

    updateTransitionPattern: (id, updates) => {
      set((state) => {
        const patterns = (state.transitionPatterns as TransitionPattern[]).map((p) =>
          p.id === id ? normalizePattern({ ...p, ...updates, modifiedAt: Date.now() }) : p
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    deleteTransitionPattern: (id) => {
      set((state) => {
        let patterns = (state.transitionPatterns as TransitionPattern[]).filter(
          (p) => p.id !== id
        );
        if (patterns.length === 0) {
          const fallback = createDefaultPattern();
          patterns = [fallback];
        }
        const activeId =
          state.activeTransitionPatternId === id
            ? patterns[0].id
            : (state.activeTransitionPatternId as string | null);
        savePatterns(patterns, activeId);
        return {
          transitionPatterns: patterns,
          activeTransitionPatternId: activeId,
        };
      });
    },

    duplicateTransitionPattern: (id) => {
      const source = (get().transitionPatterns as TransitionPattern[]).find((p) => p.id === id);
      if (!source) return id;
      const copy: TransitionPattern = normalizePattern({
        ...JSON.parse(JSON.stringify(source)),
        id: generatePatternId(),
        name: `${source.name} copy`,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
      set((state) => {
        const patterns = [...(state.transitionPatterns as TransitionPattern[]), copy];
        savePatterns(patterns, copy.id);
        return {
          transitionPatterns: patterns,
          activeTransitionPatternId: copy.id,
        };
      });
      return copy.id;
    },

    updateTransitionPatternLine: (patternId, lineIndex, updates) => {
      set((state) => {
        const patterns = (state.transitionPatterns as TransitionPattern[]).map((p) => {
          if (p.id !== patternId) return p;
          const lines = p.lines.map((line) =>
            line.index === lineIndex ? { ...line, ...updates } : line
          );
          return { ...p, lines, modifiedAt: Date.now() };
        });
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });

      const playback = get().transitionTrackerPlayback as TransitionTrackerPlaybackState;
      if (playback.livePreview && updates.channelValues) {
        const chUpdates = updates.channelValues;
        for (const [chStr, val] of Object.entries(chUpdates)) {
          if (val !== null && val !== undefined) {
            get().previewTrackerChannel(Number(chStr), val);
          }
        }
      }
    },

    setPatternLength: (patternId, length) => {
      const len = Math.max(1, Math.min(256, Math.round(length)));
      set((state) => {
        const patterns = (state.transitionPatterns as TransitionPattern[]).map((p) => {
          if (p.id !== patternId) return p;
          return {
            ...p,
            length: len,
            lines: resizeLines(p.lines, len),
            modifiedAt: Date.now(),
          };
        });
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    captureLineFromDmx: (patternId, lineIndex, channels) => {
      const dmx = get().dmxChannels as number[] | undefined;
      if (!dmx) return;
      const channelValues: Record<number, number | null> = {};
      for (const ch of channels) {
        if (ch >= 0 && ch < dmx.length) {
          channelValues[ch] = dmx[ch];
        }
      }
      get().updateTransitionPatternLine(patternId, lineIndex, { channelValues });
    },

    captureLineFromScene: (patternId, lineIndex, sceneName, scenes) => {
      const scene = scenes.find((s) => s.name === sceneName);
      if (!scene) return;
      const channelValues: Record<number, number | null> = {};
      scene.channelValues.forEach((val, ch) => {
        if (val > 0) channelValues[ch] = val;
      });
      get().updateTransitionPatternLine(patternId, lineIndex, {
        sceneName,
        channelValues,
      });
    },

    setPatternChannelsLocked: (patternId, locked) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => ({ ...p, channelsLocked: locked, followSelection: locked ? false : p.followSelection })
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    addPatternChannel: (patternId, channelIndex) => {
      if (channelIndex < 0) return;
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            const page = getActivePage(p);
            if (!page) return p;
            if (page.channelIndices.includes(channelIndex)) return p;
            const channelIndices = [...page.channelIndices, channelIndex]
              .sort((a, b) => a - b)
              .slice(0, MAX_TRACKER_COLUMNS);
            const pages = p.pages.map((pg) =>
              pg.id === page.id ? { ...pg, channelIndices } : pg
            );
            const tracks = syncTracksToPageChannels(p, { ...page, channelIndices });
            return { ...p, pages, tracks, channelsLocked: true, followSelection: false };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    removePatternChannel: (patternId, channelIndex) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            const page = getActivePage(p);
            if (!page) return p;
            const channelIndices = page.channelIndices.filter((c) => c !== channelIndex);
            const pages = p.pages.map((pg) =>
              pg.id === page.id ? { ...pg, channelIndices } : pg
            );
            const tracks = syncTracksToPageChannels(p, { ...page, channelIndices });
            return { ...p, pages, tracks };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    mergeSelectionIntoPattern: (patternId, channelIndices) => {
      get().setPatternPageChannels(patternId, channelIndices, 'merge');
    },

    clearPatternPageChannels: (patternId) => {
      get().setPatternPageChannels(patternId, [], 'replace');
    },

    setPatternPageChannels: (patternId, channelIndices, mode = 'replace') => {
      const sorted = [...new Set(channelIndices.filter((c) => c >= 0 && c < 512))].sort(
        (a, b) => a - b
      );
      const capped = sorted.slice(0, MAX_TRACKER_COLUMNS);
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            const page = getActivePage(p);
            if (!page) return p;
            const nextIndices =
              mode === 'merge'
                ? [...new Set([...page.channelIndices, ...capped])]
                    .sort((a, b) => a - b)
                    .slice(0, MAX_TRACKER_COLUMNS)
                : capped;
            const pages = p.pages.map((pg) =>
              pg.id === page.id ? { ...pg, channelIndices: nextIndices } : pg
            );
            const tracks = syncTracksToPageChannels(p, {
              ...page,
              channelIndices: nextIndices,
            });
            return {
              ...p,
              pages,
              tracks,
              channelsLocked: true,
              followSelection: false,
            };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    addPatternPage: (patternId, name) => {
      const pageId = generatePageId();
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            const channels: number[] = [];
            const page = {
              id: pageId,
              name: name ?? `Page ${p.pages.length + 1}`,
              channelIndices: channels,
            };
            const tracks: TransitionPatternTrack[] = [];
            return {
              ...p,
              pages: [...p.pages, page],
              activePageId: pageId,
              tracks,
              channelsLocked: true,
              followSelection: false,
            };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
      return pageId;
    },

    setActivePatternPage: (patternId, pageId) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            const page = p.pages.find((pg) => pg.id === pageId);
            if (!page) return p;
            const tracks = syncTracksToPageChannels(p, page);
            return { ...p, activePageId: pageId, tracks };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    renamePatternPage: (patternId, pageId, name) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, name } : pg)),
          })
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    deletePatternPage: (patternId, pageId) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => {
            if (p.pages.length <= 1) return p;
            const pages = p.pages.filter((pg) => pg.id !== pageId);
            const nextPage = pages[0];
            const tracks = syncTracksToPageChannels(p, nextPage);
            return {
              ...p,
              pages,
              activePageId: nextPage.id,
              tracks,
            };
          }
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    linkTrackEnvelope: (patternId, trackId, envelopeId) => {
      set((state) => {
        const patterns = patchPattern(
          state.transitionPatterns as TransitionPattern[],
          patternId,
          (p) => ({
            ...p,
            tracks: p.tracks.map((t) =>
              t.id === trackId ? { ...t, envelopeId } : t
            ),
          })
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    previewTrackerChannel: (channelIndex, value) => {
      const setDmxChannel = get().setDmxChannel as
        | ((ch: number, val: number, skip?: boolean) => void)
        | undefined;
      if (setDmxChannel) {
        setDmxChannel(channelIndex, Math.max(0, Math.min(255, Math.round(value))), true);
      }
    },

    previewTrackerLine: (patternId, lineIndex) => {
      const pattern = (get().transitionPatterns as TransitionPattern[]).find(
        (p) => p.id === patternId
      );
      if (!pattern) return;
      const line = pattern.lines[lineIndex];
      if (!line) return;
      const updates: Record<number, number> = {};
      for (const [chStr, val] of Object.entries(line.channelValues)) {
        if (val !== null && val !== undefined) {
          updates[Number(chStr)] = val;
        }
      }
      const setMultiple = get().setMultipleDmxChannels as
        | ((u: Record<number, number>, skip?: boolean) => void)
        | undefined;
      if (setMultiple && Object.keys(updates).length > 0) {
        setMultiple(updates, true);
      }
      if (line.sceneName) {
        get().setPendingSceneTransitionOverride({
          transitionMs: line.fx.transitionMs,
          easing: line.fx.easing,
        });
        get().loadScene(line.sceneName);
      }
    },

    bakeEnvelopeToPatternTrack: (patternId, channelIndex, envelopeId, lineStart = 0, lineCount) => {
      const envelopes = (get().envelopeAutomation as { envelopes: ChannelEnvelope[] }).envelopes;
      const envelope = envelopes.find((e) => e.id === envelopeId);
      if (!envelope) return;
      const pattern = (get().transitionPatterns as TransitionPattern[]).find(
        (p) => p.id === patternId
      );
      if (!pattern) return;
      const lines = bakeEnvelopeToPatternLines(
        envelope,
        pattern,
        channelIndex,
        lineStart,
        lineCount
      );
      set((state) => {
        const patterns = (state.transitionPatterns as TransitionPattern[]).map((p) =>
          p.id === patternId ? { ...p, lines, modifiedAt: Date.now() } : p
        );
        savePatterns(patterns, state.activeTransitionPatternId as string | null);
        return { transitionPatterns: patterns };
      });
    },

    importPatternTrackToEnvelope: (patternId, channelIndex, envelopeId) => {
      const pattern = (get().transitionPatterns as TransitionPattern[]).find(
        (p) => p.id === patternId
      );
      if (!pattern) return '';
      const draft = envelopeDraftFromPatternTrack(channelIndex, pattern);
      const track = pattern.tracks.find((t) => t.channelIndex === channelIndex);
      const syncMeta = { patternId, trackId: track?.id ?? '' };

      if (envelopeId) {
        get().updateEnvelope(envelopeId, {
          ...draft,
          trackerSync: syncMeta.trackId ? syncMeta : null,
        });
        return envelopeId;
      }

      get().addEnvelope({
        ...draft,
        trackerSync: syncMeta.trackId ? syncMeta : null,
      });
      const created = (get().envelopeAutomation as { envelopes: ChannelEnvelope[] }).envelopes.find(
        (e) => e.channel === channelIndex
      );
      if (created && track) {
        get().linkTrackEnvelope(patternId, track.id, created.id);
      }
      return created?.id ?? '';
    },

    startTransitionTrackerPlayback: (patternId) => {
      const id =
        patternId ??
        (get().activeTransitionPatternId as string | null) ??
        (get().transitionPatterns as TransitionPattern[])[0]?.id;
      if (!id) return;
      const envelope = get().envelopeAutomation as { globalEnabled?: boolean };
      if (envelope?.globalEnabled && typeof get().stopEnvelopeAnimation === 'function') {
        (get().stopEnvelopeAnimation as () => void)();
      }
      set({
        transitionTrackerPlayback: {
          ...defaultPlayback(),
          active: true,
          patternId: id,
          currentLine: 0,
          lineStartTime: Date.now(),
          livePreview: (get().transitionTrackerPlayback as TransitionTrackerPlaybackState)
            .livePreview,
        },
      });
    },

    stopTransitionTrackerPlayback: () => {
      const prev = get().transitionTrackerPlayback as TransitionTrackerPlaybackState;
      set({
        transitionTrackerPlayback: {
          ...defaultPlayback(),
          livePreview: prev.livePreview,
        },
      });
    },

    setTransitionTrackerLine: (line) => {
      set((state) => ({
        transitionTrackerPlayback: {
          ...(state.transitionTrackerPlayback as TransitionTrackerPlaybackState),
          currentLine: line,
          lineStartTime: Date.now(),
        },
      }));
    },

    setTransitionTrackerPlaybackOptions: (options) => {
      set((state) => ({
        transitionTrackerPlayback: {
          ...(state.transitionTrackerPlayback as TransitionTrackerPlaybackState),
          ...options,
        },
      }));
    },

    setPendingSceneTransitionOverride: (override) => {
      set({ pendingSceneTransitionOverride: override });
    },

    applyActStepPlayback: (step) => {
      const state = get();
      if (step.patternId) {
        state.stopTransitionTrackerPlayback();
        state.startTransitionTrackerPlayback(step.patternId);
        if (step.autopilotSettings?.enabled && typeof state.applyActStepAutopilot === 'function') {
          (state.applyActStepAutopilot as (s: typeof step) => void)(step);
        }
        return;
      }
      state.stopTransitionTrackerPlayback();
      state.setPendingSceneTransitionOverride({
        transitionMs: step.transitionDuration,
        easing: (state.transitionEasing as import('./types').TransitionEasing) ?? 'easeInOut',
      });
      state.loadScene(step.sceneName);
      if (step.autopilotSettings?.enabled && typeof state.applyActStepAutopilot === 'function') {
        (state.applyActStepAutopilot as (s: typeof step) => void)(step);
      }
    },
  };
};
