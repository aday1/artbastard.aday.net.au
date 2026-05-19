import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { TimelineEvent } from '../store';

export const useActsPlaybackEngine = () => {
  const store = useStore();
  const { 
    actPlaybackState, 
    acts, 
    nextActStep, 
    setActStepProgress
  } = store;
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartTimeRef = useRef<number>(0);
  const actStartTimeRef = useRef<number>(0);
  const executedEventsRef = useRef<Set<string>>(new Set());

  // Execute a timeline event
  const executeTimelineEvent = (event: TimelineEvent) => {
    const currentStore = useStore.getState();
    const { fixtures, groups } = currentStore;
    
    if (event.type === 'midi') {
      // Execute MIDI event based on target
      if (event.targetType === 'scene' && event.targetId) {
        // Load scene
        currentStore.loadScene(event.targetId);
      } else if (event.targetType === 'fixture' && event.targetId) {
        const fixture = fixtures.find(f => f.id === event.targetId);
        if (fixture && event.targetValue !== undefined) {
          // Apply target value to fixture channels
          fixture.channels.forEach((channel, index) => {
            const dmxAddress = fixture.startAddress + index - 1;
            if (dmxAddress >= 0 && dmxAddress < 512) {
              currentStore.setDmxChannel(dmxAddress, event.targetValue!);
            }
          });
        }
      } else if (event.targetType === 'dmxChannel' && event.targetId) {
        // Apply to specific DMX channel
        const channelIndex = parseInt(event.targetId) - 1;
        if (channelIndex >= 0 && channelIndex < 512 && event.targetValue !== undefined) {
          currentStore.setDmxChannel(channelIndex, event.targetValue);
        }
      } else if (event.targetType === 'group' && event.targetId) {
        const group = groups.find(g => g.id === event.targetId);
        if (group && event.targetValue !== undefined) {
          // Apply to all fixtures in group
          group.fixtureIndices.forEach(fixtureIndex => {
            const fixture = fixtures[fixtureIndex];
            if (fixture) {
              fixture.channels.forEach((channel, index) => {
                const dmxAddress = fixture.startAddress + index - 1;
                if (dmxAddress >= 0 && dmxAddress < 512) {
                  currentStore.setDmxChannel(dmxAddress, event.targetValue!);
                }
              });
            }
          });
        }
      }
    } else if (event.type === 'osc') {
      // Execute OSC event based on target
      if (event.targetType === 'scene' && event.targetId) {
        currentStore.loadScene(event.targetId);
      } else if (event.targetType === 'fixture' && event.targetId) {
        const fixture = fixtures.find(f => f.id === event.targetId);
        if (fixture && event.oscArgs && event.oscArgs.length > 0) {
          // Apply OSC value to fixture
          const oscValue = typeof event.oscArgs[0] === 'number' 
            ? event.oscArgs[0] 
            : (event.oscArgs[0] as any)?.value || 0;
          const normalizedValue = oscValue > 1 ? Math.round(oscValue) : Math.round(oscValue * 255);
          fixture.channels.forEach((channel, index) => {
            const dmxAddress = fixture.startAddress + index - 1;
            if (dmxAddress >= 0 && dmxAddress < 512) {
              currentStore.setDmxChannel(dmxAddress, normalizedValue);
            }
          });
        }
      } else if (event.targetType === 'dmxChannel' && event.targetId) {
        const channelIndex = parseInt(event.targetId) - 1;
        if (channelIndex >= 0 && channelIndex < 512 && event.oscArgs && event.oscArgs.length > 0) {
          const oscValue = typeof event.oscArgs[0] === 'number' 
            ? event.oscArgs[0] 
            : (event.oscArgs[0] as any)?.value || 0;
          const normalizedValue = oscValue > 1 ? Math.round(oscValue) : Math.round(oscValue * 255);
          currentStore.setDmxChannel(channelIndex, normalizedValue);
        }
      } else if (event.targetType === 'group' && event.targetId) {
        const group = groups.find(g => g.id === event.targetId);
        if (group && event.oscArgs && event.oscArgs.length > 0) {
          const oscValue = typeof event.oscArgs[0] === 'number' 
            ? event.oscArgs[0] 
            : (event.oscArgs[0] as any)?.value || 0;
          const normalizedValue = oscValue > 1 ? Math.round(oscValue) : Math.round(oscValue * 255);
          group.fixtureIndices.forEach(fixtureIndex => {
            const fixture = fixtures[fixtureIndex];
            if (fixture) {
              fixture.channels.forEach((channel, index) => {
                const dmxAddress = fixture.startAddress + index - 1;
                if (dmxAddress >= 0 && dmxAddress < 512) {
                  currentStore.setDmxChannel(dmxAddress, normalizedValue);
                }
              });
            }
          });
        }
      }
    }
  };

  useEffect(() => {
    if (!actPlaybackState.isPlaying || !actPlaybackState.currentActId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      executedEventsRef.current.clear();
      return;
    }

    const act = acts.find(a => a.id === actPlaybackState.currentActId);
    if (!act || !act.steps.length) return;

    const currentStep = act.steps[actPlaybackState.currentStepIndex];
    if (!currentStep) return;

    // Calculate absolute time from act start
    let absoluteTime = 0;
    for (let i = 0; i < actPlaybackState.currentStepIndex; i++) {
      absoluteTime += act.steps[i].duration;
    }

    // Reset act start time when playback starts
    if (actStartTimeRef.current === 0) {
      actStartTimeRef.current = actPlaybackState.stepStartTime - (absoluteTime / actPlaybackState.playbackSpeed);
      executedEventsRef.current.clear();
    }

    // Reset step start time when step changes
    if (stepStartTimeRef.current !== actPlaybackState.stepStartTime) {
      stepStartTimeRef.current = actPlaybackState.stepStartTime;
    }

    // Start the playback interval
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - stepStartTimeRef.current;
      const stepDuration = currentStep.duration * actPlaybackState.playbackSpeed;
      const progress = Math.min(elapsed / stepDuration, 1);

      // Calculate current absolute time in act
      const currentAbsoluteTime = absoluteTime + (elapsed / actPlaybackState.playbackSpeed);

      // Check and execute timeline events (respecting mute/solo)
      const timelineEvents = act.timelineEvents || [];
      const hasSoloedLanes = act.channelLanes 
        ? Object.values(act.channelLanes).some(lane => lane.soloed)
        : false;
      
      timelineEvents.forEach(event => {
        // Determine which lane this event belongs to
        const laneId = event.type === 'midi' ? -1 : event.type === 'osc' ? -2 : undefined;
        const laneState = laneId !== undefined ? act.channelLanes?.[laneId] : undefined;
        const isMuted = laneState?.muted || false;
        const isSoloed = laneState?.soloed || false;
        
        // Skip if muted or if there are soloed lanes and this one isn't soloed
        if (isMuted || (hasSoloedLanes && !isSoloed)) {
          return;
        }
        
        if (!executedEventsRef.current.has(event.id)) {
          // Check if event time has been reached (with 50ms tolerance)
          if (Math.abs(currentAbsoluteTime - event.time) < 50 || currentAbsoluteTime >= event.time) {
            executeTimelineEvent(event);
            executedEventsRef.current.add(event.id);
          }
        }
      });

      // Update progress
      setActStepProgress(progress);

      // Auto-advance to next step when current step completes
      if (progress >= 1) {
        nextActStep();
      }
    }, 50); // Update every 50ms for smooth progress

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    actPlaybackState.isPlaying,
    actPlaybackState.currentActId,
    actPlaybackState.currentStepIndex,
    actPlaybackState.stepStartTime,
    actPlaybackState.playbackSpeed,
    acts,
    nextActStep,
    setActStepProgress
  ]);

  // Reset when playback stops
  useEffect(() => {
    if (!actPlaybackState.isPlaying) {
      executedEventsRef.current.clear();
      actStartTimeRef.current = 0;
    }
  }, [actPlaybackState.isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      executedEventsRef.current.clear();
    };
  }, []);
};
