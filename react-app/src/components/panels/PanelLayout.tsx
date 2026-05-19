import React, { useCallback, useRef, useState } from 'react';
import { usePanels, PanelId } from '../../context/PanelContext';
import ResizablePanel from './ResizablePanel';
import { ComponentToolbar } from './ComponentToolbar';
import styles from './PanelLayout.module.scss';

export const PanelLayout: React.FC = () => {
  const { layout, addComponentToPanel, updateSplitterPosition } = usePanels();
  const [isDragging, setIsDragging] = useState<'horizontal' | 'vertical' | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback((panelId: PanelId) => (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const componentData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Generate unique ID for component instance
      const componentId = `${componentData.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newComponent = {
        id: componentId,
        type: componentData.type,
        title: componentData.title,
        props: componentData.defaultProps || {},
      };

      addComponentToPanel(panelId, newComponent);
    } catch (error) {
      console.error('Failed to parse dropped component data:', error);
    }
  }, [addComponentToPanel]);

  const handleMouseDown = useCallback((type: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !layoutRef.current) return;

    const rect = layoutRef.current.getBoundingClientRect();
    
    if (isDragging === 'horizontal') {
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
      updateSplitterPosition('horizontal', newPosition);
    } else if (isDragging === 'vertical') {
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      updateSplitterPosition('vertical', newPosition);
    }
  }, [isDragging, updateSplitterPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);
  const { horizontal, vertical } = layout.splitterPositions;

  return (
    <div className={styles.layoutContainer}>
      <div
        ref={layoutRef}
        className={styles.panelLayout}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Top Section */}
        <div 
          className={styles.topSection}
          style={{ height: `${vertical}%` }}
        >
          {/* Top Left Panel */}
          <div 
            className={styles.topLeft}
            style={{ width: `${horizontal}%` }}
          >
            <ResizablePanel
              panelId="top-left"
              title="Left Panel"
              className={styles.topLeftPanel}
              onDrop={handleDrop('top-left')}
            />
          </div>

          {/* Horizontal Splitter */}
          <div
            className={`${styles.splitter} ${styles.horizontalSplitter}`}
            onMouseDown={handleMouseDown('horizontal')}
          >
            <div className={styles.splitterHandle}>
              <i className="fas fa-grip-lines-vertical"></i>
            </div>
          </div>

          {/* Top Right Panel */}
          <div 
            className={styles.topRight}
            style={{ width: `${100 - horizontal}%` }}
          >
            <ResizablePanel
              panelId="top-right"
              title="Right Panel"
              className={styles.topRightPanel}
              onDrop={handleDrop('top-right')}
            />
          </div>
        </div>

        {/* Vertical Splitter */}
        <div
          className={`${styles.splitter} ${styles.verticalSplitter}`}
          onMouseDown={handleMouseDown('vertical')}
        >
          <div className={styles.splitterHandle}>
            <i className="fas fa-grip-lines"></i>
          </div>
        </div>

        {/* Bottom Section */}
        <div 
          className={styles.bottomSection}
          style={{ height: `${100 - vertical}%` }}
        >
          <ResizablePanel
            panelId="bottom"
            title="Bottom Panel"
            className={styles.bottomPanel}
            onDrop={handleDrop('bottom')}
          />
        </div>
      </div>
    </div>
  );
};

export default PanelLayout;
