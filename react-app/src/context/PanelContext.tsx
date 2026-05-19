import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  migrateSavedLayoutsStorage,
  sanitizePanelLayout,
} from './panelLayoutUtils';

export type {
  PanelId,
  LayoutMode,
  PanelComponent,
  PanelState,
  PanelLayout,
} from './panelTypes';
import type {
  PanelId,
  LayoutMode,
  PanelComponent,
  PanelState,
  PanelLayout,
} from './panelTypes';

export interface PanelContextType {
  layout: PanelLayout;
  setLayoutMode: (mode: LayoutMode) => void;
  addComponentToPanel: (panelId: PanelId, component: PanelComponent) => void;
  removeComponentFromPanel: (panelId: PanelId, componentId: string) => void;
  moveComponent: (fromPanel: PanelId, toPanel: PanelId, componentId: string) => void;
  updateComponent: (panelId: PanelId, componentId: string, updates: Partial<PanelComponent>) => void;
  reorderComponent: (panelId: PanelId, componentId: string, direction: 'up' | 'down') => void;
  moveComponentToIndex: (panelId: PanelId, componentId: string, newIndex: number) => void;
  updateSplitterPosition: (type: 'horizontal' | 'vertical', position: number) => void;
  saveLayout: (name: string) => void;
  loadLayout: (name: string) => void;
  getSavedLayouts: () => string[];
  deleteLayout: (name: string) => void;
  resetLayout: () => void;
  loadBlankLayout: () => void;
  clearPanel: (panelId: PanelId) => void; // Added clearPanel
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

interface PanelProviderProps {
  children: ReactNode;
}

const getDefaultLayout = (): PanelLayout => ({
  'top-left': {
    components: [
      {
        id: 'default-master-fader',
        type: 'master-fader',
        title: 'Master Slider',
        props: { isDockable: false }
      },
      {
        id: 'default-scene-control',
        type: 'scene-quick-launch',
        title: 'Scene Control',
        props: { isDockable: false }
      }
    ]
  },
  'top-right': {
    components: [
      {
        id: 'default-dmx-visualizer',
        type: 'dmx-visualizer',
        title: 'DMX Visual Display',
        props: {}
      }
    ]
  },
  'bottom': {
    components: [
      {
        id: 'default-dmx-control',
        type: 'dmx-control-panel',
        title: 'DMX Control Panel',
        props: {}
      },
      {
        id: 'default-fixture-control',
        type: 'professional-fixture-controller',
        title: 'Super Control',
        props: { isDockable: false }
      }]
  },
  'bottom-right': {
    components: [
      {
        id: 'default-audio-panel',
        type: 'audio-control-panel',
        title: 'Audio Control',
        props: { touchOptimized: true }
      }
    ]
  },
  splitterPositions: {
    horizontal: 50, // 50% split between top panels
    vertical: 70   // 70% top, 30% bottom
  },
  layoutMode: 'grid-3'
});

const getBlankLayout = (): PanelLayout => ({
  'top-left': { components: [] },
  'top-right': { components: [] },
  'bottom': { components: [] },
  'bottom-right': { components: [] },
  splitterPositions: {
    horizontal: 50,
    vertical: 70
  },
  layoutMode: 'grid-3'
});

export const PanelProvider: React.FC<PanelProviderProps> = ({ children }) => {
  const [layout, setLayout] = useState<PanelLayout>(() => {
    migrateSavedLayoutsStorage();
    const saved = localStorage.getItem('artbastard-panel-layout');
    if (saved) {
      try {
        const parsedLayout = JSON.parse(saved) as Record<string, unknown>;
        return sanitizePanelLayout(parsedLayout, getDefaultLayout());
      } catch (error) {
        console.warn('Failed to parse saved panel layout, using defaults', error);
      }
    }
    return getDefaultLayout();
  });

  // Save layout to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('artbastard-panel-layout', JSON.stringify(layout));
  }, [layout]);

  const addComponentToPanel = useCallback((panelId: PanelId, component: PanelComponent) => {
    setLayout(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        components: [...prev[panelId].components, component]
      }
    }));
  }, []);

  const removeComponentFromPanel = useCallback((panelId: PanelId, componentId: string) => {
    setLayout(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        components: prev[panelId].components.filter(c => c.id !== componentId)
      }
    }));
  }, []);

  const moveComponent = useCallback((fromPanel: PanelId, toPanel: PanelId, componentId: string) => {
    setLayout(prev => {
      const component = prev[fromPanel].components.find(c => c.id === componentId);
      if (!component) return prev;

      return {
        ...prev,
        [fromPanel]: {
          ...prev[fromPanel],
          components: prev[fromPanel].components.filter(c => c.id !== componentId)
        },
        [toPanel]: {
          ...prev[toPanel],
          components: [...prev[toPanel].components, component]
        }
      };
    });
  }, []);
  const updateComponent = useCallback((panelId: PanelId, componentId: string, updates: Partial<PanelComponent>) => {
    setLayout(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        components: prev[panelId].components.map(c =>
          c.id === componentId ? { ...c, ...updates } : c
        )
      }
    }));
  }, []);

  const reorderComponent = useCallback((panelId: PanelId, componentId: string, direction: 'up' | 'down') => {
    setLayout(prev => {
      const components = [...prev[panelId].components];
      const currentIndex = components.findIndex(c => c.id === componentId);

      if (currentIndex === -1) return prev;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Check bounds
      if (newIndex < 0 || newIndex >= components.length) return prev;

      // Swap components
      [components[currentIndex], components[newIndex]] = [components[newIndex], components[currentIndex]];

      return {
        ...prev,
        [panelId]: {
          ...prev[panelId],
          components
        }
      };
    });
  }, []);

  const moveComponentToIndex = useCallback((panelId: PanelId, componentId: string, newIndex: number) => {
    setLayout(prev => {
      const components = [...prev[panelId].components];
      const currentIndex = components.findIndex(c => c.id === componentId);

      if (currentIndex === -1 || newIndex < 0 || newIndex >= components.length) return prev;

      // Remove component from current position
      const [component] = components.splice(currentIndex, 1);

      // Insert at new position
      components.splice(newIndex, 0, component);

      return {
        ...prev,
        [panelId]: {
          ...prev[panelId],
          components
        }
      };
    });
  }, []);

  const updateSplitterPosition = useCallback((type: 'horizontal' | 'vertical', position: number) => {
    setLayout(prev => ({
      ...prev,
      splitterPositions: {
        ...prev.splitterPositions,
        [type]: Math.max(10, Math.min(90, position)) // Constrain between 10% and 90%
      }
    }));
  }, []);

  const saveLayout = useCallback((name: string) => {
    const savedLayouts = JSON.parse(localStorage.getItem('artbastard-saved-layouts') || '{}');
    savedLayouts[name] = layout;
    localStorage.setItem('artbastard-saved-layouts', JSON.stringify(savedLayouts));
  }, [layout]);
  const loadLayout = useCallback((name: string) => {
    const savedLayouts = JSON.parse(localStorage.getItem('artbastard-saved-layouts') || '{}');
    if (savedLayouts[name]) {
      setLayout(
        sanitizePanelLayout(
          savedLayouts[name] as Record<string, unknown>,
          getDefaultLayout()
        )
      );
    }
  }, []);
  const getSavedLayouts = useCallback((): string[] => {
    const savedLayouts = JSON.parse(localStorage.getItem('artbastard-saved-layouts') || '{}');
    return Object.keys(savedLayouts);
  }, []);

  const deleteLayout = useCallback((name: string) => {
    const savedLayouts = JSON.parse(localStorage.getItem('artbastard-saved-layouts') || '{}');
    delete savedLayouts[name];
    localStorage.setItem('artbastard-saved-layouts', JSON.stringify(savedLayouts));
  }, []);
  const resetLayout = useCallback(() => {
    setLayout(getDefaultLayout());
  }, []);

  const loadBlankLayout = useCallback(() => {
    setLayout(getBlankLayout());
  }, []);

  const clearPanel = useCallback((panelId: PanelId) => {
    setLayout(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        components: []
      }
    }));
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayout(prev => ({
      ...prev,
      layoutMode: mode
    }));
  }, []);

  const contextValue: PanelContextType = {
    layout,
    addComponentToPanel,
    removeComponentFromPanel,
    moveComponent,
    updateComponent,
    reorderComponent,
    moveComponentToIndex,
    updateSplitterPosition,
    saveLayout,
    loadLayout,
    getSavedLayouts,
    deleteLayout,
    resetLayout,
    loadBlankLayout,

    clearPanel, // Added clearPanel
    setLayoutMode,
  };

  return (
    <PanelContext.Provider value={contextValue}>
      {children}
    </PanelContext.Provider>
  );
};

export const usePanels = (): PanelContextType => {
  const context = useContext(PanelContext);
  if (context === undefined) {
    throw new Error('usePanels must be used within a PanelProvider');
  }
  return context;
};

export default PanelProvider;
