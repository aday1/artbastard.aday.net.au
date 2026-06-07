import React, { useState, useEffect, useRef } from 'react'
import { useStore, Fixture, MasterSlider } from '../../store' 
import useStoreUtils from '../../store/storeUtils'
import { useTheme } from '../../context/ThemeContext'
import { useSocket } from '../../context/SocketContext'
import {
  useSuperControlPreferences,
  type SuperControlPreferences,
} from '../../context/SuperControlPreferencesContext'
import { MidiLearnButton } from '../midi/MidiLearnButton'

import { getVersionDisplay, getBuildInfo } from '../../utils/version';
import { isDebugEnabled, setDebugEnabled } from '../../utils/debugLog';
import { ReleaseNotes } from './ReleaseNotes'
import SettingsPanel from './SettingsPanel'
import { MidiOscSetup } from '../midi/MidiOscSetup'
import { DebugMenu } from '../debug/DebugMenu'
import { BridgeSettings } from './BridgeSettings'
import { FaderOrientationSwitch } from '../dmx/FaderOrientationSwitch'
import { HelpOverlay } from '../ui/HelpOverlay'
import { HorizontalFader } from '../ui/controls'
import { ThemePresetStrip } from './ThemePresetStrip'
import { useDebouncedAppearanceSave } from '../../hooks/useDebouncedAppearanceSave'
import { applyRackChrome, getPresetById } from '../../utils/themeUtils'
import styles from './UnifiedSettings.module.scss'

type SuperControlSettingsExport = SuperControlPreferences

interface AppSettings {
  theme: 'artsnob' | 'standard' | 'minimal'
  darkMode: boolean
  debugModules: {
    midi: boolean
    osc: boolean
    artnet: boolean
    button: boolean
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
  superControlPreferences: SuperControlSettingsExport;
  /** @deprecated Import key kept for older settings exports */
  chromaticEnergyManipulator?: SuperControlSettingsExport;
}

export const UnifiedSettings: React.FC = () => {
  const { theme, setTheme, darkMode, toggleDarkMode } = useTheme()
  const { socket, connected } = useSocket()
  const { settings: chromaticSettings, updateSettings: updateChromaticSettings } = useSuperControlPreferences()
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
    themeColors,
    updateThemeColors,
    saveAppearanceToServer,
    loadAppearanceFromServer,
    uiSettings,
    updateUiSettings,
    setDmxVisualEffects,
    addNotification,
    dmxFaderOrientation,
    setDmxFaderOrientation,
  } = useStore(state => ({
    artNetConfig: state.artNetConfig,
    fixtures: state.fixtures,
    masterSliders: state.masterSliders,
    midiMappings: state.midiMappings,
    navVisibility: state.navVisibility,
    debugTools: state.debugTools,
    themeColors: state.themeColors,
    updateThemeColors: state.updateThemeColors,
    saveAppearanceToServer: state.saveAppearanceToServer,
    loadAppearanceFromServer: state.loadAppearanceFromServer,
    uiSettings: state.uiSettings,
    updateUiSettings: state.updateUiSettings,
    setDmxVisualEffects: state.setDmxVisualEffects,
    addNotification: state.addNotification,
    dmxFaderOrientation: state.dmxFaderOrientation,
    setDmxFaderOrientation: state.setDmxFaderOrientation,
  }))

  // Settings state
  const [artNetSettings, setArtNetSettings] = useState({ ...artNetConfig })
  const [debugModules, setDebugModules] = useState({
    midi: false,
    osc: false,
    artnet: false,
    button: true
  });
  const [exportInProgress, setExportInProgress] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [localNavVisibility, setLocalNavVisibility] = useState(navVisibility);
  const [localDebugTools, setLocalDebugTools] = useState(debugTools);
  const [consoleDebugEnabled, setConsoleDebugEnabled] = useState(() => isDebugEnabled());
  const [activeSection, setActiveSection] = useState<string>('general');
  
  // Preview state for theme settings (not saved until user clicks Save)
  const [previewThemeColors, setPreviewThemeColors] = useState({
    ...themeColors,
    backgroundBrightness: themeColors.backgroundBrightness ?? 25,
    backgroundHue: themeColors.backgroundHue ?? 220,
    backgroundSaturation: themeColors.backgroundSaturation ?? 20,
    hueRotation: themeColors.hueRotation ?? 0,
    successHue: themeColors.successHue ?? 142,
    successSaturation: themeColors.successSaturation ?? 71,
    successBrightness: themeColors.successBrightness ?? 47,
    warningHue: themeColors.warningHue ?? 38,
    warningSaturation: themeColors.warningSaturation ?? 92,
    warningBrightness: themeColors.warningBrightness ?? 51,
    errorHue: themeColors.errorHue ?? 0,
    errorSaturation: themeColors.errorSaturation ?? 84,
    errorBrightness: themeColors.errorBrightness ?? 60,
    infoHue: themeColors.infoHue ?? 217,
    infoSaturation: themeColors.infoSaturation ?? 91,
    infoBrightness: themeColors.infoBrightness ?? 59,
    textPrimaryBrightness: themeColors.textPrimaryBrightness ?? 90,
    textSecondaryBrightness: themeColors.textSecondaryBrightness ?? 65,
    textTertiaryBrightness: themeColors.textTertiaryBrightness ?? 50,
    borderBrightness: themeColors.borderBrightness ?? 30,
    borderSaturation: themeColors.borderSaturation ?? 15,
    cardBrightness: themeColors.cardBrightness ?? 8,
    cardSaturation: themeColors.cardSaturation ?? 20,
    statusConnectedHue: themeColors.statusConnectedHue ?? 142,
    statusDisconnectedHue: themeColors.statusDisconnectedHue ?? 0,
    statusActiveHue: themeColors.statusActiveHue ?? 142,
    statusInactiveBrightness: themeColors.statusInactiveBrightness ?? 50
  });
  const [activeColorTab, setActiveColorTab] = useState<'primary' | 'semantic' | 'text' | 'surfaces' | 'status'>('primary');
  const [savedThemes, setSavedThemes] = useState<Array<{ name: string; colors: typeof previewThemeColors; uiSettings?: typeof previewUiSettings }>>([]);
  const [previewUiSettings, setPreviewUiSettings] = useState({
    ...uiSettings,
    fontFamily: uiSettings.fontFamily || 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyHeading: uiSettings.fontFamilyHeading || 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: uiSettings.fontWeight ?? 400,
    fontWeightHeading: uiSettings.fontWeightHeading ?? 600
  });
  const [serverSyncPending, setServerSyncPending] = useState(false);
  const { scheduleSave, flushSave } = useDebouncedAppearanceSave();
  const liveApplyReady = React.useRef(false);
  const skipStoreToPreviewRef = React.useRef(false);
  const scheduleSaveRef = useRef(scheduleSave);
  scheduleSaveRef.current = scheduleSave;

