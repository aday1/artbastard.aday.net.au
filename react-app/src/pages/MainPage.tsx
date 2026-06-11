import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EnhancedPanelLayout } from '../components/panels/EnhancedPanelLayout';
import { ComponentToolbar } from '../components/panels/ComponentToolbar';
import { useTheme } from '../context/ThemeContext';
import { usePanels } from '../context/PanelContext';
import { LucideIcon } from '../components/ui/LucideIcon';
import styles from './MainPage.module.scss';

const MainPage: React.FC = () => {
  const { theme } = useTheme();
  const { layout, resetLayout, loadBlankLayout } = usePanels();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; component: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enhanced drag preview
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragPreview) {
        setDragPreview({
          ...dragPreview,
          x: e.clientX,
          y: e.clientY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragPreview(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragPreview]);

  const handleDragStart = useCallback((componentType: string, componentTitle: string) => {
    setIsDragging(true);
    setDragPreview({
      x: 0,
      y: 0,
      component: componentTitle,
    });
  }, []);

  const hasComponents = (layout['top-left']?.components?.length > 0) ||
                        (layout['top-right']?.components?.length > 0) ||
                        (layout['bottom']?.components?.length > 0) ||
                        (layout['external']?.components?.length > 0);


  return (
    <div className={styles.mainPage} ref={containerRef}>
      {/* Dashboard is now an external window component */}
      <div className={styles.dashboardRedirect}>
        <div className={styles.redirectContent}>
          <LucideIcon name="LayoutGrid" className={styles.redirectIcon} />
          <h2 className={styles.redirectTitle}>
            {theme === 'artsnob'
              ? 'Console Externe Élégante™ - Opens in New Window'
              : 'External Console - Opens in New Window'}
          </h2>
          <p className={styles.redirectDescription}>
            {theme === 'artsnob'
              ? 'The External Console opens in a new window - perfect for tablets and 2nd monitors. Click the "Console Externe Élégante™" button in the navigation menu, or drag the "External Console" component from the Component Toolbar.'
              : 'The External Console opens in a new window - perfect for tablets and 2nd monitors. Click "External Console" in the navigation menu, or drag it from the Component Toolbar.'}
          </p>
          <div className={styles.redirectHint}>
            <LucideIcon name="ArrowRight" />
            <span>Click "External Console" in the navigation menu to open in a new window</span>
          </div>
          <div className={styles.redirectActions}>
            <button
              className={styles.redirectButton}
              onClick={() => {
                // Trigger navigation to dmxControl
                window.dispatchEvent(new CustomEvent('changeView', { detail: { view: 'dmxControl' } }));
              }}
            >
              <LucideIcon name="Zap" />
              <span>Go to DMX Control</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
