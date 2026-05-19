import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface DockPosition {
  zone: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'left-center' | 'right-center' | 'middle-left' | 'floating';
  offset?: { x: number; y: number }; // For floating positions
}

export interface DockedComponent {
  id: string;
  title: string;
  position: DockPosition;
  zIndex: number;
  isCollapsed: boolean;
  component: 'midi-monitor' | 'osc-monitor' | 'midi-clock' | 'chromatic-energy-manipulator' | 'master-fader' | 'dmx-channel-grid' | 'professional-fixture-controller';
}

export interface DockingState {
  components: Record<string, DockedComponent>;
  isDragging: boolean;
  draggedComponentId: string | null;
  showDockZones: boolean;
  gridSize: number;
  gridSnappingEnabled: boolean;
  showGrid: boolean;
  showGridTemporarily: boolean; // Show grid temporarily during dragging
}

export interface DockingContextType {
  state: DockingState;
  registerComponent: (component: DockedComponent) => void;
  unregisterComponent: (id: string) => void;
  updateComponentPosition: (id: string, position: DockPosition) => void;
  updateComponentCollapsed: (id: string, isCollapsed: boolean) => void;
  startDrag: (componentId: string) => void;
  endDrag: () => void;
  setShowDockZones: (show: boolean) => void;
  getDockZoneForPosition: (x: number, y: number) => DockPosition['zone'] | null;
  getComponentsByZone: (zone: DockPosition['zone']) => DockedComponent[];
  bringToFront: (id: string) => void;
  setGridSize: (size: number) => void;
  setGridSnappingEnabled: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  snapToGrid: (value: number) => number;
  snapPositionToGrid: (x: number, y: number) => { x: number; y: number };
  shouldSnapToGrid: (currentX: number, currentY: number) => boolean;
}

const DockingContext = createContext<DockingContextType | null>(null);

export const useDocking = () => {
  const context = useContext(DockingContext);
  if (!context) {
    throw new Error('useDocking must be used within a DockingProvider');
  }
  return context;
};

interface DockingProviderProps {
  children: ReactNode;
}

