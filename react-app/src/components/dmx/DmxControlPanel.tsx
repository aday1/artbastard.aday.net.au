import React, { useState } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../context/ThemeContext'
import { DmxChannel } from './DmxChannel'
import styles from './DmxControlPanel.module.scss'

// Channel filtering interface
interface ChannelFilter {
  name: string;
  startChannel: number;
  endChannel: number;
  isSelectedOnly?: boolean;
  isActiveFixtures?: boolean;
  groupId?: string;
}

// Base channel filters
const BASE_CHANNEL_FILTERS: ChannelFilter[] = [
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

export const DmxControlPanel: React.FC = () => {
  const { theme } = useTheme()
  const [filterText, setFilterText] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [channelsPerPage, setChannelsPerPage] = useState(32)
  const [selectedChannelsOnlyMode, setSelectedChannelsOnlyMode] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState(2) // Default to "All Channels"
    const {
    dmxChannels,
    selectedChannels,
    selectAllChannels,
    deselectAllChannels,
    invertChannelSelection,
    fixtures,
    groups,
  } = useStore((state) => ({
    dmxChannels: state.dmxChannels,
    selectedChannels: state.selectedChannels,
    selectAllChannels: state.selectAllChannels,
    deselectAllChannels: state.deselectAllChannels,
    invertChannelSelection: state.invertChannelSelection,
    fixtures: state.fixtures,
    groups: state.groups,
  }))

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
    const baseFilters = [...BASE_CHANNEL_FILTERS];
    
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

  const dynamicChannelFilters = getDynamicChannelFilters();
    // Get the channels to display based on mode and filter
  const getDisplayedChannels = () => {
    const currentFilter = dynamicChannelFilters[selectedFilter];
    let allFilteredChannels: number[] = [];
    
    if (currentFilter.isSelectedOnly) {
      // Use selected channels only
      allFilteredChannels = [...selectedChannels].sort((a, b) => a - b);
    } else if (currentFilter.isActiveFixtures) {
      // Use active fixture channels only
      allFilteredChannels = getActiveFixtureChannels();
    } else if (currentFilter.groupId) {
      // Use specific group channels
      allFilteredChannels = getGroupChannels(currentFilter.groupId);
    } else {
      // Use channel range
      allFilteredChannels = Array.from(
        { length: currentFilter.endChannel - currentFilter.startChannel + 1 }, 
        (_, i) => currentFilter.startChannel - 1 + i // Convert to 0-based
      );
    }
    
    // Apply pagination to filtered channels
    const startIdx = currentPage * channelsPerPage;
    const endIdx = Math.min(startIdx + channelsPerPage, allFilteredChannels.length);
    return allFilteredChannels.slice(startIdx, endIdx);
  }
  
  // Calculate total pages based on current filter
  const getTotalPages = () => {
    const currentFilter = dynamicChannelFilters[selectedFilter];
    let totalChannels = 0;
    
    if (currentFilter.isSelectedOnly) {
      totalChannels = selectedChannels.length;
    } else if (currentFilter.isActiveFixtures) {
      totalChannels = getActiveFixtureChannels().length;
    } else if (currentFilter.groupId) {
      totalChannels = getGroupChannels(currentFilter.groupId).length;
    } else {
      totalChannels = currentFilter.endChannel - currentFilter.startChannel + 1;
    }
      return Math.ceil(totalChannels / channelsPerPage);
  }
  
  const displayedChannels = getDisplayedChannels()
  const totalPages = getTotalPages()
  
  // Calculate completion for progress bar
  const nonZeroChannels = dmxChannels.filter(val => val > 0).length
  const completion = (nonZeroChannels / 512) * 100
    // Reset to first page when switching filters
  const handleFilterChange = (filterIndex: number) => {
    setSelectedFilter(filterIndex)
    setCurrentPage(0)
  }
  
  // Legacy function for backward compatibility
  const handleModeToggle = () => {
    const isCurrentlySelectedOnly = dynamicChannelFilters[selectedFilter]?.isSelectedOnly;
    if (isCurrentlySelectedOnly) {
      // Switch to "All Channels"
      const allChannelsIndex = dynamicChannelFilters.findIndex(f => f.name === "All Channels");
      handleFilterChange(allChannelsIndex);
    } else {
      // Switch to "Selected Channels Only"
      const selectedOnlyIndex = dynamicChannelFilters.findIndex(f => f.isSelectedOnly);
      handleFilterChange(selectedOnlyIndex);
    }
  }
  
  return (
    <div className={styles.dmxControlPanel}>
      <h2 className={styles.sectionTitle}>
        {theme === 'artsnob' && 'DMX Channels: The Elemental Brushstrokes'}
        {theme === 'standard' && 'DMX Channel Control'}
        {theme === 'minimal' && 'DMX Channels'}
      </h2>      
      {/* Status bar showing active channels */}
      <div className={styles.statusBar}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${completion}%` }}
          ></div>
        </div>        <div className={styles.stats}>
          <span>{nonZeroChannels} active channels</span>
          <span>{selectedChannels.length} selected</span>
          <span className={styles.modeIndicator}>
            {dynamicChannelFilters[selectedFilter]?.name || 'All Channels'}
          </span>
        </div>
      </div>
      
      {/* Control toolbar */}
      <div className={styles.controlToolbar}>
        <div className={styles.selectionControls}>
          <button onClick={selectAllChannels} className={styles.toolbarButton}>
            <i className="fas fa-check-double"></i>
            {theme !== 'minimal' && <span>Select All</span>}
          </button>
          <button onClick={deselectAllChannels} className={styles.toolbarButton}>
            <i className="fas fa-times"></i>
            {theme !== 'minimal' && <span>Deselect All</span>}
          </button>
          <button onClick={invertChannelSelection} className={styles.toolbarButton}>
            <i className="fas fa-exchange-alt"></i>
            {theme !== 'minimal' && <span>Invert</span>}
          </button>
            {/* Touch Mode Toggle */}
          <button 
            onClick={handleModeToggle} 
            className={`${styles.toolbarButton} ${dynamicChannelFilters[selectedFilter]?.isSelectedOnly ? styles.active : ''}`}
            title={dynamicChannelFilters[selectedFilter]?.isSelectedOnly ? "Show All Channels" : "Show Selected Channels Only (Touch Mode)"}
          >
            <i className="fas fa-hand-pointer"></i>
            {theme !== 'minimal' && (
              <span>{dynamicChannelFilters[selectedFilter]?.isSelectedOnly ? 'All Channels' : 'Selected Only'}</span>
            )}
          </button>
          
          {/* Channel Filter Dropdown */}
          <select
            value={selectedFilter}
            onChange={(e) => handleFilterChange(Number(e.target.value))}
            className={styles.filterSelect}
            title="Filter channels by fixtures or groups"
          >
            {dynamicChannelFilters.map((filter, index) => (
              <option key={index} value={index}>
                {filter.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className={styles.pageControls}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className={styles.pageButton}
          >
            <i className="fas fa-chevron-left"></i>
          </button>          <select 
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            className={styles.pageSelect}
          >
            {Array.from({ length: totalPages }, (_, i) => {
              const currentFilter = dynamicChannelFilters[selectedFilter];
              let startCh, endCh;
              
              if (currentFilter.isSelectedOnly) {
                const sortedSelected = [...selectedChannels].sort((a, b) => a - b);
                startCh = sortedSelected[i * channelsPerPage];
                const endIdx = Math.min((i + 1) * channelsPerPage - 1, sortedSelected.length - 1);
                endCh = sortedSelected[endIdx];
              } else if (currentFilter.isActiveFixtures) {
                const activeChannels = getActiveFixtureChannels();
                startCh = activeChannels[i * channelsPerPage];
                const endIdx = Math.min((i + 1) * channelsPerPage - 1, activeChannels.length - 1);
                endCh = activeChannels[endIdx];
              } else if (currentFilter.groupId) {
                const groupChannels = getGroupChannels(currentFilter.groupId);
                startCh = groupChannels[i * channelsPerPage];
                const endIdx = Math.min((i + 1) * channelsPerPage - 1, groupChannels.length - 1);
                endCh = groupChannels[endIdx];
              } else {
                startCh = currentFilter.startChannel - 1 + (i * channelsPerPage);
                endCh = Math.min(startCh + channelsPerPage - 1, currentFilter.endChannel - 1);
              }
              
              return (
                <option key={i} value={i}>
                  Ch {(startCh || 0) + 1}-{(endCh || 0) + 1}
                </option>
              );
            })}
          </select>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className={styles.pageButton}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        
        <div className={styles.viewControls}>
          <select 
            value={channelsPerPage}
            onChange={(e) => {
              setChannelsPerPage(Number(e.target.value))
              setCurrentPage(0) // Reset to first page when changing view
            }}
            className={styles.viewSelect}
          >
            <option value={8}>8 channels</option>
            <option value={16}>16 channels</option>
            <option value={32}>32 channels</option>
            <option value={64}>64 channels</option>
            <option value={128}>128 channels</option>
          </select>
          
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Filter channels..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className={styles.searchInput}
            />
            {filterText && (
              <button 
                onClick={() => setFilterText('')}
                className={styles.clearSearch}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>        {/* Filter Mode Info */}
      {(() => {
        const currentFilter = dynamicChannelFilters[selectedFilter];
        
        if (currentFilter.isSelectedOnly) {
          return (
            <div className={styles.modeInfo}>
              {selectedChannels.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-info-circle"></i>
                  <span>No channels selected. Select channels to use Selected Mode.</span>
                </div>
              ) : (
                <div className={styles.modeStats}>
                  <i className="fas fa-hand-pointer"></i>
                  <span>Showing {Math.min(channelsPerPage, selectedChannels.length - (currentPage * channelsPerPage))} of {selectedChannels.length} selected channels</span>
                </div>
              )}
            </div>
          );
        }
        
        if (currentFilter.isActiveFixtures) {
          const activeChannels = getActiveFixtureChannels();
          return (
            <div className={styles.modeInfo}>
              {activeChannels.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-info-circle"></i>
                  <span>No active fixtures found. Set some DMX values to see active fixtures.</span>
                </div>
              ) : (
                <div className={styles.modeStats}>
                  <i className="fas fa-lightbulb"></i>
                  <span>Showing {Math.min(channelsPerPage, activeChannels.length - (currentPage * channelsPerPage))} of {activeChannels.length} active fixture channels</span>
                </div>
              )}
            </div>
          );
        }
        
        if (currentFilter.groupId) {
          const group = groups.find(g => g.id === currentFilter.groupId);
          const groupChannels = getGroupChannels(currentFilter.groupId);
          return (
            <div className={styles.modeInfo}>
              {groupChannels.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-info-circle"></i>
                  <span>No channels found for group "{group?.name}". Check group fixture assignments.</span>
                </div>
              ) : (
                <div className={styles.modeStats}>
                  <i className="fas fa-layer-group"></i>
                  <span>Showing {Math.min(channelsPerPage, groupChannels.length - (currentPage * channelsPerPage))} of {groupChannels.length} channels from group "{group?.name}"</span>
                </div>
              )}
            </div>
          );
        }
        
        return null; // No special info for range-based filters
      })()}
        {/* DMX Channels grid */}
      <div className={`${styles.channelsGrid} ${selectedChannelsOnlyMode ? styles.touchMode : ''}`}>
        {displayedChannels.map((index) => (
          <DmxChannel 
            key={index} 
            index={index}
            allowFullscreen={!selectedChannelsOnlyMode} 
            touchOptimized={selectedChannelsOnlyMode}
          />
        ))}
      </div>
      
      {/* Pagination controls at bottom */}
      <div className={styles.pagination}>
        <button 
          onClick={() => setCurrentPage(0)}
          disabled={currentPage === 0}
          className={styles.paginationButton}
        >
          <i className="fas fa-angle-double-left"></i>
        </button>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
          disabled={currentPage === 0}
          className={styles.paginationButton}
        >
          <i className="fas fa-angle-left"></i>
        </button>
        
        <div className={styles.pageIndicator}>
          Page {currentPage + 1} of {totalPages}
          {selectedChannelsOnlyMode && selectedChannels.length > 0 && (
            <span className={styles.modeLabel}>• Touch Mode</span>
          )}
        </div>
        
        <button 
          onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
          disabled={currentPage === totalPages - 1}
          className={styles.paginationButton}
        >
          <i className="fas fa-angle-right"></i>
        </button>
        <button 
          onClick={() => setCurrentPage(totalPages - 1)}
          disabled={currentPage === totalPages - 1}
          className={styles.paginationButton}
        >
          <i className="fas fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  )
}