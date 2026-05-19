import axios from 'axios';
import { ChannelRange, DmxChannelBatchUpdate } from '../types';

export interface DmxSlice {
  // DMX State
  dmxChannels: number[];
  oscAssignments: string[];
  superControlOscAddresses: Record<string, string>;
  channelNames: string[];
  channelRanges: ChannelRange[];
  channelColors: string[];
  selectedChannels: number[];
  pinnedChannels: number[];
  channelJumpTarget: number | null;
  activeSceneName: string | null;
  tuningSceneName: string | null;

  // Scene Transition State
  isTransitioning: boolean;
  transitionStartTime: number | null;
  transitionDuration: number;
  transitionEasing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' | 'easeInOutCubic' | 'easeInOutQuart' | 'easeInOutSine';
  fromDmxValues: number[] | null;
  toDmxValues: number[] | null;
  currentTransitionFrame: number | null;
  lastDmxTransitionUpdate: number | null;
  lastTransitionDmxValues: number[] | null;

  // DMX Actions
  getDmxChannelValue: (channel: number) => number;
  setDmxChannel: (channel: number, value: number, sendToBackend?: boolean) => void;
  setMultipleDmxChannels: (updates: DmxChannelBatchUpdate, sendToBackend?: boolean) => void;
  setDmxChannelValue: (channel: number, value: number) => void;
  setDmxChannelsForTransition: (values: number[]) => void;
  setCurrentTransitionFrameId: (frameId: number | null) => void;
  clearTransitionState: () => void;
  setTransitionDuration: (duration: number) => void;
  setTransitionEasing: (easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' | 'easeInOutCubic' | 'easeInOutQuart' | 'easeInOutSine') => void;

  // Channel Selection Actions
  selectChannel: (channel: number) => void;
  deselectChannel: (channel: number) => void;
  toggleChannelSelection: (channel: number) => void;
  selectAllChannels: () => void;
  deselectAllChannels: () => void;
  invertChannelSelection: () => void;

  // Channel Configuration Actions
  setChannelName: (channel: number, name: string) => void;
  setChannelRange: (channel: number, min: number, max: number) => void;
  getChannelRange: (channel: number) => ChannelRange;
  setChannelColor: (channel: number, color: string) => void;
  setRandomChannelColor: (channel: number) => void;

  // Channel Pinning Actions
  pinChannel: (channel: number) => void;
  unpinChannel: (channel: number) => void;
  togglePinChannel: (channel: number) => void;

  // OSC Assignment Actions
  setOscAssignment: (channelIndex: number, address: string) => void;
  setSuperControlOscAddress: (controlName: string, address: string) => void;

  // Navigation Actions
  jumpToChannel: (channelIndex: number) => void;
  setActiveSceneName: (name: string | null) => void;
  setTuningSceneName: (name: string | null) => void;
}

export const createDmxSlice = (
  set: any,
  get: any
): DmxSlice => ({
  // Initial state
  dmxChannels: new Array(512).fill(0),
  oscAssignments: new Array(512).fill('').map((_, i) => `/1/fader${i + 1}`),
  superControlOscAddresses: (() => {
    const defaults: Record<string, string> = {
      dimmer: '/supercontrol/dimmer',
      pan: '/supercontrol/pan',
      tilt: '/supercontrol/tilt',
      red: '/supercontrol/red',
      green: '/supercontrol/green',
      blue: '/supercontrol/blue',
      gobo: '/supercontrol/gobo',
      shutter: '/supercontrol/shutter',
      strobe: '/supercontrol/strobe',
      lamp: '/supercontrol/lamp',
      reset: '/supercontrol/reset',
      focus: '/supercontrol/focus',
      zoom: '/supercontrol/zoom',
      iris: '/supercontrol/iris',
      prism: '/supercontrol/prism',
      colorWheel: '/supercontrol/colorwheel',
      goboRotation: '/supercontrol/gobo/rotation',
      finePan: '/supercontrol/pan/fine',
      fineTilt: '/supercontrol/tilt/fine',
      gobo2: '/supercontrol/gobo2',
      frost: '/supercontrol/frost',
      macro: '/supercontrol/macro',
      speed: '/supercontrol/speed',
      panTiltXY: '/supercontrol/pantilt/xy',
      autopilotEnable: '/supercontrol/autopilot/enable',
      autopilotSpeed: '/supercontrol/autopilot/speed',
      autopilotTrackEnabled: '/supercontrol/autopilot/enabled',
      autopilotTrackType: '/supercontrol/autopilot/type',
      autopilotTrackPosition: '/supercontrol/autopilot/position',
      autopilotTrackSize: '/supercontrol/autopilot/size',
      autopilotTrackSpeed: '/supercontrol/autopilot/speed',
      autopilotTrackCenterX: '/supercontrol/autopilot/center/x',
      autopilotTrackCenterY: '/supercontrol/autopilot/center/y',
      autopilotTrackAutoPlay: '/supercontrol/autopilot/autoplay',
    };
    try {
      const saved = localStorage.getItem('artbastard-superControlOscAddresses');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load superControlOscAddresses from localStorage:', e);
    }
    return defaults;
  })(),
  channelNames: new Array(512).fill(''),
  channelRanges: new Array(512).fill(null).map(() => ({ min: 0, max: 255 })),
  channelColors: new Array(512).fill(''),
  selectedChannels: [],
  pinnedChannels: [],
  channelJumpTarget: null,
  activeSceneName: null,
  tuningSceneName: null,

  // Scene Transition State
  isTransitioning: false,
  transitionStartTime: null,
  transitionDuration: 1000,
  transitionEasing: 'easeInOut',
  fromDmxValues: null,
  toDmxValues: null,
  currentTransitionFrame: null,
  lastDmxTransitionUpdate: null,
  lastTransitionDmxValues: null,

  // DMX Actions
  getDmxChannelValue: (channel) => {
    const dmxChannels = get().dmxChannels;
    if (channel >= 0 && channel < dmxChannels.length) {
      return dmxChannels[channel] || 0;
    }
    return 0;
  },

  setDmxChannel: (channel, value, sendToBackend = true) => {
    console.log(`[DMX Store] setDmxChannel called: channel=${channel}, value=${value}, sendToBackend=${sendToBackend}`);

    // Get channel range and clamp value
    const channelRange = get().getChannelRange(channel);
    const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, value));

    const dmxChannels = [...get().dmxChannels];
    dmxChannels[channel] = clampedValue;
    set({ dmxChannels });

    if (sendToBackend) {
      console.log(`[DMX Store] Sending HTTP POST to /api/dmx: channel=${channel}, value=${value}`);
      axios.post('/api/dmx', { channel, value })
        .then(response => {
          console.log(`[DMX Store] DMX API call successful:`, response.data);
        })
        .catch(error => {
          console.error('Failed to update DMX channel:', error);
          console.error('Error details:', error.response?.data || error.message);
          get().addNotification?.({ message: 'Failed to update DMX channel', type: 'error', priority: 'high' });
        });
    } else {
      console.log(`[DMX Store] DMX channel updated locally (no backend request): channel=${channel}, value=${value}`);
    }
  },