  // Keep local slider state aligned when appearance loads from server / other clients
  useEffect(() => {
    if (skipStoreToPreviewRef.current) {
      skipStoreToPreviewRef.current = false;
      return;
    }
    setPreviewThemeColors(themeColors);
    setPreviewUiSettings(uiSettings);
  }, [themeColors, uiSettings]);

  // Apply color + typography changes to the whole app immediately (store + CSS)
  useEffect(() => {
    if (!liveApplyReady.current) {
      liveApplyReady.current = true;
      return;
    }
    const current = useStore.getState().themeColors;
    if (JSON.stringify(current) === JSON.stringify(previewThemeColors)) {
      return;
    }
    skipStoreToPreviewRef.current = true;
    updateThemeColors(previewThemeColors);
    const presetId = localStorage.getItem('themePresetId');
    const preset = presetId ? getPresetById(presetId) : undefined;
    if (preset) applyRackChrome(preset.rack);
    setServerSyncPending(true);
    scheduleSaveRef.current({ themeColors: previewThemeColors });
  }, [previewThemeColors, updateThemeColors]);

  useEffect(() => {
    if (!liveApplyReady.current) return;
    const current = useStore.getState().uiSettings;
    if (JSON.stringify(current) === JSON.stringify(previewUiSettings)) {
      return;
    }
    skipStoreToPreviewRef.current = true;
    updateUiSettings(previewUiSettings);
    setServerSyncPending(true);
    scheduleSaveRef.current({ themeColors: previewThemeColors });
  }, [previewUiSettings, updateUiSettings, previewThemeColors]);

  useEffect(() => {
    if (!serverSyncPending) return;
    const t = setTimeout(() => setServerSyncPending(false), 700);
    return () => clearTimeout(t);
  }, [serverSyncPending, previewThemeColors, previewUiSettings]);

  const handleSaveTheme = () => {
    flushSave({ themeColors: previewThemeColors });
    setServerSyncPending(false);
    addNotification({
      message: 'Theme synced to server now',
      type: 'success',
      priority: 'normal',
    });
  };

  const handleResetTheme = () => {
    void loadAppearanceFromServer().then(() => {
      const state = useStore.getState();
      setPreviewThemeColors(state.themeColors);
      setPreviewUiSettings(state.uiSettings);
      setServerSyncPending(false);
      addNotification({
        message: 'Theme reloaded from server',
        type: 'info',
        priority: 'normal',
      });
    });
  };

