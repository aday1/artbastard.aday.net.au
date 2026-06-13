import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  collectLineChannelTargets,
  easingFunctions,
  interpolateChannelTargets,
  lineDurationMs,
} from '../utils/transitionTrackerEngine';
import type { TransitionPatternLine } from '../store/types';

export const useTransitionTrackerPlayback = (enabled = true) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rampRef = useRef<number | null>(null);
  const rampStartRef = useRef<number>(0);
  const rampFromRef = useRef<number[]>([]);
  const rampTargetsRef = useRef<Record<number, number>>({});
  const rampEasingRef = useRef<keyof typeof easingFunctions>('easeInOut');
  const rampDurationRef = useRef(1000);

  const playback = useStore((s) => s.transitionTrackerPlayback);
  const patterns = useStore((s) => s.transitionPatterns);
  const bpm = useStore((s) => s.bpm);
  const dmxChannels = useStore((s) => s.dmxChannels);
  const setMultipleDmxChannels = useStore((s) => s.setMultipleDmxChannels);
  const loadScene = useStore((s) => s.loadScene);
  const setPendingSceneTransitionOverride = useStore((s) => s.setPendingSceneTransitionOverride);
  const stopTransitionTrackerPlayback = useStore((s) => s.stopTransitionTrackerPlayback);
  const setTransitionTrackerLine = useStore((s) => s.setTransitionTrackerLine);
  const setDmxChannelsForTransition = useStore((s) => s.setDmxChannelsForTransition);
  const clearTransitionState = useStore((s) => s.clearTransitionState);
  const isTransitioning = useStore((s) => s.isTransitioning);

  const applyLine = (line: TransitionPatternLine, patternId: string) => {
    const state = useStore.getState();
    const pattern = state.transitionPatterns.find((p) => p.id === patternId);
    if (!pattern) return;

    if (line.sceneName) {
      setPendingSceneTransitionOverride({
        transitionMs: line.fx.transitionMs,
        easing: line.fx.easing,
      });
      loadScene(line.sceneName);
    }

    const targets = collectLineChannelTargets(line);
    const keys = Object.keys(targets);
    if (keys.length === 0) return;

    if (line.fx.snap) {
      const updates: Record<number, number> = {};
      for (const [ch, val] of Object.entries(targets)) {
        updates[Number(ch)] = val;
      }
      setMultipleDmxChannels(updates, true);
      return;
    }

    rampFromRef.current = [...state.dmxChannels];
    rampTargetsRef.current = targets;
    rampEasingRef.current = line.fx.easing;
    rampDurationRef.current = Math.max(16, line.fx.transitionMs);
    rampStartRef.current = performance.now();

    const tickRamp = () => {
      const elapsed = performance.now() - rampStartRef.current;
      const progress = Math.min(1, elapsed / rampDurationRef.current);
      const next = interpolateChannelTargets(
        rampFromRef.current,
        rampTargetsRef.current,
        progress,
        rampEasingRef.current
      );
      setDmxChannelsForTransition(next);
      if (progress < 1) {
        rampRef.current = requestAnimationFrame(tickRamp);
      } else {
        rampRef.current = null;
        clearTransitionState();
      }
    };

    if (rampRef.current) cancelAnimationFrame(rampRef.current);
    rampRef.current = requestAnimationFrame(tickRamp);
  };

  useEffect(() => {
    if (!enabled || !playback.active || !playback.patternId) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rampRef.current) {
        cancelAnimationFrame(rampRef.current);
        rampRef.current = null;
      }
      if (!enabled && playback.active) {
        stopTransitionTrackerPlayback();
      }
      return;
    }

    const pattern = patterns.find((p) => p.id === playback.patternId);
    if (!pattern) {
      stopTransitionTrackerPlayback();
      return;
    }

    const scheduleLine = (lineIndex: number) => {
      const line = pattern.lines[lineIndex];
      if (!line) {
        stopTransitionTrackerPlayback();
        return;
      }

      setTransitionTrackerLine(lineIndex);
      applyLine(line, pattern.id);

      const duration = playback.syncToBpm
        ? lineDurationMs(bpm, pattern.linesPerBeat, playback.speed)
        : Math.max(50, line.fx.transitionMs);

      timerRef.current = setTimeout(() => {
        const current = useStore.getState().transitionTrackerPlayback;
        if (!current.active || current.patternId !== pattern.id) return;

        let nextLine = lineIndex + 1;
        if (nextLine >= pattern.length) {
          if (current.loop) {
            nextLine = 0;
          } else {
            stopTransitionTrackerPlayback();
            return;
          }
        }
        scheduleLine(nextLine);
      }, duration);
    };

    scheduleLine(playback.currentLine);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rampRef.current) {
        cancelAnimationFrame(rampRef.current);
        rampRef.current = null;
      }
    };
  }, [
    enabled,
    playback.active,
    playback.patternId,
    playback.loop,
    playback.speed,
    playback.syncToBpm,
    patterns,
    bpm,
    loadScene,
    setPendingSceneTransitionOverride,
    stopTransitionTrackerPlayback,
    setTransitionTrackerLine,
    setMultipleDmxChannels,
    setDmxChannelsForTransition,
    clearTransitionState,
  ]);
};
