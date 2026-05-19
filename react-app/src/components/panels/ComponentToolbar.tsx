import React, { useState, useRef, useEffect, useCallback } from 'react';
import { COMPONENT_REGISTRY, ComponentDefinition, getAllCategories, getComponentsByCategory } from './ComponentRegistry';
import { usePanels, LayoutMode } from '../../context/PanelContext';
import styles from './ComponentToolbar.module.scss';

interface DraggableComponentProps {
  definition: ComponentDefinition;
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ definition }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(definition));
    e.dataTransfer.effectAllowed = 'copy';

    // Create custom drag image
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, #4ECDC4, #FF6BB4);
      color: white;
      border-radius: 8px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(78, 205, 196, 0.5);
    `;
    dragImage.textContent = definition.title;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`${styles.draggableComponent} ${isDragging ? styles.dragging : ''} ${isHovered ? styles.hovered : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={definition.description}
    >
      <div className={styles.componentIcon}>
        <i className={definition.icon}></i>
      </div>
      <div className={styles.componentInfo}>
        <div className={styles.componentTitle}>{definition.title}</div>
        <div className={styles.componentCategory}>{definition.category.toUpperCase()}</div>
      </div>
      <div className={styles.dragIndicator}>
        <i className="fas fa-grip-vertical"></i>
      </div>
    </div>
  );
};

interface ComponentToolbarProps {
  panelId?: string;
  panelRef?: React.RefObject<HTMLDivElement>;
  onClose?: () => void;
}

