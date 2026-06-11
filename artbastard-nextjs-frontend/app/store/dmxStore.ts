import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

// Types based on existing app structure (can be refined)
export interface FixtureChannel {
  name: string; // e.g., "Red", "Pan", "Gobo Wheel"
  type: string; // e.g., "red", "pan", "gobo_wheel" - for default behavior/UI
  // defaultValue?: number;
  // lsb?: boolean; // If it's a fine channel for an MSB
}

export interface Fixture {
  id: string; // Unique ID for the fixture instance
  name: string;
  startAddress: number; // 1-indexed
  channels: FixtureChannel[];
  // typeName?: string; // e.g., "LED PAR", "Moving Head Spot 250" - for grouping/presets
  // mode?: string; // If fixture has multiple DMX modes
}

export interface DMXState {
  dmxValues: number[];
  channelNames: (string | null)[];
  selectedChannels: number[];
  fixtures: Fixture[];
  selectedFixtureIds: string[];

  // Actions
  setDmxValue: (channelIndex: number, value: number, sendToServer?: boolean) => void;
  setChannelName: (channelIndex: number, name: string) => void;
  toggleChannelSelection: (channelIndex: number) => void;
  selectChannels: (channelIndices: number[], additive?: boolean) => void;
  deselectChannels: (channelIndices: number[]) => void;
  selectAllChannels: () => void;
  deselectAllChannels: () => void;
  invertSelection: (allChannels: number[]) => void;
  setFixtures: (fixtures: Fixture[]) => void;
  addFixture: (fixture: Fixture) => Promise<void>; // Added
  updateFixture: (fixture: Fixture) => Promise<void>; // Added
  removeFixture: (fixtureId: string) => Promise<void>; // Added
  toggleFixtureSelection: (fixtureId: string, additive?: boolean) => void; // Handles channel selection too
  loadInitialState: (initialState: Partial<Pick<DMXState, 'dmxValues' | 'channelNames' | 'fixtures'>>) => void;
  sendBatchDmxUpdates: (updates: Record<number, number>) => Promise<void>;
  setAllToZero: () => Promise<void>;
}

const initialState = {
  dmxValues: Array(512).fill(0),
  channelNames: Array(512).fill(null).map((_, i) => `CH ${i + 1}`),
  selectedChannels: [],
  fixtures: [],
  selectedFixtureIds: [],
};

let debounceTimer: NodeJS.Timeout | null = null;
const pendingUpdates: Record<number, number> = {};

const sendUpdatesToServer = async (updates: Record<number, number>) => {
  if (Object.keys(updates).length === 0) return;
  try {
    const response = await fetch('/api/dmx/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to send DMX updates:', response.status, errorData);
    }
    for (const key in updates) {
        delete pendingUpdates[key];
    }
  } catch (error) {
    console.error('Error sending DMX updates:', error);
  }
};

// Helper to send fixture updates to the backend
const syncFixturesWithBackend = async (fixtures: Fixture[]) => {
  try {
    const response = await fetch('/api/fixtures', { // Assuming this endpoint updates all fixtures
      method: 'POST', // Or PUT, depending on backend API design
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtures }), // Send the whole array
    });
    if (!response.ok) {
      console.error('Failed to sync fixtures with backend:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error syncing fixtures with backend:', error);
  }
};


