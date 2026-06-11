import React from 'react';
import { useDocking } from '@/context/DockingContext';
import styles from './SnapIndicator.module.scss';

interface SnapIndicatorProps {
  x: number;
  y: number;
  visible: boolean;
}

export const SnapIndicator: React.FC<SnapIndicatorProps> = ({ x, y, visible }) => {
  const { state } = useDocking();

  if (!visible || !state.gridSnappingEnabled) {
    return null;
  }

  const { gridSize } = state;
  const snappedX = Math.round(x / gridSize) * gridSize;
  const snappedY = Math.round(y / gridSize) * gridSize;

  return (
    <>      {/* Snap point indicator */}
      <div
        className={styles.snapIndicatorPoint}
        style={{
          position: 'fixed',
          left: snappedX - 4,
          top: snappedY - 4,
          width: '8px',
          height: '8px',
          backgroundColor: '#007acc',
          borderRadius: '50%',
          zIndex: 10000,
          pointerEvents: 'none',
          boxShadow: '0 0 6px rgba(0, 122, 204, 0.8)',
        }}
      />
        {/* Grid line highlights */}
      <div
        className={styles.snapIndicatorVertical}
        style={{
          position: 'fixed',
          left: snappedX,
          top: 0,
          width: '1px',
          height: '100vh',
          backgroundColor: 'rgba(0, 122, 204, 0.6)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
      
      <div
        className={styles.snapIndicatorHorizontal}
        style={{
          position: 'fixed',
          left: 0,
          top: snappedY,
          width: '100vw',
          height: '1px',
          backgroundColor: 'rgba(0, 122, 204, 0.6)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
