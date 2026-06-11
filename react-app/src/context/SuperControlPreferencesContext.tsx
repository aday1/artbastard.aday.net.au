import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const LEGACY_STORAGE_KEY = 'chromaticEnergyManipulatorSettings';
const STORAGE_KEY = 'superControlPreferences';

export interface SuperControlPreferences {
  enableKeyboardShortcuts: boolean;
  autoSelectFirstFixture: boolean;
  showQuickActions: boolean;
  defaultColorPresets: string[];
  enableErrorMessages: boolean;
  autoUpdateRate: number;
  enableAnimations: boolean;
  compactMode: boolean;
}

interface SuperControlPreferencesContextType {
  settings: SuperControlPreferences;
  updateSettings: (updates: Partial<SuperControlPreferences>) => void;
  resetSettings: () => void;
}

const defaultSettings: SuperControlPreferences = {
  enableKeyboardShortcuts: true,
  autoSelectFirstFixture: true,
  showQuickActions: false,
  defaultColorPresets: ['Red', 'Green', 'Blue', 'White', 'Yellow', 'Cyan', 'Magenta', 'Off'],
  enableErrorMessages: true,
  autoUpdateRate: 50,
  enableAnimations: true,
  compactMode: false,
};

const SuperControlPreferencesContext = createContext<
  SuperControlPreferencesContextType | undefined
>(undefined);

function loadStoredSettings(): SuperControlPreferences {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

interface SuperControlPreferencesProviderProps {
  children: ReactNode;
}

export const SuperControlPreferencesProvider: React.FC<SuperControlPreferencesProviderProps> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SuperControlPreferences>(loadStoredSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<SuperControlPreferences>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  };

  return (
    <SuperControlPreferencesContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </SuperControlPreferencesContext.Provider>
  );
};

export const useSuperControlPreferences = (): SuperControlPreferencesContextType => {
  const context = useContext(SuperControlPreferencesContext);
  if (context === undefined) {
    throw new Error(
      'useSuperControlPreferences must be used within a SuperControlPreferencesProvider'
    );
  }
  return context;
};

/** @deprecated Use useSuperControlPreferences */
export const useChromaticEnergyManipulatorSettings = useSuperControlPreferences;

/** @deprecated Use SuperControlPreferencesProvider */
export const ChromaticEnergyManipulatorProvider = SuperControlPreferencesProvider;

export type ChromaticEnergyManipulatorSettings = SuperControlPreferences;
