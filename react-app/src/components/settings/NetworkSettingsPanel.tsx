import React, { useState } from 'react';
import styles from './Settings.module.scss'; // Assuming a shared style module

interface NetworkSettings {
  dmxInterface: string;
  ipAddress: string;
  subnetMask: string;
  port: number;
  artnetEnabled: boolean;
}

const NetworkSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<NetworkSettings>({
    dmxInterface: 'default',
    ipAddress: '192.168.1.100',
    subnetMask: '255.255.255.0',
    port: 6454, // Default Art-Net port
    artnetEnabled: true,
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
      <h4>DMX Network & Communication</h4>
      <div className={styles.settingsGrid}>
        <div className={styles.formGroup}>
          <label htmlFor="dmxInterface">DMX Interface</label>
          <select
            id="dmxInterface"
            name="dmxInterface"
            value={settings.dmxInterface}
            onChange={handleChange}
          >
            <option value="default">Default Ethernet</option>
            {/* Add other interface options here if discoverable */}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ipAddress">IP Address (Informational)</label>
          <input
            type="text"
            id="ipAddress"
            name="ipAddress"
            value={settings.ipAddress}
            onChange={handleChange}
            disabled // Usually auto-detected or system configured
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="subnetMask">Subnet Mask (Informational)</label>
          <input
            type="text"
            id="subnetMask"
            name="subnetMask"
            value={settings.subnetMask}
            onChange={handleChange}
            disabled
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="port">Art-Net Port</label>
          <input
            type="number"
            id="port"
            name="port"
            value={settings.port}
            onChange={handleChange}
            min="1"
            max="65535"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="artnetEnabled"
              checked={settings.artnetEnabled}
              onChange={handleChange}
            />
            Enable Art-Net Protocol
          </label>
        </div>
      </div>
      <p className={styles.settingDescription}>
        Configure network interfaces and protocols for DMX output. IP and Subnet are typically auto-detected.
      </p>
    </div>
  );
};

export default NetworkSettingsPanel;