  setMultipleDmxChannels: (updates, sendToBackend = true) => {
    console.log('[DMX Store] setMultipleDmxChannels: Called with updates batch:', updates, 'sendToBackend:', sendToBackend);
    const currentDmxChannels = get().dmxChannels;
    const newDmxChannels = [...currentDmxChannels];
    let changesApplied = false;
    
    for (const channelStr in updates) {
      const channel = parseInt(channelStr, 10);
      if (channel >= 0 && channel < newDmxChannels.length) {
        if (newDmxChannels[channel] !== updates[channel]) {
          newDmxChannels[channel] = updates[channel];
          changesApplied = true;
        }
      }
    }

    if (changesApplied) {
      set({ dmxChannels: newDmxChannels });
      console.log('[DMX Store] setMultipleDmxChannels: Applied changes to local DMX state.');
    } else {
      console.log('[DMX Store] setMultipleDmxChannels: No actual changes to local DMX state after processing batch.');
    }

    if (sendToBackend) {
      console.log('[DMX Store] setMultipleDmxChannels: Sending HTTP POST to /api/dmx/batch with payload:', updates);
      axios.post('/api/dmx/batch', updates)
        .then(response => {
          console.log('[DMX Store] setMultipleDmxChannels: DMX batch API call successful. Response status:', response.status, 'Data:', response.data);
        })
        .catch(error => {
          console.error('[DMX Store] setMultipleDmxChannels: Failed to update DMX channels in batch via API.');
          if (error.response) {
            console.error('[DMX Store] setMultipleDmxChannels: Error response data:', error.response.data);
            console.error('[DMX Store] setMultipleDmxChannels: Error response status:', error.response.status);
            console.error('[DMX Store] setMultipleDmxChannels: Error response headers:', error.response.headers);
          } else if (error.request) {
            console.error('[DMX Store] setMultipleDmxChannels: No response received for DMX batch:', error.request);
          } else {
            console.error('[DMX Store] setMultipleDmxChannels: Error setting up DMX batch request:', error.message);
          }
          get().addNotification?.({ message: 'Failed to send DMX batch update to server', type: 'error', priority: 'high' });
        });
    } else {
      console.log('[DMX Store] setMultipleDmxChannels: Skipping backend request (sendToBackend=false)');
    }
  },

