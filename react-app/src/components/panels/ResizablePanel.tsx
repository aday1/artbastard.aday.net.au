import React, { useRef, useCallback, useState, useEffect } from 'react';
import { usePanels, PanelId, PanelComponent } from '../../context/PanelContext';
import { renderComponent } from './ComponentRegistry';
import { ComponentToolbar } from './ComponentToolbar';
import styles from './ResizablePanel.module.scss';

interface ResizablePanelProps {
  panelId: PanelId;
  title: string;
  className?: string;
  onDrop?: (e: React.DragEvent) => void;
  allowPanelManagement?: boolean;
  enableTouchOptimization?: boolean;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  panelId,
  title,
  className = '',
  onDrop,
  allowPanelManagement = false,
  enableTouchOptimization = false
}) => {
  const { layout, removeComponentFromPanel, updateComponent, moveComponent, reorderComponent, moveComponentToIndex, clearPanel } = usePanels();
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [showPanelControls, setShowPanelControls] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPanelFullScreen, setIsPanelFullScreen] = useState(false);

  const panelState = layout[panelId];

  // Safety check: if panelState is undefined, initialize with empty components
  const safeComponents = panelState?.components || [];

  // Debug logging to help identify the issue
  if (!panelState) {
    console.warn(`ResizablePanel: panelState is undefined for panelId: ${panelId}`, { layout, panelId });
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're actually leaving the panel
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setIsDragOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (onDrop) {
      onDrop(e);
    }
  }, [onDrop]);
  const handleRemoveComponent = useCallback((componentId: string) => {
    console.log('Attempting to remove component:', componentId, 'from panel:', panelId);
    removeComponentFromPanel(panelId, componentId);
  }, [panelId, removeComponentFromPanel]);

  const handleExpandComponent = useCallback((componentId: string) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(componentId)) {
        newSet.delete(componentId);
      } else {
        newSet.add(componentId);
      }
      return newSet;
    });
  }, []);
  const handleMoveComponent = useCallback((componentId: string, direction: 'up' | 'down') => {
    console.log(`Moving component ${componentId} ${direction} in panel ${panelId}`);
    reorderComponent(panelId, componentId, direction);
  }, [panelId, reorderComponent]);

  const togglePanelFullScreen = () => {
    if (!panelRef.current) return;

    if (!isPanelFullScreen) {
      if (panelRef.current.requestFullscreen) {
        panelRef.current.requestFullscreen();
      } else if ((panelRef.current as any).mozRequestFullScreen) { /* Firefox */
        (panelRef.current as any).mozRequestFullScreen();
      } else if ((panelRef.current as any).webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        (panelRef.current as any).webkitRequestFullscreen();
      } else if ((panelRef.current as any).msRequestFullscreen) { /* IE/Edge */
        (panelRef.current as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).mozCancelFullScreen) { /* Firefox */
        (document as any).mozCancelFullScreen();
      } else if ((document as any).webkitExitFullscreen) { /* Chrome, Safari & Opera */
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) { /* IE/Edge */
        (document as any).msExitFullscreen();
      }
    }
    setIsPanelFullScreen(!isPanelFullScreen);
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsPanelFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className={`${styles.panel} ${className} ${isDragOver ? styles.dragOver : ''} ${enableTouchOptimization ? styles.touchOptimized : ''} ${isPanelFullScreen ? styles.panelFullScreen : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          <i className="fas fa-th-large"></i>
          {title}
        </h3>
        
        <div className={styles.panelControls}>
          <button
            className={styles.panelControlButton}
            onClick={() => setShowToolbar(!showToolbar)}
            title="Toggle Component Toolbar"
          >
            <i className="fas fa-toolbox"></i>
          </button>
          <button
            className={styles.panelControlButton}
            onClick={togglePanelFullScreen}
            title={isPanelFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <i className={`fas fa-${isPanelFullScreen ? 'compress-arrows-alt' : 'expand-arrows-alt'}`}></i>
          </button>
          <span className={styles.componentCount}>
            {safeComponents.length} component{safeComponents.length !== 1 ? 's' : ''}
          </span>
          
          {allowPanelManagement && (
            <div className={styles.panelManagement}>
              <button
                className={styles.panelControlButton}
                onClick={() => setShowPanelControls(!showPanelControls)}
                title="Panel Controls"
              >
                <i className="fas fa-cog"></i>
              </button>
              
              {showPanelControls && (
                <div className={styles.panelControlsDropdown}>
                  <button
                    className={styles.controlAction}
                    onClick={() => {
                      console.log('Clear all components from panel:', panelId);
                      // Use the clearPanel function from PanelContext
                      clearPanel(panelId); 
                      setShowPanelControls(false); // Optionally close dropdown
                    }}
                    title="Clear All Components"
                  >
                    <i className="fas fa-trash"></i>
                    Clear All
                  </button>
                  <button
                    className={styles.controlAction}
                    onClick={() => {
                      setExpandedComponents(new Set(safeComponents.map(c => c.id)));
                    }}
                    title="Expand All Components"
                  >
                    <i className="fas fa-expand"></i>
                    Expand All
                  </button>
                  <button
                    className={styles.controlAction}
                    onClick={() => {
                      setExpandedComponents(new Set());
                    }}
                    title="Collapse All Components"
                  >
                    <i className="fas fa-compress"></i>
                    Collapse All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>      <div className={styles.panelContent}>
        {safeComponents.length === 0 ? (
          <div className={styles.emptyPanel}>
            <i className="fas fa-plus-circle"></i>
            <p>Drag components here</p>
            <small>Drop UI components to build your interface</small>
          </div>
        ) : (
          <div className={styles.componentGrid}>
            {safeComponents.map((component: PanelComponent, index: number) => {
              const isExpanded = expandedComponents.has(component.id);
              const canMoveUp = index > 0;
              const canMoveDown = index < safeComponents.length - 1;
              
              return (
                <div 
                  key={component.id} 
                  className={`${styles.componentWrapper} ${isExpanded ? styles.expanded : ''} ${enableTouchOptimization ? styles.touchOptimized : ''}`}
                >
                  <div className={styles.componentHeader}>
                    <span className={styles.componentTitle}>{component.title}</span>
                    
                    <div className={styles.componentActions}>
                      {allowPanelManagement && (
                        <>
                          {canMoveUp && (
                            <button
                              className={styles.actionButton}
                              onClick={() => handleMoveComponent(component.id, 'up')}
                              title="Move Up"
                            >
                              <i className="fas fa-chevron-up"></i>
                            </button>
                          )}
                          {canMoveDown && (
                            <button
                              className={styles.actionButton}
                              onClick={() => handleMoveComponent(component.id, 'down')}
                              title="Move Down"
                            >
                              <i className="fas fa-chevron-down"></i>
                            </button>
                          )}
                        </>
                      )}
                      
                      <button
                        className={styles.actionButton}
                        onClick={() => handleExpandComponent(component.id)}
                        title={isExpanded ? 'Collapse Component' : 'Expand Component'}
                      >
                        <i className={`fas fa-${isExpanded ? 'compress' : 'expand'}`}></i>
                      </button>
                        <button
                        className={`${styles.removeButton} ${enableTouchOptimization ? styles.touchButton : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Remove button clicked for component:', component.id);
                          handleRemoveComponent(component.id);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Remove button touched for component:', component.id);
                          handleRemoveComponent(component.id);
                        }}
                        style={{
                          touchAction: 'manipulation',
                          userSelect: 'none',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                        title={`Remove ${component.title}`}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div className={`${styles.componentContent} ${isExpanded ? styles.expandedContent : ''}`}>
                    {renderComponent(component.type, {
                      ...component.props,
                      touchOptimized: enableTouchOptimization,
                      compact: !isExpanded,
                      panelId: panelId
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Component Toolbar - slides out from panel */}
      {showToolbar && (
        <ComponentToolbar 
          panelId={panelId}
          panelRef={panelRef}
          onClose={() => setShowToolbar(false)}
        />
      )}
    </div>
  );
};

export default ResizablePanel;
