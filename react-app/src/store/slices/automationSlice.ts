import { StateCreator } from 'zustand';
import { 
  AutopilotConfig, 
  PanTiltAutopilotConfig, 
  ColorSliderAutopilotConfig,
  ModularAutomationState,
  ChannelEnvelope,
  EnvelopeAutomationState,
  Notification
} from '../types';

export interface AutomationState {
  // Autopilot System State
  channelAutopilots: Record<number, AutopilotConfig>;
  panTiltAutopilot: PanTiltAutopilotConfig;
  colorSliderAutopilot: ColorSliderAutopilotConfig;
  // Use DOM/Node compatible timer type so this works in both environments
  autopilotUpdateInterval: ReturnType<typeof setInterval> | null;
  lastAutopilotUpdate: number;

  // Modular Automation System State
  modularAutomation: ModularAutomationState;

  // Envelope Automation System State
  envelopeAutomation: EnvelopeAutomationState;

  // Autopilot Actions
  setChannelAutopilot: (channelIndex: number, config: AutopilotConfig) => void;
  removeChannelAutopilot: (channelIndex: number) => void;
  setPanTiltAutopilot: (config: Partial<PanTiltAutopilotConfig>) => void;
  togglePanTiltAutopilot: () => void;
  setColorSliderAutopilot: (config: Partial<ColorSliderAutopilotConfig>) => void;
  toggleColorSliderAutopilot: () => void;
  updateAutopilotValues: () => void;
  startAutopilotSystem: () => void;
  stopAutopilotSystem: () => void;

  // Modular Automation Actions
  setColorAutomation: (config: Partial<ModularAutomationState['color']>) => void;
  setDimmerAutomation: (config: Partial<ModularAutomationState['dimmer']>) => void;
  setPanTiltAutomation: (config: Partial<ModularAutomationState['panTilt']>) => void;
  setEffectsAutomation: (config: Partial<ModularAutomationState['effects']>) => void;
  toggleColorAutomation: () => void;
  toggleDimmerAutomation: () => void;
  togglePanTiltAutomation: () => void;
  toggleEffectsAutomation: () => void;
  startModularAnimation: (type: 'color' | 'dimmer' | 'panTilt' | 'effects') => void;
  stopModularAnimation: (type: 'color' | 'dimmer' | 'panTilt' | 'effects') => void;
  stopAllModularAnimations: () => void;
  applyModularAutomation: (type: 'color' | 'dimmer' | 'panTilt' | 'effects', fixtureId: string, progress: number) => void;

  // Envelope Automation Actions
  addEnvelope: (envelope: Omit<ChannelEnvelope, 'id'>) => void;
  updateEnvelope: (id: string, updates: Partial<ChannelEnvelope>) => void;
  removeEnvelope: (id: string) => void;
  toggleEnvelope: (id: string) => void;
  toggleGlobalEnvelope: () => void;
  startEnvelopeAnimation: () => void;
  stopEnvelopeAnimation: () => void;
  setEnvelopeSpeed: (speed: number) => void;
}

