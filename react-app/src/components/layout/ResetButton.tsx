import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ResetButton.module.scss';

interface ResetButtonProps {
  showLabels?: boolean;
}

export const ResetButton: React.FC<ResetButtonProps> = ({ showLabels = false }) => {
  const handleResetUI = () => {
    window.dispatchEvent(new CustomEvent('resetLayout'));

    localStorage.removeItem('midiMonitorPositionX');
    localStorage.removeItem('midiMonitorPositionY');
    localStorage.removeItem('oscMonitorPositionX');
    localStorage.removeItem('oscMonitorPositionY');
    localStorage.removeItem('midiMonitorDismissed');
    localStorage.removeItem('oscMonitorDismissed');
    localStorage.removeItem('dmxMonitorDismissed');
    localStorage.removeItem('midiMonitorCollapsed');
    localStorage.removeItem('oscMonitorCollapsed');
    localStorage.removeItem('dmxMonitorCollapsed');
    localStorage.removeItem('midiMonitorUserInteracted');
    localStorage.removeItem('oscMonitorUserInteracted');
    localStorage.removeItem('dmxMonitorUserInteracted');
    localStorage.removeItem('artbastard.midiMonitor.size');
    localStorage.removeItem('artbastard.oscMonitor.size');
    localStorage.removeItem('artbastard.dmxMonitor.size');
    localStorage.removeItem('fancyQuotesDismissed');

    // Reload the page to apply the reset
    window.location.reload();
  };

  return (
    <button
      className={styles.resetButton}
      onClick={handleResetUI}
      title="Reset UI layout, monitor visibility, and floating panel positions"
    >
      <LucideIcon name="RefreshCw" />
      {showLabels && <span>Reset</span>}
    </button>
  );
};
