import React, { useState } from 'react';
import styles from './Settings.module.scss'; // Assuming a shared style module

interface PerformanceSettings {
  enableHardwareAcceleration: boolean;
  visualizerQuality: 'low' | 'medium' | 'high';
  loggingLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  showFps: boolean;
}

const PerformanceSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<PerformanceSettings>({
    enableHardwareAcceleration: true,
    visualizerQuality: 'medium',
    loggingLevel: 'info',
    showFps: false,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (type === 'checkbox') {
      const { checked } = event.target as HTMLInputElement;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className={styles.settingsPanelItem}>
      <h4>Performance & Debugging</h4>
      <div className={styles.settingsGrid}>
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="enableHardwareAcceleration"
              checked={settings.enableHardwareAcceleration}
              onChange={handleChange}
            />
            Enable Hardware Acceleration (if available)
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="visualizerQuality">Visualizer Quality</label>
          <select
            id="visualizerQuality"
            name="visualizerQuality"
            value={settings.visualizerQuality}
            onChange={handleChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="loggingLevel">Logging Level</label>
          <select
            id="loggingLevel"
            name="loggingLevel"
            value={settings.loggingLevel}
            onChange={handleChange}
          >
            <option value="none">None</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="showFps"
              checked={settings.showFps}
              onChange={handleChange}
            />
            Show FPS Counter
          </label>
        </div>
      </div>
      <p className={styles.settingDescription}>
        Adjust settings to optimize performance or aid in debugging. Some changes may require an application restart.
      </p>
    </div>
  );
};

export default PerformanceSettingsPanel;