export const useDmxStore = create<DMXState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      loadInitialState: (initialStatePatch) => {
        set((state) => {
          if (initialStatePatch.dmxValues) state.dmxValues = initialStatePatch.dmxValues;
          if (initialStatePatch.channelNames) state.channelNames = initialStatePatch.channelNames;
          if (initialStatePatch.fixtures) state.fixtures = initialStatePatch.fixtures;
        });
      },

      setDmxValue: (channelIndex, value, sendToServer = true) => {
        set((state) => {
          if (channelIndex >= 0 && channelIndex < state.dmxValues.length) {
            state.dmxValues[channelIndex] = Math.max(0, Math.min(255, value));
          }
        });
        if (sendToServer) {
          pendingUpdates[channelIndex] = get().dmxValues[channelIndex];
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            sendUpdatesToServer({ ...pendingUpdates });
          }, 100);
        }
      },

      sendBatchDmxUpdates: async (updates) => {
        await sendUpdatesToServer(updates);
      },

      setChannelName: (channelIndex, name) =>
        set((state) => {
          if (channelIndex >= 0 && channelIndex < state.channelNames.length) {
            state.channelNames[channelIndex] = name;
          }
        }),

      toggleChannelSelection: (channelIndex) =>
        set((state) => {
          const isSelected = state.selectedChannels.includes(channelIndex);
          if (isSelected) {
            state.selectedChannels = state.selectedChannels.filter((idx) => idx !== channelIndex);
          } else {
            state.selectedChannels.push(channelIndex);
            state.selectedChannels.sort((a, b) => a - b); // Keep sorted
          }
        }),

      selectChannels: (channelIndices, additive = false) =>
        set(state => {
          const newSelected = new Set(additive ? state.selectedChannels : []);
          channelIndices.forEach(idx => newSelected.add(idx));
          state.selectedChannels = Array.from(newSelected).sort((a, b) => a - b);
        }),

      deselectChannels: (channelIndices) =>
        set(state => {
          const toDeselect = new Set(channelIndices);
          state.selectedChannels = state.selectedChannels.filter(idx => !toDeselect.has(idx));
        }),

      selectAllChannels: () =>
        set((state) => {
          state.selectedChannels = Array.from({ length: state.dmxValues.length }, (_, i) => i);
        }),

      deselectAllChannels: () =>
        set((state) => {
          state.selectedChannels = [];
          state.selectedFixtureIds = []; // Also deselect fixtures
        }),

      invertSelection: (allChannelsIndexes) =>
        set((state) => {
          const currentSelected = new Set(state.selectedChannels);
          const newSelected: number[] = [];
          allChannelsIndexes.forEach(index => {
            if (!currentSelected.has(index)) {
              newSelected.push(index);
            }
          });
          state.selectedChannels = newSelected.sort((a,b) => a - b);
        }),

      setFixtures: (fixtures) =>
        set((state) => {
          state.fixtures = fixtures;
          // Optionally sync with backend if this is user-initiated
          // syncFixturesWithBackend(fixtures);
        }),

      addFixture: async (fixture) => {
        set(state => {
          state.fixtures.push(fixture);
        });
        await syncFixturesWithBackend(get().fixtures);
      },

      updateFixture: async (updatedFixture) => {
        set(state => {
          const index = state.fixtures.findIndex(f => f.id === updatedFixture.id);
          if (index !== -1) {
            state.fixtures[index] = updatedFixture;
          }
        });
        await syncFixturesWithBackend(get().fixtures);
      },

      removeFixture: async (fixtureId) => {
        set(state => {
          state.fixtures = state.fixtures.filter(f => f.id !== fixtureId);
          state.selectedFixtureIds = state.selectedFixtureIds.filter(id => id !== fixtureId);
          // Also deselect channels associated with this fixture
          const fixture = state.fixtures.find(f => f.id === fixtureId); // Find before filter
           if (fixture) {
             const channelsToDeselect: number[] = [];
             for (let i = 0; i < fixture.channels.length; i++) {
               const chIndex = fixture.startAddress - 1 + i;
               if (chIndex >= 0 && chIndex < 512) {
                 channelsToDeselect.push(chIndex);
               }
             }
             const toDeselectSet = new Set(channelsToDeselect);
             state.selectedChannels = state.selectedChannels.filter(idx => !toDeselectSet.has(idx));
           }
        });
        await syncFixturesWithBackend(get().fixtures);
      },

      toggleFixtureSelection: (fixtureId, additive = false) => {
        set(state => {
          const fixture = state.fixtures.find(f => f.id === fixtureId);
          if (!fixture) return;

          const currentFixtureSelected = state.selectedFixtureIds.includes(fixtureId);
          let newSelectedFixtureIds: string[];

          if (additive) {
            newSelectedFixtureIds = currentFixtureSelected
              ? state.selectedFixtureIds.filter(id => id !== fixtureId)
              : [...state.selectedFixtureIds, fixtureId];
          } else {
            newSelectedFixtureIds = currentFixtureSelected && state.selectedFixtureIds.length === 1 ? [] : [fixtureId];
          }
          state.selectedFixtureIds = newSelectedFixtureIds;

          // Sync DMX channel selection based on selected fixtures
          const newSelectedChannels = new Set<number>();
          if (!additive && (!currentFixtureSelected || state.selectedFixtureIds.length > 1 && additive)) {
            // If not additive and we are selecting this fixture (or it's one of many in additive mode)
            // clear previous selections unless additive.
            // This logic is a bit complex; simpler: base channel selection on *all* selected fixtures.
          }


          state.selectedFixtureIds.forEach(fid => {
            const f = state.fixtures.find(fix => fix.id === fid);
            if (f) {
              for (let i = 0; i < f.channels.length; i++) {
                const chIndex = f.startAddress - 1 + i; // 0-indexed
                if (chIndex >= 0 && chIndex < 512) {
                  newSelectedChannels.add(chIndex);
                }
              }
            }
          });
          state.selectedChannels = Array.from(newSelectedChannels).sort((a,b) => a - b);
        });
      },

      setAllToZero: async () => {
        // Clear any pending debounced updates
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        
        // Create updates object with all channels set to 0
        const updates: Record<number, number> = {};
        for (let i = 0; i < 512; i++) {
          updates[i] = 0;
          // Clear any pending updates for this channel
          delete pendingUpdates[i];
        }
        
        // Update store state
        set((state) => {
          state.dmxValues.fill(0);
        });
        
        // Send all updates to server immediately (bypass debounce)
        await sendUpdatesToServer(updates);
      }
    })),
    { name: 'DMXStore' }
  )
);

