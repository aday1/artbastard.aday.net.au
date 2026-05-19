import { create } from 'zustand';

// Placeholder for DMX store
// Will be populated based on usage in other files.

import { Fixture, DMXValue } from '../types/dmxTypes';

interface DmxState {
  fixtures: Fixture[];
  dmxValues: DMXValue[]; // Or a more structured type like { [channel: number]: DMXValue }
  masterIntensity: number;
  blackout: boolean;
  setFixtures: (fixtures: Fixture[]) => void;
  updateDMXValue: (channel: number, value: DMXValue) => void;
  updateMultipleDMXValues: (values: { channel: number, value: DMXValue }[]) => void;
  setMasterIntensity: (intensity: number) => void;
  setBlackout: (blackout: boolean) => void;
}

export const useDMXStore = create<DmxState>()((set) => ({
  // Initial state
  fixtures: [],
  dmxValues: Array(512).fill(0), // Initialize 512 DMX channels to 0
  masterIntensity: 1.0,
  blackout: false,
  setFixtures: (fixtures) => set(state => ({ ...state, fixtures })),
  updateDMXValue: (channel, value) => set(state => {
    const newValues = [...state.dmxValues];
    if (channel >= 0 && channel < newValues.length) {
      newValues[channel] = value;
    }
    return { dmxValues: newValues };
  }),  updateMultipleDMXValues: (valuesToUpdate) => set(state => {
    const newValues = [...state.dmxValues];
    valuesToUpdate.forEach(({ channel, value }) => {
      if (channel >= 0 && channel < newValues.length) {
        if (!state.blackout) {
          const scaledValue = Math.round(value * state.masterIntensity);
          newValues[channel] = Math.max(0, Math.min(255, scaledValue));
        }
      }
    });
    return { dmxValues: newValues };
  }),
  setMasterIntensity: (intensity) => set(state => ({ ...state, masterIntensity: intensity })),
  setBlackout: (blackoutStatus) => set(state => ({ ...state, blackout: blackoutStatus })),
}));

// Export other DMX related store logic if needed