export const DockingProvider: React.FC<DockingProviderProps> = ({ children }) => {
  // Load persisted grid settings
  const loadGridSettings = () => {
    const savedGridSize = localStorage.getItem('docking-grid-size');
    const savedGridSnapping = localStorage.getItem('docking-grid-snapping');
    const savedShowGrid = localStorage.getItem('docking-show-grid');      return {
      gridSize: savedGridSize ? parseInt(savedGridSize, 10) : 120, // Increased from 80 to 120 for even fewer lines
      gridSnappingEnabled: savedGridSnapping ? savedGridSnapping === 'true' : true,
      showGrid: savedShowGrid ? savedShowGrid === 'true' : false,
    };
  };

  const gridSettings = loadGridSettings();
  const [state, setState] = useState<DockingState>({
    components: {},
    isDragging: false,
    draggedComponentId: null,
    showDockZones: false,
    showGridTemporarily: false,
    ...gridSettings,
  });

  const registerComponent = useCallback((component: DockedComponent) => {
    setState(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [component.id]: component,
      },
    }));
  }, []);

  const unregisterComponent = useCallback((id: string) => {
    setState(prev => {
      const { [id]: removed, ...rest } = prev.components;
      return {
        ...prev,
        components: rest,
      };
    });
  }, []);

  const updateComponentPosition = useCallback((id: string, position: DockPosition) => {
    setState(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [id]: {
          ...prev.components[id],
          position,
        },
      },
    }));

    // Persist position to localStorage
    localStorage.setItem(`docking-${id}-position`, JSON.stringify(position));
  }, []);

  const updateComponentCollapsed = useCallback((id: string, isCollapsed: boolean) => {
    setState(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [id]: {
          ...prev.components[id],
          isCollapsed,
        },
      },
    }));

    // Persist collapsed state to localStorage
    localStorage.setItem(`docking-${id}-collapsed`, JSON.stringify(isCollapsed));
  }, []);
  const startDrag = useCallback((componentId: string) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      draggedComponentId: componentId,
      showDockZones: true,
      showGridTemporarily: prev.gridSnappingEnabled, // Show grid during dragging if snapping is enabled
    }));
  }, []);
  const endDrag = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedComponentId: null,
      showDockZones: false,
      showGridTemporarily: false, // Hide temporary grid when dragging ends
    }));
  }, []);

  const setShowDockZones = useCallback((show: boolean) => {
    setState(prev => ({
      ...prev,
      showDockZones: show,
    }));
  }, []);
  const getDockZoneForPosition = useCallback((x: number, y: number): DockPosition['zone'] | null => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const threshold = 150; // Increased from 100 to 150 for easier docking

    // Corner zones (priority) - larger areas for easier targeting
    if (x < threshold && y < threshold) return 'top-left';
    if (x > viewport.width - threshold && y < threshold) return 'top-right';
    if (x < threshold && y > viewport.height - threshold) return 'bottom-left';
    if (x > viewport.width - threshold && y > viewport.height - threshold) return 'bottom-right';

    // Edge zones - larger snap areas
    if (y < threshold) return 'top-center';
    if (y > viewport.height - threshold) return 'bottom-center';
    if (x < threshold) return 'left-center';
    if (x > viewport.width - threshold) return 'right-center';

    return null; // Floating
  }, []);

  const getComponentsByZone = useCallback((zone: DockPosition['zone']) => {
    return Object.values(state.components).filter(comp => comp.position.zone === zone);
  }, [state.components]);
  const bringToFront = useCallback((id: string) => {
    setState(prev => {
      const maxZIndex = Math.max(...Object.values(prev.components).map(c => c.zIndex));
      return {
        ...prev,
        components: {
          ...prev.components,
          [id]: {
            ...prev.components[id],
            zIndex: maxZIndex + 1,
          },
        },
      };
    });
  }, []);  // Grid snapping functions
  const setGridSize = useCallback((size: number) => {
    setState(prev => ({
      ...prev,
      gridSize: Math.max(20, Math.min(200, size)), // Expanded range: 20-200px for fewer lines
    }));
    // Persist to localStorage
    localStorage.setItem('docking-grid-size', size.toString());
  }, []);

  const setGridSnappingEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      gridSnappingEnabled: enabled,
    }));
    // Persist to localStorage
    localStorage.setItem('docking-grid-snapping', enabled.toString());
  }, []);

  const setShowGrid = useCallback((show: boolean) => {
    setState(prev => ({
      ...prev,
      showGrid: show,
    }));
    // Persist to localStorage
    localStorage.setItem('docking-show-grid', show.toString());
  }, []);

  const snapToGrid = useCallback((value: number) => {
    if (!state.gridSnappingEnabled) return value;
    return Math.round(value / state.gridSize) * state.gridSize;
  }, [state.gridSize, state.gridSnappingEnabled]);

  const snapPositionToGrid = useCallback((x: number, y: number) => {
    if (!state.gridSnappingEnabled) {
      return { x, y };
    }
    return {
      x: Math.round(x / state.gridSize) * state.gridSize,
      y: Math.round(y / state.gridSize) * state.gridSize,
    };
  }, [state.gridSize, state.gridSnappingEnabled]);

  const shouldSnapToGrid = useCallback((currentX: number, currentY: number) => {
    if (!state.gridSnappingEnabled) return false;
    
    const snapThreshold = state.gridSize * 0.3; // 30% of grid size
    const snappedPos = snapPositionToGrid(currentX, currentY);
    
    const deltaX = Math.abs(currentX - snappedPos.x);
    const deltaY = Math.abs(currentY - snappedPos.y);
    
    return deltaX <= snapThreshold || deltaY <= snapThreshold;
  }, [state.gridSize, state.gridSnappingEnabled, snapPositionToGrid]);

  const contextValue: DockingContextType = {
    state,
    registerComponent,
    unregisterComponent,
    updateComponentPosition,
    updateComponentCollapsed,
    startDrag,
    endDrag,
    setShowDockZones,
    getDockZoneForPosition,
    getComponentsByZone,
    bringToFront,
    setGridSize,
    setGridSnappingEnabled,
    setShowGrid,
    snapToGrid,
    snapPositionToGrid,
    shouldSnapToGrid,
  };

  return (
    <DockingContext.Provider value={contextValue}>
      {children}
    </DockingContext.Provider>
  );
};
