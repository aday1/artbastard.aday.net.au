import { StateCreator } from 'zustand';
import { Notification } from '../types';

export interface UniverseConfig {
  universe: number; // 0-32767 (Art-Net supports up to 32768 universes)
  subnet: number; // 0-15
  net: number; // 0-127
  name?: string;
  enabled: boolean;
}

export interface UniverseState {
  // Multi-universe support
  activeUniverse: number; // Currently selected universe for editing
  universes: Record<number, UniverseConfig>; // Universe configurations
  dmxUniverseData: Record<number, number[]>; // DMX data per universe (universe -> 512 channels)
  
  // Universe Actions
  setActiveUniverse: (universe: number) => void;
  addUniverse: (universe: number, config?: Partial<UniverseConfig>) => void;
  removeUniverse: (universe: number) => void;
  updateUniverseConfig: (universe: number, config: Partial<UniverseConfig>) => void;
  getUniverseChannels: (universe: number) => number[];
  setUniverseChannel: (universe: number, channel: number, value: number) => void;
  setUniverseChannels: (universe: number, channels: number[]) => void;
  getTotalUniverseCount: () => number;
  getEnabledUniverses: () => number[];
}

export const createUniverseSlice: StateCreator<UniverseState> = (set, get) => ({
  // Initial state - start with universe 0
  activeUniverse: 0,
  universes: {
    0: {
      universe: 0,
      subnet: 0,
      net: 0,
      name: 'Universe 1',
      enabled: true
    }
  },
  dmxUniverseData: {
    0: new Array(512).fill(0)
  },

  setActiveUniverse: (universe) => {
    // Ensure universe exists
    if (!get().universes[universe]) {
      get().addUniverse(universe);
    }
    set({ activeUniverse: universe });
  },

  addUniverse: (universe, config) => {
    set(state => {
      const newConfig: UniverseConfig = {
        universe,
        subnet: Math.floor(universe / 16) % 16,
        net: Math.floor(universe / 256),
        name: config?.name || `Universe ${universe + 1}`,
        enabled: config?.enabled !== undefined ? config.enabled : true,
        ...config
      };

      const newUniverses = { ...state.universes, [universe]: newConfig };
      const newDmxData = { ...state.dmxUniverseData };
      
      // Initialize DMX data for new universe if it doesn't exist
      if (!newDmxData[universe]) {
        newDmxData[universe] = new Array(512).fill(0);
      }

      // Save to localStorage
      try {
        localStorage.setItem('artbastard-universes', JSON.stringify(newUniverses));
      } catch (e) {
        console.error('Failed to save universes to localStorage:', e);
      }

      (get() as any).addNotification({
        message: `Universe ${universe + 1} added`,
        type: 'success',
        priority: 'normal'
      });

      return {
        universes: newUniverses,
        dmxUniverseData: newDmxData
      };
    });
  },

  removeUniverse: (universe) => {
    // Don't allow removing universe 0 (default)
    if (universe === 0) {
      (get() as any).addNotification({
        message: 'Cannot remove default universe (Universe 1)',
        type: 'error',
        priority: 'high'
      });
      return;
    }

    set(state => {
      const newUniverses = { ...state.universes };
      const newDmxData = { ...state.dmxUniverseData };
      
      delete newUniverses[universe];
      delete newDmxData[universe];

      // If removing active universe, switch to universe 0
      const newActiveUniverse = state.activeUniverse === universe ? 0 : state.activeUniverse;

      // Save to localStorage
      try {
        localStorage.setItem('artbastard-universes', JSON.stringify(newUniverses));
      } catch (e) {
        console.error('Failed to save universes to localStorage:', e);
      }

      get().addNotification({
        message: `Universe ${universe + 1} removed`,
        type: 'success',
        priority: 'normal'
      });

      return {
        universes: newUniverses,
        dmxUniverseData: newDmxData,
        activeUniverse: newActiveUniverse
      };
    });
  },

  updateUniverseConfig: (universe, config) => {
    set(state => {
      if (!state.universes[universe]) {
        get().addNotification({
          message: `Universe ${universe + 1} does not exist`,
          type: 'error',
          priority: 'high'
        });
        return state;
      }

      const updatedUniverses = {
        ...state.universes,
        [universe]: {
          ...state.universes[universe],
          ...config
        }
      };

      // Save to localStorage
      try {
        localStorage.setItem('artbastard-universes', JSON.stringify(updatedUniverses));
      } catch (e) {
        console.error('Failed to save universes to localStorage:', e);
      }

      return { universes: updatedUniverses };
    });
  },

  getUniverseChannels: (universe) => {
    const state = get();
    if (!state.dmxUniverseData[universe]) {
      // Initialize if doesn't exist
      state.dmxUniverseData[universe] = new Array(512).fill(0);
      set({ dmxUniverseData: { ...state.dmxUniverseData } });
    }
    return state.dmxUniverseData[universe] || new Array(512).fill(0);
  },

  setUniverseChannel: (universe, channel, value) => {
    set(state => {
      const newDmxData = { ...state.dmxUniverseData };
      if (!newDmxData[universe]) {
        newDmxData[universe] = new Array(512).fill(0);
      }
      const universeChannels = [...newDmxData[universe]];
      universeChannels[channel] = Math.max(0, Math.min(255, value));
      newDmxData[universe] = universeChannels;
      return { dmxUniverseData: newDmxData };
    });
  },

  setUniverseChannels: (universe, channels) => {
    set(state => {
      const newDmxData = { ...state.dmxUniverseData };
      newDmxData[universe] = [...channels];
      return { dmxUniverseData: newDmxData };
    });
  },

  getTotalUniverseCount: () => {
    return Object.keys(get().universes).length;
  },

  getEnabledUniverses: () => {
    return Object.entries(get().universes)
      .filter(([, config]) => (config as UniverseConfig).enabled)
      .map(([universe, _]) => Number(universe))
      .sort((a, b) => a - b);
  }
});

