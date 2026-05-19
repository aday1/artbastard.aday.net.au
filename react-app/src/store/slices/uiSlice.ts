import { Notification, AddNotificationInput } from '../types';

export interface UiSlice {
  // UI State
  theme: 'artsnob' | 'standard' | 'minimal';
  darkMode: boolean;
  notifications: Notification[];
  uiSettings: {
    sparklesEnabled: boolean;
    dmxVisualEffects: 'off' | 'low' | 'medium' | 'high';
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    borderRadius: number;
    spacing: number;
    animationSpeed: number;
    fontFamily: string;
    fontFamilyHeading: string;
    fontWeight: number;
    fontWeightHeading: number;
    hideExperimentalSection: boolean;
  };
  themeColors: any; // Large object, simplified for now
  navVisibility: {
    main: boolean;
    midiOsc: boolean;
    fixture: boolean;
    scenes: boolean;
    misc: boolean;
  };
  debugTools: {
    debugButton: boolean;
    midiMonitor: boolean;
    oscMonitor: boolean;
  };
  debugModules: {
    midi: boolean;
    osc: boolean;
    artnet: boolean;
    button: boolean;
  };

  // UI Actions
  setTheme: (theme: 'artsnob' | 'standard' | 'minimal') => void;
  toggleDarkMode: () => void;
  addNotification: (notification: AddNotificationInput) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  updateUiSettings: (settings: Partial<UiSlice['uiSettings']>) => void;
  updateThemeColors: (colors: Partial<any>) => void;
}

const initializeDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem('darkMode');
    const darkMode = stored !== null ? stored === 'true' : true;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    return darkMode;
  } catch (error) {
    console.warn('Failed to read darkMode from localStorage:', error);
    document.documentElement.setAttribute('data-theme', 'dark');
    return true;
  }
};

const initializeUiSettings = () => {
  try {
    const stored = localStorage.getItem('uiSettings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load UI settings:', e);
  }
  return {
    sparklesEnabled: true,
    dmxVisualEffects: 'medium' as const,
    fontSize: 1.0,
    lineHeight: 1.5,
    letterSpacing: 0,
    borderRadius: 8,
    spacing: 1.0,
    animationSpeed: 1.0,
    fontFamily: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyHeading: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 400,
    fontWeightHeading: 600,
    hideExperimentalSection: false
  };
};

export const createUiSlice = (set: any, get: any): UiSlice => ({
  theme: 'artsnob',
  darkMode: initializeDarkMode(),
  notifications: [],
  uiSettings: initializeUiSettings(),
  themeColors: {}, // Simplified - full implementation would be large
  navVisibility: {
    main: true,
    midiOsc: true,
    fixture: true,
    scenes: true,
    misc: true
  },
  debugTools: {
    debugButton: false,
    midiMonitor: false,
    oscMonitor: false
  },
  debugModules: {
    midi: false,
    osc: false,
    artnet: false,
    button: false
  },

  setTheme: (theme) => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  toggleDarkMode: () => {
    const newDarkMode = !get().darkMode;
    document.documentElement.setAttribute('data-theme', newDarkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(newDarkMode));
    set({ darkMode: newDarkMode });
  },

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now()
    };
    set(state => ({
      notifications: [...state.notifications, newNotification]
    }));
  },

  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  updateUiSettings: (settings) => {
    set(state => ({
      uiSettings: { ...state.uiSettings, ...settings }
    }));
    try {
      localStorage.setItem('uiSettings', JSON.stringify(get().uiSettings));
    } catch (e) {
      console.error('Failed to save UI settings:', e);
    }
  },

  updateThemeColors: (colors) => {
    set(state => ({
      themeColors: { ...state.themeColors, ...colors }
    }));
  },
});

