import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ResetButton.module.scss';

interface ResetButtonProps {
  showLabels?: boolean;
}

export const ResetButton: React.FC<ResetButtonProps> = ({ showLabels = false }) => {
  const handleResetUI = () => {
    // Remove localStorage items for MidiMonitor and OscMonitor positions
    localStorage.removeItem('midiMonitorPositionX');
    localStorage.removeItem('midiMonitorPositionY');
    localStorage.removeItem('oscMonitorPositionX');
    localStorage.removeItem('oscMonitorPositionY');

    // Reload the page to apply the reset
    window.location.reload();
  };

  return (
    <button
      className={styles.resetButton}
      onClick={handleResetUI}
      title="Reset UI Elements"
    >
      <LucideIcon name="RefreshCw" />
      {showLabels && <span>Reset</span>}
    </button>
  );
};
