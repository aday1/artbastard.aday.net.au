import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { interpolateValue } from '../store/timeline';

/**
 * Hook that continuously updates DMX values during timeline playback
 * This ensures that DMX channels are actually updated, not just the visual slider
 */
export const useTimelinePlayback = () => {
  const {
    timelinePlayback,
    timelineSequences,
    setDmxChannel,
    stopTimelinePlayback
  } = useStore();
  
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!timelinePlayback.active || !timelinePlayback.sequenceId || !timelinePlayback.startTime) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const sequence = timelineSequences.find(s => s.id === timelinePlayback.sequenceId);
    if (!sequence) {
      console.error(`Timeline sequence ${timelinePlayback.sequenceId} not found`);
      stopTimelinePlayback();
      return;
    }

    const updateTimeline = () => {
      const state = useStore.getState();
      const playback = state.timelinePlayback;
      
      if (!playback.active || !playback.startTime) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      const now = Date.now();
      // Speed affects how fast time progresses: speed > 1 = faster, speed < 1 = slower
      const elapsed = (now - playback.startTime) * playback.speed;
      const effectiveDuration = sequence.duration;
      let position = (elapsed % effectiveDuration) / effectiveDuration;
      
      // Handle looping
      if (!playback.loop && elapsed >= effectiveDuration) {
        position = 1;
        stopTimelinePlayback();
        return;
      }

      // Update position in store
      useStore.setState(state => ({
        timelinePlayback: {
          ...state.timelinePlayback,
          position
        }
      }));

      // Update DMX values based on timeline position
      const currentTime = position * sequence.duration;
      
      sequence.channels.forEach(channelData => {
        const value = interpolateValue(channelData.keyframes, currentTime);
        if (value !== undefined) {
          const dmxValue = Math.round(Math.max(0, Math.min(255, value)));
          // Channel numbers in timeline are 1-based (DMX address), convert to 0-based index
          const channelIndex = channelData.channel >= 1 ? channelData.channel - 1 : channelData.channel;
          // Use setDmxChannel to actually send DMX values
          setDmxChannel(channelIndex, dmxValue, true);
        }
      });

      // Throttle updates to ~60fps
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      if (timeSinceLastUpdate >= 16) { // ~60fps
        lastUpdateTimeRef.current = now;
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateTimeline);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updateTimeline);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    timelinePlayback.active,
    timelinePlayback.sequenceId,
    timelinePlayback.startTime,
    timelinePlayback.speed,
    timelinePlayback.loop,
    timelineSequences,
    setDmxChannel,
    stopTimelinePlayback
  ]);
};