  // Load saved custom themes from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('savedCustomThemes');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedThemes(parsed);
      }
    } catch (error) {
      console.warn('Failed to load saved custom themes:', error);
    }
  }, []);

  // Save current theme as custom theme
  const handleSaveCustomTheme = () => {
    const themeName = prompt('Enter a name for this theme:');
    if (!themeName) return;

    const newTheme = {
      name: themeName,
      colors: previewThemeColors,
      uiSettings: previewUiSettings
    };

    const updatedThemes = [...savedThemes, newTheme];
    setSavedThemes(updatedThemes);
    
    try {
      localStorage.setItem('savedCustomThemes', JSON.stringify(updatedThemes));
      addNotification({
        message: `Theme "${themeName}" saved successfully`,
        type: 'success',
        priority: 'normal'
      });
    } catch (error) {
      console.warn('Failed to save custom theme:', error);
      addNotification({
        message: 'Failed to save theme',
        type: 'error',
        priority: 'normal'
      });
    }
  };

  // Load a custom theme
  const handleLoadCustomTheme = (theme: { name: string; colors: typeof previewThemeColors; uiSettings?: typeof previewUiSettings }) => {
    setPreviewThemeColors(theme.colors);
    if (theme.uiSettings) {
      setPreviewUiSettings(theme.uiSettings);
    }
    setServerSyncPending(true);
    scheduleSave({ themeColors: theme.colors });
    addNotification({
      message: `Theme "${theme.name}" loaded`,
      type: 'info',
      priority: 'normal'
    });
  };

  // Delete a custom theme
  const handleDeleteCustomTheme = (index: number) => {
    const theme = savedThemes[index];
    if (!confirm(`Delete theme "${theme.name}"?`)) return;

    const updatedThemes = savedThemes.filter((_, i) => i !== index);
    setSavedThemes(updatedThemes);
    
    try {
      localStorage.setItem('savedCustomThemes', JSON.stringify(updatedThemes));
      addNotification({
        message: `Theme "${theme.name}" deleted`,
        type: 'info',
        priority: 'normal'
      });
    } catch (error) {
      console.warn('Failed to delete custom theme:', error);
      addNotification({
        message: 'Failed to delete theme',
        type: 'error',
        priority: 'normal'
      });
    }
  };


  // Network settings
  const [networkSettings, setNetworkSettings] = useState({
    dmxInterface: 'default',
    ipAddress: '192.168.1.100',
    subnetMask: '255.255.255.0',
    port: 6454,
    artnetEnabled: true,
  });
  const [allNetworkInterfaces, setAllNetworkInterfaces] = useState<Array<{ name: string; address: string; family: string; internal: boolean }>>([]);

  // Fetch all network interfaces on mount
  useEffect(() => {
    if (socket && connected) {
      socket.emit('getNetworkInfo');
      socket.on('networkInfo', (data: any) => {
        if (data.interfaces && Array.isArray(data.interfaces)) {
          setAllNetworkInterfaces(data.interfaces);
          // Set primary IP if available
          if (data.primaryHost && data.primaryHost !== 'localhost') {
            setNetworkSettings(prev => ({ ...prev, ipAddress: data.primaryHost }));
          }
        }
      });
      
      return () => {
        socket.off('networkInfo');
      };
    }
  }, [socket, connected]);

  // Performance settings
  const [performanceSettings, setPerformanceSettings] = useState({
    enableHardwareAcceleration: true,
    visualizerQuality: 'medium' as 'low' | 'medium' | 'high',
    loggingLevel: 'info' as 'none' | 'error' | 'warn' | 'info' | 'debug',
    showFps: false,
  });

  // Theme change handlers
  const handleThemeChange = (newTheme: 'artsnob' | 'standard' | 'minimal') => {
    setTheme(newTheme);
    scheduleSave({ theme: newTheme });
    addNotification({
      message: `Theme changed to ${newTheme}`,
      type: 'success',
    });
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
    scheduleSave({ darkMode: !darkMode });
    addNotification({
      message: darkMode ? 'Light mode enabled' : 'Dark mode enabled',
      type: 'success',
    });
  };

  // Factory reset handler
  const handleFactoryReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to factory defaults? This cannot be undone.')) {
      try {
        // Clear ALL localStorage keys explicitly
        const keysToRemove = [
          'artbastard-fixtures',
          'dmxChannelNames',
          'dmxChannelRanges',
          'dmxChannelColors',
          'pinnedChannels',
          'pinnedChannelsWidth',
          'superControlOscAddresses',
          'envelopeSpeedMidiMapping',
          'tempoPlayPauseMidiMapping',
          'tempoPlayPauseOscAddress',
          'tapTempoMidiMapping',
          'tapTempoOscAddress',
          'envelopeAutomation',
          'artbastard-auto-scene-settings',
          'fixtureTemplates',
          'theme',
          'darkMode',
          'uiSettings',
          'themeColors',
          'artbastard-default-config',
          'superControlLayouts',
          'midiMonitorDismissed',
          'oscMonitorDismissed',
          'fancyQuotesDismissed',
          'midiMonitorPositionX',
          'midiMonitorPositionY',
          'oscMonitorPositionX',
          'oscMonitorPositionY'
        ];
        
        // Remove all known keys
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Also clear everything else
        localStorage.clear();
        
        // Clear server-side data
        await fetch('/api/scenes', { method: 'DELETE' })
        
        // Reset ALL store state including channel names, colors, ranges, fixtures, etc.
        useStoreUtils.setState({
          artNetConfig: { ip: '192.168.1.199', subnet: 0, universe: 0, net: 0, port: 6454, base_refresh_interval: 1000 },
          fixtures: [],
          scenes: [],
          masterSliders: [],
          midiMappings: {},
          channelNames: new Array(512).fill('').map((_, i) => `CH ${i + 1}`),
          channelRanges: new Array(512).fill(null).map(() => ({ min: 0, max: 255 })),
          channelColors: new Array(512).fill(''),
          pinnedChannels: [],
          selectedChannels: [],
          oscAssignments: new Array(512).fill('').map((_, i) => `/1/fader${i + 1}`),
          superControlOscAddresses: {},
          theme: 'standard',
          darkMode: true,
          debugModules: { midi: false, osc: false, artnet: false, button: true },
          autoSceneTempo: 120,
          autoSceneEnabled: false,
          autoSceneTapTimes: [],
          autoSceneTempoSource: 'internal_clock',
          autoSceneIsFlashing: false,
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
          },
          envelopeSpeedMidiMapping: null,
          tempoPlayPauseMidiMapping: null,
          tempoPlayPauseOscAddress: '/tempo/playpause',
          tapTempoMidiMapping: null,
          tapTempoOscAddress: '/tempo/tap',
          envelopeAutomation: {
            enabled: false,
            envelopes: []
          },
          uiSettings: {
            sparklesEnabled: true,
            dmxVisualEffects: 'medium'
          },
          themeColors: {
            primaryHue: 220,
            primarySaturation: 70,
            primaryBrightness: 50,
            secondaryHue: 280,
            secondarySaturation: 60,
            secondaryBrightness: 45,
            accentHue: 340,
            accentSaturation: 80,
            accentBrightness: 60
          }
        })
        
        setDebugModules({ midi: false, osc: false, artnet: false, button: true });
        setLocalNavVisibility({
          main: true, midiOsc: true, fixture: true, scenes: true,
          misc: true
        });
        setLocalDebugTools({ debugButton: true, midiMonitor: true, oscMonitor: true });
        updateChromaticSettings({
          enableKeyboardShortcuts: true,
          autoSelectFirstFixture: true,
          showQuickActions: true,
          defaultColorPresets: ['red', 'green', 'blue', 'white'],
          enableErrorMessages: true,
          autoUpdateRate: 100,
          enableAnimations: true,
          compactMode: false
        });

        addNotification({
          message: 'Settings reset to factory defaults. Reloading...',
          type: 'success'
        });

        // Reload after a short delay to ensure everything is cleared
        setTimeout(() => {
          // Clear localStorage one more time before reload
          localStorage.clear();
          window.location.reload();
        }, 500);
      } catch (error) {
        console.error('Factory reset error:', error);
        addNotification({
          message: 'Error during factory reset',
          type: 'error'
        });
      }
    }
  }

  // Export settings
  const handleExportSettings = async () => {
    setExportInProgress(true);
    try {
      const allSettings: AppSettings = {
        theme,
        darkMode,
        debugModules,
        artNetConfig,
        midiMappings,
        fixtures,
        masterSliders,
        navVisibility: localNavVisibility,
        debugTools: localDebugTools,
        superControlPreferences: chromaticSettings,
        chromaticEnergyManipulator: chromaticSettings,
      };

      const blob = new Blob([JSON.stringify(allSettings, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artbastard-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      addNotification({
        message: 'Settings exported successfully',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'Failed to export settings',
        type: 'error'
      });
    } finally {
      setExportInProgress(false);
    }
  };

  // Import settings
  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportInProgress(true);
    try {
      const text = await file.text();
      const importedSettings: AppSettings = JSON.parse(text);

      if (importedSettings.theme) setTheme(importedSettings.theme);
      if (typeof importedSettings.darkMode === 'boolean') {
        if (importedSettings.darkMode !== darkMode) toggleDarkMode();
      }
      if (importedSettings.debugModules) setDebugModules(importedSettings.debugModules);
      if (importedSettings.navVisibility) setLocalNavVisibility(importedSettings.navVisibility);
      if (importedSettings.debugTools) setLocalDebugTools(importedSettings.debugTools);
      const importedSuperControl =
        importedSettings.superControlPreferences ?? importedSettings.chromaticEnergyManipulator;
      if (importedSuperControl) {
        updateChromaticSettings(importedSuperControl);
      }

      useStoreUtils.setState(state => ({
        ...state,
        artNetConfig: importedSettings.artNetConfig || state.artNetConfig,
        midiMappings: importedSettings.midiMappings || state.midiMappings,
        fixtures: importedSettings.fixtures || state.fixtures,
        masterSliders: importedSettings.masterSliders || state.masterSliders,
        navVisibility: importedSettings.navVisibility || state.navVisibility,
        debugTools: importedSettings.debugTools || state.debugTools
      }));

      addNotification({
        message: 'Settings imported successfully',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'Failed to import settings',
        type: 'error'
      });
    } finally {
      setImportInProgress(false);
      event.target.value = '';
    }
  };

  // Navigation visibility handler
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

  // Debug tools visibility handler
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

  const handleNetworkChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    if (type === 'checkbox') {
      const { checked } = event.target as HTMLInputElement;
      setNetworkSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setNetworkSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePerformanceChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    if (type === 'checkbox') {
      const { checked } = event.target as HTMLInputElement;
      setPerformanceSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setPerformanceSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const settingsSections = [
    { id: 'general', label: 'General', icon: 'fas fa-cogs' },
    { id: 'theme', label: 'Theme', icon: 'fas fa-palette' },
    { id: 'network', label: 'Network', icon: 'fas fa-network-wired' },
    { id: 'midiOsc', label: 'MIDI & OSC', icon: 'fas fa-sliders-h' },
    { id: 'performance', label: 'Performance', icon: 'fas fa-tachometer-alt' },
    { id: 'debug', label: 'Debug & Diagnostics', icon: 'fas fa-bug' },
    { id: 'help', label: 'Help & Documentation', icon: 'fas fa-question-circle' },
    { id: 'advanced', label: 'Advanced', icon: 'fas fa-tools' },
    { id: 'state', label: 'State Management', icon: 'fas fa-database' }
  ];

  const settingsOverviewCards = [
    {
      id: 'general',
      title: 'Operate',
      summary: `${theme} theme, ${darkMode ? 'dark' : 'light'} mode`,
      detail: `${dmxFaderOrientation} faders`,
      icon: 'fas fa-sliders-h',
    },
    {
      id: 'network',
      title: 'Output',
      summary: connected ? 'Socket connected' : 'Socket disconnected',
      detail: networkSettings.artnetEnabled ? `Art-Net ${networkSettings.port}` : 'Art-Net disabled',
      icon: 'fas fa-network-wired',
    },
    {
      id: 'midiOsc',
      title: 'Control I/O',
      summary: `${Object.keys(midiMappings).length} MIDI mappings`,
      detail: 'MIDI, OSC, browser MIDI',
      icon: 'fas fa-plug',
    },
    {
      id: 'theme',
      title: 'Look',
      summary: serverSyncPending ? 'Appearance syncing' : 'Appearance synced',
      detail: `${savedThemes.length} saved custom themes`,
      icon: 'fas fa-palette',
    },
    {
      id: 'state',
      title: 'Rig Data',
      summary: `${fixtures.length} fixtures`,
      detail: `${masterSliders.length} master sliders`,
      icon: 'fas fa-database',
    },
    {
      id: 'debug',
      title: 'Diagnostics',
      summary: consoleDebugEnabled ? 'Console debug enabled' : 'Console debug off',
      detail: getVersionDisplay(),
      icon: 'fas fa-stethoscope',
    },
  ];

  return (
    <div className={styles.unifiedSettings}>
      <div className={styles.panel}>
        {/* Panel Header */}
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
              title="Export all settings to file"
            >
              <i className="fas fa-download"></i>
              {exportInProgress ? 'Exporting...' : 'Export All'}
            </button>
            <label className={styles.actionButton} title="Import settings from file">
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                style={{ display: 'none' }}
                disabled={importInProgress}
              />
              <i className="fas fa-upload"></i>
              {importInProgress ? 'Importing...' : 'Import'}
            </label>
            <button 
              className={styles.dangerButton}
              onClick={handleFactoryReset}
              title="Reset all settings to factory defaults"
            >
              <i className="fas fa-undo"></i>
              Factory Reset
            </button>
          </div>
        </div>

        {/* Panel Content */}
        <div className={styles.panelContent}>
          {/* Navigation Tabs */}
          <div className={styles.tabNavigation}>
            {settingsSections.map(section => (
              <button
                key={section.id}
                className={`${styles.tabButton} ${activeSection === section.id ? styles.active : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <i className={section.icon}></i>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Settings Sections */}
          <div className={styles.settingsContent}>
            <div className={styles.settingsOverview} aria-label="Settings overview">
              {settingsOverviewCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`${styles.settingsOverviewCard} ${activeSection === card.id ? styles.activeOverviewCard : ''}`}
                  onClick={() => setActiveSection(card.id)}
                >
                  <i className={card.icon}></i>
                  <span>
                    <strong>{card.title}</strong>
                    <small>{card.summary}</small>
                    <em>{card.detail}</em>
                  </span>
                </button>
              ))}
            </div>

            {/* General Settings */}
            {activeSection === 'general' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-cogs"></i> General</h3>
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-info-circle"></i>
                    Version Information
                  </label>
                  <div className={styles.versionInfo}>
                    <span className={styles.versionNumber}>{getVersionDisplay()}</span>
                    <button 
                      className={styles.releaseNotesButton}
                      onClick={() => setShowReleaseNotes(true)}
                      title="View detailed release notes and version history"
                    >
                      <i className="fas fa-info-circle"></i>
                      Release Notes
                    </button>
                  </div>
                  <p className={styles.settingDescription}>
                    {getBuildInfo()}
                  </p>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-sliders-h"></i>
                    DMX channel faders
                  </label>
                  <FaderOrientationSwitch
                    value={dmxFaderOrientation}
                    onChange={setDmxFaderOrientation}
                  />
                  <p className={styles.settingDescription}>
                    Horizontal sliders are the default row layout. Vertical sliders use a channel-strip layout on the DMX Channels page (and pinned channels).
                  </p>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-server"></i>
                    Web Server Port
                  </label>
                  <p className={styles.settingDescription}>
                    The web server port is locked to <strong>3030</strong> and cannot be changed from the UI.
                  </p>
                  <p className={styles.settingDescription} style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '4px' }}>
                    To change the port, modify the code in:<br />
                    <strong>src/server.ts</strong> (line 552-553): <code>const basePort = basePortEnv ? parseInt(basePortEnv, 10) : 3030;</code><br />
                    <strong>src/index.ts</strong> (line 1652): <code>const serverPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3030;</code><br />
                    Or set the <code>PORT</code> environment variable before starting the server.
                  </p>
                </div>
              </div>
            )}

            {/* Theme Settings */}
            {activeSection === 'theme' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-palette"></i> Theme & Appearance</h3>
                
                
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-paint-brush"></i>
                    Theme Selection
                  </label>
                  <div className={styles.themeOptions}>
                    {[
                      { id: 'artsnob', name: 'Art Snob', description: 'Artistic and expressive' },
                      { id: 'standard', name: 'Standard', description: 'Professional and clean' }
                    ].map(themeOption => (
                      <div 
                        key={themeOption.id}
                        className={`${styles.themeOption} ${theme === themeOption.id ? styles.active : ''}`}
                        onClick={() => handleThemeChange(themeOption.id as any)}
                      >
                        <div className={styles.themePreview} data-theme={themeOption.id}>
                          <div className={styles.themePreviewHeader}></div>
                          <div className={styles.themePreviewBody}>
                            <div className={styles.themePreviewLine}></div>
                            <div className={styles.themePreviewLine}></div>
                          </div>
                        </div>
                        <div className={styles.themeInfo}>
                          <span className={styles.themeName}>{themeOption.name}</span>
                          <span className={styles.themeDescription}>{themeOption.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className={`fas ${darkMode ? 'fa-moon' : 'fa-sun'}`}></i>
                    Dark Mode
                  </label>
                  <div className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      id="darkMode"
                      checked={darkMode}
                      onChange={handleDarkModeToggle}
                    />
                    <label htmlFor="darkMode" className={styles.toggleLabel}>
                      <span className={styles.toggleSlider}></span>
                    </label>
                  </div>
                  <p className={styles.settingDescription}>
                    Toggle between light and dark interface themes
                  </p>
                </div>

                  {/* Customizable Color Themes */}
                <div className={styles.settingGroup}>
                  <div className={styles.settingHeader}>
                    <div>
                      <label className={styles.settingLabel}>
                        <i className="fas fa-palette"></i>
                        Custom Color Themes
                      </label>
                      <p className={styles.settingDescription}>
                        Customize colors and typography. Changes apply instantly across the app;
                        the server syncs automatically after you stop adjusting.
                      </p>
                    </div>
                    <div className={styles.themeActions}>
                      {serverSyncPending && (
                        <span className={styles.settingDescription}>Syncing to server...</span>
                      )}
                      <button
                        className={styles.saveButton}
                        onClick={handleSaveTheme}
                        title="Push theme to server immediately"
                      >
                        <i className="fas fa-cloud-upload-alt"></i>
                        Sync now
                      </button>
                      <button
                        className={styles.resetButton}
                        onClick={handleResetTheme}
                        title="Reload appearance from server"
                      >
                        <i className="fas fa-undo"></i>
                        Reload
                      </button>
                    </div>
                  </div>

                  {/* Color Category Tabs */}
                  <div className={styles.colorTabs}>
                    <button
                      className={activeColorTab === 'primary' ? styles.activeTab : ''}
                      onClick={() => setActiveColorTab('primary')}
                    >
                      Primary Colors
                    </button>
                    <button
                      className={activeColorTab === 'semantic' ? styles.activeTab : ''}
                      onClick={() => setActiveColorTab('semantic')}
                    >
                      Semantic Colors
                    </button>
                    <button
                      className={activeColorTab === 'text' ? styles.activeTab : ''}
                      onClick={() => setActiveColorTab('text')}
                    >
                      Text & Borders
                    </button>
                    <button
                      className={activeColorTab === 'surfaces' ? styles.activeTab : ''}
                      onClick={() => setActiveColorTab('surfaces')}
                    >
                      Surfaces & Cards
                    </button>
                    <button
                      className={activeColorTab === 'status' ? styles.activeTab : ''}
                      onClick={() => setActiveColorTab('status')}
                    >
                      Status Colors
                    </button>
                  </div>

                  {/* Primary Colors Tab */}
                  {activeColorTab === 'primary' && (
                    <>

                  {/* Live Preview Panel */}
                  <div className={styles.themePreviewPanel}>
                    <h4>Live Preview</h4>
                    <div className={styles.previewComponents}>
                      <div className={styles.previewCard}>
                        <div className={styles.previewHeader}>Sample Card</div>
                        <div className={styles.previewBody}>
                          <button className={styles.previewButton}>Primary Button</button>
                          <button className={styles.previewButtonSecondary}>Secondary Button</button>
                          <div className={styles.previewStatus}>
                            <span className={styles.previewStatusConnected}>● Connected</span>
                            <span className={styles.previewStatusDisconnected}>● Disconnected</span>
                          </div>
                          <div className={styles.previewText}>
                            <p style={{ color: 'var(--text-primary)' }}>Primary Text</p>
                            <p style={{ color: 'var(--text-secondary)' }}>Secondary Text</p>
                            <p style={{ color: 'var(--text-tertiary)' }}>Tertiary Text</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Color */}
                  <div className={styles.colorControlGroup}>
                    <h4>Primary Color</h4>
                    <div className={styles.colorPreview} style={{
                      backgroundColor: `hsl(${previewThemeColors.primaryHue}, ${previewThemeColors.primarySaturation}%, ${previewThemeColors.primaryBrightness}%)`
                    }}></div>
                    <div className={styles.colorSliderGroup}>
                      <label>
                        <span>Hue: {previewThemeColors.primaryHue}°</span>
                        <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.primaryHue}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, primaryHue: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Saturation: {previewThemeColors.primarySaturation}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.primarySaturation}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, primarySaturation: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Brightness: {previewThemeColors.primaryBrightness}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.primaryBrightness}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, primaryBrightness: Math.round(v) }))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div className={styles.colorControlGroup}>
                    <h4>Secondary Color</h4>
                    <div className={styles.colorPreview} style={{
                      backgroundColor: `hsl(${previewThemeColors.secondaryHue}, ${previewThemeColors.secondarySaturation}%, ${previewThemeColors.secondaryBrightness}%)`
                    }}></div>
                    <div className={styles.colorSliderGroup}>
                      <label>
                        <span>Hue: {previewThemeColors.secondaryHue}°</span>
                        <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.secondaryHue}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, secondaryHue: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Saturation: {previewThemeColors.secondarySaturation}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.secondarySaturation}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, secondarySaturation: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Brightness: {previewThemeColors.secondaryBrightness}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.secondaryBrightness}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, secondaryBrightness: Math.round(v) }))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className={styles.colorControlGroup}>
                    <h4>Accent Color</h4>
                    <div className={styles.colorPreview} style={{
                      backgroundColor: `hsl(${previewThemeColors.accentHue}, ${previewThemeColors.accentSaturation}%, ${previewThemeColors.accentBrightness}%)`
                    }}></div>
                    <div className={styles.colorSliderGroup}>
                      <label>
                        <span>Hue: {previewThemeColors.accentHue}°</span>
                        <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.accentHue}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, accentHue: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Saturation: {previewThemeColors.accentSaturation}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.accentSaturation}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, accentSaturation: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Brightness: {previewThemeColors.accentBrightness}%</span>
                        <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.accentBrightness}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, accentBrightness: Math.round(v) }))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Background Color Controls */}
                  <div className={styles.colorControlGroup}>
                    <h4>Background Color</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Control the overall darkness and color of the interface background
                    </p>
                    <div className={styles.colorPreview} style={{
                      backgroundColor: `hsl(${previewThemeColors.backgroundHue ?? 220}, ${previewThemeColors.backgroundSaturation ?? 20}%, ${previewThemeColors.backgroundBrightness ?? 25}%)`
                    }}></div>
                    <div className={styles.colorSliderGroup}>
                      <label>
                        <span>Background Brightness: {previewThemeColors.backgroundBrightness ?? 25}%</span>
                        <HorizontalFader
                          min={5}
                          max={50}
                          value={previewThemeColors.backgroundBrightness ?? 25}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, backgroundBrightness: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Background Hue: {previewThemeColors.backgroundHue ?? 220}°</span>
                        <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.backgroundHue ?? 220}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, backgroundHue: Math.round(v) }))}
                        />
                      </label>
                      <label>
                        <span>Background Saturation: {previewThemeColors.backgroundSaturation ?? 20}%</span>
                        <HorizontalFader
                          min={0}
                          max={50}
                          value={previewThemeColors.backgroundSaturation ?? 20}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, backgroundSaturation: Math.round(v) }))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Hue Rotation */}
                  <div className={styles.colorControlGroup}>
                    <h4>Hue Rotation</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Rotate all colors together to create different color schemes
                    </p>
                    <div className={styles.colorSliderGroup}>
                      <label>
                        <span>Rotation: {previewThemeColors.hueRotation ?? 0}°</span>
                        <HorizontalFader
                          min={-180}
                          max={180}
                          value={previewThemeColors.hueRotation ?? 0}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, hueRotation: Math.round(v) }))}
                        />
                      </label>
                    </div>
                  </div>

                  <ThemePresetStrip
                    onPreview={(colors) => {
                      setPreviewThemeColors(colors);
                    }}
                    onPreferDark={(prefer) => {
                      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                      if (prefer && !isDark) toggleDarkMode();
                      if (!prefer && isDark) toggleDarkMode();
                      scheduleSave({ darkMode: prefer });
                    }}
                  />

                  {/* Custom Saved Themes */}
                  {savedThemes.length > 0 && (
                    <div className={styles.colorControlGroup}>
                      <h4>Saved Custom Themes</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {savedThemes.map((theme, index) => (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                            <button
                              className={styles.toolButton}
                              onClick={() => handleLoadCustomTheme(theme)}
                              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                            >
                              {theme.name}
                            </button>
                            <button
                              className={styles.toolButton}
                              onClick={() => handleDeleteCustomTheme(index)}
                              style={{ fontSize: '0.85rem', padding: '0.4rem', background: 'var(--error-color)', color: 'white' }}
                              title="Delete theme"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        className={styles.toolButton}
                        onClick={handleSaveCustomTheme}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: 'var(--success-color)', color: 'white' }}
                      >
                        <i className="fas fa-save"></i> Save Current as Custom Theme
                      </button>
                    </div>
                  )}
                    </>
                  )}

                  {/* Semantic Colors Tab */}
                  {activeColorTab === 'semantic' && (
                    <>
                      {/* Success Color */}
                      <div className={styles.colorControlGroup}>
                        <h4>Success Color</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.successHue ?? 142}, ${previewThemeColors.successSaturation ?? 71}%, ${previewThemeColors.successBrightness ?? 47}%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.successHue ?? 142}°</span>
                            <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.successHue ?? 142}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, successHue: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Saturation: {previewThemeColors.successSaturation ?? 71}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.successSaturation ?? 71}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, successSaturation: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Brightness: {previewThemeColors.successBrightness ?? 47}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.successBrightness ?? 47}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, successBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>

                      {/* Warning Color */}
                      <div className={styles.colorControlGroup}>
                        <h4>Warning Color</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.warningHue ?? 38}, ${previewThemeColors.warningSaturation ?? 92}%, ${previewThemeColors.warningBrightness ?? 51}%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.warningHue ?? 38}°</span>
                            <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.warningHue ?? 38}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, warningHue: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Saturation: {previewThemeColors.warningSaturation ?? 92}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.warningSaturation ?? 92}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, warningSaturation: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Brightness: {previewThemeColors.warningBrightness ?? 51}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.warningBrightness ?? 51}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, warningBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>

                      {/* Error Color */}
                      <div className={styles.colorControlGroup}>
                        <h4>Error Color</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.errorHue ?? 0}, ${previewThemeColors.errorSaturation ?? 84}%, ${previewThemeColors.errorBrightness ?? 60}%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.errorHue ?? 0}°</span>
                            <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.errorHue ?? 0}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, errorHue: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Saturation: {previewThemeColors.errorSaturation ?? 84}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.errorSaturation ?? 84}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, errorSaturation: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Brightness: {previewThemeColors.errorBrightness ?? 60}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.errorBrightness ?? 60}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, errorBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>

                      {/* Info Color */}
                      <div className={styles.colorControlGroup}>
                        <h4>Info Color</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.infoHue ?? 217}, ${previewThemeColors.infoSaturation ?? 91}%, ${previewThemeColors.infoBrightness ?? 59}%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.infoHue ?? 217}°</span>
                            <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.infoHue ?? 217}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, infoHue: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Saturation: {previewThemeColors.infoSaturation ?? 91}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.infoSaturation ?? 91}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, infoSaturation: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Brightness: {previewThemeColors.infoBrightness ?? 59}%</span>
                            <HorizontalFader
                          min={0}
                          max={100}
                          value={previewThemeColors.infoBrightness ?? 59}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, infoBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Text & Borders Tab */}
                  {activeColorTab === 'text' && (
                    <>
                      {/* Text Colors */}
                      <div className={styles.colorControlGroup}>
                        <h4>Text Colors</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Control text brightness levels (hue follows background)
                        </p>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Primary Text Brightness: {previewThemeColors.textPrimaryBrightness ?? 90}%</span>
                            <HorizontalFader
                          min={70}
                          max={100}
                          value={previewThemeColors.textPrimaryBrightness ?? 90}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, textPrimaryBrightness: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Secondary Text Brightness: {previewThemeColors.textSecondaryBrightness ?? 65}%</span>
                            <HorizontalFader
                          min={40}
                          max={80}
                          value={previewThemeColors.textSecondaryBrightness ?? 65}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, textSecondaryBrightness: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Tertiary Text Brightness: {previewThemeColors.textTertiaryBrightness ?? 50}%</span>
                            <HorizontalFader
                          min={30}
                          max={70}
                          value={previewThemeColors.textTertiaryBrightness ?? 50}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, textTertiaryBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>

                      {/* Border Colors */}
                      <div className={styles.colorControlGroup}>
                        <h4>Border Colors</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Control border appearance (hue follows background)
                        </p>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Border Brightness: {previewThemeColors.borderBrightness ?? 30}%</span>
                            <HorizontalFader
                          min={10}
                          max={60}
                          value={previewThemeColors.borderBrightness ?? 30}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, borderBrightness: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Border Saturation: {previewThemeColors.borderSaturation ?? 15}%</span>
                            <HorizontalFader
                          min={0}
                          max={50}
                          value={previewThemeColors.borderSaturation ?? 15}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, borderSaturation: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Surfaces & Cards Tab */}
                  {activeColorTab === 'surfaces' && (
                    <>
                      {/* Card Colors */}
                      <div className={styles.colorControlGroup}>
                        <h4>Card/Surface Colors</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Control card and surface appearance (relative to background)
                        </p>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Card Brightness Offset: +{previewThemeColors.cardBrightness ?? 8}%</span>
                            <HorizontalFader
                          min={0}
                          max={20}
                          value={previewThemeColors.cardBrightness ?? 8}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, cardBrightness: Math.round(v) }))}
                        />
                          </label>
                          <label>
                            <span>Card Saturation: {previewThemeColors.cardSaturation ?? 20}%</span>
                            <HorizontalFader
                          min={0}
                          max={50}
                          value={previewThemeColors.cardSaturation ?? 20}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, cardSaturation: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Status Colors Tab */}
                  {activeColorTab === 'status' && (
                    <>
                      {/* Status Connected */}
                      <div className={styles.colorControlGroup}>
                        <h4>Status: Connected/Active</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.statusConnectedHue ?? 142}, 71%, 47%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.statusConnectedHue ?? 142}°</span>
                            <HorizontalFader
                              min={0}
                              max={360}
                              value={previewThemeColors.statusConnectedHue ?? 142}
                              onChange={(v) => {
                                const n = Math.round(v);
                                setPreviewThemeColors(prev => ({ ...prev, statusConnectedHue: n, statusActiveHue: n }));
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Status Disconnected */}
                      <div className={styles.colorControlGroup}>
                        <h4>Status: Disconnected</h4>
                        <div className={styles.colorPreview} style={{
                          backgroundColor: `hsl(${previewThemeColors.statusDisconnectedHue ?? 0}, 84%, 60%)`
                        }}></div>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Hue: {previewThemeColors.statusDisconnectedHue ?? 0}°</span>
                            <HorizontalFader
                          min={0}
                          max={360}
                          value={previewThemeColors.statusDisconnectedHue ?? 0}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, statusDisconnectedHue: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>

                      {/* Status Inactive */}
                      <div className={styles.colorControlGroup}>
                        <h4>Status: Inactive</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Control inactive status brightness
                        </p>
                        <div className={styles.colorSliderGroup}>
                          <label>
                            <span>Brightness: {previewThemeColors.statusInactiveBrightness ?? 50}%</span>
                            <HorizontalFader
                          min={20}
                          max={70}
                          value={previewThemeColors.statusInactiveBrightness ?? 50}
                          onChange={(v) => setPreviewThemeColors(prev => ({ ...prev, statusInactiveBrightness: Math.round(v) }))}
                        />
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Typography & Spacing */}
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-text-height"></i>
                    Typography & Spacing
                  </label>
                  <p className={styles.settingDescription}>
                    Customize font size, line height, letter spacing, and overall spacing.
                    Changes preview in real-time. Click Save to apply.
                  </p>

                  <div className={styles.colorSliderGroup}>
                    <label>
                      <span>Font Size: {((previewUiSettings?.fontSize || 1.0) * 100).toFixed(0)}%</span>
                      <HorizontalFader
                        min={0.75}
                        max={2.0}
                        step={0.05}
                        value={previewUiSettings?.fontSize || 1.0}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, fontSize: v }))}
                      />
                    </label>
                    <label>
                      <span>Line Height: {((previewUiSettings?.lineHeight || 1.5) * 100).toFixed(0)}%</span>
                      <HorizontalFader
                        min={1.0}
                        max={2.5}
                        step={0.1}
                        value={previewUiSettings?.lineHeight || 1.5}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, lineHeight: v }))}
                      />
                    </label>
                    <label>
                      <span>Letter Spacing: {previewUiSettings?.letterSpacing || 0}px</span>
                      <HorizontalFader
                        min={-2}
                        max={4}
                        step={0.5}
                        value={previewUiSettings?.letterSpacing || 0}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, letterSpacing: v }))}
                      />
                    </label>
                    <label>
                      <span>Border Radius: {previewUiSettings?.borderRadius || 8}px</span>
                      <HorizontalFader
                        min={0}
                        max={20}
                        step={1}
                        value={previewUiSettings?.borderRadius || 8}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, borderRadius: Math.round(v) }))}
                      />
                    </label>
                    <label>
                      <span>Spacing: {((previewUiSettings?.spacing || 1.0) * 100).toFixed(0)}%</span>
                      <HorizontalFader
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={previewUiSettings?.spacing || 1.0}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, spacing: v }))}
                      />
                    </label>
                    <label>
                      <span>Animation Speed: {((previewUiSettings?.animationSpeed || 1.0) * 100).toFixed(0)}%</span>
                      <HorizontalFader
                        min={0.25}
                        max={3.0}
                        step={0.25}
                        value={previewUiSettings?.animationSpeed || 1.0}
                        onChange={(v) => setPreviewUiSettings(prev => ({ ...prev, animationSpeed: v }))}
                      />
                    </label>
                  </div>
                </div>

                {/* DMX Visual Effects */}
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-sparkles"></i>
                    DMX Visual Effects
                  </label>
                  <select
                    value={uiSettings?.dmxVisualEffects || 'medium'}
                    onChange={(e) => setDmxVisualEffects(e.target.value as 'off' | 'low' | 'medium' | 'high')}
                    className={styles.settingSelect}
                  >
                    <option value="off">Off - No visual effects</option>
                    <option value="low">Low - Minimal GPU usage</option>
                    <option value="medium">Medium - Balanced</option>
                    <option value="high">High - Maximum visual effects</option>
                  </select>
                  <p className={styles.settingDescription}>
                    Control the intensity of visual effects when DMX messages are sent. Lower settings reduce GPU usage.
                  </p>
                </div>
              </div>
            )}

            {/* Network Settings */}
            {activeSection === 'network' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-network-wired"></i> Network & DMX</h3>
                
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-ethernet"></i>
                    Network Interfaces
                  </label>
                  <div className={styles.networkInterfacesList}>
                    <p className={styles.settingDescription}>
                      All detected network interfaces (read-only):
                    </p>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: 'var(--bg-secondary, #2c2c34)', 
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {allNetworkInterfaces.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allNetworkInterfaces.map((iface, index) => (
                            <div key={index} style={{ 
                              padding: '0.5rem',
                              background: iface.internal ? 'rgba(255, 193, 7, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                              borderRadius: '4px',
                              border: `1px solid ${iface.internal ? 'rgba(255, 193, 7, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`
                            }}>
                              <div style={{ fontWeight: 'bold' }}>{iface.name}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {iface.address} ({iface.family}) {iface.internal ? '(Internal)' : '(External)'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)' }}>No interfaces detected. Waiting for network info...</div>
                      )}
                    </div>
                    <p className={styles.settingDescription} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      All network interfaces are displayed. The system will automatically use the appropriate interface for Art-Net communication.
                      External interfaces (non-internal) are preferred for DMX communication.
                    </p>
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-door-open"></i>
                    Art-Net Port
                  </label>
                  <input
                    type="number"
                    name="port"
                    value={networkSettings.port}
                    onChange={handleNetworkChange}
                    disabled
                    min="1"
                    max="65535"
                    className={styles.settingInput}
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <p className={styles.settingDescription}>
                    Art-Net port is fixed at 6454 (standard Art-Net port). This cannot be changed as Art-Net always uses this port.
                  </p>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-info-circle"></i>
                    Art-Net Protocol
                  </label>
                  <p className={styles.settingDescription}>
                    Art-Net protocol is always enabled. This is the primary method for sending DMX data over network.
                  </p>
                </div>

                <h4 style={{ marginTop: '1.5rem' }}>LAN Bridge (Pi / home network)</h4>
                <BridgeSettings />
              </div>
            )}

            {/* MIDI & OSC Setup */}
            {activeSection === 'midiOsc' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-sliders-h"></i> MIDI & OSC Configuration</h3>
                <div className={styles.setupSection}>
                  <MidiOscSetup />
                </div>
              </div>
            )}

            {/* Debug & Diagnostics */}
            {activeSection === 'debug' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-bug"></i> Debug & Diagnostics</h3>
                <div className={styles.debugSection}>
                  <DebugMenu position="embedded" />
                </div>
              </div>
            )}

            {/* Help & Documentation */}
            {activeSection === 'help' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-question-circle"></i> Help & Documentation</h3>
                <div className={styles.helpSection}>
                  <HelpOverlay embedded={true} />
                </div>
              </div>
            )}

            {/* Performance Settings */}
            {activeSection === 'performance' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-tachometer-alt"></i> Performance & Debugging</h3>
                

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-eye"></i>
                    Visualizer Quality
                  </label>
                  <select
                    name="visualizerQuality"
                    value={performanceSettings.visualizerQuality}
                    onChange={handlePerformanceChange}
                    className={styles.settingSelect}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-file-alt"></i>
                    Logging Level
                  </label>
                  <select
                    name="loggingLevel"
                    value={performanceSettings.loggingLevel}
                    onChange={handlePerformanceChange}
                    className={styles.settingSelect}
                  >
                    <option value="none">None</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>

              </div>
            )}



            {/* Advanced Settings */}
            {activeSection === 'advanced' && (
              <div className={styles.settingsSection}>
                <h3><i className="fas fa-tools"></i> Advanced Settings</h3>
                
                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-lightbulb"></i>
                    Super Control
                  </label>
                  <p className={styles.settingDescription} style={{ marginBottom: '1rem' }}>
                    Super Control is the single fixture interface for color, pan/tilt, gobos, scenes, MIDI learn, and autopilot.
                    These preferences apply on desktop and touch surfaces.
                  </p>
                  <div className={styles.advancedToggles}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={chromaticSettings.enableKeyboardShortcuts}
                        onChange={(e) => updateChromaticSettings({
                          enableKeyboardShortcuts: e.target.checked
                        })}
                      />
                      <span className={styles.checkboxText}>Keyboard Shortcuts</span>
                      <span className={styles.settingDescription} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Enable keyboard shortcuts for quick fixture control (e.g., arrow keys, number keys)
                      </span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={chromaticSettings.autoSelectFirstFixture}
                        onChange={(e) => updateChromaticSettings({
                          autoSelectFirstFixture: e.target.checked
                        })}
                      />
                      <span className={styles.checkboxText}>Auto-select First Fixture</span>
                      <span className={styles.settingDescription} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Automatically select the first fixture when opening Super Control
                      </span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={chromaticSettings.showQuickActions}
                        onChange={(e) => updateChromaticSettings({
                          showQuickActions: e.target.checked
                        })}
                      />
                      <span className={styles.checkboxText}>Show Quick Actions</span>
                      <span className={styles.settingDescription} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Display quick action buttons for common color operations and presets
                      </span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={chromaticSettings.enableAnimations}
                        onChange={(e) => updateChromaticSettings({
                          enableAnimations: e.target.checked
                        })}
                      />
                      <span className={styles.checkboxText}>Enable Animations</span>
                      <span className={styles.settingDescription} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Enable smooth transitions and animations in Super Control
                      </span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={chromaticSettings.compactMode}
                        onChange={(e) => updateChromaticSettings({
                          compactMode: e.target.checked
                        })}
                      />
                      <span className={styles.checkboxText}>Compact Mode</span>
                      <span className={styles.settingDescription} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Use a more compact touch-friendly layout in Super Control (also enabled on phones and tablets). 
                        Useful for smaller screens or when you need to see more information at once.
                      </span>
                    </label>
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-terminal"></i>
                    Console debug logging
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={consoleDebugEnabled}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setDebugEnabled(on);
                        setConsoleDebugEnabled(on);
                        addNotification({
                          message: on
                            ? 'Verbose console logging enabled'
                            : 'Verbose console logging disabled',
                          type: 'info',
                          priority: 'normal',
                        });
                      }}
                    />
                    <span className={styles.checkboxText}>Verbose store and MIDI logs</span>
                  </label>
                  <p className={styles.settingDescription}>
                    Gates store and MIDI console output in production. Always on in dev builds.
                    Persists via localStorage key artbastard-debug.
                  </p>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-clock"></i>
                    Auto Update Rate (ms)
                  </label>
                  <input
                    type="number"
                    value={chromaticSettings.autoUpdateRate}
                    onChange={(e) => updateChromaticSettings({
                      autoUpdateRate: parseInt(e.target.value)
                    })}
                    min={50}
                    max={1000}
                    step={10}
                    className={styles.settingInput}
                  />
                  <p className={styles.settingDescription}>
                    Update frequency in milliseconds for Super Control. Lower values (50-100ms) provide 
                    more responsive updates but use more CPU. Higher values (500-1000ms) reduce CPU usage but may feel less responsive. 
                    Default: 50ms for smooth real-time control.
                  </p>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <i className="fas fa-exclamation-triangle"></i>
                    Danger Zone
                  </label>
                  <div className={styles.dangerZone}>
                    <button 
                      className={styles.dangerButton}
                      onClick={handleFactoryReset}
                    >
                      <i className="fas fa-exclamation-triangle"></i>
                      Factory Reset All Settings
                    </button>
                    <p className={styles.settingDescription}>
                      This will reset ALL settings to factory defaults and cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* State Management */}
            {activeSection === 'state' && (
              <div className={styles.settingsSection}>
                <SettingsPanel />
              </div>
            )}
          </div>
        </div>
      </div>

      <ReleaseNotes 
        showModal={showReleaseNotes}
        onClose={() => setShowReleaseNotes(false)}
      />
    </div>
  )
}

export default UnifiedSettings
