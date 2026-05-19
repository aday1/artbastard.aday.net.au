import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import { useRouter } from '../../context/RouterContext';
import { useSocket } from '../../context/SocketContext';
import styles from './PinnedChannels.module.scss';

export const PinnedChannels: React.FC = () => {
  const { theme } = useTheme();
  const {
    pinnedChannels,
    dmxChannels,
    channelNames,
    channelColors,
    setDmxChannel,
    unpinChannel,
    getChannelRange,
    envelopeAutomation,
    toggleEnvelope,
    quickSceneSave,
    quickSceneLoad,
    scenes,
    loadScene,
    deleteScene,
    quickSceneMidiMapping,
    setQuickSceneMidiMapping,
    startMidiLearn,
    cancelMidiLearn,
    midiLearnTarget,
    removeMidiMapping,
    setOscAssignment,
    oscAssignments,
    jumpToChannel,
    getChannelInfo,
    getFixtureColor,
    midiMappings,
    addMidiMapping,
    updateScene,
    setChannelName,
    // Tempo/BPM controls
    midiClockBpm,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    midiClockCurrentBar,
    autoSceneEnabled,
    autopilotTrackEnabled,
    autopilotTrackAutoPlay,
    autopilotTrackSpeed,
    colorSliderAutopilot,
    panTiltAutopilot,
    autoSceneTempoSource,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    setMidiClockBpm,
    setMidiClockIsPlaying,
    setAutoSceneTempoSource,
    setManualBpm,
    recordTapTempo,
    requestToggleMasterClockPlayPause,
    setAutopilotTrackSpeed,
    setColorSliderAutopilot,
    setPanTiltAutopilot,
    // Tempo Play/Pause MIDI/OSC
    tempoPlayPauseMidiMapping,
    tempoPlayPauseOscAddress,
    setTempoPlayPauseMidiMapping,
    setTempoPlayPauseOscAddress,
    // Tap Tempo MIDI/OSC
    tapTempoMidiMapping,
    tapTempoOscAddress,
    setTapTempoMidiMapping,
    setTapTempoOscAddress
  } = useStore();

  const { setCurrentView } = useRouter();
  const { socket, connected: socketConnected } = useSocket();

  const handleJumpToChannel = (index: number) => {
    // Navigate to DMX Channel Control page first
    setCurrentView('dmxControl');

    // Then trigger the jump
    jumpToChannel(index);
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(() => {
    // Load saved width from localStorage
    try {
      const saved = localStorage.getItem('pinnedChannelsWidth');
      if (saved) {
        return parseInt(saved, 10);
      }
    } catch (e) {
      console.error('Failed to load pinned channels width:', e);
    }
    return 280; // Default width
  });
  const [isResizing, setIsResizing] = useState(false);
  const [editingSceneName, setEditingSceneName] = useState<string | null>(null);
  const [editingSceneNewName, setEditingSceneNewName] = useState<string>('');
  const sceneNameInputRef = useRef<HTMLInputElement>(null);
  const [editingOscAddress, setEditingOscAddress] = useState<string | null>(null);
  const [editingOscValue, setEditingOscValue] = useState('');
  const [editingChannelName, setEditingChannelName] = useState<number | null>(null);
  const [editingChannelNameValue, setEditingChannelNameValue] = useState('');
  const [showQuickScenePanel, setShowQuickScenePanel] = useState(false);
  const [selectedQuickSceneName, setSelectedQuickSceneName] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInputValue, setBpmInputValue] = useState('');
  const [editingTempoOscAddress, setEditingTempoOscAddress] = useState(false);
  const [tempoOscAddressValue, setTempoOscAddressValue] = useState('');
  const [editingTapTempoOscAddress, setEditingTapTempoOscAddress] = useState(false);
  const [tapTempoOscAddressValue, setTapTempoOscAddressValue] = useState('');
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const diff = e.clientX - resizeStartRef.current.x;
      const newWidth = Math.max(200, Math.min(500, resizeStartRef.current.width + diff));
      setWidth(newWidth);
      // Save to localStorage
      try {
        localStorage.setItem('pinnedChannelsWidth', newWidth.toString());
      } catch (err) {
        console.error('Failed to save pinned channels width:', err);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Set initial CSS variable and update when width/collapse changes
  useEffect(() => {
    if (!pinnedChannels || pinnedChannels.length === 0) {
      document.documentElement.style.setProperty('--pinned-channels-width', '0px');
    } else {
      const currentWidth = isCollapsed ? 64 : width;
      document.documentElement.style.setProperty('--pinned-channels-width', `${currentWidth}px`);
    }
  }, [width, isCollapsed, pinnedChannels?.length]);

  // Auto-select the latest scene when scenes change
  useEffect(() => {
    if (scenes.length > 0 && !selectedQuickSceneName) {
      setSelectedQuickSceneName(scenes[scenes.length - 1].name);
    }
  }, [scenes, selectedQuickSceneName]);

  // Check if tempo is being used - show tempo controls if autopilot, auto color, or auto scene is enabled
  const isTempoInUse = autopilotTrackEnabled || autoSceneEnabled || (colorSliderAutopilot?.enabled) || (panTiltAutopilot?.enabled);

  // Current BPM value
  const currentBpm = autoSceneTempoSource === 'tap_tempo' ? autoSceneTapTempoBpm : autoSceneManualBpm;

  // Flash effect for tempo when playing
  useEffect(() => {
    if (midiClockIsPlaying && currentBpm > 0 && isTempoInUse) {
      const beatInterval = (60 / currentBpm) * 1000;
      const flashBeat = () => {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);
      };
      flashBeat();
      const intervalId = setInterval(flashBeat, beatInterval);
      return () => clearInterval(intervalId);
    } else {
      setIsFlashing(false);
    }
  }, [midiClockIsPlaying, currentBpm, isTempoInUse, midiClockCurrentBeat]);

  // Handle tap tempo
  const handleTapTempo = () => {
    recordTapTempo();
    setAutoSceneTempoSource('tap_tempo');
    const currentTime = Date.now();
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    if (lastTapTime > 0 && (currentTime - lastTapTime) < 2000) {
      setTapCount(prev => prev + 1);
    } else {
      setTapCount(1);
    }
    setLastTapTime(currentTime);
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
      setLastTapTime(0);
    }, 3000);
  };

  // Handle BPM change
  const handleBpmChange = (value: number) => {
    const newBpm = Math.max(60, Math.min(200, value));
    setManualBpm(newBpm);
    setAutoSceneTempoSource('manual_bpm');
    if (midiClockIsPlaying) {
      setMidiClockBpm(newBpm);
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (requestToggleMasterClockPlayPause) {
      requestToggleMasterClockPlayPause();
    } else {
      setMidiClockIsPlaying(!midiClockIsPlaying);
    }
  };

  // Handle MIDI learn for tempo play/pause
  const handleStartTempoMidiLearn = () => {
    startMidiLearn({ type: 'tempoPlayPause' });
  };

  const handleForgetTempoMidi = () => {
    setTempoPlayPauseMidiMapping(null);
  };

  // Handle OSC address editing for tempo play/pause
  const handleEditTempoOscAddress = () => {
    setTempoOscAddressValue(tempoPlayPauseOscAddress);
    setEditingTempoOscAddress(true);
  };

  const handleSaveTempoOscAddress = () => {
    setTempoPlayPauseOscAddress(tempoOscAddressValue.trim() || '/tempo/playpause');
    setEditingTempoOscAddress(false);
  };

  // Handle MIDI learn for tap tempo
  const handleStartTapTempoMidiLearn = () => {
    startMidiLearn({ type: 'tapTempo' });
  };

  const handleForgetTapTempoMidi = () => {
    setTapTempoMidiMapping(null);
  };

  // Handle OSC address editing for tap tempo
  const handleEditTapTempoOscAddress = () => {
    setTapTempoOscAddressValue(tapTempoOscAddress);
    setEditingTapTempoOscAddress(true);
  };

  const handleSaveTapTempoOscAddress = () => {
    setTapTempoOscAddress(tapTempoOscAddressValue.trim() || '/tempo/tap');
    setEditingTapTempoOscAddress(false);
  };

  // Listen for OSC messages for tempo play/pause and tap tempo
  useEffect(() => {
    if (!socket || !socketConnected) return;

    const handleTempoOsc = (data: { address: string; args: any[]; timestamp: number }) => {
      const { address } = data;
      
      // Check if this OSC address matches the configured tempo play/pause address
      if (address === tempoPlayPauseOscAddress || 
          address === '/tempo/playpause' || 
          address === '/tempo/toggle' ||
          (address === '/tempo/play' && !midiClockIsPlaying) ||
          (address === '/tempo/stop' && midiClockIsPlaying)) {
        console.log(`[PinnedChannels] OSC tempo play/pause received: ${address}`);
        // Call store functions directly to avoid closure issues
        if (requestToggleMasterClockPlayPause) {
          requestToggleMasterClockPlayPause();
        } else {
          setMidiClockIsPlaying(!midiClockIsPlaying);
        }
      }
      
      // Check if this OSC address matches the configured tap tempo address
      if (address === tapTempoOscAddress || address === '/tempo/tap') {
        console.log(`[PinnedChannels] OSC tap tempo received: ${address}`);
        recordTapTempo();
        setAutoSceneTempoSource('tap_tempo');
        // Also trigger the visual tap effect
        const currentTime = Date.now();
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }
        if (lastTapTime > 0 && (currentTime - lastTapTime) < 2000) {
          setTapCount(prev => prev + 1);
        } else {
          setTapCount(1);
        }
        setLastTapTime(currentTime);
        tapTimeoutRef.current = setTimeout(() => {
          setTapCount(0);
          setLastTapTime(0);
        }, 3000);
      }
    };

    socket.on('tempoOsc', handleTempoOsc);

    return () => {
      socket.off('tempoOsc', handleTempoOsc);
    };
  }, [socket, socketConnected, tempoPlayPauseOscAddress, tapTempoOscAddress, midiClockIsPlaying, requestToggleMasterClockPlayPause, setMidiClockIsPlaying, recordTapTempo, setAutoSceneTempoSource, lastTapTime]);

  // Helper functions for Quick Scene management
  const getSelectedQuickScene = () => {
    if (!selectedQuickSceneName) return scenes.length > 0 ? scenes[scenes.length - 1] : null;
    return scenes.find(s => s.name === selectedQuickSceneName) || null;
  };

  const handleDeleteQuickScene = () => {
    const selectedScene = getSelectedQuickScene();
    if (!selectedScene) return;

    if (window.confirm(`Are you sure you want to delete the scene "${selectedScene.name}"? This action cannot be undone.`)) {
      deleteScene(selectedScene.name);
      setSelectedQuickSceneName(null);
      setShowQuickScenePanel(false);
    }
  };

  const handleStartMidiLearnQuickScene = () => {
    startMidiLearn({ type: 'superControl', controlName: 'quickSceneLoad' });
  };

  const handleForgetMidiQuickScene = () => {
    setQuickSceneMidiMapping(null);
  };

  const handleEditOscAddress = () => {
    const selectedScene = getSelectedQuickScene();
    if (selectedScene) {
      setEditingOscAddress('quickScene');
      setEditingOscValue(selectedScene.oscAddress);
    }
  };

  const handleSaveOscAddress = () => {
    const selectedScene = getSelectedQuickScene();
    if (selectedScene && editingOscAddress === 'quickScene') {
      updateScene(selectedScene.name, { oscAddress: editingOscValue });
      setEditingOscAddress(null);
      setEditingOscValue('');
    }
  };

  if (!pinnedChannels || pinnedChannels.length === 0) {
    return null; // Don't show if no channels are pinned
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.pinnedChannelsContainer} ${isCollapsed ? styles.collapsed : ''}`}
      style={{ width: isCollapsed ? '64px' : `${width}px` }}
    >
      <div className={styles.pinnedContent}>
        <div className={styles.headerRow}>
          <button
            onClick={toggleCollapse}
            className={styles.collapseToggle}
            title={isCollapsed ? 'Expand Pinned Channels' : 'Collapse Pinned Channels'}
          >
            <LucideIcon name={isCollapsed ? 'ChevronRight' : 'ChevronLeft'} />
          </button>
        </div>

        {!isCollapsed && (
          <div className={styles.quickSceneControls}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                onClick={quickSceneSave}
                className={styles.quickSaveButton}
                title="Quick Save Scene (saves with timestamp)"
              >
                <LucideIcon name="Save" size={14} />
                <span>Quick Save{scenes.length > 0 ? ` (New Scene)` : ''}</span>
              </button>
              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                <button
                  onClick={() => {
                    const sceneToLoad = selectedQuickSceneName || scenes[scenes.length - 1]?.name;
                    if (sceneToLoad) {
                      loadScene(sceneToLoad);
                    } else if (scenes.length > 0) {
                      loadScene(scenes[scenes.length - 1].name);
                    }
                  }}
                  className={styles.quickLoadButton}
                  title="Load selected scene"
                  disabled={scenes.length === 0}
                  style={{ flex: 1 }}
                >
                  <LucideIcon name="RotateCcw" size={14} />
                  <span>Quick Load</span>
                </button>
                {scenes.length > 0 && (
                  <select
                    value={selectedQuickSceneName || scenes[scenes.length - 1]?.name || ''}
                    onChange={(e) => {
                      const selectedScene = scenes.find(s => s.name === e.target.value);
                      if (selectedScene) {
                        setSelectedQuickSceneName(selectedScene.name);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.quickLoadSelect}
                    title="Select scene to load"
                  >
                    {scenes.slice().reverse().map((scene) => (
                      <option key={scene.name} value={scene.name}>
                        {scene.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Quick Scene Panel with advanced controls */}
            {scenes.length > 0 && (
              <div style={{
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: '4px',
                padding: '8px',
                marginTop: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)'
              }}>
                {/* Scene Selector Dropdown with inline rename */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Select Scene:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      value={selectedQuickSceneName || getSelectedQuickScene()?.name || ''}
                      onChange={(e) => {
                        const selectedScene = scenes.find(s => s.name === e.target.value);
                        if (selectedScene) {
                          setSelectedQuickSceneName(selectedScene.name);
                          // Don't auto-load - just select for MIDI/OSC setup
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        backgroundColor: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {scenes.slice().reverse().map((scene) => (
                        <option key={scene.name} value={scene.name}>
                          {scene.name}
                        </option>
                      ))}
                    </select>
                    {/* Inline rename for selected scene */}
                    <button
                      onClick={() => {
                        const selectedScene = scenes.find(s => s.name === (selectedQuickSceneName || getSelectedQuickScene()?.name));
                        if (selectedScene) {
                          const newName = window.prompt('Rename scene', selectedScene.name)?.trim();
                          if (newName && newName !== selectedScene.name) {
                            const nameExists = scenes.some(s => s.name === newName);
                            if (nameExists) {
                              alert(`Scene "${newName}" already exists. Please choose a different name.`);
                            } else {
                              updateScene(selectedScene.name, { name: newName });
                              setSelectedQuickSceneName(newName);
                            }
                          }
                        }
                      }}
                      disabled={!selectedQuickSceneName && !getSelectedQuickScene()?.name}
                      title="Rename selected scene"
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'rgba(30, 64, 175, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.6)',
                        borderRadius: '4px',
                        color: '#93c5fd',
                        cursor: selectedQuickSceneName || getSelectedQuickScene()?.name ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <LucideIcon name="Edit" size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const sceneToLoad = selectedQuickSceneName || getSelectedQuickScene()?.name;
                        if (sceneToLoad) {
                          loadScene(sceneToLoad);
                        }
                      }}
                      disabled={!selectedQuickSceneName && !getSelectedQuickScene()?.name}
                      title="Load/Launch selected scene"
                      style={{
                        padding: '6px 10px',
                        backgroundColor: selectedQuickSceneName || getSelectedQuickScene()?.name 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : 'rgba(71, 85, 105, 0.3)',
                        border: `1px solid ${selectedQuickSceneName || getSelectedQuickScene()?.name 
                          ? 'rgba(16, 185, 129, 0.4)' 
                          : 'rgba(71, 85, 105, 0.5)'}`,
                        borderRadius: '4px',
                        color: selectedQuickSceneName || getSelectedQuickScene()?.name 
                          ? '#10b981' 
                          : '#64748b',
                        cursor: selectedQuickSceneName || getSelectedQuickScene()?.name 
                          ? 'pointer' 
                          : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedQuickSceneName || getSelectedQuickScene()?.name) {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedQuickSceneName || getSelectedQuickScene()?.name) {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                        }
                      }}
                    >
                      <LucideIcon name="Play" size={14} />
                    </button>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={handleDeleteQuickScene}
                  title={`Delete scene "${getSelectedQuickScene()?.name}"`}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    marginBottom: '6px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <LucideIcon name="Trash2" size={12} />
                  Delete
                </button>

                {/* MIDI Learn/Forget Buttons */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  <button
                    onClick={handleStartMidiLearnQuickScene}
                    title="Learn MIDI control for quick scene load"
                    className={`${styles.midiLearnButton} ${midiLearnTarget?.type === 'superControl' && midiLearnTarget.controlName === 'quickSceneLoad' ? styles.flashing : ''}`}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: quickSceneMidiMapping ? '#8b5cf6' : undefined,
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      border: 'none'
                    }}
                  >
                    <LucideIcon name="Zap" size={12} />
                    {quickSceneMidiMapping ? `MIDI: ${quickSceneMidiMapping.controller ?? quickSceneMidiMapping.note}` : 'MIDI Learn'}
                  </button>

                  {quickSceneMidiMapping && (
                    <button
                      onClick={handleForgetMidiQuickScene}
                      title="Forget MIDI mapping"
                      className={styles.forgetMidiButton}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <LucideIcon name="X" size={12} />
                    </button>
                  )}
                </div>


                {/* OSC Address Field */}
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', marginBottom: '4px' }}>OSC:</div>
                {editingOscAddress === 'quickScene' ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      value={editingOscValue}
                      onChange={(e) => setEditingOscValue(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #475569',
                        borderRadius: '3px',
                        fontSize: '11px'
                      }}
                      placeholder="/scene/quickscene"
                    />
                    <button
                      onClick={handleSaveOscAddress}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleEditOscAddress}
                    title="Edit OSC address"
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: '#334155',
                      color: '#cbd5e1',
                      border: '1px solid #475569',
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {getSelectedQuickScene()?.oscAddress || '/scene/quickscene'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

          {/* Tempo Controls - Always show when autopilot, auto color, or auto scene is enabled */}
          {!isCollapsed && (autopilotTrackEnabled || autoSceneEnabled || colorSliderAutopilot?.enabled || panTiltAutopilot?.enabled) && (
            <div className={styles.tempoControls} style={{
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '4px',
              padding: '8px',
              marginTop: '8px',
              marginBottom: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <LucideIcon name="Music" size={14} />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Tempo</span>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'flex-end'
                }}>
                  {/* Clock Indicator */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: midiClockIsPlaying ? '#10b981' : '#64748b',
                    fontWeight: '600',
                    padding: '2px 6px',
                    backgroundColor: midiClockIsPlaying ? 'rgba(16, 185, 129, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                    borderRadius: '4px',
                    border: `1px solid ${midiClockIsPlaying ? 'rgba(16, 185, 129, 0.3)' : 'rgba(71, 85, 105, 0.3)'}`
                  }}>
                    <LucideIcon name="Radio" size={10} />
                    <span>{midiClockCurrentBar || 1}.{midiClockCurrentBeat || 1}</span>
                  </div>
                  {/* BPM Counter */}
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: isFlashing ? '#10b981' : '#e2e8f0',
                    transition: 'color 0.15s ease',
                    minWidth: '40px',
                    textAlign: 'right'
                  }}>
                    {Math.round(currentBpm || midiClockBpm || 120)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>BPM</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={handlePlayPause}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: midiClockIsPlaying ? '#10b981' : '#475569',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                    title={midiClockIsPlaying ? 'Stop tempo' : 'Start tempo'}
                  >
                    <LucideIcon name={midiClockIsPlaying ? "Pause" : "Play"} size={12} />
                    {midiClockIsPlaying ? 'Stop' : 'Play'}
                  </button>
                
                <button
                  onClick={handleTapTempo}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    backgroundColor: tapCount > 0 ? '#8b5cf6' : '#475569',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  title="Tap tempo"
                >
                    <LucideIcon name="Hand" size={12} />
                  Tap {tapCount > 0 ? `(${tapCount})` : ''}
                </button>
                </div>

                {/* MIDI/OSC Learn Controls for Tempo Play/Pause */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {/* MIDI Learn Button */}
                  <button
                    onClick={handleStartTempoMidiLearn}
                    className={`${styles.midiLearnButton} ${midiLearnTarget?.type === 'tempoPlayPause' ? styles.flashing : ''}`}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: tempoPlayPauseMidiMapping ? '#8b5cf6' : undefined,
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    title={tempoPlayPauseMidiMapping 
                      ? `MIDI: ${tempoPlayPauseMidiMapping.controller !== undefined ? `CC${tempoPlayPauseMidiMapping.controller}` : `Note${tempoPlayPauseMidiMapping.note}`} on CH${tempoPlayPauseMidiMapping.channel + 1}` 
                      : 'Learn MIDI for tempo play/pause'}
                  >
                    <LucideIcon name={midiLearnTarget?.type === 'tempoPlayPause' ? "Radio" : "Music"} size={10} />
                    {tempoPlayPauseMidiMapping 
                      ? `${tempoPlayPauseMidiMapping.controller !== undefined ? `CC${tempoPlayPauseMidiMapping.controller}` : `N${tempoPlayPauseMidiMapping.note}`}` 
                      : 'MIDI'}
                  </button>

                  {/* MIDI Forget Button */}
                  {tempoPlayPauseMidiMapping && (
                    <button
                      onClick={handleForgetTempoMidi}
                      style={{
                        padding: '4px 6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Forget MIDI mapping"
                    >
                      <LucideIcon name="X" size={10} />
                    </button>
                  )}

                  {/* OSC Address Display/Edit */}
                  {editingTempoOscAddress ? (
                    <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                      <input
                        type="text"
                        value={tempoOscAddressValue}
                        onChange={(e) => setTempoOscAddressValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveTempoOscAddress();
                          } else if (e.key === 'Escape') {
                            setEditingTempoOscAddress(false);
                          }
                        }}
                        onBlur={handleSaveTempoOscAddress}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                          border: '1px solid #475569',
                          borderRadius: '3px',
                          fontSize: '10px'
                        }}
                        placeholder="/tempo/playpause"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTempoOscAddress}
                        style={{
                          padding: '4px 6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                        title="Save OSC address"
                      >
                        <LucideIcon name="Check" size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleEditTempoOscAddress}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#334155',
                        color: '#cbd5e1',
                        border: '1px solid #475569',
                        borderRadius: '3px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`OSC: ${tempoPlayPauseOscAddress} - Click to edit`}
                    >
                      <LucideIcon name="Globe" size={10} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tempoPlayPauseOscAddress}
                      </span>
                    </button>
                  )}
                </div>

                {/* MIDI/OSC Learn Controls for Tap Tempo */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {/* MIDI Learn Button */}
                  <button
                    onClick={handleStartTapTempoMidiLearn}
                    className={`${styles.midiLearnButton} ${midiLearnTarget?.type === 'tapTempo' ? styles.flashing : ''}`}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: tapTempoMidiMapping ? '#8b5cf6' : undefined,
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    title={tapTempoMidiMapping 
                      ? `MIDI: ${tapTempoMidiMapping.controller !== undefined ? `CC${tapTempoMidiMapping.controller}` : `Note${tapTempoMidiMapping.note}`} on CH${tapTempoMidiMapping.channel + 1}` 
                      : 'Learn MIDI for tap tempo'}
                  >
                    <LucideIcon name={midiLearnTarget?.type === 'tapTempo' ? "Radio" : "Music"} size={10} />
                    {tapTempoMidiMapping 
                      ? `${tapTempoMidiMapping.controller !== undefined ? `CC${tapTempoMidiMapping.controller}` : `N${tapTempoMidiMapping.note}`}` 
                      : 'MIDI'}
                  </button>

                  {/* MIDI Forget Button */}
                  {tapTempoMidiMapping && (
                    <button
                      onClick={handleForgetTapTempoMidi}
                      style={{
                        padding: '4px 6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Forget MIDI mapping"
                    >
                      <LucideIcon name="X" size={10} />
                    </button>
                  )}

                  {/* OSC Address Display/Edit */}
                  {editingTapTempoOscAddress ? (
                    <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                      <input
                        type="text"
                        value={tapTempoOscAddressValue}
                        onChange={(e) => setTapTempoOscAddressValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveTapTempoOscAddress();
                          } else if (e.key === 'Escape') {
                            setEditingTapTempoOscAddress(false);
                          }
                        }}
                        onBlur={handleSaveTapTempoOscAddress}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                          border: '1px solid #475569',
                          borderRadius: '3px',
                          fontSize: '10px'
                        }}
                        placeholder="/tempo/tap"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTapTempoOscAddress}
                        style={{
                          padding: '4px 6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                        title="Save OSC address"
                      >
                        <LucideIcon name="Check" size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleEditTapTempoOscAddress}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#334155',
                        color: '#cbd5e1',
                        border: '1px solid #475569',
                        borderRadius: '3px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`OSC: ${tapTempoOscAddress} - Click to edit`}
                    >
                      <LucideIcon name="Globe" size={10} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tapTempoOscAddress}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {editingBpm ? (
                  <>
                    <input
                      type="number"
                      min="60"
                      max="200"
                      value={bpmInputValue}
                      onChange={(e) => setBpmInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = parseInt(bpmInputValue);
                          if (!isNaN(value) && value >= 60 && value <= 200) {
                            handleBpmChange(value);
                            setEditingBpm(false);
                          }
                        } else if (e.key === 'Escape') {
                          setEditingBpm(false);
                          setBpmInputValue('');
                        }
                      }}
                      onBlur={() => {
                        const value = parseInt(bpmInputValue);
                        if (!isNaN(value) && value >= 60 && value <= 200) {
                          handleBpmChange(value);
                        }
                        setEditingBpm(false);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}
                    />
                    <button
                      onClick={() => {
                        const value = parseInt(bpmInputValue);
                        if (!isNaN(value) && value >= 60 && value <= 200) {
                          handleBpmChange(value);
                        }
                        setEditingBpm(false);
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      <LucideIcon name="Check" size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setBpmInputValue(Math.round(currentBpm || midiClockBpm || 120).toString());
                      setEditingBpm(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(71, 85, 105, 0.3)',
                      color: '#94a3b8',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    title="Click to set BPM manually"
                  >
                    Set BPM: {Math.round(currentBpm || midiClockBpm || 120)}
                  </button>
                )}
              </div>

              {/* Autopilot Speed Control */}
              {autopilotTrackEnabled && autopilotTrackAutoPlay && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <LucideIcon name="Navigation" size={12} />
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8' }}>Autopilot Speed</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>
                      {autopilotTrackSpeed.toFixed(0)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={autopilotTrackSpeed}
                    onChange={(e) => setAutopilotTrackSpeed(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      height: '4px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${autopilotTrackSpeed}%, #475569 ${autopilotTrackSpeed}%, #475569 100%)`,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                    title={`Autopilot Speed: ${autopilotTrackSpeed}x`}
                  />
                </div>
              )}

              {/* Auto Color Speed Control */}
              {colorSliderAutopilot?.enabled && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <LucideIcon name="Palette" size={12} />
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8' }}>Auto Color Speed</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>
                      {colorSliderAutopilot.speed.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={colorSliderAutopilot.speed}
                    onChange={(e) => setColorSliderAutopilot({ speed: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      height: '4px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(colorSliderAutopilot.speed / 1.0) * 100}%, #475569 ${(colorSliderAutopilot.speed / 1.0) * 100}%, #475569 100%)`,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                    title={`Auto Color Speed: ${colorSliderAutopilot.speed.toFixed(1)}x`}
                  />
                </div>
              )}

              {/* Auto Color and Pan/Tilt Autopilot Toggles */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Auto Color Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <LucideIcon name="Palette" size={14} />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>Auto Color</span>
                    </div>
                    <button
                      onClick={() => setColorSliderAutopilot({ enabled: !colorSliderAutopilot?.enabled })}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: colorSliderAutopilot?.enabled ? '#10b981' : '#475569',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '50px'
                      }}
                      title={colorSliderAutopilot?.enabled ? 'Disable auto color' : 'Enable auto color'}
                    >
                      {colorSliderAutopilot?.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Pan/Tilt Autopilot Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <LucideIcon name="Navigation" size={14} />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>Pan/Tilt Autopilot</span>
                    </div>
                    <button
                      onClick={() => setPanTiltAutopilot({ enabled: !panTiltAutopilot?.enabled })}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: panTiltAutopilot?.enabled ? '#10b981' : '#475569',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '50px'
                      }}
                      title={panTiltAutopilot?.enabled ? 'Disable pan/tilt autopilot' : 'Enable pan/tilt autopilot'}
                    >
                      {panTiltAutopilot?.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {!isCollapsed && (
          <>
            <div className={styles.header}>
              <h3 className={styles.title}>
                <LucideIcon name="Pin" />
                Pinned Channels
              </h3>
              <span className={styles.count}>{pinnedChannels?.length || 0}</span>
            </div>

            <div className={styles.channelsList}>
              {(pinnedChannels || []).map(channelIndex => {
                const value = dmxChannels[channelIndex] || 0;
                const channelName = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
                const hasCustomName = channelName &&
                  channelName !== `CH ${channelIndex + 1}` &&
                  channelName !== `Channel ${channelIndex + 1}` &&
                  channelName.trim() !== '';
                const channelColor = channelColors[channelIndex] || '';
                const range = getChannelRange(channelIndex);

                // Get fixture info
                const channelInfo = getChannelInfo(channelIndex);
                const fixtureColor = channelInfo ? getFixtureColor(channelInfo.fixtureId) : '';

                // Check if this channel has an envelope
                const channelEnvelope = envelopeAutomation.envelopes.find(e => e.channel === channelIndex);
                const hasEnvelope = !!channelEnvelope;
                const envelopeEnabled = channelEnvelope?.enabled ?? false;
                const envelopeRunning = envelopeEnabled && envelopeAutomation.globalEnabled;
                const envelopeInfo = hasEnvelope
                  ? `${channelEnvelope?.waveform || 'Env'} @ ${channelEnvelope?.speed?.toFixed?.(2) ?? channelEnvelope?.speed}`
                  : null;

                return (
                  <div
                    key={channelIndex}
                    className={styles.pinnedChannel}
                    style={{
                      borderLeft: channelColor 
                        ? `6px solid ${channelColor}` 
                        : (fixtureColor ? `4px solid ${fixtureColor}` : `4px solid #475569`),
                      borderWidth: channelColor ? '4px' : undefined,
                      borderColor: channelColor || undefined,
                      backgroundColor: channelColor 
                        ? `${channelColor}20` 
                        : (fixtureColor ? `${fixtureColor}10` : undefined),
                      backgroundImage: channelColor
                        ? `linear-gradient(135deg, ${channelColor}25 0%, ${channelColor}10 100%)`
                        : (fixtureColor
                          ? `linear-gradient(135deg, ${fixtureColor}15 0%, ${fixtureColor}08 100%)`
                          : undefined),
                    }}
                  >
                    <div className={styles.channelHeader}>
                      <div className={styles.channelInfo}>
                        <div className={styles.topRow}>
                          <span className={styles.channelNumber}>CH {channelIndex + 1}</span>
                          {channelInfo && (
                            <span className={styles.fixtureName} title={channelInfo.fixtureName}>
                              {channelInfo.fixtureName}
                            </span>
                          )}
                        </div>
                        <div className={styles.bottomRow}>
                          {editingChannelName === channelIndex ? (
                            <input
                              type="text"
                              value={editingChannelNameValue}
                              onChange={(e) => setEditingChannelNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingChannelNameValue.trim()) {
                                    setChannelName(channelIndex, editingChannelNameValue.trim());
                                  }
                                  setEditingChannelName(null);
                                  setEditingChannelNameValue('');
                                } else if (e.key === 'Escape') {
                                  setEditingChannelName(null);
                                  setEditingChannelNameValue('');
                                }
                              }}
                              onBlur={() => {
                                if (editingChannelNameValue.trim()) {
                                  setChannelName(channelIndex, editingChannelNameValue.trim());
                                }
                                setEditingChannelName(null);
                                setEditingChannelNameValue('');
                              }}
                              className={styles.channelNameInput}
                              autoFocus
                            />
                          ) : (
                            <span 
                              className={styles.channelName} 
                              title={hasCustomName ? channelName : (channelInfo?.channelName || channelName)}
                              onClick={() => {
                                setEditingChannelName(channelIndex);
                                setEditingChannelNameValue(channelName);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {hasCustomName
                                ? (channelName.length > 20 ? `${channelName.substring(0, 18)}...` : channelName)
                                : (channelInfo ? channelInfo.channelName : channelName)
                              }
                            </span>
                          )}
                          {hasEnvelope && (
                            <span
                              className={`${styles.envelopeBadge} ${envelopeRunning ? styles.envelopeRunning : ''}`}
                              title={envelopeInfo || 'Envelope automation configured for this channel'}
                            >
                              <LucideIcon name={envelopeRunning ? 'Play' : 'Activity'} size={10} />
                              <span>{channelEnvelope?.waveform || 'Env'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.channelActions}>
                        <button
                          className={styles.jumpButton}
                          onClick={() => handleJumpToChannel(channelIndex)}
                          title="Jump to channel in grid"
                        >
                          <LucideIcon name="ExternalLink" size={14} />
                        </button>
                        {hasEnvelope && (
                          <button
                            className={`${styles.envelopeButton} ${envelopeEnabled ? styles.active : ''}`}
                            onClick={() => channelEnvelope && toggleEnvelope(channelEnvelope.id)}
                            title={envelopeEnabled ? 'Stop Envelope' : 'Start Envelope'}
                            disabled={!envelopeAutomation.globalEnabled}
                          >
                            <LucideIcon name={envelopeEnabled ? "Square" : "Play"} size={12} />
                          </button>
                        )}
                        <button
                          className={styles.unpinButton}
                          onClick={() => unpinChannel(channelIndex)}
                          title="Unpin channel"
                        >
                          <LucideIcon name="X" size={14} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.valueDisplay}>
                      <span className={styles.value}>{value}</span>
                      <span className={styles.percent}>{Math.round((value / 255) * 100)}%</span>
                    </div>

                    <div className={styles.sliderContainer}>
                      <input
                        type="range"
                        min={range.min}
                        max={range.max}
                        value={value}
                        onChange={(e) => setDmxChannel(channelIndex, parseInt(e.target.value))}
                        className={styles.slider}
                        style={{
                          background: channelColor || fixtureColor
                            ? `linear-gradient(to right, ${channelColor || fixtureColor} 0%, ${channelColor || fixtureColor} ${(value / range.max) * 100}%, rgba(71, 85, 105, 0.3) ${(value / range.max) * 100}%, rgba(71, 85, 105, 0.3) 100%)`
                            : undefined
                        }}
                      />
                    </div>

                    <div className={styles.midiControls}>
                      {midiMappings[channelIndex] ? (
                        <div className={styles.midiInfo}>
                          <span className={styles.midiBadge}>
                            <LucideIcon name="Zap" size={10} />
                            MIDI: {midiMappings[channelIndex].controller !== undefined
                              ? `CC ${midiMappings[channelIndex].controller}`
                              : `Note ${midiMappings[channelIndex].note}`}
                          </span>
                          <button
                            className={styles.forgetMidiButton}
                            onClick={() => removeMidiMapping(channelIndex)}
                            title="Forget MIDI mapping"
                          >
                            <LucideIcon name="X" size={10} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`${styles.learnMidiButton} ${midiLearnTarget?.type === 'dmxChannel' && midiLearnTarget.channelIndex === channelIndex ? styles.flashing : ''}`}
                          onClick={() => startMidiLearn({ type: 'dmxChannel', channelIndex })}
                        >
                          <LucideIcon name="Music" size={10} />
                          MIDI Learn
                        </button>
                      )}
                    </div>
                    
                    {/* OSC Address Display and Edit */}
                    <div className={styles.oscControls}>
                      {editingOscAddress === `channel_${channelIndex}` ? (
                        <div className={styles.oscEditRow}>
                          <input
                            type="text"
                            value={editingOscValue}
                            onChange={(e) => setEditingOscValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setOscAssignment(channelIndex, editingOscValue.trim());
                                setEditingOscAddress(null);
                                setEditingOscValue('');
                              } else if (e.key === 'Escape') {
                                setEditingOscAddress(null);
                                setEditingOscValue('');
                              }
                            }}
                            onBlur={() => {
                              setOscAssignment(channelIndex, editingOscValue.trim());
                              setEditingOscAddress(null);
                              setEditingOscValue('');
                            }}
                            className={styles.oscInput}
                            placeholder="/dmx/channel/12"
                            autoFocus
                          />
                          <button
                            className={styles.oscSaveButton}
                            onClick={() => {
                              setOscAssignment(channelIndex, editingOscValue.trim());
                              setEditingOscAddress(null);
                              setEditingOscValue('');
                            }}
                            title="Save OSC address"
                          >
                            <LucideIcon name="Check" size={12} />
                          </button>
                          <button
                            className={styles.oscCancelButton}
                            onClick={() => {
                              setEditingOscAddress(null);
                              setEditingOscValue('');
                            }}
                            title="Cancel editing"
                          >
                            <LucideIcon name="X" size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.oscDisplayButton}
                          onClick={() => {
                            setEditingOscAddress(`channel_${channelIndex}`);
                            setEditingOscValue(oscAssignments[channelIndex] || `/dmx/channel/${channelIndex + 1}`);
                          }}
                          title={`OSC: ${oscAssignments[channelIndex] || `/dmx/channel/${channelIndex + 1}`} - Click to edit`}
                        >
                          <LucideIcon name="Globe" size={10} />
                          <span className={styles.oscAddressText}>
                            {oscAssignments[channelIndex] || `/dmx/channel/${channelIndex + 1}`}
                          </span>
                          <LucideIcon name="Edit" size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Saved Scenes List */}
            {scenes.length > 0 && (
              <div className={styles.scenesSection}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <LucideIcon name="Theater" size={14} />
                    Saved Scenes
                  </h4>
                  <span className={styles.sceneCount}>{scenes.length}</span>
                </div>
                <div className={styles.scenesList}>
                  {scenes.slice().reverse().map((scene, index) => (
                    <div
                      key={`${scene.name}-${index}`}
                      className={styles.sceneItemWrapper}
                    >
                      {editingSceneName === scene.name ? (
                        <div className={styles.sceneItemEditing}>
                          <input
                            ref={sceneNameInputRef}
                            type="text"
                            value={editingSceneNewName}
                            onChange={(e) => setEditingSceneNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const newName = editingSceneNewName.trim();
                                if (newName && newName !== scene.name) {
                                  // Check if name already exists
                                  const nameExists = scenes.some(s => s.name === newName);
                                  if (!nameExists) {
                                    updateScene(scene.name, { name: newName });
                                    setEditingSceneName(null);
                                    setEditingSceneNewName('');
                                  } else {
                                    alert(`Scene "${newName}" already exists. Please choose a different name.`);
                                  }
                                } else {
                                  setEditingSceneName(null);
                                  setEditingSceneNewName('');
                                }
                              } else if (e.key === 'Escape') {
                                setEditingSceneName(null);
                                setEditingSceneNewName('');
                              }
                            }}
                            onBlur={() => {
                              const newName = editingSceneNewName.trim();
                              if (newName && newName !== scene.name) {
                                const nameExists = scenes.some(s => s.name === newName);
                                if (!nameExists) {
                                  updateScene(scene.name, { name: newName });
                                }
                              }
                              setEditingSceneName(null);
                              setEditingSceneNewName('');
                            }}
                            className={styles.sceneNameInput}
                            autoFocus
                          />
                          <button
                            className={styles.sceneEditButton}
                            onClick={() => {
                              const newName = editingSceneNewName.trim();
                              if (newName && newName !== scene.name) {
                                const nameExists = scenes.some(s => s.name === newName);
                                if (!nameExists) {
                                  updateScene(scene.name, { name: newName });
                                } else {
                                  alert(`Scene "${newName}" already exists. Please choose a different name.`);
                                }
                              }
                              setEditingSceneName(null);
                              setEditingSceneNewName('');
                            }}
                            title="Save"
                          >
                            <LucideIcon name="Check" size={12} />
                          </button>
                          <button
                            className={styles.sceneEditButton}
                            onClick={() => {
                              setEditingSceneName(null);
                              setEditingSceneNewName('');
                            }}
                            title="Cancel"
                          >
                            <LucideIcon name="X" size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.sceneItem}
                          onClick={(e) => {
                            // Don't load if clicking on rename button
                            if ((e.target as HTMLElement).closest(`.${styles.sceneRenameButton}`)) {
                              return;
                            }
                            loadScene(scene.name);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingSceneName(scene.name);
                            setEditingSceneNewName(scene.name);
                            // Focus input after state update
                            setTimeout(() => {
                              sceneNameInputRef.current?.focus();
                              sceneNameInputRef.current?.select();
                            }, 0);
                          }}
                          title={`Load scene: ${scene.name} (Double-click to rename)`}
                        >
                          <LucideIcon name="Play" size={12} />
                          <span className={styles.sceneName}>{scene.name}</span>
                          <button
                            className={styles.sceneRenameButton}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingSceneName(scene.name);
                              setEditingSceneNewName(scene.name);
                              setTimeout(() => {
                                sceneNameInputRef.current?.focus();
                                sceneNameInputRef.current?.select();
                              }, 0);
                            }}
                            title="Rename scene"
                          >
                            <LucideIcon name="Pencil" size={10} />
                          </button>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {!isCollapsed && (
        <div
          ref={resizeHandleRef}
          className={styles.resizeHandle}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeStartRef.current = { x: e.clientX, width };
            setIsResizing(true);
          }}
          title="Drag to resize"
        >
          <LucideIcon name="GripVertical" size={16} />
        </div>
      )}
    </div>
  );
};