  setDmxChannelValue: (channel, value) => {
    get().setDmxChannel(channel, value);

    // Record the change if recording is active
    if (get().recordingActive) {
      get().addRecordingEvent?.({
        type: 'dmx',
        channel,
        value
      });
    }
  },

  setDmxChannelsForTransition: (values) => {
    // Update local state
    set({ dmxChannels: values });

    // Balanced approach - responsive but not spammy
    const now = Date.now();
    const { lastDmxTransitionUpdate, lastTransitionDmxValues, transitionStartTime, transitionDuration } = get();
    const updateInterval = 100; // Send DMX updates every 100ms (10fps)

    // Always send final update when transition is complete
    const isTransitionComplete = transitionStartTime && (now - transitionStartTime) >= transitionDuration;

    if (isTransitionComplete || !lastDmxTransitionUpdate || (now - lastDmxTransitionUpdate) >= updateInterval) {
      // Only send channels that actually changed
      const updates: Record<number, number> = {};
      let hasChanges = false;

      if (lastTransitionDmxValues) {
        // Compare with last sent values
        for (let i = 0; i < values.length && i < 512; i++) {
          const currentValue = values[i] || 0;
          const lastValue = lastTransitionDmxValues[i] || 0;

          // Only include channels that changed by more than 3 DMX values
          if (Math.abs(currentValue - lastValue) > 3) {
            updates[i] = currentValue;
            hasChanges = true;
          }
        }
      } else {
        // First update - send all non-zero values
        for (let i = 0; i < values.length && i < 512; i++) {
          const currentValue = values[i] || 0;
          if (currentValue > 0) {
            updates[i] = currentValue;
            hasChanges = true;
          }
        }
      }

      // Send if there are changes OR if transition is complete
      if (hasChanges || isTransitionComplete) {
        if (isTransitionComplete) {
          // Final update - send all non-zero values to ensure we reach target
          const finalUpdates: Record<number, number> = {};
          for (let i = 0; i < values.length && i < 512; i++) {
            const currentValue = values[i] || 0;
            if (currentValue > 0) {
              finalUpdates[i] = currentValue;
            }
          }
          axios.post('/api/dmx/batch', finalUpdates)
            .catch(error => {
              console.error('Failed to send final DMX update:', error);
            });
        } else {
          // Regular update - only changed channels
          axios.post('/api/dmx/batch', updates)
            .catch(error => {
              console.error('Failed to update DMX channels during transition:', error);
            });
        }
      }

      // Update tracking values
      set({
        lastDmxTransitionUpdate: now,
        lastTransitionDmxValues: [...values]
      });
    }
  },

  setCurrentTransitionFrameId: (frameId) => set({ currentTransitionFrame: frameId }),

  clearTransitionState: () => set({
    isTransitioning: false,
    transitionStartTime: null,
    fromDmxValues: null,
    toDmxValues: null,
    currentTransitionFrame: null,
    lastDmxTransitionUpdate: null,
    lastTransitionDmxValues: null,
  }),

  setTransitionDuration: (duration) => {
    if (duration >= 0) {
      set({ transitionDuration: duration });
    }
  },

  setTransitionEasing: (easing) => {
    set({ transitionEasing: easing });
  },

  // Channel Selection Actions
  selectChannel: (channel) => {
    const selectedChannels = [...get().selectedChannels];
    if (!selectedChannels.includes(channel)) {
      selectedChannels.push(channel);
      set({ selectedChannels });
    }
  },

  deselectChannel: (channel) => {
    const selectedChannels = get().selectedChannels.filter(ch => ch !== channel);
    set({ selectedChannels });
  },

  toggleChannelSelection: (channel) => {
    const selectedChannels = [...get().selectedChannels];
    const index = selectedChannels.indexOf(channel);

    if (index === -1) {
      selectedChannels.push(channel);
    } else {
      selectedChannels.splice(index, 1);
    }

    set({ selectedChannels });
  },

  selectAllChannels: () => {
    const selectedChannels = Array.from({ length: 512 }, (_, i) => i);
    set({ selectedChannels });
  },

  deselectAllChannels: () => {
    set({ selectedChannels: [] });
  },

