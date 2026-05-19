import { useEffect, useRef, useCallback } from 'react';
import { useStore, SceneTimeline, SceneTimelineKeyframe } from '../store';

interface ScenePlaybackState {
  sceneName: string | null;
  isPlaying: boolean;
  startTime: number;
  currentTime: number;
  loopCount: number;
}

export const useSceneTimelinePlayback = () => {
  const { scenes, setDmxChannel } = useStore();
  const playbackStateRef = useRef<ScenePlaybackState>({
    sceneName: null,
    isPlaying: false,
    startTime: 0,
    currentTime: 0,
    loopCount: 0
  });

  // Interpolate between two keyframes with various easing functions
  const interpolateValue = (
    startValue: number,
    endValue: number,
    progress: number,
    easing: string = 'linear'
  ): number => {
    let easedProgress = progress;

    switch (easing) {
      case 'linear':
        easedProgress = progress;
        break;
      case 'smooth':
        // Smooth S-curve (smoothstep)
        easedProgress = progress * progress * (3 - 2 * progress);
        break;
      case 'ease-in':
        easedProgress = progress * progress;
        break;
      case 'ease-out':
        easedProgress = 1 - (1 - progress) * (1 - progress);
        break;
      case 'ease-in-out':
        easedProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        break;
      case 'step':
        // Instant change - no interpolation
        easedProgress = progress >= 1 ? 1 : 0;
        break;
      default:
        easedProgress = progress;
    }

    return Math.round(startValue + (endValue - startValue) * easedProgress);
  };

  // Get keyframes for a given time
  const getKeyframesForTime = (timeline: SceneTimeline, time: number): {
    prev: SceneTimelineKeyframe | null;
    next: SceneTimelineKeyframe | null;
    progress: number;
  } => {
    const normalizedTime = timeline.loop ? time % timeline.duration : Math.min(time, timeline.duration);
    
    let prev: SceneTimelineKeyframe | null = null;
    let next: SceneTimelineKeyframe | null = null;

    for (let i = 0; i < timeline.keyframes.length; i++) {
      const kf = timeline.keyframes[i];
      if (kf.time <= normalizedTime) {
        prev = kf;
      }
      if (kf.time >= normalizedTime && !next) {
        next = kf;
        break;
      }
    }

    // If no next keyframe, use the last one
    if (!next && prev) {
      next = prev;
    }

    // Calculate progress between keyframes
    let progress = 0;
    if (prev && next && prev.id !== next.id) {
      const timeDiff = next.time - prev.time;
      const elapsed = normalizedTime - prev.time;
      progress = timeDiff > 0 ? elapsed / timeDiff : 0;
    }

    return { prev, next, progress };
  };

  // Apply timeline values at a specific time
  const applyTimelineAtTime = (timeline: SceneTimeline, time: number) => {
    const { prev, next, progress } = getKeyframesForTime(timeline, time);
    
    if (!prev || !next) return;

    // Check for soloed channels
    const hasSoloedChannels = timeline.channelLanes 
      ? Object.values(timeline.channelLanes).some(lane => lane.soloed)
      : false;

    // Get all unique channel indices from both keyframes
    const allChannels = new Set([
      ...Object.keys(prev.channelValues).map(Number),
      ...Object.keys(next.channelValues).map(Number)
    ]);

    // Interpolate values for each channel
    allChannels.forEach(channelIndex => {
      const laneState = timeline.channelLanes?.[channelIndex];
      const isMuted = laneState?.muted || false;
      const isSoloed = laneState?.soloed || false;
      
      // Skip if muted or if there are soloed channels and this one isn't soloed
      if (isMuted || (hasSoloedChannels && !isSoloed)) {
        return;
      }
      
      const startValue = prev.channelValues[channelIndex] || 0;
      const endValue = next.channelValues[channelIndex] || 0;
      const interpolatedValue = interpolateValue(
        startValue,
        endValue,
        progress,
        prev.easing || 'linear'
      );

      setDmxChannel(channelIndex, interpolatedValue);
    });
  };

  // Stop timeline playback
  const stopTimeline = useCallback(() => {
    playbackStateRef.current.isPlaying = false;
    playbackStateRef.current.sceneName = null;
  }, []);

  // Start timeline playback
  const startTimeline = useCallback((sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName);
    if (!scene || !scene.timeline || !scene.timeline.enabled) return;

    playbackStateRef.current = {
      sceneName,
      isPlaying: true,
      startTime: Date.now(),
      currentTime: 0,
      loopCount: 0
    };

    // Apply initial keyframe
    const firstKeyframe = scene.timeline.keyframes[0];
    if (firstKeyframe) {
      Object.entries(firstKeyframe.channelValues).forEach(([channelIndex, value]) => {
        setDmxChannel(Number(channelIndex), value);
      });
    }
  }, [scenes, setDmxChannel]);

  // Listen for scene timeline start/stop events
  useEffect(() => {
    const handleStartTimeline = (event: CustomEvent) => {
      const { sceneName } = event.detail;
      startTimeline(sceneName);
    };

    const handleStopTimeline = () => {
      stopTimeline();
    };

    window.addEventListener('startSceneTimeline', handleStartTimeline as EventListener);
    window.addEventListener('stopSceneTimeline', handleStopTimeline);
    return () => {
      window.removeEventListener('startSceneTimeline', handleStartTimeline as EventListener);
      window.removeEventListener('stopSceneTimeline', handleStopTimeline);
    };
  }, [startTimeline, stopTimeline]);

  // Playback loop
  useEffect(() => {
    const interval = setInterval(() => {
      const state = playbackStateRef.current;
      if (!state.isPlaying || !state.sceneName) return;

      const scene = scenes.find(s => s.name === state.sceneName);
      if (!scene || !scene.timeline || !scene.timeline.enabled) {
        playbackStateRef.current.isPlaying = false;
        return;
      }

      const now = Date.now();
      const elapsed = now - state.startTime;
      playbackStateRef.current.currentTime = elapsed;

      // Apply timeline values
      applyTimelineAtTime(scene.timeline, elapsed);

      // Check if timeline should loop or stop
      if (!scene.timeline.loop && elapsed >= scene.timeline.duration) {
        playbackStateRef.current.isPlaying = false;
        // Apply final keyframe values
        const lastKeyframe = scene.timeline.keyframes[scene.timeline.keyframes.length - 1];
        if (lastKeyframe) {
          Object.entries(lastKeyframe.channelValues).forEach(([channelIndex, value]) => {
            setDmxChannel(Number(channelIndex), value);
          });
        }
      } else if (scene.timeline.loop && elapsed >= scene.timeline.duration) {
        // Reset for loop
        playbackStateRef.current.startTime = now;
        playbackStateRef.current.currentTime = 0;
        playbackStateRef.current.loopCount++;
      }
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [scenes, setDmxChannel, applyTimelineAtTime]);

  return {
    startTimeline,
    stopTimeline,
    isPlaying: playbackStateRef.current.isPlaying,
    currentScene: playbackStateRef.current.sceneName
  };
};
