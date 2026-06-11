import axios from 'axios';
import { Scene } from '../types';

export interface SceneSlice {
  // Scenes State
  scenes: Scene[];

  // Scene Actions
  saveScene: (name: string, oscAddress: string) => void;
  loadScene: (nameOrIndex: string | number) => void;
  deleteScene: (name: string) => void;
  updateScene: (originalName: string, updates: Partial<Scene>) => void;
  setTuningScene: (name: string | null) => void;
  updateActiveScene: () => void;
}

export const createSceneSlice = (
  set: any,
  get: any
): SceneSlice => ({
  // Initial state
  scenes: [],

  // Scene Actions
  saveScene: (name, oscAddress) => {
    const { dmxChannels, channelAutopilots, panTiltAutopilot, modularAutomation } = get();
    const newScene: Scene = {
      name,
      channelValues: [...dmxChannels],
      oscAddress,
      // Note: These properties may not exist on Scene type - simplified for now
      autopilots: { ...channelAutopilots },
      panTiltAutopilot: { ...panTiltAutopilot },
      modularAutomation: {
        color: { ...modularAutomation.color },
        dimmer: { ...modularAutomation.dimmer },
        panTilt: { ...modularAutomation.panTilt },
        effects: { ...modularAutomation.effects },
        animationIds: {
          color: null,
          dimmer: null,
          panTilt: null,
          effects: null
        }
      }
    } as any;

    const scenes = [...get().scenes];
    const existingIndex = scenes.findIndex(s => s.name === name);

    if (existingIndex !== -1) {
      scenes[existingIndex] = newScene;
      console.log(`[Scene Store] Updated scene "${name}"`);
    } else {
      scenes.push(newScene);
      console.log(`[Scene Store] Created new scene "${name}"`);
    }

    set({ scenes });

    axios.post('/api/scenes', {
      name,
      oscAddress,
      channelValues: [...dmxChannels]
    })
      .then(() => {
        get().addNotification?.({ message: `Scene '${name}' saved`, type: 'success' });
      })
      .catch(error => {
        console.error('Failed to save scene:', error);
        get().addNotification?.({ message: `Failed to save scene '${name}'`, type: 'error', priority: 'high' });
      });
  },

  loadScene: (nameOrIndex) => {
    const { scenes, isTransitioning, currentTransitionFrame, dmxChannels: currentDmxState, transitionDuration, groups, fixtures } = get();
    let scene;

    if (typeof nameOrIndex === 'string') {
      scene = scenes.find(s => s.name === nameOrIndex);
    } else if (typeof nameOrIndex === 'number') {
      scene = scenes[nameOrIndex];
    }

    if (scene) {
      const sceneName = scene.name;
      console.log(`[Scene Store] Loading scene "${sceneName}" with transition`);

      if (isTransitioning && currentTransitionFrame) {
        cancelAnimationFrame(currentTransitionFrame);
        set({ currentTransitionFrame: null });
      }

      const targetDmxValues = [...scene.channelValues];

      groups.forEach(group => {
        if (group.ignoreSceneChanges) {
          group.fixtureIndices.forEach(fixtureIndex => {
            const fixture = fixtures[fixtureIndex];
            if (fixture) {
              const startAddr = fixture.startAddress - 1;
              const endAddr = startAddr + fixture.channels.length;
              for (let i = startAddr; i < endAddr; i++) {
                targetDmxValues[i] = currentDmxState[i];
              }
            }
          });
        }
      });

      set({
        isTransitioning: true,
        fromDmxValues: [...currentDmxState],
        toDmxValues: targetDmxValues,
        transitionStartTime: Date.now(),
        activeSceneName: sceneName,
      });

      if (scene.timeline && scene.timeline.enabled) {
        window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
        
        const firstKeyframe = scene.timeline.keyframes[0];
        if (firstKeyframe) {
          Object.entries(firstKeyframe.channelValues).forEach(([channelIndex, value]) => {
            if (Number(channelIndex) < targetDmxValues.length) {
              targetDmxValues[Number(channelIndex)] = value;
            }
          });
        }
        
        targetDmxValues.forEach((value, index) => {
          if (index < currentDmxState.length) {
            get().setDmxChannel(index, value);
          }
        });
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('startSceneTimeline', { 
            detail: { sceneName } 
          }));
        }, 100);
      } else {
        // Regular scene load with transition animation
        const startTransition = () => {
          const now = Date.now();
          const { transitionStartTime, transitionDuration, fromDmxValues, toDmxValues, isTransitioning } = get();
          
          if (!isTransitioning || !transitionStartTime || !fromDmxValues || !toDmxValues) {
            return;
          }

          const elapsed = now - transitionStartTime;
          const progress = Math.min(elapsed / transitionDuration, 1);

          const easingFunctions = {
            linear: (t: number) => t,
            easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeIn: (t: number) => t * t,
            easeOut: (t: number) => t * (2 - t),
            easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
          };

          const easing = get().transitionEasing || 'easeInOut';
          const easedProgress = easingFunctions[easing](progress);

          const interpolatedValues = fromDmxValues.map((fromValue, index) => {
            const toValue = toDmxValues[index] || 0;
            return Math.round(fromValue + (toValue - fromValue) * easedProgress);
          });

          get().setDmxChannelsForTransition(interpolatedValues);

          if (progress < 1) {
            const frameId = requestAnimationFrame(startTransition);
            set({ currentTransitionFrame: frameId });
          } else {
            get().clearTransitionState();
            get().setActiveSceneName?.(sceneName);
            get().addNotification?.({
              message: `Scene "${sceneName}" loaded`,
              type: 'success',
              priority: 'low'
            });
          }
        };

        startTransition();
      }
    } else {
      get().addNotification?.({
        message: `Scene not found: ${nameOrIndex}`,
        type: 'error',
        priority: 'medium'
      });
    }
  },

  deleteScene: (name) => {
    const scenes = get().scenes.filter(s => s.name !== name);
    set({ scenes });

    axios.delete(`/api/scenes/${encodeURIComponent(name)}`)
      .then(() => {
        get().addNotification?.({ message: `Scene '${name}' deleted`, type: 'success' });
      })
      .catch(error => {
        console.error('Failed to delete scene:', error);
        get().addNotification?.({ message: `Failed to delete scene '${name}'`, type: 'error' });
      });
  },

  updateScene: (originalName, updates) => {
    const scenes = get().scenes.map(scene =>
      scene.name === originalName ? { ...scene, ...updates } : scene
    );
    set({ scenes });

    axios.put(`/api/scenes/${encodeURIComponent(originalName)}`, updates)
      .then(() => {
        get().addNotification?.({ message: `Scene '${originalName}' updated`, type: 'success' });
      })
      .catch(error => {
        console.error('Failed to update scene:', error);
        get().addNotification?.({ message: `Failed to update scene '${originalName}'`, type: 'error' });
      });
  },

  setTuningScene: (name) => {
    set({ tuningSceneName: name });
  },

  updateActiveScene: () => {
    const { activeSceneName, scenes, dmxChannels } = get();
    if (!activeSceneName) {
      get().addNotification?.({ message: 'No active scene to update', type: 'warning' });
      return;
    }

    const scene = scenes.find(s => s.name === activeSceneName);
    if (!scene) return;

    const updates = { channelValues: [...dmxChannels] };
    get().updateScene(activeSceneName, updates);

    get().addNotification?.({
      message: `Scene "${activeSceneName}" fine-tuned with current sliders`,
      type: 'success'
    });
  },
});