// Helper function to get fixture info for a channel (similar to DmxChannel.tsx)
export const getFixtureInfoForDmxChannel = (channelIndex: number, fixtures: Fixture[]): { name?: string; function?: string, type?: string, shortFunction?: string } => {
  const dmxAddress = channelIndex + 1; // 0-indexed to 1-indexed
  for (const fixture of fixtures) {
    if (!fixture.channels || !fixture.startAddress) continue;
    const fixtureStartAddress = fixture.startAddress;
    const fixtureEndAddress = fixtureStartAddress + fixture.channels.length - 1;

    if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
      const channelOffset = dmxAddress - fixtureStartAddress;
      const channel = fixture.channels[channelOffset];
      if (channel) {
        const shortFunction = (() => {
          switch (channel.type?.toLowerCase()) {
            case 'red': case 'green': case 'blue': case 'white': case 'amber': case 'uv':
              return channel.type.toUpperCase();
            case 'pan': case 'tilt': return channel.type.toUpperCase();
            case 'pan_fine': return 'PAN-F';
            case 'tilt_fine': return 'TILT-F';
            case 'dimmer': return 'DIM';
            case 'shutter': return 'SHUT';
            case 'strobe': return 'STRB';
            case 'color_wheel': return 'CW';
            case 'gobo_wheel': return 'GOBO';
            case 'gobo_rotation': return 'G-ROT';
            case 'zoom': return 'ZOOM';
            case 'focus': return 'FOCUS';
            case 'prism': return 'PRISM';
            case 'iris': return 'IRIS';
            case 'speed': return 'SPEED';
            case 'macro': return 'MACRO';
            case 'effect': return 'FX';
            case 'frost': case 'diffusion': return 'FROST';
            case 'animation': return 'ANIM';
            case 'animation_speed': return 'A-SPD';
            case 'cto': case 'color_temperature_orange': return 'CTO';
            case 'ctb': case 'color_temperature_blue': return 'CTB';
            case 'reset': return 'RESET';
            case 'lamp_control': return 'LAMP';
            case 'fan_control': return 'FAN';
            case 'display': return 'DISP';
            case 'function': return 'FUNC';
            default: return channel.type?.toUpperCase().substring(0, 5) || 'N/A';
          }
        })();
        return { name: fixture.name, function: channel.name || channel.type, type: channel.type, shortFunction };
      }
    }
  }
  return {};
};
