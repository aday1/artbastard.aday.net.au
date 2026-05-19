import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { TouchDmxChannel } from './TouchDmxChannel';
import { TouchPanelManager } from '../touch/TouchPanelManager';

// Add CSS for better scrolling
const scrollbarStyles = `
  .touch-dmx-grid::-webkit-scrollbar {
    width: 6px;
  }
  .touch-dmx-grid::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .touch-dmx-grid::-webkit-scrollbar-thumb {
    background: rgba(78, 205, 196, 0.5);
    border-radius: 3px;
  }
  .touch-dmx-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(78, 205, 196, 0.7);
  }
`;

// Inject styles if not already injected
if (typeof document !== 'undefined' && !document.getElementById('touch-dmx-scrollbar-styles')) {
  const style = document.createElement('style');
  style.id = 'touch-dmx-scrollbar-styles';
  style.textContent = scrollbarStyles;
  document.head.appendChild(style);
}

// Channel filtering and page sizing options
interface ChannelFilter {
  name: string;
  startChannel: number;
  endChannel: number;
  isSelectedOnly?: boolean;
  isActiveFixtures?: boolean;
  groupId?: string;
}

interface PageSize {
  label: string;
  value: number;
}

const CHANNEL_FILTERS: ChannelFilter[] = [
  { name: "Selected Channels Only", startChannel: 1, endChannel: 512, isSelectedOnly: true },
  { name: "Active Fixtures Only", startChannel: 1, endChannel: 512, isActiveFixtures: true },
  { name: "All Channels", startChannel: 1, endChannel: 512 },
  { name: "Channels 1-16", startChannel: 1, endChannel: 16 },
  { name: "Channels 17-32", startChannel: 17, endChannel: 32 },
  { name: "Channels 33-64", startChannel: 33, endChannel: 64 },
  { name: "Channels 65-128", startChannel: 65, endChannel: 128 },
  { name: "Channels 129-256", startChannel: 129, endChannel: 256 },
  { name: "Channels 257-512", startChannel: 257, endChannel: 512 }
];

const PAGE_SIZES: PageSize[] = [
  { label: "1 channel per page", value: 1 },
  { label: "4 channels per page", value: 4 },
  { label: "8 channels per page", value: 8 },
  { label: "16 channels per page", value: 16 },
  { label: "32 channels per page", value: 32 },
  { label: "64 channels per page", value: 64 },
  { label: "128 channels per page", value: 128 },
  { label: "256 channels per page", value: 256 }
];

