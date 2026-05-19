import React, { useState, useEffect } from 'react'
import { useStore, Fixture, MasterSlider } from '../../store' 
import useStoreUtils from '../../store/storeUtils'
import { useTheme } from '../../context/ThemeContext'
import { useSocket } from '../../context/SocketContext'
import { useChromaticEnergyManipulatorSettings } from '../../context/ChromaticEnergyManipulatorContext'
import { MidiLearnButton } from '../midi/MidiLearnButton'

import { CURRENT_VERSION, getVersionDisplay, getBuildInfo } from '../../utils/version'; // Added getBuildInfo
import { ReleaseNotes } from './ReleaseNotes'
import styles from './Settings.module.scss'

interface TouchOscExportOptionsUI {
  resolution: 'phone_portrait' | 'tablet_portrait'
  includeFixtureControls: boolean
  includeMasterSliders: boolean
  includeAllDmxChannels: boolean
}

interface ChromaticEnergyManipulatorSettings {
  enableKeyboardShortcuts: boolean
  autoSelectFirstFixture: boolean
  showQuickActions: boolean
  defaultColorPresets: string[]
  enableErrorMessages: boolean
  autoUpdateRate: number
  enableAnimations: boolean
  compactMode: boolean
}

interface AppSettings {
  theme: 'artsnob' | 'standard'
  darkMode: boolean
  debugModules: {
    midi: boolean
    osc: boolean
    artnet: boolean
    button: boolean // Added button visibility toggle
  }
  artNetConfig: any
  midiMappings: any
  fixtures: Fixture[]
  masterSliders: MasterSlider[]
  navVisibility: {
    main: boolean;
    midiOsc: boolean;
    fixture: boolean;
    scenes: boolean;
    misc: boolean;
  };
  debugTools: {
    debugButton: boolean;
    midiMonitor: boolean;
    oscMonitor: boolean;
  };
  chromaticEnergyManipulator: ChromaticEnergyManipulatorSettings;
}

