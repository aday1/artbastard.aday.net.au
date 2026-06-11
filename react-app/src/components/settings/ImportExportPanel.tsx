import React, { useRef } from 'react';
import styles from './Settings.module.scss'; // Assuming a shared style module

const ImportExportPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportConfiguration = () => {
    // Simulate generating a configuration object
    const configData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: {
        // Placeholder for actual settings that would be exported
        theme: 'dark',
        network: { ip: '192.168.1.100', port: 6454 },
        performance: { quality: 'high' }
      },
      // Add other data like scenes, fixtures, etc.
    };

    const jsonData = JSON.stringify(configData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Configuration exported successfully!');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target?.result as string);
          // Here, you would typically validate and apply the importedConfig
          console.log('Imported configuration:', importedConfig);
          alert(`File "${file.name}" imported successfully! (Data logged to console)`);
        } catch (error) {
          console.error('Error parsing imported configuration:', error);
          alert(`Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
    }
    // Reset file input value to allow importing the same file again if needed
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className={styles.settingsPanelItem}>
      <h4>Import/Export Configuration</h4>
      <div className={styles.settingsGroup}>
        <p>Backup your current settings and data, or restore from a previous backup.</p>
        <button
          className={styles.actionButton}
          onClick={handleExportConfiguration}
        >
          Export Configuration Data
        </button>
        <button
          className={styles.actionButton}
          onClick={handleImportClick}
        >
          Import Configuration Data
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json"
          onChange={handleFileImport}
        />
      </div>
      <p className={styles.settingDescription}>
        Export creates a JSON file of your application's configuration. Import allows restoring from such a file.
      </p>
    </div>
  );
};

export default ImportExportPanel;