export const ComponentToolbar: React.FC<ComponentToolbarProps> = ({
  panelId,
  panelRef,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { saveLayout, loadLayout, getSavedLayouts, deleteLayout, resetLayout, loadBlankLayout, setLayoutMode, layout } = usePanels();
  const [layoutName, setLayoutName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const categories = getAllCategories();
  const savedLayouts = getSavedLayouts();

  // Priority order for components
  const priorityComponents = [
    'master-fader',
    'dmx-control-panel',
    'dmx-channels',
    'dmx-visualizer',
    'face-tracker',
    'scene-quick-launch',
    'chromatic-energy-manipulator'
  ];

  const getCategoryDisplayName = (category: string): string => {
    const names = {
      'dmx': 'DMX Controls',
      'scenes': 'Scene Control',
      'fixtures': 'Fixtures',
      'midi': 'MIDI',
      'osc': 'OSC',
      'audio': 'Audio',
      'setup': 'Setup'
    };
    return names[category as keyof typeof names] || category;
  };
  const getFilteredComponents = (): ComponentDefinition[] => {
    let components: ComponentDefinition[];

    if (selectedCategory === 'all') {
      components = Object.values(COMPONENT_REGISTRY);
    } else {
      components = getComponentsByCategory(selectedCategory as any);
    }

    // Sort components by priority for better UX
    return components
      .filter(comp => comp.type !== 'dashboard') // Don't allow dragging External Console onto itself
      .sort((a, b) => {
        const aIndex = priorityComponents.indexOf(a.type);
        const bIndex = priorityComponents.indexOf(b.type);

        // Priority components come first
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        } else if (aIndex !== -1) {
          return -1;
        } else if (bIndex !== -1) {
          return 1;
        }

        // Then sort alphabetically
        return a.title.localeCompare(b.title);
      });
  };

  const handleSaveLayout = () => {
    if (layoutName.trim()) {
      saveLayout(layoutName.trim());
      setLayoutName('');
      setShowSaveDialog(false);
    }
  };
  const handleLoadLayout = (name: string) => {
    loadLayout(name);
  };

  const handleDeleteLayout = (name: string) => {
    deleteLayout(name);
    setDeleteConfirm(null);
  };

  const handleLoadBlankLayout = () => {
    loadBlankLayout();
  };

  // Position toolbar relative to panel if panelRef is provided
  useEffect(() => {
    if (panelRef?.current && toolbarRef.current && !isDragging) {
      const panelRect = panelRef.current.getBoundingClientRect();
      const toolbar = toolbarRef.current;

      // Determine which side to slide out from based on panel position
      const isLeftPanel = panelId?.includes('left');
      const isRightPanel = panelId?.includes('right');

      if (isLeftPanel) {
        // Slide out from right edge of left panel
        toolbar.style.left = `${panelRect.right + 10}px`;
        toolbar.style.top = `${panelRect.top}px`;
        toolbar.style.right = 'auto';
        toolbar.setAttribute('data-panel-side', 'left');
      } else if (isRightPanel) {
        // Slide out from left edge of right panel
        toolbar.style.right = `${window.innerWidth - panelRect.left + 10}px`;
        toolbar.style.top = `${panelRect.top}px`;
        toolbar.style.left = 'auto';
        toolbar.setAttribute('data-panel-side', 'right');
      } else {
        // Default: slide out from right
        toolbar.style.right = `${window.innerWidth - panelRect.right + 10}px`;
        toolbar.style.top = `${panelRect.top}px`;
        toolbar.style.left = 'auto';
        toolbar.setAttribute('data-panel-side', 'right');
      }
    }
  }, [panelRef, panelId, isDragging]);

  // Handle dragging for non-slideout toolbars
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (panelId) return; // Don't drag slideout toolbars

    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  }, [panelId]);

  useEffect(() => {
    if (!isDragging || panelId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (toolbarRef.current) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Keep toolbar within viewport
        const maxX = window.innerWidth - (toolbarRef.current.offsetWidth || 320);
        const maxY = window.innerHeight - (toolbarRef.current.offsetHeight || 400);

        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));

        toolbarRef.current.style.left = `${clampedX}px`;
        toolbarRef.current.style.top = `${clampedY}px`;
        toolbarRef.current.style.right = 'auto';
        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, panelId]);

  return (
    <div
      ref={toolbarRef}
      className={`${styles.componentToolbar} ${panelId ? styles.slideout : ''} ${isCollapsed ? styles.collapsed : ''} ${isDocked ? styles.docked : ''} ${isMinimized ? styles.minimized : ''}`}
    >
      <div
        className={styles.toolbarHeader}
        onMouseDown={handleMouseDown}
        style={{ cursor: panelId ? 'default' : 'move' }}
      >
        <h3 className={styles.toolbarTitle}>
          <i className="fas fa-toolbox"></i>
          {!isMinimized && 'Component Toolbar'}
        </h3>
        <div className={styles.toolbarControls}>
          {onClose && (
            <button
              className={styles.controlButton}
              onClick={onClose}
              title="Close toolbar"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
          {!panelId && (
            <>
              <button
                className={styles.controlButton}
                onClick={() => setIsDocked(!isDocked)}
                title={isDocked ? 'Undock toolbar' : 'Dock toolbar'}
              >
                <i className={`fas fa-${isDocked ? 'expand-arrows-alt' : 'compress-arrows-alt'}`}></i>
              </button>
              <button
                className={styles.controlButton}
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Restore toolbar' : 'Minimize toolbar'}
              >
                <i className={`fas fa-${isMinimized ? 'window-restore' : 'window-minimize'}`}></i>
              </button>
            </>
          )}
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          >
            <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
          </button>
        </div>
      </div>

      {!isCollapsed && !isMinimized && (
        <div className={styles.toolbarContent}>
          {/* Layout Controls */}
          <div className={styles.layoutControls}>
            <div className={styles.controlGroup}>
              <button
                className={styles.controlButton}
                onClick={() => setShowSaveDialog(!showSaveDialog)}
                title="Save current layout"
              >
                <i className="fas fa-save"></i>
                Save Layout
              </button>
              <button
                className={styles.controlButton}
                onClick={resetLayout}
                title="Reset to default layout"
              >
                <i className="fas fa-undo"></i>
                Reset
              </button>
            </div>

            {/* Layout Mode Switcher */}
            <div className={styles.layoutModeSwitcher}>
              <label>Layout Mode:</label>
              <div className={styles.modeButtons}>
                <button
                  className={`${styles.modeButton} ${layout.layoutMode === 'single' ? styles.active : ''}`}
                  onClick={() => setLayoutMode('single')}
                  title="Single Panel"
                >
                  <i className="fas fa-square"></i>
                </button>
                <button
                  className={`${styles.modeButton} ${layout.layoutMode === 'split-vertical' ? styles.active : ''}`}
                  onClick={() => setLayoutMode('split-vertical')}
                  title="Split Vertical"
                >
                  <i className="fas fa-columns"></i>
                </button>
                <button
                  className={`${styles.modeButton} ${layout.layoutMode === 'split-horizontal' ? styles.active : ''}`}
                  onClick={() => setLayoutMode('split-horizontal')}
                  title="Split Horizontal"
                >
                  <i className="fas fa-window-maximize" style={{ transform: 'rotate(90deg)' }}></i>
                </button>
                <button
                  className={`${styles.modeButton} ${layout.layoutMode === 'grid-3' ? styles.active : ''}`}
                  onClick={() => setLayoutMode('grid-3')}
                  title="Grid 3 (Standard)"
                >
                  <i className="fas fa-th-large"></i>
                </button>
                <button
                  className={`${styles.modeButton} ${layout.layoutMode === 'grid-4' ? styles.active : ''}`}
                  onClick={() => setLayoutMode('grid-4')}
                  title="Grid 4 (2x2)"
                >
                  <i className="fas fa-th"></i>
                </button>
              </div>
            </div>

            {showSaveDialog && (
              <div className={styles.saveDialog}>
                <input
                  type="text"
                  placeholder="Layout name..."
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  className={styles.layoutNameInput}
                />
                <button
                  onClick={handleSaveLayout}
                  disabled={!layoutName.trim()}
                  className={styles.saveButton}
                >
                  Save
                </button>
              </div>
            )}            {(savedLayouts.length > 0 || true) && (
              <div className={styles.savedLayouts}>
                <label>Available Layouts:</label>
                <div className={styles.layoutList}>
                  {/* Blank Layout - always first */}
                  <div className={styles.layoutItem}>
                    <button
                      onClick={handleLoadBlankLayout}
                      className={`${styles.layoutButton} ${styles.blankLayoutButton}`}
                      title="Load blank layout"
                    >
                      <i className="fas fa-file"></i>
                      Blank Layout
                    </button>
                  </div>

                  {/* Saved Layouts */}
                  {savedLayouts.map(name => (
                    <div key={name} className={styles.layoutItem}>
                      <button
                        onClick={() => handleLoadLayout(name)}
                        className={styles.layoutButton}
                        title={`Load ${name} layout`}
                      >
                        <i className="fas fa-folder-open"></i>
                        {name}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(name)}
                        className={styles.deleteButton}
                        title={`Delete ${name} layout`}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>))}
                </div>
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
              <div className={styles.deleteConfirmDialog}>
                <div className={styles.confirmContent}>
                  <p>Delete layout "{deleteConfirm}"?</p>
                  <div className={styles.confirmButtons}>
                    <button
                      onClick={() => handleDeleteLayout(deleteConfirm)}
                      className={styles.confirmDeleteButton}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className={styles.categoryFilter}>
            <label>Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.categorySelect}
            >
              <option value="all">All Components</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Component List */}
          <div className={styles.componentList}>
            <div className={styles.listHeader}>
              <span>Drag components to panels:</span>
            </div>
            <div className={styles.components}>
              {getFilteredComponents().map(definition => (
                <DraggableComponent
                  key={definition.type}
                  definition={definition}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentToolbar;
