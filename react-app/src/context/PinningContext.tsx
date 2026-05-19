import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type PinnableComponent = 
  | 'master-fader'
  | 'scene-auto'
  | 'chromatic-energy-manipulator'
  | 'scene-quick-launch'
  | 'quick-capture';

interface PinningState {
  [key: string]: boolean;
}

interface PinningContextType {
  isPinned: (componentId: PinnableComponent) => boolean;
  togglePin: (componentId: PinnableComponent) => void;
  setPinned: (componentId: PinnableComponent, pinned: boolean) => void;
  pinAllComponents: () => void;
  unpinAllComponents: () => void;
  getPinnedComponents: () => PinnableComponent[];
}

const PinningContext = createContext<PinningContextType | undefined>(undefined);

interface PinningProviderProps {
  children: ReactNode;
}

export const PinningProvider: React.FC<PinningProviderProps> = ({ children }) => {
  // Default all components to pinned for immediate visibility
  const getDefaultPinState = (): PinningState => ({
    'master-fader': true,
    'scene-auto': true,
    'chromatic-energy-manipulator': true,
    'scene-quick-launch': true,
    'quick-capture': true,
  });

  const [pinningState, setPinningState] = useState<PinningState>(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('artbastard-pinning-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all components have a state
        return { ...getDefaultPinState(), ...parsed };
      } catch (error) {
        console.warn('Failed to parse saved pinning state, using defaults');
        return getDefaultPinState();
      }
    }
    return getDefaultPinState();
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('artbastard-pinning-state', JSON.stringify(pinningState));
  }, [pinningState]);

  const isPinned = useCallback((componentId: PinnableComponent): boolean => {
    return pinningState[componentId] ?? true; // Default to pinned
  }, [pinningState]);

  const togglePin = useCallback((componentId: PinnableComponent) => {
    setPinningState(prev => ({
      ...prev,
      [componentId]: !prev[componentId]
    }));
  }, []);

  const setPinned = useCallback((componentId: PinnableComponent, pinned: boolean) => {
    setPinningState(prev => ({
      ...prev,
      [componentId]: pinned
    }));
  }, []);

  const pinAllComponents = useCallback(() => {
    const allPinned: PinningState = {};
    Object.keys(getDefaultPinState()).forEach(key => {
      allPinned[key] = true;
    });
    setPinningState(allPinned);
  }, []);

  const unpinAllComponents = useCallback(() => {
    const allUnpinned: PinningState = {};
    Object.keys(getDefaultPinState()).forEach(key => {
      allUnpinned[key] = false;
    });
    setPinningState(allUnpinned);
  }, []);

  const getPinnedComponents = useCallback((): PinnableComponent[] => {
    return Object.entries(pinningState)
      .filter(([_, pinned]) => pinned)
      .map(([componentId, _]) => componentId as PinnableComponent);
  }, [pinningState]);

  const contextValue: PinningContextType = {
    isPinned,
    togglePin,
    setPinned,
    pinAllComponents,
    unpinAllComponents,
    getPinnedComponents,
  };

  return (
    <PinningContext.Provider value={contextValue}>
      {children}
    </PinningContext.Provider>
  );
};

export const usePinning = (): PinningContextType => {
  const context = useContext(PinningContext);
  if (context === undefined) {
    throw new Error('usePinning must be used within a PinningProvider');
  }
  return context;
};

export default PinningProvider;
