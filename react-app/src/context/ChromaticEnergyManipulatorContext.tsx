import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ChromaticEnergyManipulatorSettings {
  enableKeyboardShortcuts: boolean;
  autoSelectFirstFixture: boolean;
  showQuickActions: boolean;
  defaultColorPresets: string[];
  enableErrorMessages: boolean;
  autoUpdateRate: number;
  enableAnimations: boolean;
  compactMode: boolean;
}

interface ChromaticEnergyManipulatorContextType {
  settings: ChromaticEnergyManipulatorSettings;
  updateSettings: (updates: Partial<ChromaticEnergyManipulatorSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: ChromaticEnergyManipulatorSettings = {
  enableKeyboardShortcuts: true,
  autoSelectFirstFixture: true,
  showQuickActions: false,
  defaultColorPresets: ['Red', 'Green', 'Blue', 'White', 'Yellow', 'Cyan', 'Magenta', 'Off'],
  enableErrorMessages: true,
  autoUpdateRate: 50,
  enableAnimations: true,
  compactMode: false,
};

const ChromaticEnergyManipulatorContext = createContext<ChromaticEnergyManipulatorContextType | undefined>(undefined);

interface ChromaticEnergyManipulatorProviderProps {
  children: ReactNode;
}

export const ChromaticEnergyManipulatorProvider: React.FC<ChromaticEnergyManipulatorProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<ChromaticEnergyManipulatorSettings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('chromaticEnergyManipulatorSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.warn('Failed to parse saved ChromaticEnergyManipulator settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when changed
  useEffect(() => {
    localStorage.setItem('chromaticEnergyManipulatorSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<ChromaticEnergyManipulatorSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('chromaticEnergyManipulatorSettings');
  };

  const value = {
    settings,
    updateSettings,
    resetSettings,
  };

  return (
    <ChromaticEnergyManipulatorContext.Provider value={value}>
      {children}
    </ChromaticEnergyManipulatorContext.Provider>
  );
};

export const useChromaticEnergyManipulatorSettings = (): ChromaticEnergyManipulatorContextType => {
  const context = useContext(ChromaticEnergyManipulatorContext);
  if (context === undefined) {
    throw new Error('useChromaticEnergyManipulatorSettings must be used within a ChromaticEnergyManipulatorProvider');
  }
  return context;
};
