import React from 'react';
import { EnhancedPanelLayout } from '../panels/EnhancedPanelLayout';
import { ComponentToolbar } from '../panels/ComponentToolbar';
import { useTheme } from '../../context/ThemeContext';
import { usePanels } from '../../context/PanelContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './Dashboard.module.scss';

/**
 * External Console Component - Opens in New Window
 * Perfect for tablets and 2nd monitors - opens as a standalone window
 */
export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const { layout } = usePanels();

  const hasComponents = (layout['top-left']?.components?.length > 0) ||
                        (layout['top-right']?.components?.length > 0) ||
                        (layout['bottom']?.components?.length > 0) ||
                        (layout['external']?.components?.length > 0);

  return (
    <div className={styles.dashboard}>
      {/* Global Component Toolbar - Always accessible */}
      <ComponentToolbar />

      {/* Main Layout */}
      <div className={styles.layoutWrapper}>
        <EnhancedPanelLayout />
      </div>

      {/* Empty State */}
      {!hasComponents && (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateContent}>
            <LucideIcon name="LayoutGrid" className={styles.emptyIcon} />
            <h2 className={styles.emptyTitle}>
              {theme === 'artsnob'
                ? 'Your Canvas Awaits'
                : 'Empty Workspace'}
            </h2>
            <p className={styles.emptyDescription}>
              {theme === 'artsnob'
                ? 'Drag components from the toolbar to begin crafting your lighting masterpiece. Each panel is a blank canvas, ready for your artistic vision.'
                : 'Drag components from the toolbar to add them to your workspace.'}
            </p>
            <div className={styles.emptyHint}>
              <LucideIcon name="ArrowRight" />
              <span>Look for the Component Toolbar on the right side</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