// Note: We deliberately type this slice creator broadly as `any` for easier integration
// with the existing monolithic store while we refactor toward fully-typed slices.
export const createAutomationSlice: StateCreator<any> = (set, get) => ({
  // Initial Autopilot State
  channelAutopilots: {},
  panTiltAutopilot: {
    enabled: false,
    pathType: 'circle',
    speed: 0.5,
    size: 50,
    centerX: 128,
    centerY: 128,
    syncToBPM: false,
    phase: 0
  },
  colorSliderAutopilot: {
    enabled: false,
    type: 'sine',
    speed: 0.2,
    range: { min: 0, max: 360 },
    syncToBPM: false,
    phase: 0
  },
  autopilotUpdateInterval: null,
  lastAutopilotUpdate: Date.now(),

  // Initial Modular Automation State
  modularAutomation: {
    color: {
      enabled: false,
      type: 'rainbow',
      speed: 1.0,
      intensity: 100,
      syncToBPM: true,
      colors: [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 0 },
        { r: 255, g: 0, b: 255 },
        { r: 0, g: 255, b: 255 }
      ],
      hueRange: { start: 0, end: 360 },
      saturation: 100,
      brightness: 100,
      phase: 0
    },
    dimmer: {
      enabled: false,
      type: 'breathe',
      speed: 0.5,
      range: { min: 0, max: 255 },
      syncToBPM: true,
      pattern: 'smooth',
      phase: 0
    },
    panTilt: {
      enabled: false,
      pathType: 'circle',
      size: 50,
      speed: 1.0,
      centerX: 127,
      centerY: 127,
      syncToBPM: true,
      phase: 0
    },
    effects: {
      enabled: false,
      type: 'gobo_cycle',
      speed: 0.8,
      range: { min: 0, max: 255 },
      syncToBPM: true,
      direction: 'forward'
    },
    animationIds: {
      color: null,
      dimmer: null,
      panTilt: null,
      effects: null
    }
  },

  // Initial Envelope Automation State
  envelopeAutomation: (() => {
    try {
      const saved = localStorage.getItem('envelopeAutomation');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          envelopes: parsed.envelopes || [],
          globalEnabled: false,
          animationId: null,
          speed: parsed.speed || 1.0
        };
      }
    } catch (e) {
      console.error('Failed to load envelope automation from localStorage:', e);
    }
    return {
      envelopes: [],
      globalEnabled: false,
      animationId: null,
      speed: 1.0
    };
  })(),

  // Autopilot Actions (simplified - full implementation would require access to DMX channels, fixtures, etc.)
  setChannelAutopilot: (channelIndex, config) => {
    set(state => ({
      channelAutopilots: {
        ...state.channelAutopilots,
        [channelIndex]: config
      }
    }));
    if (config.enabled && !get().autopilotUpdateInterval) {
      get().startAutopilotSystem();
    }
  },

  removeChannelAutopilot: (channelIndex) => {
    set(state => {
      const newAutopilots = { ...state.channelAutopilots };
      delete newAutopilots[channelIndex];
      return { channelAutopilots: newAutopilots };
    });
  },

  setPanTiltAutopilot: (config) => {
    const currentConfig = get().panTiltAutopilot;
    const newConfig = { ...currentConfig, ...config };
    set({ panTiltAutopilot: newConfig });
    if (newConfig.enabled && !get().autopilotUpdateInterval) {
      get().startAutopilotSystem();
    }
  },

  togglePanTiltAutopilot: () => {
    const enabled = !get().panTiltAutopilot.enabled;
    get().setPanTiltAutopilot({ enabled });
  },

  setColorSliderAutopilot: (config) => {
    const currentConfig = get().colorSliderAutopilot;
    const newConfig = { ...currentConfig, ...config };
    if (newConfig.speed !== undefined) {
      newConfig.speed = Math.max(0.1, Math.min(1.0, newConfig.speed));
    }
    set({ colorSliderAutopilot: newConfig });
    if (newConfig.enabled && !get().autopilotUpdateInterval) {
      get().startAutopilotSystem();
    }
  },

  toggleColorSliderAutopilot: () => {
    const enabled = !get().colorSliderAutopilot.enabled;
    get().setColorSliderAutopilot({ enabled });
  },

  updateAutopilotValues: () => {
    // This requires access to DMX channels, fixtures, etc. - would need to be implemented
    // with access to other slices or passed as dependencies
    console.warn('updateAutopilotValues needs full store context - implement in integrated store');
  },

  startAutopilotSystem: () => {
    const { autopilotUpdateInterval } = get();
    if (autopilotUpdateInterval) return;

    const interval = setInterval(() => {
      get().updateAutopilotValues();
    }, 50);

    set({ autopilotUpdateInterval: interval });
    get().addNotification({ message: 'Autopilot system started', type: 'success' });
  },

  stopAutopilotSystem: () => {
    const { autopilotUpdateInterval } = get();
    if (autopilotUpdateInterval) {
      clearInterval(autopilotUpdateInterval);
      set({ autopilotUpdateInterval: null });
      get().addNotification({ message: 'Autopilot system stopped', type: 'info' });
    }
  },

  // Modular Automation Actions
  setColorAutomation: (config) => {
    set((state) => ({
      modularAutomation: {
        ...state.modularAutomation,
        color: { ...state.modularAutomation.color, ...config }
      }
    }));
  },

  setDimmerAutomation: (config) => {
    set((state) => ({
      modularAutomation: {
        ...state.modularAutomation,
        dimmer: { ...state.modularAutomation.dimmer, ...config }
      }
    }));
  },

  setPanTiltAutomation: (config) => {
    set((state) => ({
      modularAutomation: {
        ...state.modularAutomation,
        panTilt: { ...state.modularAutomation.panTilt, ...config }
      }
    }));
  },

  setEffectsAutomation: (config) => {
    set((state) => ({
      modularAutomation: {
        ...state.modularAutomation,
        effects: { ...state.modularAutomation.effects, ...config }
      }
    }));
  },

  toggleColorAutomation: () => {
    const { modularAutomation } = get();
    const newEnabled = !modularAutomation.color.enabled;
    get().setColorAutomation({ enabled: newEnabled });
    if (newEnabled) {
      get().startModularAnimation('color');
    } else {
      get().stopModularAnimation('color');
    }
  },

  toggleDimmerAutomation: () => {
    const { modularAutomation } = get();
    const newEnabled = !modularAutomation.dimmer.enabled;
    get().setDimmerAutomation({ enabled: newEnabled });
    if (newEnabled) {
      get().startModularAnimation('dimmer');
    } else {
      get().stopModularAnimation('dimmer');
    }
  },

  togglePanTiltAutomation: () => {
    const { modularAutomation } = get();
    const newEnabled = !modularAutomation.panTilt.enabled;
    get().setPanTiltAutomation({ enabled: newEnabled });
    if (newEnabled) {
      get().startModularAnimation('panTilt');
    } else {
      get().stopModularAnimation('panTilt');
    }
  },

  toggleEffectsAutomation: () => {
    const { modularAutomation } = get();
    const newEnabled = !modularAutomation.effects.enabled;
    get().setEffectsAutomation({ enabled: newEnabled });
    if (newEnabled) {
      get().startModularAnimation('effects');
    } else {
      get().stopModularAnimation('effects');
    }
  },

  startModularAnimation: (type) => {
    // Full implementation requires animation loop - simplified for now
    console.warn(`startModularAnimation(${type}) needs full implementation with animation loop`);
  },

  stopModularAnimation: (type) => {
    const { modularAutomation } = get();
    const animationId = modularAutomation.animationIds[type];
    if (animationId) {
      cancelAnimationFrame(animationId);
      set((state) => ({
        modularAutomation: {
          ...state.modularAutomation,
          animationIds: { ...state.modularAutomation.animationIds, [type]: null }
        }
      }));
    }
  },

  stopAllModularAnimations: () => {
    const { modularAutomation } = get();
    Object.entries(modularAutomation.animationIds).forEach(([type, animationId]) => {
      if (animationId && typeof animationId === 'number') {
        cancelAnimationFrame(animationId);
      }
    });
    set((state) => ({
      modularAutomation: {
        ...state.modularAutomation,
        animationIds: { color: null, dimmer: null, panTilt: null, effects: null }
      }
    }));
  },

  applyModularAutomation: (type, fixtureId, progress) => {
    // Full implementation requires fixture access and DMX channel updates
    console.warn(`applyModularAutomation(${type}, ${fixtureId}, ${progress}) needs full implementation`);
  },

  // Envelope Automation Actions
  addEnvelope: (envelope) => {
    const newEnvelope: ChannelEnvelope = {
      ...envelope,
      id: `envelope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
    set(state => {
      const updated = {
        envelopeAutomation: {
          ...state.envelopeAutomation,
          envelopes: [...state.envelopeAutomation.envelopes, newEnvelope]
        }
      };
      try {
        localStorage.setItem('envelopeAutomation', JSON.stringify({
          envelopes: updated.envelopeAutomation.envelopes,
          speed: updated.envelopeAutomation.speed
        }));
      } catch (e) {
        console.error('Failed to save envelope automation to localStorage:', e);
      }
      return updated;
    });
    if (get().envelopeAutomation.globalEnabled) {
      get().startEnvelopeAnimation();
    }
  },

  updateEnvelope: (id, updates) => {
    set(state => {
      const updated = {
        envelopeAutomation: {
          ...state.envelopeAutomation,
          envelopes: state.envelopeAutomation.envelopes.map(env =>
            env.id === id ? { ...env, ...updates } : env
          )
        }
      };
      try {
        localStorage.setItem('envelopeAutomation', JSON.stringify({
          envelopes: updated.envelopeAutomation.envelopes,
          speed: updated.envelopeAutomation.speed
        }));
      } catch (e) {
        console.error('Failed to save envelope automation to localStorage:', e);
      }
      return updated;
    });
  },

  removeEnvelope: (id) => {
    set(state => {
      const updated = {
        envelopeAutomation: {
          ...state.envelopeAutomation,
          envelopes: state.envelopeAutomation.envelopes.filter(env => env.id !== id)
        }
      };
      try {
        localStorage.setItem('envelopeAutomation', JSON.stringify({
          envelopes: updated.envelopeAutomation.envelopes,
          speed: updated.envelopeAutomation.speed
        }));
      } catch (e) {
        console.error('Failed to save envelope automation to localStorage:', e);
      }
      return updated;
    });
  },

  toggleEnvelope: (id) => {
    set(state => ({
      envelopeAutomation: {
        ...state.envelopeAutomation,
        envelopes: state.envelopeAutomation.envelopes.map(env =>
          env.id === id ? { ...env, enabled: !env.enabled } : env
        )
      }
    }));
  },

  toggleGlobalEnvelope: () => {
    const { envelopeAutomation } = get();
    const newEnabled = !envelopeAutomation.globalEnabled;
    set({
      envelopeAutomation: {
        ...envelopeAutomation,
        globalEnabled: newEnabled
      }
    });
    if (newEnabled) {
      get().startEnvelopeAnimation();
    } else {
      get().stopEnvelopeAnimation();
    }
  },

  startEnvelopeAnimation: () => {
    // Full implementation requires animation loop - simplified for now
    console.warn('startEnvelopeAnimation needs full implementation with animation loop');
  },

  stopEnvelopeAnimation: () => {
    const { envelopeAutomation } = get();
    if (envelopeAutomation.animationId) {
      cancelAnimationFrame(envelopeAutomation.animationId);
      set(state => ({
        envelopeAutomation: {
          ...state.envelopeAutomation,
          animationId: null
        }
      }));
    }
  },

  setEnvelopeSpeed: (speed) => {
    set(state => ({
      envelopeAutomation: {
        ...state.envelopeAutomation,
        speed: Math.max(0.1, Math.min(10.0, speed))
      }
    }));
    try {
      const current = get().envelopeAutomation;
      localStorage.setItem('envelopeAutomation', JSON.stringify({
        envelopes: current.envelopes,
        speed: current.speed
      }));
    } catch (e) {
      console.error('Failed to save envelope speed to localStorage:', e);
    }
  }
});

