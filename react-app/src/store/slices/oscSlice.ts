import { OscConfig, OscMessage, OscActivity } from '../types';

export interface OscSlice {
  // OSC State
  oscConfig: OscConfig;
  oscMessages: OscMessage[];
  oscActivity: Record<number, OscActivity>;

  // OSC Actions
  reportOscActivity: (channelIndex: number, value: number) => void;
  addOscMessage: (message: OscMessage) => void;
  updateOscConfig: (config: Partial<OscConfig>) => void;
}

export const createOscSlice = (set: any, get: any): OscSlice => ({
  oscConfig: {
    host: 'localhost',
    port: 9000,
    sendEnabled: false,
    sendHost: 'localhost'
  },
  oscMessages: [],
  oscActivity: {},

  reportOscActivity: (channelIndex, value) => {
    set(state => ({
      oscActivity: {
        ...state.oscActivity,
        [channelIndex]: {
          lastValue: value,
          lastUpdate: Date.now()
        }
      }
    }));
  },

  addOscMessage: (message) => {
    const messages = [...get().oscMessages, message].slice(-1000);
    set({ oscMessages: messages });
  },

  updateOscConfig: (config) => {
    set(state => ({
      oscConfig: { ...state.oscConfig, ...config }
    }));
  },
});

