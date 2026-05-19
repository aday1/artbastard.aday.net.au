import React from 'react';
import { MasterFader } from '../dmx/MasterFader';
import styles from './CompactMasterFaderExample.module.scss';

interface CompactMasterFaderExampleProps {
  showComparison?: boolean;
}

export const CompactMasterFaderExample: React.FC<CompactMasterFaderExampleProps> = ({ 
  showComparison = false 
}) => {
  const handleValueChange = (value: number) => {
    console.log('Master fader value changed:', value);
  };

  const handleMinimizedChange = (minimized: boolean) => {
    console.log('Master fader minimized state:', minimized);
  };

  if (showComparison) {
    return (
      <div className={styles.comparisonContainer}>
        <div className={styles.section}>
          <h3>Standard Master Fader</h3>
          <div className={styles.faderWrapper}>
            <MasterFader
              onValueChange={handleValueChange}
              onMinimizedChange={handleMinimizedChange}
              isDockable={false}
            />
          </div>
        </div>
        
        <div className={styles.section}>
          <h3>Compact Master Fader</h3>
          <div className={styles.faderWrapper}>
            <MasterFader
              compact={true}
              onValueChange={handleValueChange}
              onMinimizedChange={handleMinimizedChange}
              isDockable={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>Compact Master Fader Demo</h2>
      <p>This Master Fader uses 70% less vertical space while maintaining full functionality.</p>
      
      <div className={styles.compactFaderContainer}>
        <MasterFader
          compact={true}
          onValueChange={handleValueChange}
          onMinimizedChange={handleMinimizedChange}
          isDockable={false}
        />
      </div>
      
      <div className={styles.info}>
        <h4>Features Available in Compact Mode:</h4>
        <ul>
          <li>✅ Full On button with visual feedback</li>
          <li>✅ Blackout button</li>
          <li>✅ Fade Out (slow fadeout over 5 seconds)</li>
          <li>✅ Fade In (fade back to previous value)</li>
          <li>✅ Horizontal slider with real-time value display</li>
          <li>✅ Percentage value indicator</li>
          <li>✅ All DMX channel control functionality</li>
        </ul>
        
        <h4>Hidden in Compact Mode:</h4>
        <ul>
          <li>📦 OSC Address configuration</li>
          <li>📦 MIDI Learn controls</li>
          <li>📦 Channel information display</li>
          <li>📦 Detailed configuration options</li>
        </ul>
      </div>
    </div>
  );
};
