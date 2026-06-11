import { useEffect, useRef, useCallback } from 'react';
import { useStore, SceneTimeline } from '../store';
import {
  SCENE_TIMELINE_PLAYHEAD_EVENT,
  SCENE_TIMELINE_START_EVENT,
  SCENE_TIMELINE_STOP_EVENT,
  computeSceneTimelineDmxUpdates,
  dispatchSceneTimelinePlayhead,
  getEffectiveTimelineDuration,
  type SceneTimelineStartDetail,
} from '../utils/sceneTimelinePlayback';

interface ScenePlaybackState {
  sceneName: string | null;
  isPlaying: boolean;
  startTime: number;
  startAtMs: number;
  currentTime: number;
  direction: 1 | -1;
  timelineOverride: SceneTimeline | null;
}

export const useSceneTimelinePlayback = () => {
  const scenes = useStore((s) => s.scenes);
  const bpm = useStore((s) => s.bpm);
  const setMultipleDmxChannels = useStore((s) => s.setMultipleDmxChannels);

  const playbackStateRef = useRef<ScenePlaybackState>({
    sceneName: null,
    isPlaying: false,
    startTime: 0,
    startAtMs: 0,
    currentTime: 0,
    direction: 1,
    timelineOverride: null,
  });

  const resolveTimeline = useCallback(
    (sceneName: string): SceneTimeline | null => {
      const override = playbackStateRef.current.timelineOverride;
      if (override) {
        return override;
      }
      const scene = scenes.find((s) => s.name === sceneName);
      return scene?.timeline ?? null;
    },
    [scenes]
  );

  const applyAtTime = useCallback(
    (sceneName: string, timeMs: number) => {
      const timeline = resolveTimeline(sceneName);
      if (!timeline?.enabled) {
        return;
      }
      const duration = getEffectiveTimelineDuration(timeline, bpm);
      const updates = computeSceneTimelineDmxUpdates(timeline, timeMs, duration);
      if (Object.keys(updates).length > 0) {
        setMultipleDmxChannels(updates, true);
      }
    },
    [bpm, resolveTimeline, setMultipleDmxChannels]
  );

  const stopTimeline = useCallback(() => {
    const sceneName = playbackStateRef.current.sceneName;
    playbackStateRef.current.isPlaying = false;
    playbackStateRef.current.timelineOverride = null;
    if (sceneName) {
      dispatchSceneTimelinePlayhead({
        sceneName,
        timeMs: playbackStateRef.current.currentTime,
        isPlaying: false,
      });
    }
    playbackStateRef.current.sceneName = null;
  }, []);

  const startTimeline = useCallback(
    (detail: SceneTimelineStartDetail) => {
      const { sceneName, timelineOverride, startAtMs = 0 } = detail;
      const timeline = timelineOverride ?? scenes.find((s) => s.name === sceneName)?.timeline;
      if (!timeline?.enabled) {
        return;
      }

      playbackStateRef.current = {
        sceneName,
        isPlaying: true,
        startTime: Date.now(),
        startAtMs,
        currentTime: startAtMs,
        direction: 1,
        timelineOverride: timelineOverride ?? null,
      };

      applyAtTime(sceneName, startAtMs);
      dispatchSceneTimelinePlayhead({ sceneName, timeMs: startAtMs, isPlaying: true });
    },
    [applyAtTime, scenes]
  );

  useEffect(() => {
    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<SceneTimelineStartDetail>).detail;
      if (detail?.sceneName) {
        startTimeline(detail);
      }
    };

    const handleStop = () => {
      stopTimeline();
    };

    window.addEventListener(SCENE_TIMELINE_START_EVENT, handleStart);
    window.addEventListener(SCENE_TIMELINE_STOP_EVENT, handleStop);
    window.addEventListener('restartSceneTimeline', handleStart);

    return () => {
      window.removeEventListener(SCENE_TIMELINE_START_EVENT, handleStart);
      window.removeEventListener(SCENE_TIMELINE_STOP_EVENT, handleStop);
      window.removeEventListener('restartSceneTimeline', handleStart);
    };
  }, [startTimeline, stopTimeline]);

  useEffect(() => {
    const tickMs = 16;
    const interval = setInterval(() => {
      const state = playbackStateRef.current;
      if (!state.isPlaying || !state.sceneName) {
        return;
      }

      const timeline = resolveTimeline(state.sceneName);
      if (!timeline?.enabled) {
        stopTimeline();
        return;
      }

      const effectiveDuration = getEffectiveTimelineDuration(timeline, bpm);
      const playbackMode = timeline.playbackMode || 'loop';
      const playbackSpeed = timeline.playbackSpeed ?? 1;
      const elapsed = (Date.now() - state.startTime) * playbackSpeed * state.direction;
      let timeMs = state.startAtMs + elapsed;

      if (playbackMode === 'pingpong') {
        if (timeMs >= effectiveDuration) {
          playbackStateRef.current.direction = -1;
          playbackStateRef.current.startTime = Date.now();
          playbackStateRef.current.startAtMs = effectiveDuration;
          timeMs = effectiveDuration;
        } else if (timeMs <= 0) {
          playbackStateRef.current.direction = 1;
          playbackStateRef.current.startTime = Date.now();
          playbackStateRef.current.startAtMs = 0;
          timeMs = 0;
        }
      } else if (playbackMode === 'once' && timeMs >= effectiveDuration) {
        timeMs = effectiveDuration;
        playbackStateRef.current.currentTime = timeMs;
        applyAtTime(state.sceneName, timeMs);
        dispatchSceneTimelinePlayhead({
          sceneName: state.sceneName,
          timeMs,
          isPlaying: false,
        });
        playbackStateRef.current.isPlaying = false;
        return;
      } else if (playbackMode === 'loop') {
        if (timeMs >= effectiveDuration) {
          playbackStateRef.current.startTime = Date.now();
          playbackStateRef.current.startAtMs = 0;
          timeMs = 0;
        }
      } else if (!timeline.loop && timeMs >= effectiveDuration) {
        timeMs = effectiveDuration;
        playbackStateRef.current.isPlaying = false;
      }

      playbackStateRef.current.currentTime = timeMs;
      applyAtTime(state.sceneName, timeMs);
      dispatchSceneTimelinePlayhead({
        sceneName: state.sceneName,
        timeMs,
        isPlaying: playbackStateRef.current.isPlaying,
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [applyAtTime, bpm, resolveTimeline, stopTimeline]);

  return {
    startTimeline,
    stopTimeline,
  };
};
