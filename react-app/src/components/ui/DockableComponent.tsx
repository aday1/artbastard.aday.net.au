import React, { useEffect, useRef, ReactNode, useState } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { useDocking, DockPosition } from '@/context/DockingContext';
import { SnapIndicator } from './SnapIndicator';

interface DockableComponentProps {
  id: string;
  title: string;
  component: 'midi-monitor' | 'osc-monitor' | 'midi-clock' | 'chromatic-energy-manipulator' | 'master-fader' | 'dmx-channel-grid' | 'professional-fixture-controller';
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  defaultPosition?: DockPosition;
  defaultZIndex?: number;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  width?: string;
  height?: string;
  isDraggable?: boolean;
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  showMinimizeButton?: boolean;
}

export const DockableComponent: React.FC<DockableComponentProps> = ({
  id,
  title,
  component,
  children,
  className = '',
  style = {},
  defaultPosition = { zone: 'floating', offset: { x: 0, y: 0 } },
  defaultZIndex = 1000,
  isCollapsed = false,
  onCollapsedChange,
  width = 'auto',
  height = 'auto',
  isDraggable = true,
  isMinimized = false,
  onMinimizedChange,
  showMinimizeButton = true,
}) => {  const dragControls = useDragControls();
  const componentRef = useRef<HTMLDivElement>(null);
  const [localMinimized, setLocalMinimized] = useState(isMinimized);
  const [currentDragPosition, setCurrentDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [showSnapIndicator, setShowSnapIndicator] = useState(false);
    const {
    registerComponent,
    unregisterComponent,
    updateComponentPosition,
    updateComponentCollapsed,
    startDrag,
    endDrag,
    getDockZoneForPosition,
    bringToFront,
    state,
    snapPositionToGrid,
    shouldSnapToGrid,
  } = useDocking();

  // Get component from docking state
  const dockedComponent = state.components[id];

  useEffect(() => {
    // Load saved position and collapsed state from localStorage
    const savedPosition = localStorage.getItem(`docking-${id}-position`);
    const savedCollapsed = localStorage.getItem(`docking-${id}-collapsed`);
    const savedMinimized = localStorage.getItem(`docking-${id}-minimized`);
    
    const position = savedPosition ? JSON.parse(savedPosition) : defaultPosition;
    const collapsed = savedCollapsed ? JSON.parse(savedCollapsed) : isCollapsed;
    const minimized = savedMinimized ? JSON.parse(savedMinimized) : isMinimized;

    // Register component with docking system
    registerComponent({
      id,
      title,
      position,
      zIndex: defaultZIndex,
      isCollapsed: collapsed,
      component,
    });

    // Set initial minimized state
    setLocalMinimized(minimized);

    // Call callbacks if needed
    if (onCollapsedChange && collapsed !== isCollapsed) {
      onCollapsedChange(collapsed);
    }
    if (onMinimizedChange && minimized !== isMinimized) {
      onMinimizedChange(minimized);
    }

    return () => {
      unregisterComponent(id);
    };
  }, [id, title, component, defaultPosition, defaultZIndex, registerComponent, unregisterComponent, isCollapsed, onCollapsedChange, isMinimized, onMinimizedChange]);

  // Update collapsed state when it changes externally
  useEffect(() => {
    if (dockedComponent && dockedComponent.isCollapsed !== isCollapsed) {
      updateComponentCollapsed(id, isCollapsed);
    }
  }, [isCollapsed, dockedComponent, updateComponentCollapsed, id]);

  // Update minimized state when it changes externally
  useEffect(() => {
    setLocalMinimized(isMinimized);
  }, [isMinimized]);  const getDragConstraints = () => {
    // If not draggable, return null constraints to prevent any dragging
    if (!isDraggable) {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      };
    }

    const componentElement = componentRef.current;
    if (!componentElement) {
      return {
        left: 0,
        top: 0,
        right: window.innerWidth - 200,
        bottom: window.innerHeight - 100,
      };
    }

    const componentWidth = componentElement.offsetWidth;
    const componentHeight = componentElement.offsetHeight;
    
    // Ensure at least 100px of the component remains visible
    const minVisibleWidth = Math.max(100, Math.min(200, componentWidth * 0.6));
    const minVisibleHeight = Math.max(50, Math.min(100, componentHeight * 0.6));

    return {
      left: -componentWidth + minVisibleWidth,
      top: -componentHeight + minVisibleHeight,
      right: window.innerWidth - minVisibleWidth,
      bottom: window.innerHeight - minVisibleHeight,
    };
  };

  const handleDragStart = (e: MouseEvent | TouchEvent | PointerEvent) => {
    e.preventDefault();
    bringToFront(id);
    startDrag(id);
    setShowSnapIndicator(true);
  };
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Get current component position and add the delta
    const rect = componentRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Calculate the actual position of the component center
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Update current drag position for snap indicator (use center for better UX)
    setCurrentDragPosition({ x: centerX, y: centerY });
    
    // Show snap indicator when close to snap points
    const shouldShow = shouldSnapToGrid(centerX, centerY) || getDockZoneForPosition(centerX, centerY) !== null;
    setShowSnapIndicator(shouldShow);
  };  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    endDrag();
    setShowSnapIndicator(false);
    setCurrentDragPosition(null);
    
    // Get final component position
    const rect = componentRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Use component center for more intuitive docking
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Determine if we should dock or stay floating
    const zone = getDockZoneForPosition(centerX, centerY);
    
    if (zone) {
      // Dock to zone
      updateComponentPosition(id, { zone });
    } else {
      // Stay floating, calculate offset from top-left of component
      let newOffset = { x: rect.left, y: rect.top };
      
      // Apply grid snapping if enabled and close enough to grid
      if (shouldSnapToGrid(centerX, centerY)) {
        const snapped = snapPositionToGrid(centerX, centerY);
        // Convert snapped center position back to top-left offset
        newOffset = {
          x: snapped.x - rect.width / 2,
          y: snapped.y - rect.height / 2
        };
      }
      
      // Apply viewport constraints to final position
      newOffset = getFloatingOffset(newOffset.x, newOffset.y);
      
      updateComponentPosition(id, { zone: 'floating', offset: newOffset });
    }
  };const getFloatingOffset = (x: number, y: number) => {
    // Get component dimensions for better constraint calculation
    const componentElement = componentRef.current;
    const componentWidth = componentElement?.offsetWidth || 300;
    const componentHeight = componentElement?.offsetHeight || 200;
    
    // Minimum visible area (prevent complete off-screen positioning)
    const minVisibleWidth = Math.min(150, componentWidth * 0.5); // Increased minimum visible area
    const minVisibleHeight = Math.min(80, componentHeight * 0.5); // Increased minimum visible area
    
    // Calculate constrained position to keep component mostly in viewport
    const constrainedX = Math.max(
      -componentWidth + minVisibleWidth, // Allow partial off-screen but keep significant portion visible
      Math.min(
        x,
        window.innerWidth - minVisibleWidth // Ensure significant part remains visible on right
      )
    );
    
    const constrainedY = Math.max(
      -componentHeight + minVisibleHeight, // Allow partial off-screen but keep significant portion visible
      Math.min(
        y,
        window.innerHeight - minVisibleHeight // Ensure significant part remains visible on bottom
      )
    );
    
    return { x: constrainedX, y: constrainedY };
  };

  const getPositionStyle = (): React.CSSProperties => {
    if (!dockedComponent) return {};

    const { position } = dockedComponent;
    
    switch (position.zone) {
      case 'top-left':
        return { top: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'bottom-right':
        return { bottom: 20, right: 20 };
      case 'top-center':
        return { top: 20, left: '50%', transform: 'translateX(-50%)' };      case 'bottom-center':
        return { bottom: 20, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 40px)' };
      case 'left-center':
        return { left: 20, top: '50%', transform: 'translateY(-50%)' };
      case 'right-center':
        return { right: 20, top: '50%', transform: 'translateY(-50%)' };
      case 'middle-left':
        return { left: 20, top: '40%', transform: 'translateY(-50%)' };
      case 'floating':
      default:
        return {
          left: position.offset?.x || 0,
          top: position.offset?.y || 0,
        };
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return; // Don't start drag if clicking a button
    }
    if (isDraggable) {
      // Allow dragging from any zone, not just floating
      dragControls.start(e);
    }
  };

  const toggleMinimized = () => {
    const newMinimized = !localMinimized;
    setLocalMinimized(newMinimized);
    
    // Save to localStorage
    localStorage.setItem(`docking-${id}-minimized`, JSON.stringify(newMinimized));
    
    // Call callback
    if (onMinimizedChange) {
      onMinimizedChange(newMinimized);
    }
  };

  // Handle window resize to keep components within bounds
  useEffect(() => {
    const handleResize = () => {
      if (dockedComponent && dockedComponent.position.zone === 'floating' && dockedComponent.position.offset) {
        const newOffset = getFloatingOffset(
          dockedComponent.position.offset.x,
          dockedComponent.position.offset.y
        );
        
        // Only update if position actually changed
        if (newOffset.x !== dockedComponent.position.offset.x || newOffset.y !== dockedComponent.position.offset.y) {
          updateComponentPosition(id, { zone: 'floating', offset: newOffset });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dockedComponent, id, updateComponentPosition]);

  if (!dockedComponent) {
    return null; // Component not registered yet
  }  const motionStyle = {
    width: localMinimized ? 'auto' : width,
    height: localMinimized ? 'auto' : height,
    zIndex: dockedComponent.zIndex,
    maxWidth: 'calc(100vw - 20px)', // Prevent overflow beyond viewport
    // For non-draggable components, use relative positioning to let CSS handle layout
    // For draggable components, use fixed positioning with calculated positions
    ...(isDraggable ? {
      position: 'fixed' as const,
      ...getPositionStyle(),
    } : {
      position: 'relative' as const,
    }),
    ...style,
  };
  return (
    <>
      {/* Snap indicator for visual feedback during dragging */}
      {currentDragPosition && (
        <SnapIndicator
          x={currentDragPosition.x}
          y={currentDragPosition.y}
          visible={showSnapIndicator}
        />
      )}        <motion.div
      ref={componentRef}
      className={`${className} ${localMinimized ? 'minimized' : ''}`}
      style={motionStyle}
      drag={isDraggable}
      dragControls={isDraggable ? dragControls : undefined}
      dragListener={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDrag={isDraggable ? handleDrag : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
      whileDrag={isDraggable ? { cursor: 'grabbing' } : undefined}
      dragConstraints={isDraggable ? getDragConstraints() : undefined}
      initial={false}
    >
      <div style={{ cursor: isDraggable ? 'grab' : 'default' }}>
        {/* Header with title and minimize button */}
        <div 
          onPointerDown={handlePointerDown}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.1)',
            borderBottom: localMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            cursor: isDraggable ? 'grab' : 'default',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{title}</span>
          {showMinimizeButton && (
            <button
              onClick={toggleMinimized}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '12px',
              }}
              title={localMinimized ? 'Expand' : 'Minimize'}
            >
              <i className={localMinimized ? 'fas fa-chevron-down' : 'fas fa-chevron-up'}></i>
            </button>
          )}
        </div>
          {/* Content - only show when not minimized */}
        {!localMinimized && (
          <div style={{ 
            pointerEvents: 'auto',
            overflow: 'visible', // Ensure content is not clipped
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {children}
          </div>        )}
        
        {/* Minimized content - show essential parts when minimized */}
        {localMinimized && (
          <div style={{ 
            pointerEvents: 'auto',
            overflow: 'visible', // Ensure buttons are not clipped
            width: '100%',
            boxSizing: 'border-box',
            padding: '4px' // Small padding to prevent edge clipping
          }}>
            {children}
          </div>
        )}
      </div>      </motion.div>
    </>
  );
  };