  invertChannelSelection: () => {
    const currentSelection = get().selectedChannels;
    const allChannels = Array.from({ length: 512 }, (_, i) => i);
    const newSelection = allChannels.filter(ch => !currentSelection.includes(ch));
    set({ selectedChannels: newSelection });
  },

  // Channel Configuration Actions
  setChannelName: (channel, name) => {
    const channelNames = [...get().channelNames];
    if (channel >= 0 && channel < channelNames.length) {
      channelNames[channel] = name;
      set({ channelNames });
      
      // Persist to localStorage
      try {
        localStorage.setItem('artbastard-channelNames', JSON.stringify(channelNames));
      } catch (e) {
        console.error('Failed to save channel names to localStorage:', e);
      }
    }
  },

  setChannelRange: (channel, min, max) => {
    const channelRanges = [...get().channelRanges];
    if (channel >= 0 && channel < channelRanges.length) {
      channelRanges[channel] = { min, max };
      set({ channelRanges });
      
      // Persist to localStorage
      try {
        localStorage.setItem('artbastard-channelRanges', JSON.stringify(channelRanges));
      } catch (e) {
        console.error('Failed to save channel ranges to localStorage:', e);
      }
    }
  },

  getChannelRange: (channel) => {
    const channelRanges = get().channelRanges;
    if (channel >= 0 && channel < channelRanges.length) {
      return channelRanges[channel] || { min: 0, max: 255 };
    }
    return { min: 0, max: 255 };
  },

  setChannelColor: (channel, color) => {
    const channelColors = [...get().channelColors];
    if (channel >= 0 && channel < channelColors.length) {
      channelColors[channel] = color;
      set({ channelColors });
      
      // Persist to localStorage
      try {
        localStorage.setItem('artbastard-channelColors', JSON.stringify(channelColors));
      } catch (e) {
        console.error('Failed to save channel colors to localStorage:', e);
      }
    }
  },

  setRandomChannelColor: (channel) => {
    const colors = [
      '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
      '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#0ea5e9', '#d946ef'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    get().setChannelColor(channel, randomColor);
  },

  // Channel Pinning Actions
  pinChannel: (channel) => {
    const pinnedChannels = [...get().pinnedChannels];
    if (!pinnedChannels.includes(channel)) {
      pinnedChannels.push(channel);
      set({ pinnedChannels });
      
      // Persist to localStorage
      try {
        localStorage.setItem('artbastard-pinnedChannels', JSON.stringify(pinnedChannels));
      } catch (e) {
        console.error('Failed to save pinned channels to localStorage:', e);
      }
    }
  },

  unpinChannel: (channel) => {
    const pinnedChannels = get().pinnedChannels.filter(ch => ch !== channel);
    set({ pinnedChannels });
    
    // Persist to localStorage
    try {
      localStorage.setItem('artbastard-pinnedChannels', JSON.stringify(pinnedChannels));
    } catch (e) {
      console.error('Failed to save pinned channels to localStorage:', e);
    }
  },

  togglePinChannel: (channel) => {
    const pinnedChannels = get().pinnedChannels;
    if (pinnedChannels.includes(channel)) {
      get().unpinChannel(channel);
    } else {
      get().pinChannel(channel);
    }
  },

  // OSC Assignment Actions
  setOscAssignment: (channelIndex, address) => {
    const oscAssignments = [...get().oscAssignments];
    if (channelIndex >= 0 && channelIndex < oscAssignments.length) {
      oscAssignments[channelIndex] = address;
      set({ oscAssignments });
      
      // Persist to localStorage
      try {
        localStorage.setItem('artbastard-oscAssignments', JSON.stringify(oscAssignments));
      } catch (e) {
        console.error('Failed to save OSC assignments to localStorage:', e);
      }
    }
  },

  setSuperControlOscAddress: (controlName, address) => {
    const superControlOscAddresses = { ...get().superControlOscAddresses };
    superControlOscAddresses[controlName] = address;
    set({ superControlOscAddresses });
    
    // Persist to localStorage
    try {
      localStorage.setItem('artbastard-superControlOscAddresses', JSON.stringify(superControlOscAddresses));
    } catch (e) {
      console.error('Failed to save superControlOscAddresses to localStorage:', e);
    }
  },

  // Navigation Actions
  jumpToChannel: (channelIndex) => {
    // Set the jump target
    set({ channelJumpTarget: channelIndex });

    // Reset the target shortly after to allow re-triggering the same jump
    setTimeout(() => {
      set({ channelJumpTarget: null });
    }, 500);
  },

  setActiveSceneName: (name) => {
    set({ activeSceneName: name });
  },

  setTuningSceneName: (name) => {
    set({ tuningSceneName: name });
  },
});