export const Settings: React.FC = () => {
  const { theme, setTheme, darkMode, toggleDarkMode } = useTheme()
  const { socket, connected } = useSocket()
  const { settings: chromaticSettings, updateSettings: updateChromaticSettings } = useChromaticEnergyManipulatorSettings()
  const {
    artNetConfig,
    fixtures,
    masterSliders,
    midiMappings,
    navVisibility = {
      main: true,
      midiOsc: true,
      fixture: true,
      scenes: true,
      misc: true
    },
    debugTools = {
      debugButton: true,
      midiMonitor: true,
      oscMonitor: true
    },
    uiSettings,
    toggleSparkles,
    addNotification
  } = useStore(state => ({
    artNetConfig: state.artNetConfig,
    fixtures: state.fixtures,
    masterSliders: state.masterSliders,
    midiMappings: state.midiMappings,
    navVisibility: state.navVisibility,
    debugTools: state.debugTools,
    uiSettings: state.uiSettings,
    toggleSparkles: state.toggleSparkles,
    addNotification: state.addNotification
  }))

  // Settings state
  const [artNetSettings, setArtNetSettings] = useState({ ...artNetConfig })
  const [debugModules, setDebugModules] = useState({
    midi: false,
    osc: false,
    artnet: false,
    button: true // Added debug button visibility toggle
  });
  const [exportInProgress, setExportInProgress] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);  const [touchOscExportInProgress, setTouchOscExportInProgress] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [localNavVisibility, setLocalNavVisibility] = useState(navVisibility);  const [localDebugTools, setLocalDebugTools] = useState(debugTools);

  // Effect for log fetching
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs')
        if (!response.ok) throw new Error('Failed to fetch logs')
        const text = await response.text()
        setLogs(text.split('\n').filter(Boolean))
        setLogError(null)
      } catch (error) {
        setLogError(error instanceof Error ? error.message : 'Failed to fetch logs')
      }
    }

    fetchLogs()
    let interval: number
    if (autoRefresh) {
      interval = window.setInterval(fetchLogs, 5000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const handleClearLogs = async () => {
    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to clear logs')
      setLogs([])
      addNotification({
        message: 'Logs cleared successfully',
        type: 'success'
      })
    } catch (error) {
      addNotification({
        message: 'Failed to clear logs',
        type: 'error'
      })
    }
  }

  const [touchOscExportOptions, setTouchOscExportOptions] = useState<TouchOscExportOptionsUI>({
    resolution: 'phone_portrait',
    includeFixtureControls: true,
    includeMasterSliders: true,
    includeAllDmxChannels: false,
  })

  // Theme change handlers
  const handleThemeChange = (newTheme: 'artsnob' | 'standard') => {
    setTheme(newTheme)
    addNotification({
      message: `Theme changed to ${newTheme}`,
      type: 'success'
    })
  }

  const handleDarkModeToggle = () => {
    toggleDarkMode()
    addNotification({
      message: darkMode ? 'Light mode enabled' : 'Dark mode enabled',
      type: 'success'
    })
  }
  // Factory reset handler
  const handleFactoryReset = async () => {
    const confirmMessage = `Are you sure you want to perform a FACTORY RESET?\n\nThis will:\n• Delete ALL scenes and lighting setups\n• Clear ALL MIDI mappings\n• Reset ALL OSC assignments\n• Clear ArtNET configuration\n• Reset ALL automation settings\n• Clear current DMX state\n• Reset ALL UI settings\n\nThis action CANNOT be undone!`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setExportInProgress(true);
        
        // Clear localStorage
        localStorage.clear();
        
        // Clear server-side data
        await Promise.all([
          fetch('/api/scenes', { method: 'DELETE' }),
          fetch('/api/config', { method: 'DELETE' }),
          fetch('/api/state', { method: 'DELETE' })
        ]);
        
        // Reset store to initial state (comprehensive reset)
        useStoreUtils.setState({
          // Core DMX state
          dmxChannels: new Array(512).fill(0),
          channelNames: new Array(512).fill('').map((_, i) => `CH ${i + 1}`),
          selectedChannels: [],
          
          // Fixtures and groups
          fixtures: [],
          groups: [],
          selectedFixtures: [],
          fixtureLayout: [],
          placedFixtures: [],
          masterSliders: [],
          
          // Scenes and automation
          scenes: [],
          autoSceneEnabled: false,
          autoSceneList: [],
          autoSceneMode: 'forward',
          autoSceneCurrentIndex: -1,
          autoScenePingPongDirection: 'forward',
          autoSceneBeatDivision: 4,
          autoSceneManualBpm: 120,
          autoSceneTapTempoBpm: 120,
          autoSceneLastTapTime: 0,
          autoSceneTapTimes: [],
          autoSceneTempoSource: 'internal_clock',
          autoSceneIsFlashing: false,
          
          // MIDI and OSC
          midiMappings: {},
          oscAssignments: new Array(512).fill('').map((_, i) => `/fixture/DMX${i + 1}`),
          oscActivity: {},
          
          // Network configuration
          artNetConfig: {
            ip: '192.168.1.199',
            subnet: 0,
            universe: 0,
            net: 0,
            port: 6454,
            base_refresh_interval: 1000
          },
          oscConfig: {
            receivePort: 8000,
            sendPort: 8001,
            sendEnabled: false,
            receiveEnabled: true
          },
          
          // UI settings
          theme: 'standard',
          darkMode: true,
          navVisibility: {
            main: true,
            midiOsc: true,
            fixture: true,
            scenes: true,
            misc: true
          },
          debugTools: {
            debugButton: true,
            midiMonitor: true,
            oscMonitor: true
          }
        })
        
        // Reset local state
        setDebugModules({
          midi: false,
          osc: false,
          artnet: false,
          button: true
        });
        setLocalNavVisibility({
          main: true,
          midiOsc: true,
          fixture: true,
          scenes: true,
          misc: true
        });
        setLocalDebugTools({
          debugButton: true,
          midiMonitor: true,
          oscMonitor: true
        });
        updateChromaticSettings({
          enableKeyboardShortcuts: true,
          autoSelectFirstFixture: true,
          showQuickActions: false,
          defaultColorPresets: ['Red', 'Green', 'Blue', 'White', 'Yellow', 'Cyan', 'Magenta', 'Off'],
          enableErrorMessages: true,
          autoUpdateRate: 50,
          enableAnimations: true,
          compactMode: false
        });

        // Show success message
        addNotification({
          message: 'All settings have been reset to factory defaults, including scenes',
          type: 'success'
        })

        // Reload the page to apply all changes
        window.location.reload()
      } catch (error) {
        console.error('Error during factory reset:', error)
        addNotification({
          message: 'Factory reset completed with some errors. Please check that all scenes were cleared.',
          type: 'warning'
        })
        
        // Still reload the page even if there were errors
        window.location.reload()
      }
    }
  }
  // Export settings handler - Enhanced to include all data
  const handleExportSettings = async () => {
    try {
      setExportInProgress(true);
      
      // Fetch current state from server
      const [scenesResponse, configResponse, stateResponse] = await Promise.all([
        fetch('/api/scenes'),
        fetch('/api/config'),
        fetch('/api/state')
      ]);
      
      const scenes = scenesResponse.ok ? await scenesResponse.json() : [];
      const config = configResponse.ok ? await configResponse.json() : {};
      const currentState = stateResponse.ok ? await stateResponse.json() : {};
      
      // Create comprehensive export data
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        exportType: 'complete_artbastard_backup',
        
        // Frontend settings
        frontendSettings: {
          theme,
          darkMode,
          debugModules,
          navVisibility: localNavVisibility,
          debugTools: localDebugTools,
          chromaticEnergyManipulator: chromaticSettings
        },
        
        // Backend data (what gets auto-saved)
        backendData: {
          scenes: scenes,
          config: config,
          currentState: currentState
        },
        
        // Store state
        storeState: {
          artNetConfig,
          midiMappings,
          fixtures,
          masterSliders,
          oscAssignments: useStore.getState().oscAssignments,
          channelNames: useStore.getState().channelNames,
          groups: useStore.getState().groups,
          autoSceneEnabled: useStore.getState().autoSceneEnabled,
          autoSceneList: useStore.getState().autoSceneList,
          autoSceneMode: useStore.getState().autoSceneMode,
          autoSceneBeatDivision: useStore.getState().autoSceneBeatDivision,
          autoSceneManualBpm: useStore.getState().autoSceneManualBpm,
          autoSceneTempoSource: useStore.getState().autoSceneTempoSource
        }
      };

      const settingsJson = JSON.stringify(exportData, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `artbastard-complete-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addNotification({
        message: 'Complete ArtBastard backup exported successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Export error:', error);
      addNotification({
        message: 'Failed to export complete backup',
        type: 'error'
      });
    } finally {
      setExportInProgress(false);
    }
  };

  // Import settings handler - Enhanced to handle comprehensive backups
  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      if (!file) return

      setImportInProgress(true);
      const text = await file.text()
      const importData = JSON.parse(text);
      
      // Check if this is a comprehensive backup or legacy settings file
      if (importData.exportType === 'complete_artbastard_backup') {
        // Handle comprehensive backup
        console.log('Importing comprehensive ArtBastard backup from:', importData.timestamp);
        
        // Import backend data (scenes, config, state)
        if (importData.backendData) {
          const { scenes, config, currentState } = importData.backendData;
          
          // Upload scenes
          if (scenes && scenes.length > 0) {
            try {
              const response = await fetch('/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scenes)
              });
              if (!response.ok) {
                throw new Error(`Failed to import scenes: ${response.statusText}`);
              }
            } catch (error) {
              console.error('Failed to import scenes:', error);
              addNotification({
                message: `Failed to import scenes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error'
              });
            }
          }
          
          // Upload config
          if (config) {
            try {
              const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
              });
              if (!response.ok) {
                throw new Error(`Failed to import config: ${response.statusText}`);
              }
            } catch (error) {
              console.error('Failed to import config:', error);
              addNotification({
                message: `Failed to import config: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error'
              });
            }
          }
          
          // Upload current state
          if (currentState) {
            try {
              const response = await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentState)
              });
              if (!response.ok) {
                throw new Error(`Failed to import state: ${response.statusText}`);
              }
            } catch (error) {
              console.error('Failed to import state:', error);
              addNotification({
                message: `Failed to import state: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error'
              });
            }
          }
        }
        
        // Import store state
        if (importData.storeState) {
          const storeState = importData.storeState;
          useStoreUtils.setState({
            artNetConfig: storeState.artNetConfig || artNetConfig,
            fixtures: storeState.fixtures || fixtures,
            masterSliders: storeState.masterSliders || masterSliders,
            midiMappings: storeState.midiMappings || midiMappings,
            oscAssignments: storeState.oscAssignments || useStore.getState().oscAssignments,
            channelNames: storeState.channelNames || useStore.getState().channelNames,
            groups: storeState.groups || useStore.getState().groups,
            autoSceneEnabled: storeState.autoSceneEnabled ?? useStore.getState().autoSceneEnabled,
            autoSceneList: storeState.autoSceneList || useStore.getState().autoSceneList,
            autoSceneMode: storeState.autoSceneMode || useStore.getState().autoSceneMode,
            autoSceneBeatDivision: storeState.autoSceneBeatDivision ?? useStore.getState().autoSceneBeatDivision,
            autoSceneManualBpm: storeState.autoSceneManualBpm ?? useStore.getState().autoSceneManualBpm,
            autoSceneTempoSource: storeState.autoSceneTempoSource || useStore.getState().autoSceneTempoSource
          });
        }
        
        // Import frontend settings
        if (importData.frontendSettings) {
          const frontendSettings = importData.frontendSettings;
          setDebugModules(frontendSettings.debugModules || debugModules);
          setLocalNavVisibility(frontendSettings.navVisibility || localNavVisibility);
          setLocalDebugTools(frontendSettings.debugTools || localDebugTools);
          
          if (frontendSettings.chromaticEnergyManipulator) {
            updateChromaticSettings(frontendSettings.chromaticEnergyManipulator);
          }
        }
        
        addNotification({
          message: `Complete ArtBastard backup imported successfully from ${importData.timestamp}`,
          type: 'success'
        });
        
      } else {
        // Handle legacy settings format
        const settings: AppSettings = importData;
        
        // Update store with imported settings
        useStoreUtils.setState({
          artNetConfig: settings.artNetConfig,
          fixtures: settings.fixtures,
          masterSliders: settings.masterSliders,
          midiMappings: settings.midiMappings,
          theme: settings.theme,
          darkMode: settings.darkMode,
          navVisibility: settings.navVisibility,
          debugTools: settings.debugTools
        });

        // Update state
        setDebugModules(settings.debugModules);
        setLocalNavVisibility(settings.navVisibility);
        setLocalDebugTools(settings.debugTools);
        
        if (settings.chromaticEnergyManipulator) {
          updateChromaticSettings(settings.chromaticEnergyManipulator);
        }

        addNotification({
          message: 'Legacy settings imported successfully',
          type: 'success'
        });
      }

      // Reload to apply changes
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      addNotification({
        message: 'Failed to import backup - file may be corrupted or incompatible',
        type: 'error'
      });
    } finally {
      setImportInProgress(false);
    }
  }  // Debug module toggle handler
  const toggleDebugModule = (module: keyof typeof debugModules) => {
    const newValue = !debugModules[module];
    
    // Update local state
    setDebugModules(prev => ({
      ...prev,
      [module]: newValue
    }));
    
    // Save to localStorage
    const savedDebugModules = JSON.parse(localStorage.getItem('debugModules') || '{}');
    localStorage.setItem('debugModules', JSON.stringify({
      ...savedDebugModules,
      [module]: newValue
    }));
    
    // Update application state
    if (module === 'midi' || module === 'osc' || module === 'artnet') {
      // Update store state if it's available
      const updateDebugModules = useStore.getState().updateDebugModules;
      if (updateDebugModules) {
        updateDebugModules({
          ...debugModules,
          [module]: newValue
        });
      }
    }
    
    // Get a display-friendly module name
    const moduleDisplayName = String(module).charAt(0).toUpperCase() + String(module).slice(1);
    
    // Show notification
    addNotification({
      message: `${moduleDisplayName} debug ${newValue ? 'enabled' : 'disabled'}`,
      type: 'info'
    });
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs')
        if (!response.ok) throw new Error('Failed to fetch logs')
        const data = await response.text()
        setLogs(data.split('\n').filter(Boolean))
        setLogError(null)
      } catch (error) {
        setLogError(error instanceof Error ? error.message : 'Failed to fetch logs')
      }
    }

    fetchLogs()
    
    let interval: number | undefined
    if (autoRefresh) {
      interval = window.setInterval(fetchLogs, 5000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // Function to update navigation visibility
  const handleNavVisibilityChange = (item: keyof typeof navVisibility) => {
    const newValue = !localNavVisibility[item];
    setLocalNavVisibility(prev => ({
      ...prev,
      [item]: newValue
    }));
    
    useStoreUtils.setState(state => ({
      ...state,
      navVisibility: {
        ...state.navVisibility,
        [item]: newValue
      }
    }));
  };

  // Function to update debug tools visibility
  const handleDebugToolsChange = (tool: keyof typeof debugTools) => {
    const newValue = !localDebugTools[tool];
    setLocalDebugTools(prev => ({
      ...prev,
      [tool]: newValue
    }));
    
    useStoreUtils.setState(state => ({
      ...state,
      debugTools: {
        ...state.debugTools,
        [tool]: newValue
      }
    }));
  };
    return (
    <div className={styles.settings}>
      <div className={styles.unifiedPanel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>
            <i className="fas fa-cog"></i>
            {theme === 'artsnob' && 'Configuration Sanctuary'}
            {theme === 'standard' && 'Configuration & Settings'}
          </h2>
          <div className={styles.panelActions}>
            <button 
              className={styles.actionButton}
              onClick={handleExportSettings}
              disabled={exportInProgress}
            >
              <i className="fas fa-download"></i>
              {exportInProgress ? 'Exporting...' : 'Export Complete Backup'}
            </button>
            <label className={styles.actionButton}>
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                style={{ display: 'none' }}
                disabled={importInProgress}
              />
              <i className="fas fa-upload"></i>
              {importInProgress ? 'Importing...' : 'Import Backup'}
            </label>
            <button 
              className={styles.dangerButton}
              onClick={handleFactoryReset}
            >
              <i className="fas fa-undo"></i>
              Factory Reset
            </button>
          </div>
        </div>

        <div className={styles.panelContent}>
        {/* Debug Tools Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Debug Tools Visibility</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.toggleGrid}>
              {Object.entries(localDebugTools).map(([key, value]) => (
                <div key={key} className={styles.toggleItem}>
                  <div className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      id={`debug-${key}`}
                      checked={value}
                      onChange={() => handleDebugToolsChange(key as keyof typeof debugTools)}
                    />
                    <label htmlFor={`debug-${key}`} className={styles.toggleLabel}>
                      <span className={styles.toggleDot}>
                        <i className={`fas ${value ? 'fa-bug' : 'fa-times'}`}></i>
                      </span>
                    </label>
                    <span className={styles.toggleText}>{
                      key === 'debugButton' ? 'Debug Button' :
                      key === 'midiMonitor' ? 'MIDI Monitor' :
                      key === 'oscMonitor' ? 'OSC Monitor' :
                      key
                    }</span>
                  </div>
                </div>              ))}
            </div>
          </div>        </div>

        {/* UI Settings Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>UI Settings</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.toggleGrid}>
              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="ui-sparkles-enabled"
                    checked={uiSettings?.sparklesEnabled ?? true}
                    onChange={() => toggleSparkles()}
                  />
                  <label htmlFor="ui-sparkles-enabled" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${uiSettings?.sparklesEnabled ? 'fa-sparkles' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Sparkles Effect</span>
                </div>
                <div className={styles.toggleDescription}>
                  Enable or disable the animated sparkles background effect for improved performance
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ChromaticEnergyManipulator Settings Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>ChromaticEnergyManipulator Settings</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.toggleGrid}>
              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="chromatic-keyboard-shortcuts"
                    checked={chromaticSettings.enableKeyboardShortcuts}                    onChange={(e) => updateChromaticSettings({
                      enableKeyboardShortcuts: e.target.checked
                    })}
                  />
                  <label htmlFor="chromatic-keyboard-shortcuts" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${chromaticSettings.enableKeyboardShortcuts ? 'fa-keyboard' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Keyboard Shortcuts</span>
                </div>
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="chromatic-auto-select"
                    checked={chromaticSettings.autoSelectFirstFixture}                    onChange={(e) => updateChromaticSettings({
                      autoSelectFirstFixture: e.target.checked
                    })}
                  />
                  <label htmlFor="chromatic-auto-select" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${chromaticSettings.autoSelectFirstFixture ? 'fa-mouse-pointer' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Auto-select First Fixture</span>
                </div>
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="chromatic-quick-actions"
                    checked={chromaticSettings.showQuickActions}                    onChange={(e) => updateChromaticSettings({
                      showQuickActions: e.target.checked
                    })}
                  />
                  <label htmlFor="chromatic-quick-actions" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${chromaticSettings.showQuickActions ? 'fa-bolt' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Show Quick Actions</span>
                </div>
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="chromatic-error-messages"
                    checked={chromaticSettings.enableErrorMessages}                    onChange={(e) => updateChromaticSettings({
                      enableErrorMessages: e.target.checked
                    })}
                  />
                  <label htmlFor="chromatic-error-messages" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${chromaticSettings.enableErrorMessages ? 'fa-exclamation-triangle' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Show Error Messages</span>
                </div>
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    id="chromatic-animations"
                    checked={chromaticSettings.enableAnimations}                    onChange={(e) => updateChromaticSettings({
                      enableAnimations: e.target.checked
                    })}
                  />
                  <label htmlFor="chromatic-animations" className={styles.toggleLabel}>
                    <span className={styles.toggleDot}>
                      <i className={`fas ${chromaticSettings.enableAnimations ? 'fa-magic' : 'fa-times'}`}></i>
                    </span>
                  </label>
                  <span className={styles.toggleText}>Enable Animations</span>
                </div>
              </div>

            </div>

            <div className={styles.formGroup}>
              <label htmlFor="chromatic-update-rate">Auto Update Rate (ms)</label>
              <input
                type="number"
                id="chromatic-update-rate"
                value={chromaticSettings.autoUpdateRate}                onChange={(e) => updateChromaticSettings({
                  autoUpdateRate: Math.max(10, Math.min(1000, Number(e.target.value)))
                })}
                min={10}
                max={1000}
                step={10}
              />
              <small>Lower values = faster updates, higher CPU usage (10-1000ms)</small>
            </div>

            <div className={styles.formGroup}>
              <label>Default Color Presets</label>
              <div className={styles.colorPresetGrid}>
                {['Red', 'Green', 'Blue', 'White', 'Yellow', 'Cyan', 'Magenta', 'Orange', 'Purple', 'Warm White', 'Cool White', 'Off'].map(color => (
                  <div key={color} className={styles.colorPresetItem}>
                    <input
                      type="checkbox"
                      id={`preset-${color}`}
                      checked={chromaticSettings.defaultColorPresets.includes(color)}                      onChange={(e) => {
                        if (e.target.checked) {
                          updateChromaticSettings({
                            defaultColorPresets: [...chromaticSettings.defaultColorPresets, color]
                          });
                        } else {
                          updateChromaticSettings({
                            defaultColorPresets: chromaticSettings.defaultColorPresets.filter(c => c !== color)
                          });
                        }
                      }}
                    />
                    <label htmlFor={`preset-${color}`} className={styles.colorPresetLabel}>
                      {color}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* UI Theme Settings Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Theme Settings</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.themeOptions}>
              <div 
                className={`${styles.themeOption} ${theme === 'artsnob' ? styles.active : ''}`}
                onClick={() => handleThemeChange('artsnob')}
              >
                <div className={styles.themePreview} data-theme="artsnob">
                  <div className={styles.themePreviewHeader}></div>
                  <div className={styles.themePreviewBody}>
                    <div className={styles.themePreviewLine}></div>
                    <div className={styles.themePreviewLine}></div>
                  </div>
                </div>
                <span className={styles.themeName}>Art Snob</span>
              </div>

              <div 
                className={`${styles.themeOption} ${theme === 'standard' ? styles.active : ''}`}
                onClick={() => handleThemeChange('standard')}
              >
                <div className={styles.themePreview} data-theme="standard">
                  <div className={styles.themePreviewHeader}></div>
                  <div className={styles.themePreviewBody}>
                    <div className={styles.themePreviewLine}></div>
                    <div className={styles.themePreviewLine}></div>
                  </div>
                </div>
                <span className={styles.themeName}>Standard</span>
              </div>

            </div>

            <div className={styles.toggleSwitch}>
              <input
                type="checkbox"
                id="darkMode"
                checked={darkMode}
                onChange={handleDarkModeToggle}
              />
              <label htmlFor="darkMode" className={styles.toggleLabel}>
                <span className={styles.toggleDot}>
                  <i className={`fas ${darkMode ? 'fa-moon' : 'fa-sun'}`}></i>
                </span>
              </label>
              <span className={styles.toggleText}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Management Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Configuration Management</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.configActions}>
              <button 
                className={styles.secondaryButton}
                onClick={handleExportSettings}
              >
                <i className="fas fa-download"></i>
                <span>Export Complete Backup</span>
              </button>

              <label className={styles.secondaryButton}>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportSettings}
                />
                <i className="fas fa-upload"></i>
                <span>Import Backup</span>
              </label>

              <button 
                className={styles.dangerButton}
                onClick={handleFactoryReset}
              >
                <i className="fas fa-trash-alt"></i>
                <span>Factory Reset</span>
              </button>
            </div>

            <div className={styles.configNote}>
              <i className="fas fa-info-circle"></i>
              <p>
                Exporting saves all your settings to a file that you can backup or transfer to another device.
                Factory reset will remove all settings and return to defaults.
              </p>
            </div>
          </div>
        </div>        {/* ArtNet Configuration Card */}
        <div className={styles.card}>          <div className={styles.cardHeader}>
            <h3>ArtNet Configuration</h3>
            <div className={styles.cardDescription}>
              <i className="fas fa-info-circle"></i>
              <span>Configure Art-Net network settings for DMX transmission</span>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="artnet-ip">IP Address</label>
                <div className={styles.inputWithAction}>
                  <input
                    id="artnet-ip"
                    type="text"
                    value={artNetSettings.ip}
                    onChange={(e) => setArtNetSettings({
                      ...artNetSettings,
                      ip: e.target.value
                    })}
                    placeholder="192.168.1.99"
                  />                  <button 
                    className={`${styles.actionButton} ${!connected ? styles.disabled : ''}`}
                    onClick={() => {
                      if (connected && socket) {
                        socket.emit('pingArtNetDevice', { ip: artNetSettings.ip });
                        addNotification({
                          message: `Pinging ${artNetSettings.ip}...`,
                          type: 'info'
                        });
                      } else {
                        addNotification({
                          message: 'Cannot ping: Not connected to server',
                          type: 'error'
                        });
                      }
                    }}
                    disabled={!connected}
                    title={connected ? "Ping device to verify connectivity" : "Server connection required"}
                  >
                    <i className="fas fa-satellite-dish"></i>
                    <span>Ping</span>
                  </button>
                </div>
                <small className={styles.formHint}>Default for most Art-Net devices: 192.168.1.99</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="artnet-subnet">Subnet</label>
                <input
                  id="artnet-subnet"
                  type="number"
                  min="0"
                  max="15"
                  value={artNetSettings.subnet}
                  onChange={(e) => setArtNetSettings({
                    ...artNetSettings,
                    subnet: parseInt(e.target.value)
                  })}
                />
                <small>Range: 0-15</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="artnet-universe">Universe</label>
                <input
                  id="artnet-universe"
                  type="number"
                  min="0"
                  max="15"
                  value={artNetSettings.universe}
                  onChange={(e) => setArtNetSettings({
                    ...artNetSettings,
                    universe: parseInt(e.target.value)
                  })}
                />
                <small>Range: 0-15</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="artnet-port">Port</label>
                <input
                  id="artnet-port"
                  type="number"
                  min="1024"
                  max="65535"
                  value={artNetSettings.port}
                  onChange={(e) => setArtNetSettings({
                    ...artNetSettings,
                    port: parseInt(e.target.value)
                  })}
                />
                <small>Default: 6454</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="artnet-refresh">Refresh Rate (ms)</label>
                <input
                  id="artnet-refresh"
                  type="number"
                  min="20"
                  max="5000"
                  value={artNetSettings.base_refresh_interval}
                  onChange={(e) => setArtNetSettings({
                    ...artNetSettings,
                    base_refresh_interval: parseInt(e.target.value)
                  })}
                />
                <small>Lower values = faster updates, higher CPU usage</small>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button
                className={styles.primaryButton}
                onClick={() => {
                  useStore.getState().updateArtNetConfig(artNetSettings);
                }}
              >
                <i className="fas fa-save"></i>
                <span>Save ArtNet Settings</span>
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  useStore.getState().testArtNetConnection();
                }}
              >
                <i className="fas fa-plug"></i>
                <span>Test Connection</span>
              </button>
            </div>
          </div>
        </div>

        {/* System Logs Card */}
        <div className={`${styles.card} ${styles.logViewerCard}`}>
          <div className={styles.cardHeader}>
            <h3>System Logs</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.logControls}>
              <button 
                className={styles.refreshButton}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <i className={`fas ${autoRefresh ? 'fa-pause' : 'fa-play'}`}></i>
                {autoRefresh ? 'Pause Auto-Refresh' : 'Enable Auto-Refresh'}
              </button>
              <button 
                className={styles.clearButton}
                onClick={handleClearLogs}
              >
                <i className="fas fa-eraser"></i>
                Clear Logs
              </button>
            </div>
            
            <div className={styles.logContent}>
              {logError ? (
                <div className={styles.logError}>
                  <i className="fas fa-exclamation-circle"></i>
                  {logError}
                </div>
              ) : logs.length === 0 ? (
                <div className={styles.emptyLogs}>
                  <i className="fas fa-info-circle"></i>
                  No logs available
                </div>
              ) : (
                logs.map((log, index) => (
                  <pre key={index}>{log}</pre>
                ))
              )}
            </div>
          </div>
        </div>
      </div>        <div className={styles.manifestoSection}>
          <h3>⚡ ArtBastard DMX512 ⚡</h3>
          
          <div className={styles.manifestoSummary}>
            <strong>Professional lighting control meets artistic expression.</strong> ArtBastard DMX512 is an open-source 
            lighting controller that bridges technical precision with creative freedom. Control up to 512 DMX channels, 
            design dynamic scenes, and synchronize with MIDI/OSC for live performances.
          </div>

          <div className={styles.techTable}>
            <div className={styles.techTableHeader}>
              🔧 Technical Specifications
            </div>
            <div className={styles.techTableBody}>
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-layer-group"></i>
                  Frontend
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  React 18 + TypeScript
                </div>
              </div>
              
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-server"></i>
                  Backend
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  Node.js + Express
                </div>
              </div>
              
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-network-wired"></i>
                  Protocols
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  DMX512 • ArtNet • MIDI • OSC
                </div>
              </div>
              
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-sync-alt"></i>
                  Real-time
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  Socket.IO WebSockets
                </div>
              </div>
              
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-palette"></i>
                  Rendering
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  WebGL + Canvas2D
                </div>
              </div>
              
              <div className={styles.techRow}>
                <div className={`${styles.techCell} ${styles.techLabel}`}>
                  <i className="fas fa-wave-square"></i>
                  Audio
                </div>
                <div className={`${styles.techCell} ${styles.techValue}`}>
                  Web Audio API
                </div>
              </div>
            </div>
          </div>          <div className={styles.versionSection}>
            <div className={styles.versionInfo}>
              Version<span className={styles.versionNumber}>{getVersionDisplay()}</span>
              <button 
                className={styles.releaseNotesButton}
                onClick={() => setShowReleaseNotes(true)}
                title="View detailed release notes and version history"
              >
                <i className="fas fa-info-circle"></i>
                Release Notes
              </button>
            </div>
            <div className={styles.licenseInfo}>
              <span className={styles.copyleft}>◄◄◄</span> 
              Released under Creative Commons Zero (CC0) — Free and open source for everyone.
              <br />
              <small>{getBuildInfo()}</small>
            </div>
          </div>

          <div className={styles.manifestoCreed}>
            <h2>✧ Ethereal Manifesto & Cosmic Creed ✧</h2>
            <p>
              From the celestial depths of digital realms, we, the ethereal architects of illumination, present 
              ArtBastard DMX512 — a transcendent vessel for the manipulation of photonic energies. Version {getVersionDisplay()}, 
              forged in the quantum fires of artistic rebellion.
            </p>
            <p>
              ⚡ Our Creed ⚡<br/>
              We dance with electrons, sculpt with wavelengths, and paint with pure energy.<br/>
              Through the ancient protocol of DMX, we bridge dimensions of creativity and control.<br/>
              Let those who seek mere illumination step aside —<br/>
              For we are the light-shapers, the masters of luminous expression,<br/>
              Channeling the very essence of artistry through 512 channels of infinite possibility.            </p>
          </div>
        </div>
        
        <ReleaseNotes 
          showModal={showReleaseNotes}
          onClose={() => setShowReleaseNotes(false)}
        />
      </div>
    </div>
  )
}