import React from 'react';
import { useDocking } from '@/context/DockingContext';
import styles from './DockZones.module.scss';

export const DockZones: React.FC = () => {
  const { state } = useDocking();

  if (!state.showDockZones) {
    return null;
  }

  return (
    <div className={styles.dockZones}>
      {/* Corner zones */}
      <div className={`${styles.dockZone} ${styles.topLeft}`} data-zone="top-left">
        <div className={styles.zoneIndicator}>
          <span>Top Left</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.topRight}`} data-zone="top-right">
        <div className={styles.zoneIndicator}>
          <span>Top Right</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.bottomLeft}`} data-zone="bottom-left">
        <div className={styles.zoneIndicator}>
          <span>Bottom Left</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.bottomRight}`} data-zone="bottom-right">
        <div className={styles.zoneIndicator}>
          <span>Bottom Right</span>
        </div>
      </div>

      {/* Edge zones */}
      <div className={`${styles.dockZone} ${styles.topCenter}`} data-zone="top-center">
        <div className={styles.zoneIndicator}>
          <span>Top</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.bottomCenter}`} data-zone="bottom-center">
        <div className={styles.zoneIndicator}>
          <span>Bottom</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.leftCenter}`} data-zone="left-center">
        <div className={styles.zoneIndicator}>
          <span>Left</span>
        </div>
      </div>
      
      <div className={`${styles.dockZone} ${styles.rightCenter}`} data-zone="right-center">
        <div className={styles.zoneIndicator}>
          <span>Right</span>
        </div>
      </div>
    </div>
  );
};