export const TouchDmxControlPanel: React.FC<{ touchOptimized?: boolean }> = ({ touchOptimized = false }) => {
  const [selectedFilter, setSelectedFilter] = useState(0); // Index into CHANNEL_FILTERS
  const [channelsPerPage, setChannelsPerPage] = useState(4); // Default 4 channels per page for touch
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showPanelManager, setShowPanelManager] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Scene management state
  const [showSceneControls, setShowSceneControls] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [selectedSceneToLoad, setSelectedSceneToLoad] = useState('');
  const [showAutoSceneControls, setShowAutoSceneControls] = useState(false);
  const {
    dmxChannels,
    selectedChannels,
    toggleChannelSelection,
    setDmxChannel,
    // Fixtures and groups for filtering
    fixtures,
    groups,
    // Scene management methods
    scenes,
    saveScene,
    loadScene,
    deleteScene,
    transitionDuration,
    setTransitionDuration,
    // Auto-scene methods
    autoSceneEnabled,
    autoSceneList,
    autoSceneMode,
    autoSceneTempoSource,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    autoSceneBeatDivision,
    setAutoSceneEnabled,
    setAutoSceneList,
    setAutoSceneMode,
    setAutoSceneTempoSource,
    setAutoSceneBeatDivision,
    setManualBpm,
    recordTapTempo,
    requestToggleMasterClockPlayPause,
    midiClockIsPlaying,
    // Notifications
    addNotification,
  } = useStore((state) => ({
    dmxChannels: state.dmxChannels,
    selectedChannels: state.selectedChannels,
    toggleChannelSelection: state.toggleChannelSelection,
    setDmxChannel: state.setDmxChannel,
    // Fixtures and groups
    fixtures: state.fixtures,
    groups: state.groups,
    // Scene management
    scenes: state.scenes,
    saveScene: state.saveScene,
    loadScene: state.loadScene,
    deleteScene: state.deleteScene,
    transitionDuration: state.transitionDuration,
    setTransitionDuration: state.setTransitionDuration,
    // Auto-scene
    autoSceneEnabled: state.autoSceneEnabled,
    autoSceneList: state.autoSceneList,
    autoSceneMode: state.autoSceneMode,
    autoSceneTempoSource: state.autoSceneTempoSource,
    autoSceneManualBpm: state.autoSceneManualBpm,
    autoSceneTapTempoBpm: state.autoSceneTapTempoBpm,
    autoSceneBeatDivision: state.autoSceneBeatDivision,
    setAutoSceneEnabled: state.setAutoSceneEnabled,
    setAutoSceneList: state.setAutoSceneList,
    setAutoSceneMode: state.setAutoSceneMode,
    setAutoSceneTempoSource: state.setAutoSceneTempoSource,
    setAutoSceneBeatDivision: state.setAutoSceneBeatDivision,
    setManualBpm: state.setManualBpm,
    recordTapTempo: state.recordTapTempo,
    requestToggleMasterClockPlayPause: state.requestToggleMasterClockPlayPause,
    midiClockIsPlaying: state.midiClockIsPlaying,    addNotification: state.addNotification,
  }));

  // Helper function to get active fixture channels (fixtures with non-zero DMX values)
  const getActiveFixtureChannels = (): number[] => {
    const activeChannels: number[] = [];
    
    fixtures.forEach(fixture => {
      let hasActiveChannel = false;
      
      // Check if any channels in this fixture have non-zero values
      fixture.channels.forEach((channel, index) => {
        const dmxAddress = fixture.startAddress + index - 1; // 0-based
        if (dmxAddress >= 0 && dmxAddress < 512 && dmxChannels[dmxAddress] > 0) {
          hasActiveChannel = true;
        }
      });
      
      // If fixture has any active channels, add all its channels to the list
      if (hasActiveChannel) {
        fixture.channels.forEach((channel, index) => {
          const dmxAddress = fixture.startAddress + index - 1; // 0-based
          if (dmxAddress >= 0 && dmxAddress < 512) {
            activeChannels.push(dmxAddress);
          }
        });
      }
    });
    
    return [...new Set(activeChannels)].sort((a, b) => a - b); // Remove duplicates and sort
  };

  // Helper function to get channels for a specific group
  const getGroupChannels = (groupId: string): number[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    
    const groupChannels: number[] = [];
    
    group.fixtureIndices.forEach(fixtureIndex => {
      const fixture = fixtures[fixtureIndex];
      if (fixture) {
        fixture.channels.forEach((channel, channelIndex) => {
          const dmxAddress = fixture.startAddress + channelIndex - 1; // 0-based
          if (dmxAddress >= 0 && dmxAddress < 512) {
            groupChannels.push(dmxAddress);
          }
        });
      }
    });
    
    return [...new Set(groupChannels)].sort((a, b) => a - b); // Remove duplicates and sort
  };

  // Create dynamic filters that include groups
  const getDynamicChannelFilters = (): ChannelFilter[] => {
    const baseFilters = [...CHANNEL_FILTERS];
    
    // Add group filters if groups exist
    if (groups && groups.length > 0) {
      const groupFilters: ChannelFilter[] = groups.map(group => ({
        name: `Group: ${group.name}`,
        startChannel: 1,
        endChannel: 512,
        groupId: group.id
      }));
      
      // Insert group filters after "Active Fixtures Only" but before "All Channels"
      baseFilters.splice(2, 0, ...groupFilters);
    }
    
    return baseFilters;
  };

  const dynamicChannelFilters = getDynamicChannelFilters();// Get current filter and calculate displayed channels
  const currentFilter = dynamicChannelFilters[selectedFilter];
  let totalChannelsInFilter, displayedChannels, totalPages;
  
  if (currentFilter.isSelectedOnly) {
    // Use selected channels only
    const sortedSelectedChannels = [...selectedChannels].sort((a, b) => a - b);
    totalChannelsInFilter = sortedSelectedChannels.length;
    totalPages = Math.ceil(totalChannelsInFilter / channelsPerPage);
    
    // Calculate pagination for selected channels
    const pageStartIdx = currentPage * channelsPerPage;
    const pageEndIdx = Math.min(pageStartIdx + channelsPerPage, totalChannelsInFilter);
    
    displayedChannels = sortedSelectedChannels.slice(pageStartIdx, pageEndIdx);
  } else if (currentFilter.isActiveFixtures) {
    // Use active fixture channels only
    const activeFixtureChannels = getActiveFixtureChannels();
    totalChannelsInFilter = activeFixtureChannels.length;
    totalPages = Math.ceil(totalChannelsInFilter / channelsPerPage);
    
    // Calculate pagination for active fixture channels
    const pageStartIdx = currentPage * channelsPerPage;
    const pageEndIdx = Math.min(pageStartIdx + channelsPerPage, totalChannelsInFilter);
    
    displayedChannels = activeFixtureChannels.slice(pageStartIdx, pageEndIdx);
  } else if (currentFilter.groupId) {
    // Use specific group channels
    const groupChannels = getGroupChannels(currentFilter.groupId);
    totalChannelsInFilter = groupChannels.length;
    totalPages = Math.ceil(totalChannelsInFilter / channelsPerPage);
    
    // Calculate pagination for group channels
    const pageStartIdx = currentPage * channelsPerPage;
    const pageEndIdx = Math.min(pageStartIdx + channelsPerPage, totalChannelsInFilter);
    
    displayedChannels = groupChannels.slice(pageStartIdx, pageEndIdx);
  } else {
    // Use channel range filter
    const startIdx = currentFilter.startChannel - 1; // Convert to 0-based
    const endIdx = currentFilter.endChannel - 1;
    totalChannelsInFilter = endIdx - startIdx + 1;
    totalPages = Math.ceil(totalChannelsInFilter / channelsPerPage);
    
    // Calculate pagination
    const pageStartIdx = startIdx + (currentPage * channelsPerPage);
    const pageEndIdx = Math.min(pageStartIdx + channelsPerPage - 1, endIdx);
    
    // Get channels for current page
    displayedChannels = Array.from(
      { length: pageEndIdx - pageStartIdx + 1 }, 
      (_, i) => pageStartIdx + i
    );
  }

  // Reset current page when filter or page size changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedFilter, channelsPerPage]);

  // Fullscreen change listener to keep local state in sync
  useEffect(() => {
    const handleFsChange = () => {
      const currentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(currentlyFullscreen);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange as any);
    document.addEventListener('mozfullscreenchange', handleFsChange as any);
    document.addEventListener('MSFullscreenChange', handleFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange as any);
      document.removeEventListener('mozfullscreenchange', handleFsChange as any);
      document.removeEventListener('MSFullscreenChange', handleFsChange as any);
    };
  }, []);

  const toggleFullscreen = async () => {
    const node = containerRef.current as any;
    if (!node) {
      console.warn('TouchDmxControlPanel: No container ref for fullscreen');
      return;
    }
    
    try {
      if (!document.fullscreenElement) {
        // Try to enter fullscreen
        if (node.requestFullscreen) {
          await node.requestFullscreen();
        } else if (node.webkitRequestFullscreen) {
          await node.webkitRequestFullscreen();
        } else if (node.mozRequestFullScreen) {
          await node.mozRequestFullScreen();
        } else if (node.msRequestFullscreen) {
          await node.msRequestFullscreen();
        } else {
          console.warn('TouchDmxControlPanel: Fullscreen API not supported');
          addNotification({
            message: 'Fullscreen not supported in this browser',
            type: 'warning',
            priority: 'normal'
          });
        }
      } else {
        // Try to exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('TouchDmxControlPanel: Fullscreen error:', error);
      addNotification({
        message: `Fullscreen failed: ${error.message}`,
        type: 'error',
        priority: 'normal'
      });
    }
  };
  // Calculate active channels
  const activeChannels = dmxChannels.filter(val => val > 0).length;

  // Scene management functions
  const handleQuickSave = () => {
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const quickName = `Touch_${timestamp}`;
    saveScene(quickName, `/scene/${quickName.toLowerCase()}`);
    addNotification({
      message: `Quick saved as "${quickName}"`,
      type: 'success',
      priority: 'normal'
    });
  };

  const handleSaveScene = () => {
    if (!newSceneName.trim()) {
      addNotification({
        message: 'Scene name cannot be empty',
        type: 'error',
        priority: 'high'
      });
      return;
    }

    // Check for duplicate names
    if (scenes.some(s => s.name === newSceneName)) {
      if (!window.confirm(`Scene "${newSceneName}" already exists. Overwrite?`)) {
        return;
      }
    }

    saveScene(newSceneName, `/scene/${newSceneName.toLowerCase()}`);
    setNewSceneName('');
    addNotification({
      message: `Scene "${newSceneName}" saved`,
      type: 'success',
      priority: 'normal'
    });
  };

  const handleLoadScene = () => {
    if (!selectedSceneToLoad) {
      addNotification({
        message: 'Please select a scene to load',
        type: 'error',
        priority: 'high'
      });
      return;
    }

    loadScene(selectedSceneToLoad);
    addNotification({
      message: `Loading scene "${selectedSceneToLoad}"`,
      type: 'info',
      priority: 'normal'
    });
  };

  const handleDeleteScene = (sceneName: string) => {
    if (window.confirm(`Delete scene "${sceneName}"?`)) {
      deleteScene(sceneName);
      if (selectedSceneToLoad === sceneName) {
        setSelectedSceneToLoad('');
      }
      addNotification({
        message: `Scene "${sceneName}" deleted`,
        type: 'success',
        priority: 'normal'
      });
    }
  };

  const handleAutoSceneToggle = () => {
    setAutoSceneEnabled(!autoSceneEnabled);
    if (!autoSceneEnabled && autoSceneTempoSource === 'internal_clock') {
      requestToggleMasterClockPlayPause();
    }
  };

  const toggleSceneInAutoList = (sceneName: string) => {
    const isInList = autoSceneList.includes(sceneName);
    const newList = isInList 
      ? autoSceneList.filter(name => name !== sceneName)
      : [...autoSceneList, sceneName];
    
    setAutoSceneList(newList);
    addNotification({
      message: `Scene "${sceneName}" ${isInList ? 'removed from' : 'added to'} auto-play list`,
      type: 'success',
      priority: 'normal'
    });
  };

  const handleValueChange = (index: number, value: number) => {
    setDmxChannel(index, value);
  };

  const handleToggleSelection = (index: number) => {
    toggleChannelSelection(index);
  };

  const handlePageChange = (direction: 'prev' | 'next' | 'first' | 'last') => {
    switch (direction) {
      case 'prev':
        setCurrentPage(prev => Math.max(0, prev - 1));
        break;
      case 'next':
        setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
        break;
      case 'first':
        setCurrentPage(0);
        break;
      case 'last':
        setCurrentPage(totalPages - 1);
        break;
    }
  };

  if (!touchOptimized) {
    // Return standard DMX control panel for non-touch interfaces
    return (
      <div style={{ padding: '1rem' }}>
        <p>Standard DMX Control Panel - Switch to touch mode for better mobile experience</p>
      </div>
    );  }
  return (
    <div ref={containerRef} style={{
      width: '100%',
      height: isFullscreen ? '100dvh' : '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      touchAction: 'manipulation',
      position: 'relative'
    }}>
      {/* Touch Panel Manager */}
      <TouchPanelManager 
        isVisible={showPanelManager}
        onToggle={() => setShowPanelManager(!showPanelManager)}
      />

      {/* Touch-Optimized Header - Non-blocking */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.9)',
        padding: '0.4rem 0.8rem',
        borderBottom: '1px solid rgba(78, 205, 196, 0.3)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
        // Prevent header from blocking touch events to grid
        pointerEvents: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.4rem'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#4ecdc4',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            🎛️ DMX Touch
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              style={{
                background: isFullscreen ? 'rgba(255, 99, 71, 0.3)' : 'rgba(78, 205, 196, 0.3)',
                border: `1px solid ${isFullscreen ? 'rgba(255, 99, 71, 0.6)' : 'rgba(78, 205, 196, 0.6)'}`,
                color: '#ffffff',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {isFullscreen ? '🗗' : '🗖'}
            </button>
            <div style={{
              background: 'rgba(78, 205, 196, 0.2)',
              padding: '0.2rem 0.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(78, 205, 196, 0.4)',
              fontSize: '0.7rem',
              color: '#4ecdc4'
            }}>
              {activeChannels} Active
            </div>
          </div>
        </div>

        {/* Controls Toggle - Non-blocking */}<button
          onClick={() => setShowControls(!showControls)}
          style={{
            background: showControls ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(78, 205, 196, 0.5)',
            color: '#ffffff',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.7rem',
            fontWeight: '500',
            touchAction: 'manipulation',
            transition: 'all 0.2s ease',
            marginBottom: showControls ? '0.4rem' : '0'
          }}
        >
          {showControls ? '▼ Hide' : '▶ Show'}
        </button>

        {/* Filter and Page Size Controls - Compact */}        {showControls && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.4rem',
            marginBottom: '0.4rem'
          }}>
            {/* Channel Filter Dropdown */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.2rem',
                fontSize: '0.7rem',
                color: '#cccccc'
              }}>
                Range:
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.3rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(78, 205, 196, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  touchAction: 'manipulation',
                  cursor: 'pointer'
                }}
              >
                {dynamicChannelFilters.map((filter, index) => (
                  <option key={index} value={index} style={{ background: '#2d2d2d', color: '#ffffff' }}>
                    {filter.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Size Dropdown */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.2rem',
                fontSize: '0.7rem',
                color: '#cccccc'
              }}>
                Per Page:
              </label>
              <select
                value={channelsPerPage}
                onChange={(e) => setChannelsPerPage(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.3rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(78, 205, 196, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  touchAction: 'manipulation',
                  cursor: 'pointer'
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size.value} value={size.value} style={{ background: '#2d2d2d', color: '#ffffff' }}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}        {/* Scene Controls Section */}        {showControls && (
          <div style={{
            marginBottom: '0.4rem'
          }}>
            {/* Scene Controls Toggle */}
            <button
              onClick={() => setShowSceneControls(!showSceneControls)}
              style={{
                background: showSceneControls ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 165, 0, 0.5)',
                color: '#ffffff',
                padding: '0.3rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
                width: '100%',
                marginBottom: showSceneControls ? '0.4rem' : '0'
              }}
            >
              🎭 {showSceneControls ? '▼ Hide Scenes' : '▶ Show Scenes'} ({scenes.length})
            </button>

            {/* Scene Management Controls */}
            {showSceneControls && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid rgba(255, 165, 0, 0.3)'
              }}>
                {/* Quick Actions Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.3rem',
                  marginBottom: '0.4rem'
                }}>
                  <button
                    onClick={handleQuickSave}
                    style={{
                      background: 'rgba(255, 165, 0, 0.8)',
                      border: '1px solid rgba(255, 165, 0, 0.9)',
                      color: '#ffffff',
                      padding: '0.4rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      touchAction: 'manipulation',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ⚡ Quick Save
                  </button>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.65rem',
                    color: '#cccccc'
                  }}>
                    <span>Transition:</span>
                    <input
                      type="number"
                      value={Math.round(transitionDuration)}
                      onChange={(e) => setTransitionDuration(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{
                        width: '50px',
                        padding: '0.2rem',
                        borderRadius: '3px',
                        border: '1px solid rgba(78, 205, 196, 0.3)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        textAlign: 'center'
                      }}
                      min="0"
                      max="10000"
                    />
                    <span>ms</span>
                  </div>
                </div>

                {/* Save New Scene */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.3rem',
                  marginBottom: '0.4rem'
                }}>
                  <input
                    type="text"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                    placeholder="Scene name..."
                    style={{
                      padding: '0.4rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(78, 205, 196, 0.3)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSaveScene}
                    disabled={!newSceneName.trim()}
                    style={{
                      background: newSceneName.trim() ? 'rgba(0, 150, 0, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(0, 150, 0, 0.5)',
                      color: '#ffffff',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '4px',
                      cursor: newSceneName.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.7rem',
                      touchAction: 'manipulation',
                      opacity: newSceneName.trim() ? 1 : 0.5
                    }}
                  >
                    💾 Save
                  </button>
                </div>

                {/* Load Scene */}
                {scenes.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '0.3rem',
                    marginBottom: '0.4rem'
                  }}>
                    <select
                      value={selectedSceneToLoad}
                      onChange={(e) => setSelectedSceneToLoad(e.target.value)}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(78, 205, 196, 0.3)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="" style={{ background: '#2d2d2d' }}>Select scene...</option>
                      {scenes.map((scene) => (
                        <option key={scene.name} value={scene.name} style={{ background: '#2d2d2d' }}>
                          {scene.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleLoadScene}
                      disabled={!selectedSceneToLoad}
                      style={{
                        background: selectedSceneToLoad ? 'rgba(0, 150, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 150, 255, 0.5)',
                        color: '#ffffff',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: selectedSceneToLoad ? 'pointer' : 'not-allowed',
                        fontSize: '0.7rem',
                        touchAction: 'manipulation',
                        opacity: selectedSceneToLoad ? 1 : 0.5
                      }}
                    >
                      ▶️ Load
                    </button>
                    {selectedSceneToLoad && (
                      <button
                        onClick={() => handleDeleteScene(selectedSceneToLoad)}
                        style={{
                          background: 'rgba(255, 0, 0, 0.8)',
                          border: '1px solid rgba(255, 0, 0, 0.5)',
                          color: '#ffffff',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          touchAction: 'manipulation'
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Auto Scene Controls Toggle */}
            <button
              onClick={() => setShowAutoSceneControls(!showAutoSceneControls)}
              style={{
                background: showAutoSceneControls ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                color: '#ffffff',
                padding: '0.3rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
                width: '100%',
                marginTop: '0.3rem',
                marginBottom: showAutoSceneControls ? '0.4rem' : '0'
              }}
            >
              🎪 {showAutoSceneControls ? '▼ Hide Auto' : '▶ Show Auto'} ({autoSceneList.length})
            </button>

            {/* Auto Scene Controls */}
            {showAutoSceneControls && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>
                {/* Auto Scene Status and Control */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.3rem',
                  marginBottom: '0.4rem',
                  alignItems: 'center'
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    color: autoSceneEnabled ? '#00ff00' : '#cccccc'
                  }}>
                    Status: {autoSceneEnabled ? '▶️ Playing' : '⏸️ Stopped'}
                    {autoSceneEnabled && (
                      <div style={{ fontSize: '0.6rem', marginTop: '0.2rem' }}>
                        Mode: {autoSceneMode}, {autoSceneBeatDivision} beats
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto Scene Configuration */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.3rem',
                  marginBottom: '0.4rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.65rem',
                      color: '#cccccc',
                      marginBottom: '0.2rem'
                    }}>
                      Mode:
                    </label>
                    <select
                      value={autoSceneMode}
                      onChange={(e) => setAutoSceneMode(e.target.value as 'forward' | 'ping-pong' | 'random')}
                      style={{
                        width: '100%',
                        padding: '0.3rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '0.65rem'
                      }}
                    >
                      <option value="forward" style={{ background: '#2d2d2d' }}>Forward</option>
                      <option value="ping-pong" style={{ background: '#2d2d2d' }}>Ping-Pong</option>
                      <option value="random" style={{ background: '#2d2d2d' }}>Random</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.65rem',
                      color: '#cccccc',
                      marginBottom: '0.2rem'
                    }}>
                      Every (beats):
                    </label>
                    <input
                      type="number"
                      value={autoSceneBeatDivision}
                      onChange={(e) => setAutoSceneBeatDivision(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '100%',
                        padding: '0.3rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        textAlign: 'center'
                      }}
                      min="1"
                      max="32"
                    />
                  </div>
                </div>

                {/* Tempo Source */}
                <div style={{
                  marginBottom: '0.4rem'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.65rem',
                    color: '#cccccc',
                    marginBottom: '0.2rem'
                  }}>
                    Tempo Source:
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.3rem',
                    alignItems: 'center'
                  }}>
                    <select
                      value={autoSceneTempoSource}
                      onChange={(e) => setAutoSceneTempoSource(e.target.value as 'internal_clock' | 'manual_bpm' | 'tap_tempo')}
                      style={{
                        padding: '0.3rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '0.65rem'
                      }}
                    >
                      <option value="internal_clock" style={{ background: '#2d2d2d' }}>Internal Clock</option>
                      <option value="manual_bpm" style={{ background: '#2d2d2d' }}>Manual BPM</option>
                      <option value="tap_tempo" style={{ background: '#2d2d2d' }}>Tap Tempo</option>
                    </select>

                    {autoSceneTempoSource === 'manual_bpm' && (
                      <input
                        type="number"
                        value={Math.round(autoSceneManualBpm)}
                        onChange={(e) => setManualBpm(parseInt(e.target.value) || 120)}
                        style={{
                          width: '60px',
                          padding: '0.3rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          textAlign: 'center'
                        }}
                        min="20"
                        max="300"
                      />
                    )}

                    {autoSceneTempoSource === 'tap_tempo' && (
                      <button
                        onClick={recordTapTempo}
                        style={{
                          background: 'rgba(168, 85, 247, 0.8)',
                          border: '1px solid rgba(168, 85, 247, 0.9)',
                          color: '#ffffff',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.65rem',
                          touchAction: 'manipulation'
                        }}
                      >
                        TAP ({Math.round(autoSceneTapTempoBpm)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Scene Selection for Auto Play */}
                {scenes.length > 0 && (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.65rem',
                      color: '#cccccc',
                      marginBottom: '0.3rem'
                    }}>
                      Auto-Play Scenes:
                    </label>
                    <div style={{
                      maxHeight: '120px',
                      overflowY: 'auto',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.3rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(168, 85, 247, 0.2)'
                    }}>
                      {scenes.map((scene) => (
                        <div
                          key={scene.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem',
                            marginBottom: '0.2rem',
                            background: autoSceneList.includes(scene.name) ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => toggleSceneInAutoList(scene.name)}
                        >
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            background: autoSceneList.includes(scene.name) ? '#a855f7' : 'transparent',
                            border: '1px solid #a855f7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {autoSceneList.includes(scene.name) && (
                              <span style={{ color: '#ffffff', fontSize: '8px' }}>✓</span>
                            )}
                          </div>
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#ffffff',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {scene.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}        {/* Page Navigation - Compact */}
        {showControls && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {/* Previous Page */}            <button
              onClick={() => handlePageChange('prev')}
              disabled={currentPage === 0}
              style={{
                background: currentPage === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(78, 205, 196, 0.3)',
                border: '1px solid rgba(78, 205, 196, 0.5)',
                color: currentPage === 0 ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
                minWidth: '60px'
              }}
            >
              ‹‹
            </button>            {/* Page Info */}
            <div style={{
              textAlign: 'center',
              flex: 1,
              fontSize: '0.7rem',
              color: '#cccccc'
            }}>
              <div>
                Page {currentPage + 1}/{totalPages}
              </div>
              <div style={{ fontSize: '0.65rem', marginTop: '0.1rem' }}>
                {currentFilter.isSelectedOnly && selectedChannels.length > 0 
                  ? `Selected: ${displayedChannels.length} channels`
                  : displayedChannels.length > 0 
                    ? `Ch ${displayedChannels[0] + 1}-${displayedChannels[displayedChannels.length - 1] + 1}`
                    : 'No channels'
                }
              </div>
            </div>

            {/* Next Page */}            <button
              onClick={() => handlePageChange('next')}
              disabled={currentPage === totalPages - 1}
              style={{
                background: currentPage === totalPages - 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(78, 205, 196, 0.3)',
                border: '1px solid rgba(78, 205, 196, 0.5)',
                color: currentPage === totalPages - 1 ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
                minWidth: '60px'
              }}
            >
              ››
            </button>
          </div>
        )}
      </div>      {/* Channel Grid - Fixed Touch Scrolling */}      <div 
        className="touch-dmx-grid"
        style={{
          flex: 1,
          padding: '0.75rem',
          overflow: 'auto',
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(channelsPerPage, 4)}, 1fr)`,
          gap: '0.5rem',
          alignContent: 'start',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          scrollBehavior: 'smooth',
          // Fix touch scrolling when controls are visible
          touchAction: showControls ? 'pan-y' : 'manipulation',
          // Ensure proper scrolling behavior
          position: 'relative',
          height: '100%',
          minHeight: '0' // Allow flex shrinking
        }}
      >
        {displayedChannels.map((channelIndex) => (
          <TouchDmxChannel
            key={channelIndex}
            index={channelIndex}
            value={dmxChannels[channelIndex] || 0}
            isSelected={selectedChannels.includes(channelIndex)}
            onValueChange={handleValueChange}
            onToggleSelection={handleToggleSelection}
          />
        ))}
      </div>      {/* Compact Footer with Quick Navigation - Auto-hide when controls hidden */}
      {showControls && totalPages > 1 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '0.4rem',
          borderTop: '1px solid rgba(78, 205, 196, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          gap: '0.3rem',
          flexShrink: 0
        }}>          <button
            onClick={() => handlePageChange('first')}
            disabled={currentPage === 0}
            style={{
              background: 'rgba(78, 205, 196, 0.2)',
              border: '1px solid rgba(78, 205, 196, 0.4)',
              color: '#ffffff',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.7rem',
              touchAction: 'manipulation',
              opacity: currentPage === 0 ? 0.5 : 1,
              minWidth: '60px'
            }}
          >
            First
          </button>
          <button
            onClick={() => handlePageChange('last')}
            disabled={currentPage === totalPages - 1}
            style={{
              background: 'rgba(78, 205, 196, 0.2)',
              border: '1px solid rgba(78, 205, 196, 0.4)',
              color: '#ffffff',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.7rem',
              touchAction: 'manipulation',
              opacity: currentPage === totalPages - 1 ? 0.5 : 1,
              minWidth: '60px'
            }}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
};
