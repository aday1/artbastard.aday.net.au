import React, { useState, useRef, useCallback } from 'react'
import { usePanels, PanelId } from '../../context/PanelContext'
import ResizablePanel from './ResizablePanel'
import { ComponentToolbar } from './ComponentToolbar'
import styles from './EnhancedPanelLayout.module.scss'

export const EnhancedPanelLayout: React.FC = () => {
  const { layout, addComponentToPanel, updateSplitterPosition } = usePanels()
  const [isDragging, setIsDragging] = useState<'horizontal' | 'vertical' | null>(null)
  const layoutRef = useRef<HTMLDivElement>(null)

  const handleDrop = useCallback((panelId: string) => (e: React.DragEvent) => {
    e.preventDefault()

    try {
      const componentData = JSON.parse(e.dataTransfer.getData('application/json'))

      const componentId = `${componentData.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const newComponent = {
        id: componentId,
        type: componentData.type,
        title: componentData.title,
        props: componentData.defaultProps || {},
      }

      addComponentToPanel(panelId as any, newComponent)
    } catch (error) {
      console.error('Failed to parse dropped component data:', error)
    }
  }, [addComponentToPanel])

  const handleMouseDown = useCallback((type: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(type)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !layoutRef.current) return

    const rect = layoutRef.current.getBoundingClientRect()

    if (isDragging === 'horizontal') {
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100
      updateSplitterPosition('horizontal', Math.max(20, Math.min(80, newPosition)))
    } else if (isDragging === 'vertical') {
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100
      updateSplitterPosition('vertical', Math.max(20, Math.min(80, newPosition)))
    }
  }, [isDragging, updateSplitterPosition])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
  }, [])

  const { horizontal, vertical } = layout.splitterPositions
  const { layoutMode } = layout

  // Helper to render a panel
  const renderPanel = (id: PanelId, title: string, className: string) => (
    <ResizablePanel
      panelId={id}
      title={title}
      className={className}
      onDrop={handleDrop(id)}
    />
  )

  // Helper to render horizontal splitter
  const renderHorizontalSplitter = () => (
    <div
      className={`${styles.splitter} ${styles.horizontalSplitter}`}
      onMouseDown={handleMouseDown('horizontal')}
    >
      <div className={styles.splitterHandle}>
        <i className="fas fa-grip-lines-vertical"></i>
      </div>
    </div>
  )

  // Helper to render vertical splitter
  const renderVerticalSplitter = () => (
    <div
      className={`${styles.splitter} ${styles.verticalSplitter}`}
      onMouseDown={handleMouseDown('vertical')}
    >
      <div className={styles.splitterHandle}>
        <i className="fas fa-grip-lines"></i>
      </div>
    </div>
  )

  return (
    <div className={styles.layoutContainer}>
      <div
        ref={layoutRef}
        className={styles.panelLayout}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Single Panel Mode */}
        {layoutMode === 'single' && (
          <div className={styles.mainPanelArea} style={{ height: '100%' }}>
            <div className={styles.topLeft} style={{ width: '100%', height: '100%' }}>
              {renderPanel('top-left', 'Main Panel', styles.topLeftPanel)}
            </div>
          </div>
        )}

        {/* Split Vertical Mode (Left/Right) */}
        {layoutMode === 'split-vertical' && (
          <div className={styles.mainPanelArea} style={{ height: '100%', flexDirection: 'row' }}>
            <div className={styles.topLeft} style={{ width: `${horizontal}%`, height: '100%' }}>
              {renderPanel('top-left', 'Left Panel', styles.topLeftPanel)}
            </div>
            {renderHorizontalSplitter()}
            <div className={styles.topRight} style={{ width: `${100 - horizontal}%`, height: '100%' }}>
              {renderPanel('top-right', 'Right Panel', styles.topRightPanel)}
            </div>
          </div>
        )}

        {/* Split Horizontal Mode (Top/Bottom) */}
        {layoutMode === 'split-horizontal' && (
          <div className={styles.mainPanelArea} style={{ height: '100%' }}>
            <div className={styles.topSection} style={{ height: `${vertical}%`, width: '100%' }}>
              <div className={styles.topLeft} style={{ width: '100%', height: '100%' }}>
                {renderPanel('top-left', 'Top Panel', styles.topLeftPanel)}
              </div>
            </div>
            {renderVerticalSplitter()}
            <div className={styles.bottomSection} style={{ height: `${100 - vertical}%`, width: '100%' }}>
              {renderPanel('bottom', 'Bottom Panel', styles.bottomPanel)}
            </div>
          </div>
        )}

        {/* Grid 3 Mode (Standard) */}
        {layoutMode === 'grid-3' && (
          <div className={styles.mainPanelArea} style={{ height: '100%' }}>
            <div className={styles.topSection} style={{ height: `${vertical}%` }}>
              <div className={styles.topLeft} style={{ width: `${horizontal}%` }}>
                {renderPanel('top-left', 'Top Left', styles.topLeftPanel)}
              </div>
              {renderHorizontalSplitter()}
              <div className={styles.topRight} style={{ width: `${100 - horizontal}%` }}>
                {renderPanel('top-right', 'Top Right', styles.topRightPanel)}
              </div>
            </div>
            {renderVerticalSplitter()}
            <div className={styles.bottomSection} style={{ height: `${100 - vertical}%` }}>
              {renderPanel('bottom', 'Bottom Panel', styles.bottomPanel)}
            </div>
          </div>
        )}

        {/* Grid 4 Mode (2x2) */}
        {layoutMode === 'grid-4' && (
          <div className={styles.mainPanelArea} style={{ height: '100%' }}>
            {/* Top Row */}
            <div className={styles.topSection} style={{ height: `${vertical}%` }}>
              <div className={styles.topLeft} style={{ width: `${horizontal}%` }}>
                {renderPanel('top-left', 'Top Left', styles.topLeftPanel)}
              </div>
              {renderHorizontalSplitter()}
              <div className={styles.topRight} style={{ width: `${100 - horizontal}%` }}>
                {renderPanel('top-right', 'Top Right', styles.topRightPanel)}
              </div>
            </div>

            {renderVerticalSplitter()}

            {/* Bottom Row */}
            <div className={styles.bottomSection} style={{ height: `${100 - vertical}%`, display: 'flex' }}>
              <div className={styles.bottomLeft} style={{ width: `${horizontal}%`, height: '100%', overflow: 'hidden', position: 'relative' }}>
                {renderPanel('bottom', 'Bottom Left', styles.bottomPanel)}
              </div>
              {renderHorizontalSplitter()}
              <div className={styles.bottomRight} style={{ width: `${100 - horizontal}%`, height: '100%', overflow: 'hidden', position: 'relative' }}>
                {renderPanel('bottom-right', 'Bottom Right', styles.bottomPanel)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnhancedPanelLayout
