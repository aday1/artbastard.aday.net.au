import type { SceneTimeline, SceneTimelineKeyframe } from '../store';

export type SceneTimelineEasing = SceneTimelineKeyframe['easing'];

export function getEffectiveTimelineDuration(
  timeline: SceneTimeline,
  bpm: number
): number {
  if (timeline.syncToBpm && bpm > 0) {
    return (timeline.bpmMultiplier || 4) * (60000 / bpm);
  }
  return timeline.duration;
}

export function interpolateTimelineValue(
  startValue: number,
  endValue: number,
  progress: number,
  easing: SceneTimelineEasing = 'linear'
): number {
  let easedProgress = progress;

  switch (easing) {
    case 'smooth':
      easedProgress = progress * progress * (3 - 2 * progress);
      break;
    case 'ease-in':
      easedProgress = progress * progress;
      break;
    case 'ease-out':
      easedProgress = 1 - (1 - progress) * (1 - progress);
      break;
    case 'ease-in-out':
      easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      break;
    case 'step':
      easedProgress = progress >= 1 ? 1 : 0;
      break;
    default:
      easedProgress = progress;
  }

  return Math.round(startValue + (endValue - startValue) * easedProgress);
}

export function getSceneTimelineKeyframesForTime(
  timeline: SceneTimeline,
  timeMs: number,
  effectiveDuration: number
): {
  prev: SceneTimelineKeyframe | null;
  next: SceneTimelineKeyframe | null;
  progress: number;
  normalizedTime: number;
} {
  const normalizedTime = timeline.loop
    ? timeMs % effectiveDuration
    : Math.min(timeMs, effectiveDuration);

  let prev: SceneTimelineKeyframe | null = null;
  let next: SceneTimelineKeyframe | null = null;

  for (const kf of timeline.keyframes) {
    if (kf.time <= normalizedTime) {
      prev = kf;
    }
    if (kf.time >= normalizedTime && !next) {
      next = kf;
      break;
    }
  }

  if (!next && prev) {
    next = prev;
  }

  let progress = 0;
  if (prev && next && prev.id !== next.id) {
    const timeDiff = next.time - prev.time;
    const elapsed = normalizedTime - prev.time;
    progress = timeDiff > 0 ? elapsed / timeDiff : 0;
  }

  return { prev, next, progress, normalizedTime };
}

/** Build DMX channel updates for a point on the scene timeline. */
export function computeSceneTimelineDmxUpdates(
  timeline: SceneTimeline,
  timeMs: number,
  effectiveDuration: number
): Record<number, number> {
  if (!timeline.enabled) {
    return {};
  }

  const { prev, next, progress } = getSceneTimelineKeyframesForTime(
    timeline,
    timeMs,
    effectiveDuration
  );

  if (!prev || !next) {
    return {};
  }

  const hasSoloedChannels = timeline.channelLanes
    ? Object.values(timeline.channelLanes).some((lane) => lane.soloed)
    : false;

  const allChannels = new Set([
    ...Object.keys(prev.channelValues).map(Number),
    ...Object.keys(next.channelValues).map(Number),
  ]);

  const updates: Record<number, number> = {};

  allChannels.forEach((channelIndex) => {
    const laneState = timeline.channelLanes?.[channelIndex];
    const isMuted = laneState?.muted || false;
    const isSoloed = laneState?.soloed || false;

    if (isMuted || (hasSoloedChannels && !isSoloed)) {
      return;
    }

    const startValue = prev.channelValues[channelIndex] || 0;
    const endValue = next.channelValues[channelIndex] || 0;
    updates[channelIndex] = interpolateTimelineValue(
      startValue,
      endValue,
      progress,
      prev.easing || 'linear'
    );
  });

  return updates;
}

export interface SceneTimelinePlaybackTickDetail {
  sceneName: string;
  timeMs: number;
  isPlaying: boolean;
}

export const SCENE_TIMELINE_PLAYHEAD_EVENT = 'sceneTimelinePlayhead';

export function dispatchSceneTimelinePlayhead(detail: SceneTimelinePlaybackTickDetail): void {
  window.dispatchEvent(new CustomEvent(SCENE_TIMELINE_PLAYHEAD_EVENT, { detail }));
}

export interface SceneTimelineStartDetail {
  sceneName: string;
  /** Use editor draft timeline instead of the saved scene. */
  timelineOverride?: SceneTimeline;
  startAtMs?: number;
}

export const SCENE_TIMELINE_START_EVENT = 'startSceneTimeline';
export const SCENE_TIMELINE_STOP_EVENT = 'stopSceneTimeline';
