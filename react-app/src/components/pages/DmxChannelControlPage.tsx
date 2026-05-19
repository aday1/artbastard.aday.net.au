import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { useMidiLearn } from '../../hooks/useMidiLearn';
import { useGlobalBrowserMidi } from '../../hooks/useGlobalBrowserMidi';
import { useTheme } from '../../context/ThemeContext';
import { useMobile } from '../../hooks/useMobile';
import { LucideIcon } from '../ui/LucideIcon';
import { EnvelopeAutomation } from '../automation/EnvelopeAutomation';
import { GlobalChannelNames } from '../channels/GlobalChannelNames';
import styles from './DmxChannelControlPage.module.scss';
import pageStyles from '../../pages/Pages.module.scss';

export const DmxChannelControlPage: React.FC = () => {
  const { theme } = useTheme();
  const { isMobile, isTablet, isTouch } = useMobile();

  // State management
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [filter, setFilter] = useState<'all' | 'active' | 'selected' | 'range' | 'selectedFixtures'>('all');
  const [range, setRange] = useState({ start: 1, end: 32 });
  const [searchTerm, setSearchTerm] = useState('');
  const [channelsPerPage, setChannelsPerPage] = useState(64);
  const [currentPage, setCurrentPage] = useState(0);
  const [showSceneControls, setShowSceneControls] = useState(true);
  const [showMidiControls, setShowMidiControls] = useState(true);
  const [showOscControls, setShowOscControls] = useState(true);
  const [showEnvelopeAutomation, setShowEnvelopeAutomation] = useState(true);
  const [showGlobalChannelNames, setShowGlobalChannelNames] = useState(false);
  const [editingChannelName, setEditingChannelName] = useState<number | null>(null);
  const [editingChannelNameValue, setEditingChannelNameValue] = useState('');
  const [highlightedChannel, setHighlightedChannel] = useState<number | null>(null);
  const [showFixtureSelector, setShowFixtureSelector] = useState(false);
  const [fixtureSearchTerm, setFixtureSearchTerm] = useState('');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'active' | 'byType' | 'byRange'>('all');
  const [fixtureTypeFilter, setFixtureTypeFilter] = useState<string>('');
  const [fixtureAddressRange, setFixtureAddressRange] = useState({ start: 1, end: 512 });
  const pageRef = useRef<HTMLDivElement>(null);
  const fixtureSelectorRef = useRef<HTMLDivElement>(null);

  // Helper: Jump to a specific channel by switching to its page and scrolling
  const scrollToChannel = (channelIndex: number) => {
    // Ensure the channel is visible by resetting filters
    setFilter('all');

    const pageIndex = Math.floor(channelIndex / channelsPerPage);
    setHighlightedChannel(channelIndex);

    if (pageIndex !== currentPage) {
      setCurrentPage(pageIndex);
      // Wait for the page to render the target channel before scrolling
      setTimeout(() => {
        const el = document.getElementById(`dmx-channel-${channelIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    } else {
      const el = document.getElementById(`dmx-channel-${channelIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Clear highlight after a short delay
    setTimeout(() => setHighlightedChannel(null), 2000);
  };

  // Store hooks
  const {
    // DMX Controls
    dmxChannels,
    selectedChannels,
    channelNames,
    channelRanges,
    channelColors,
    setDmxChannel,
    toggleChannelSelection,
    selectAllChannels,
    deselectAllChannels,
    midiMappings,
    removeMidiMapping,
    addMidiMapping,
    oscAssignments,
    setOscAssignment,
    setChannelName,
    setChannelRange,
    getChannelRange,
    setChannelColor,
    setRandomChannelColor,
    pinnedChannels,
    togglePinChannel,
    fixtures,
    selectedFixtures,
    setSelectedFixtures,
    toggleFixtureSelection,
    groups,
    selectFixtureGroup,

    // Fixture Helper Functions
    getChannelInfo,
    getFixtureColor,
    isChannelAssigned,

    // Scene Controls
    scenes,
    saveScene,
    loadScene,
    addNotification,

    // MIDI Learn
    startMidiLearn,
    cancelMidiLearn,
    midiLearnTarget,

    // Envelope Automation
    envelopeAutomation,
    toggleEnvelope,
    channelJumpTarget,
  } = useStore();

  // Listen for channel jump requests (e.g. from PinnedChannels sidebar)
  useEffect(() => {
    if (channelJumpTarget !== null) {
      console.log(`[DMXChannelControl] Scrolling to channel ${channelJumpTarget + 1} requested by jump target state`);
      scrollToChannel(channelJumpTarget);
    }
  }, [channelJumpTarget]);

  // MIDI Learn hook
  const { isLearning, learnStatus, currentLearningChannel, startLearn, cancelLearn } = useMidiLearn();

  // Global Browser MIDI hook
  const {
    isSupported: browserMidiSupported,
    error: browserMidiError,
    browserInputs,
    activeBrowserInputs,
    connectBrowserInput,
    disconnectBrowserInput,
    refreshDevices
  } = useGlobalBrowserMidi();


  // Get filtered channels
  const getFilteredChannels = () => {
    let channels: number[] = [];

    switch (filter) {
      case 'all':
        channels = Array.from({ length: 512 }, (_, i) => i);
        break;
      case 'active':
        channels = Array.from({ length: 512 }, (_, i) => i).filter(i => (dmxChannels[i] || 0) > 0);
        break;
      case 'selected':
        channels = selectedChannels;
        break;
      case 'range':
        channels = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start - 1 + i);
        break;
      case 'selectedFixtures':
        // Filter by selected fixtures
        if (selectedFixtures.length > 0) {
          const fixtureChannels = new Set<number>();
          selectedFixtures.forEach(fixtureId => {
            const fixture = fixtures.find(f => f.id === fixtureId);
            if (fixture) {
              const startAddress = fixture.startAddress;
              const channelCount = fixture.channels?.length || 0;
              for (let i = 0; i < channelCount; i++) {
                const channelIndex = startAddress - 1 + i; // Convert to 0-based index
                if (channelIndex >= 0 && channelIndex < 512) {
                  fixtureChannels.add(channelIndex);
                }
              }
            }
          });
          channels = Array.from(fixtureChannels).sort((a, b) => a - b);
        } else {
          // If no fixtures selected, show all channels
          channels = Array.from({ length: 512 }, (_, i) => i);
        }
        break;
    }

    // Filter by selected fixtures if any are selected AND filter is not already 'selectedFixtures'
    if (selectedFixtures.length > 0 && filter !== 'selectedFixtures') {
      const fixtureChannels = new Set<number>();
      selectedFixtures.forEach(fixtureId => {
        const fixture = fixtures.find(f => f.id === fixtureId);
        if (fixture) {
          const startAddress = fixture.startAddress;
          const channelCount = fixture.channels?.length || 0;
          for (let i = 0; i < channelCount; i++) {
            const channelIndex = startAddress - 1 + i; // Convert to 0-based index
            if (channelIndex >= 0 && channelIndex < 512) {
              fixtureChannels.add(channelIndex);
            }
          }
        }
      });
      channels = channels.filter(channel => fixtureChannels.has(channel));
    }

    // Apply search filter
    if (searchTerm) {
      channels = channels.filter(channel => {
        const channelName = channelNames[channel] || `Channel ${channel + 1}`;
        return channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (channel + 1).toString().includes(searchTerm);
      });
    }

    return channels;
  };

  const filteredChannels = getFilteredChannels();
  const totalPages = Math.ceil(filteredChannels.length / channelsPerPage);
  const startIndex = currentPage * channelsPerPage;
  const endIndex = Math.min(startIndex + channelsPerPage, filteredChannels.length);
  const displayedChannels = filteredChannels.slice(startIndex, endIndex);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [filter, range, searchTerm, selectedFixtures]);

  // Helper: Get filtered fixtures based on search and filters
  const getFilteredFixtures = () => {
    let filtered = [...fixtures];

    // Apply search filter
    if (fixtureSearchTerm) {
      const searchLower = fixtureSearchTerm.toLowerCase();
      filtered = filtered.filter(fixture => 
        fixture.name.toLowerCase().includes(searchLower) ||
        fixture.startAddress.toString().includes(fixtureSearchTerm) ||
        fixture.type?.toLowerCase().includes(searchLower) ||
        fixture.manufacturer?.toLowerCase().includes(searchLower) ||
        fixture.model?.toLowerCase().includes(searchLower)
      );
    }

    // Apply active filter (fixtures with non-zero DMX values)
    if (fixtureFilter === 'active') {
      filtered = filtered.filter(fixture => {
        const startAddress = fixture.startAddress;
        const channelCount = fixture.channels?.length || 0;
        for (let i = 0; i < channelCount; i++) {
          const channelIndex = startAddress - 1 + i;
          if (channelIndex >= 0 && channelIndex < 512 && (dmxChannels[channelIndex] || 0) > 0) {
            return true;
          }
        }
        return false;
      });
    }

    // Apply type filter
    if (fixtureFilter === 'byType' && fixtureTypeFilter) {
      filtered = filtered.filter(fixture => 
        fixture.type?.toLowerCase() === fixtureTypeFilter.toLowerCase()
      );
    }

    // Apply address range filter
    if (fixtureFilter === 'byRange') {
      filtered = filtered.filter(fixture => 
        fixture.startAddress >= fixtureAddressRange.start && 
        fixture.startAddress <= fixtureAddressRange.end
      );
    }

    return filtered;
  };

  const filteredFixtures = getFilteredFixtures();

  // Get unique fixture types
  const fixtureTypes = Array.from(new Set(fixtures.map(f => f.type).filter(Boolean))).sort();

  // Helper: Check if fixture is active
  const isFixtureActive = (fixture: any) => {
    const startAddress = fixture.startAddress;
    const channelCount = fixture.channels?.length || 0;
    for (let i = 0; i < channelCount; i++) {
      const channelIndex = startAddress - 1 + i;
      if (channelIndex >= 0 && channelIndex < 512 && (dmxChannels[channelIndex] || 0) > 0) {
        return true;
      }
    }
    return false;
  };

  // Close fixture selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fixtureSelectorRef.current &&
        !fixtureSelectorRef.current.contains(event.target as Node) &&
        showFixtureSelector
      ) {
        setShowFixtureSelector(false);
      }
    };

    if (showFixtureSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFixtureSelector]);

  // Embedded MIDI monitor removed; floating monitor remains available globally

  // Debug MIDI mappings changes
  useEffect(() => {
    console.log(`[DMXChannelControl] MIDI mappings updated:`, midiMappings);
    console.log(`[DMXChannelControl] MIDI mappings count:`, Object.keys(midiMappings).length);

    // Test: Add a debug mapping to channel 0 to test Forget button visibility
    if (Object.keys(midiMappings).length === 0) {
      console.log(`[DMXChannelControl] No MIDI mappings found. Testing with debug mapping...`);
      // Uncomment the line below to test Forget button visibility
      // addMidiMapping(0, { channel: 0, controller: 1 });
    }
  }, [midiMappings]);

  // Helper function to get fixture info for a channel
  const getFixtureInfoForChannel = (channelIndex: number) => {
    const dmxAddress = channelIndex + 1; // Convert 0-based index to 1-based address

    for (const fixture of fixtures || []) {
      const fixtureStartAddress = fixture.startAddress;
      const fixtureEndAddress = fixtureStartAddress + (fixture.channels?.length || 0) - 1;

      if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
        const channelOffset = dmxAddress - fixtureStartAddress;
        const channel = fixture.channels?.[channelOffset];

        if (channel) {
          return {
            fixtureName: fixture.name,
            channelFunction: channel.name || `${channel.type} Channel`,
            channelType: channel.type,
          };
        }
      }
    }

    return null;
  };



  // Handle channel name editing
  const handleStartEditName = (channelIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Allow editing regardless of fixture assignment - custom names can override fixture names
    setEditingChannelName(channelIndex);
    setEditingChannelNameValue(channelNames[channelIndex] || `Channel ${channelIndex + 1}`);
  };

  const handleSaveChannelName = (channelIndex: number) => {
    setChannelName(channelIndex, editingChannelNameValue);
    setEditingChannelName(null);
    setEditingChannelNameValue('');
  };

  const handleCancelEditName = () => {
    setEditingChannelName(null);
    setEditingChannelNameValue('');
  };

  // MIDI Learn handlers
  const handleMidiLearn = (channelIndex: number) => {
    // Scroll to channel when Learn is clicked
    scrollToChannel(channelIndex);
    console.log(`[DMXChannelControl] MIDI Learn clicked for channel ${channelIndex}`);
    console.log(`[DMXChannelControl] Current state:`, {
      isLearning,
      currentLearningChannel,
      midiLearnTarget,
      midiMappings: Object.keys(midiMappings).length
    });

    if (isLearning && currentLearningChannel === channelIndex) {
      console.log(`[DMXChannelControl] Cancelling MIDI Learn for channel ${channelIndex}`);
      cancelLearn();
    } else {
      console.log(`[DMXChannelControl] Starting MIDI Learn for channel ${channelIndex}`);
      startLearn(channelIndex);
    }
  };

  const handleMidiForget = (channelIndex: number) => {
    console.log(`[DMXChannelControl] MIDI Forget clicked for channel ${channelIndex}`);
    console.log(`[DMXChannelControl] Current mapping:`, midiMappings[channelIndex]);

    removeMidiMapping(channelIndex);
    addNotification({
      message: `MIDI mapping removed for DMX CH ${channelIndex + 1}`,
      type: 'info',
      priority: 'normal'
    });
  };

  // MIDI connection handlers
  const handleMidiConnect = (inputId: string) => {
    connectBrowserInput(inputId);
    addNotification({
      message: `Connected to MIDI input: ${inputId}`,
      type: 'success',
      priority: 'normal'
    });
  };

  const handleMidiDisconnect = (inputId: string) => {
    disconnectBrowserInput(inputId);
    addNotification({
      message: `Disconnected from MIDI input: ${inputId}`,
      type: 'info',
      priority: 'normal'
    });
  };

  const handleRefreshMidiDevices = () => {
    refreshDevices();
    addNotification({
      message: 'MIDI devices refreshed',
      type: 'info',
      priority: 'normal'
    });
  };

  // OSC assignment handlers
  const handleSetOscAddress = (channelIndex: number) => {
    const currentAddress = oscAssignments[channelIndex] || '';
    const newAddress = prompt(`Enter OSC address for DMX CH ${channelIndex + 1}:`, currentAddress);
    if (newAddress !== null) {
      setOscAssignment(channelIndex, newAddress);
      addNotification({
        message: `OSC address set for DMX CH ${channelIndex + 1}: ${newAddress}`,
        type: 'success',
        priority: 'normal'
      });
    }
  };

  // Scene handlers
  const handleSaveScene = () => {
    const sceneName = prompt('Enter scene name:');
    if (sceneName) {
      const oscAddress = prompt('Enter OSC address (optional):') || `/scene/${sceneName}`;
      saveScene(sceneName, oscAddress);
      addNotification({
        message: `Scene "${sceneName}" saved successfully`,
        type: 'success',
        priority: 'normal'
      });
    }
  };

  const handleLoadScene = (sceneName: string) => {
    loadScene(sceneName);
    addNotification({
      message: `Scene "${sceneName}" loaded successfully`,
      type: 'success',
      priority: 'normal'
    });
  };

  // Pagination handlers
  const handlePageChange = (direction: 'prev' | 'next' | 'first' | 'last') => {
    switch (direction) {
      case 'prev':
        setCurrentPage(Math.max(0, currentPage - 1));
        break;
      case 'next':
        setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
        break;
      case 'first':
        setCurrentPage(0);
        break;
      case 'last':
        setCurrentPage(totalPages - 1);
        break;
    }
  };

  return (
    <div className={pageStyles.pageContainer}>
      <div className={pageStyles.pageHeader}>
        <div className={pageStyles.headerContent}>
          <h2>
            {theme === 'artsnob' && 'Le Contrôle DMX Ultime'}
            {theme === 'standard' && 'DMX Channel Control'}
            {theme === 'minimal' && 'DMX Control'}
          </h2>
          <p>
            {theme === 'artsnob' && 'Direct DMX channel control with MIDI Learn/Forget functionality'}
            {theme === 'standard' && 'Direct DMX channel control with MIDI Learn/Forget functionality'}
            {theme === 'minimal' && 'Direct DMX channel control'}
          </p>
        </div>
      </div>

      <div className={pageStyles.pageContent}>
        <div className={styles.dmxChannelControlPage}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>
                <LucideIcon name="Sliders" />
                DMX Channel Control
              </h1>
              <div className={styles.stats}>
                <span className={styles.stat}>
                  <LucideIcon name="Zap" />
                  {Object.values(dmxChannels).filter(v => v > 0).length} Active
                </span>
                <span className={styles.stat}>
                  <LucideIcon name="CheckSquare" />
                  {selectedFixtures.length > 0 
                    ? `${selectedFixtures.length} Fixture${selectedFixtures.length !== 1 ? 's' : ''} Selected`
                    : `${selectedChannels.length} Channel${selectedChannels.length !== 1 ? 's' : ''} Selected`}
                </span>
                <span className={styles.stat}>
                  <LucideIcon name="Music" />
                  {Object.keys(midiMappings).length} MIDI Mapped
                </span>
                {isLearning && (
                  <span className={`${styles.stat} ${styles.learningStat}`}>
                    <LucideIcon name="Radio" />
                    Learning CH {currentLearningChannel !== null ? currentLearningChannel + 1 : '?'}
                  </span>
                )}
              </div>
            </div>
            
            {/* Enhanced Fixture Selector */}
            {fixtures.length > 0 && (
              <div className={styles.fixtureSelectorContainer} ref={fixtureSelectorRef}>
                <button
                  className={styles.fixtureSelectorButton}
                  onClick={() => setShowFixtureSelector(!showFixtureSelector)}
                >
                  <LucideIcon name="LampDesk" />
                  <span>
                    {selectedFixtures.length === 0 
                      ? 'All Fixtures' 
                      : selectedFixtures.length === 1
                        ? fixtures.find(f => f.id === selectedFixtures[0])?.name || 'Select Fixture'
                        : `${selectedFixtures.length} Selected`}
                  </span>
                  {selectedFixtures.length > 0 && (
                    <span className={styles.fixtureSelectorBadge}>{selectedFixtures.length}</span>
                  )}
                  <LucideIcon name={showFixtureSelector ? "ChevronUp" : "ChevronDown"} />
                </button>
                
                {showFixtureSelector && (
                  <div className={styles.fixtureSelectorDropdown}>
                    {/* Search and Filter Header */}
                    <div className={styles.fixtureSelectorSearchSection}>
                      <div className={styles.fixtureSearchContainer}>
                        <LucideIcon name="Search" size={18} />
                        <input
                          type="text"
                          placeholder="Search fixtures by name, address, or type..."
                          value={fixtureSearchTerm}
                          onChange={(e) => setFixtureSearchTerm(e.target.value)}
                          className={styles.fixtureSearchInput}
                          autoFocus
                        />
                        {fixtureSearchTerm && (
                          <button
                            onClick={() => setFixtureSearchTerm('')}
                            className={styles.fixtureSearchClear}
                            title="Clear search"
                          >
                            <LucideIcon name="X" size={16} />
                          </button>
                        )}
                      </div>
                      
                      {/* Quick Filter Buttons */}
                      <div className={styles.fixtureQuickFilters}>
                        <button
                          className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'all' ? styles.active : ''}`}
                          onClick={() => setFixtureFilter('all')}
                          title="Show all fixtures"
                        >
                          <LucideIcon name="List" size={14} />
                          All ({fixtures.length})
                        </button>
                        <button
                          className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'active' ? styles.active : ''}`}
                          onClick={() => setFixtureFilter('active')}
                          title="Show only active fixtures"
                        >
                          <LucideIcon name="Zap" size={14} />
                          Active ({fixtures.filter(f => isFixtureActive(f)).length})
                        </button>
                        {fixtureTypes.length > 0 && (
                          <select
                            value={fixtureFilter === 'byType' ? fixtureTypeFilter : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setFixtureFilter('byType');
                                setFixtureTypeFilter(e.target.value);
                              } else {
                                setFixtureFilter('all');
                                setFixtureTypeFilter('');
                              }
                            }}
                            className={styles.fixtureTypeSelect}
                            title="Filter by fixture type"
                          >
                            <option value="">All Types</option>
                            {fixtureTypes.map(type => (
                              <option key={type} value={type}>
                                {type} ({fixtures.filter(f => f.type === type).length})
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'byRange' ? styles.active : ''}`}
                          onClick={() => setFixtureFilter(fixtureFilter === 'byRange' ? 'all' : 'byRange')}
                          title="Filter by DMX address range"
                        >
                          <LucideIcon name="Filter" size={14} />
                          Range
                        </button>
                      </div>

                      {/* Address Range Filter */}
                      {fixtureFilter === 'byRange' && (
                        <div className={styles.fixtureRangeFilter}>
                          <label>DMX Address Range:</label>
                          <div className={styles.fixtureRangeInputs}>
                            <input
                              type="number"
                              min="1"
                              max="512"
                              value={fixtureAddressRange.start}
                              onChange={(e) => setFixtureAddressRange(prev => ({ ...prev, start: parseInt(e.target.value) || 1 }))}
                              className={styles.fixtureRangeInput}
                              placeholder="Start"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              min="1"
                              max="512"
                              value={fixtureAddressRange.end}
                              onChange={(e) => setFixtureAddressRange(prev => ({ ...prev, end: parseInt(e.target.value) || 512 }))}
                              className={styles.fixtureRangeInput}
                              placeholder="End"
                            />
                            <button
                              onClick={() => setFixtureFilter('all')}
                              className={styles.fixtureRangeClose}
                              title="Close range filter"
                            >
                              <LucideIcon name="X" size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selection Summary and Actions */}
                    <div className={styles.fixtureSelectorHeader}>
                      <div className={styles.fixtureSelectorSummary}>
                        {selectedFixtures.length > 0 ? (
                          <>
                            <span className={styles.fixtureSelectorCount}>
                              {selectedFixtures.length} of {filteredFixtures.length} selected
                            </span>
                            <button
                              className={styles.fixtureSelectorAction}
                              onClick={() => setSelectedFixtures([])}
                              title="Clear selection"
                            >
                              <LucideIcon name="X" size={14} />
                              Clear
                            </button>
                          </>
                        ) : (
                          <span className={styles.fixtureSelectorCount}>
                            {filteredFixtures.length} fixture{filteredFixtures.length !== 1 ? 's' : ''} available
                          </span>
                        )}
                      </div>
                      <div className={styles.fixtureSelectorActions}>
                        <button
                          className={styles.fixtureSelectorAction}
                          onClick={() => {
                            const filteredIds = filteredFixtures.map(f => f.id);
                            if (filteredIds.every(id => selectedFixtures.includes(id))) {
                              setSelectedFixtures(selectedFixtures.filter(id => !filteredIds.includes(id)));
                            } else {
                              setSelectedFixtures([...new Set([...selectedFixtures, ...filteredIds])]);
                            }
                          }}
                          title={filteredFixtures.every(f => selectedFixtures.includes(f.id)) ? 'Deselect filtered' : 'Select all filtered'}
                        >
                          <LucideIcon name={filteredFixtures.every(f => selectedFixtures.includes(f.id)) ? "Square" : "CheckSquare"} size={14} />
                          {filteredFixtures.every(f => selectedFixtures.includes(f.id)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    {/* Groups Section */}
                    {groups && groups.length > 0 && filteredFixtures.length > 0 && (
                      <div className={styles.fixtureSelectorSection}>
                        <div className={styles.fixtureSelectorSectionTitle}>
                          <LucideIcon name="Users" size={16} />
                          <span>Fixture Groups</span>
                        </div>
                        <div className={styles.fixtureSelectorGroupList}>
                          {groups.map((group) => {
                            const groupFixtures = group.fixtureIndices
                              .map(index => fixtures[index])
                              .filter(Boolean)
                              .filter(f => filteredFixtures.includes(f));
                            
                            if (groupFixtures.length === 0) return null;
                            
                            const allGroupFixturesSelected = groupFixtures.length > 0 && 
                              groupFixtures.every(f => selectedFixtures.includes(f.id));
                            const someGroupFixturesSelected = groupFixtures.some(f => selectedFixtures.includes(f.id));
                            
                            return (
                              <button
                                key={group.id}
                                className={`${styles.fixtureSelectorGroupItem} ${allGroupFixturesSelected ? styles.selected : ''} ${someGroupFixturesSelected ? styles.partial : ''}`}
                                onClick={() => {
                                  const groupIds = groupFixtures.map(f => f.id);
                                  if (allGroupFixturesSelected) {
                                    setSelectedFixtures(selectedFixtures.filter(id => !groupIds.includes(id)));
                                  } else {
                                    setSelectedFixtures([...new Set([...selectedFixtures, ...groupIds])]);
                                  }
                                }}
                                title={`${allGroupFixturesSelected ? 'Deselect' : 'Select'} group: ${group.name} (${groupFixtures.length} fixtures)`}
                              >
                                <LucideIcon name="Users" size={14} />
                                <span className={styles.fixtureSelectorGroupName}>{group.name}</span>
                                <span className={styles.fixtureSelectorGroupCount}>
                                  {groupFixtures.length} fixture{groupFixtures.length !== 1 ? 's' : ''}
                                </span>
                                {allGroupFixturesSelected && (
                                  <LucideIcon name="Check" size={14} className={styles.fixtureCheckIcon} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Individual Fixtures Section */}
                    {filteredFixtures.length > 0 ? (
                      <div className={styles.fixtureSelectorSection}>
                        <div className={styles.fixtureSelectorSectionTitle}>
                          <LucideIcon name="LampDesk" size={16} />
                          <span>Fixtures ({filteredFixtures.length})</span>
                        </div>
                        <div className={styles.fixtureSelectorGrid}>
                          {filteredFixtures.map((fixture) => {
                            const isSelected = selectedFixtures.includes(fixture.id);
                            const isActive = isFixtureActive(fixture);
                            const fixtureColor = getFixtureColor(fixture.id);
                            const channelCount = fixture.channels?.length || 0;
                            return (
                              <button
                                key={fixture.id}
                                className={`${styles.fixtureSelectorGridItem} ${isSelected ? styles.selected : ''} ${isActive ? styles.active : ''}`}
                                onClick={() => toggleFixtureSelection(fixture.id)}
                                style={{
                                  borderColor: isSelected ? fixtureColor : isActive ? 'rgba(245, 158, 11, 0.6)' : 'rgba(71, 85, 105, 0.5)',
                                  backgroundColor: isSelected ? `${fixtureColor}20` : isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
                                }}
                                title={`${fixture.name} - DMX ${fixture.startAddress} (${channelCount} ch)${isActive ? ' - Active' : ''}`}
                              >
                                <div className={styles.fixtureGridHeader}>
                                  <div 
                                    className={styles.fixtureColorDot}
                                    style={{ backgroundColor: fixtureColor }}
                                  />
                                  {isActive && (
                                    <div className={styles.fixtureActiveIndicator} title="Active fixture">
                                      <LucideIcon name="Zap" size={12} />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <LucideIcon name="Check" size={16} className={styles.fixtureCheckIcon} />
                                  )}
                                </div>
                                <div className={styles.fixtureGridInfo}>
                                  <div className={styles.fixtureName}>{fixture.name}</div>
                                  <div className={styles.fixtureGridDetails}>
                                    <span className={styles.fixtureAddress}>DMX {fixture.startAddress}</span>
                                    <span className={styles.fixtureChannelCount}>{channelCount} ch</span>
                                    {fixture.type && (
                                      <span className={styles.fixtureType}>{fixture.type}</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.fixtureSelectorEmpty}>
                        <LucideIcon name="SearchX" size={32} />
                        <p>No fixtures match your search or filters</p>
                        <button
                          className={styles.fixtureSelectorAction}
                          onClick={() => {
                            setFixtureSearchTerm('');
                            setFixtureFilter('all');
                            setFixtureTypeFilter('');
                          }}
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className={styles.controlsPanel}>
            {/* View Mode Controls */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>View Mode</label>
              <div className={styles.viewModeButtons}>
                <button
                  className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LucideIcon name="Grid3X3" />
                  Grid
                </button>
                <button
                  className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <LucideIcon name="List" />
                  List
                </button>
                <button
                  className={`${styles.viewModeButton} ${viewMode === 'compact' ? styles.active : ''}`}
                  onClick={() => setViewMode('compact')}
                >
                  <LucideIcon name="Minimize2" />
                  Compact
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Filter</label>
              <div className={styles.filterControls}>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Channels</option>
                  <option value="active">Active Only</option>
                  <option value="selected">Selected Channels Only</option>
                  <option value="selectedFixtures" disabled={selectedFixtures.length === 0}>
                    {selectedFixtures.length > 0 
                      ? `Selected Fixtures (${selectedFixtures.length})` 
                      : 'Selected Fixtures (none selected)'}
                  </option>
                  <option value="range">Range</option>
                </select>

                {/* Active Selections Quick Selector */}
                <button
                  onClick={() => {
                    setFilter('selected');
                    setCurrentPage(0);
                  }}
                  className={`${styles.activeSelectionsButton} ${filter === 'selected' ? styles.active : ''}`}
                  disabled={selectedChannels.length === 0}
                  title={`Show ${selectedChannels.length} selected channel${selectedChannels.length !== 1 ? 's' : ''}`}
                >
                  <LucideIcon name="CheckSquare" />
                  Active Selections ({selectedChannels.length})
                </button>

                {filter === 'range' && (
                  <div className={styles.rangeInputs}>
                    <input
                      type="number"
                      min="1"
                      max="512"
                      value={range.start}
                      onChange={(e) => setRange(prev => ({ ...prev, start: parseInt(e.target.value) || 1 }))}
                      className={styles.rangeInput}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      min="1"
                      max="512"
                      value={range.end}
                      onChange={(e) => setRange(prev => ({ ...prev, end: parseInt(e.target.value) || 512 }))}
                      className={styles.rangeInput}
                    />
                  </div>
                )}

                <div className={styles.searchInput}>
                  <LucideIcon name="Search" />
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchField}
                  />
                </div>
              </div>
            </div>

            {/* Selection Controls */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Selection</label>
              <div className={styles.selectionControls}>
                <button onClick={selectAllChannels} className={styles.selectionButton}>
                  <LucideIcon name="CheckSquare" />
                  Select All
                </button>
                <button onClick={deselectAllChannels} className={styles.selectionButton}>
                  <LucideIcon name="Square" />
                  Deselect All
                </button>
                <span className={styles.selectionCount}>
                  {selectedChannels.length} selected
                </span>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Pagination</label>
              <div className={styles.paginationControls}>
                <select
                  value={channelsPerPage}
                  onChange={(e) => setChannelsPerPage(parseInt(e.target.value))}
                  className={styles.pageSizeSelect}
                >
                  <option value={16}>16 per page</option>
                  <option value={32}>32 per page</option>
                  <option value={64}>64 per page</option>
                  <option value={128}>128 per page</option>
                </select>

                <div className={styles.pageNavigation}>
                  <button
                    onClick={() => handlePageChange('first')}
                    disabled={currentPage === 0}
                    className={styles.pageButton}
                  >
                    <LucideIcon name="ChevronsLeft" />
                  </button>
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={currentPage === 0}
                    className={styles.pageButton}
                  >
                    <LucideIcon name="ChevronLeft" />
                  </button>
                  <span className={styles.pageInfo}>
                    {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange('next')}
                    disabled={currentPage >= totalPages - 1}
                    className={styles.pageButton}
                  >
                    <LucideIcon name="ChevronRight" />
                  </button>
                  <button
                    onClick={() => handlePageChange('last')}
                    disabled={currentPage >= totalPages - 1}
                    className={styles.pageButton}
                  >
                    <LucideIcon name="ChevronsRight" />
                  </button>
                </div>
              </div>
            </div>

            {/* Toggle Controls */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Display Options</label>
              <div className={styles.toggleControls}>
                <button
                  className={`${styles.toggleButton} ${showSceneControls ? styles.active : ''}`}
                  onClick={() => setShowSceneControls(!showSceneControls)}
                >
                  <LucideIcon name="Camera" />
                  Scene Controls
                </button>
                <button
                  className={`${styles.toggleButton} ${showMidiControls ? styles.active : ''}`}
                  onClick={() => setShowMidiControls(!showMidiControls)}
                >
                  <LucideIcon name="Music" />
                  MIDI Controls
                </button>
                {/* Embedded MIDI Monitor toggle removed (floating monitor remains) */}
                <button
                  className={`${styles.toggleButton} ${showOscControls ? styles.active : ''}`}
                  onClick={() => setShowOscControls(!showOscControls)}
                >
                  <LucideIcon name="Globe" />
                  OSC Controls
                </button>
                <button
                  className={`${styles.toggleButton} ${showEnvelopeAutomation ? styles.active : ''}`}
                  onClick={() => setShowEnvelopeAutomation(!showEnvelopeAutomation)}
                >
                  <LucideIcon name="Activity" />
                  Envelope Automation
                </button>
                <button
                  className={`${styles.toggleButton} ${showGlobalChannelNames ? styles.active : ''}`}
                  onClick={() => setShowGlobalChannelNames(!showGlobalChannelNames)}
                >
                  <LucideIcon name="Tag" />
                  Channel Names
                </button>
              </div>
            </div>
          </div>

          {/* Global Channel Names */}
          {showGlobalChannelNames && (
            <div className={styles.globalChannelNamesSection}>
              <GlobalChannelNames />
            </div>
          )}

          {/* Envelope Automation */}
          {showEnvelopeAutomation && (
            <div className={styles.envelopeAutomationSection}>
              <EnvelopeAutomation />
            </div>
          )}

          {/* Scene Controls */}
          {showSceneControls && (
            <div className={styles.sceneControls}>
              <div className={styles.sceneSection}>
                <h3 className={styles.sectionTitle}>
                  <LucideIcon name="Camera" />
                  Scene Management
                </h3>
                <div className={styles.sceneActions}>
                  <button
                    className={styles.sceneButton}
                    onClick={handleSaveScene}
                    title="Save current DMX state as a scene"
                  >
                    <LucideIcon name="Save" />
                    Save Scene
                  </button>

                  {scenes.length > 0 && (
                    <div className={styles.sceneList}>
                      <label className={styles.sceneListLabel}>Load Scene:</label>
                      <div className={styles.sceneButtons}>
                        {scenes.map((scene, index) => (
                          <button
                            key={index}
                            className={styles.loadSceneButton}
                            onClick={() => handleLoadScene(scene.name)}
                            title={`Load scene: ${scene.name}`}
                          >
                            <LucideIcon name="Play" />
                            {scene.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MIDI Connection Controls */}
          {showMidiControls && (
            <div className={styles.midiControls}>
              <div className={styles.midiSection}>
                <h3 className={styles.sectionTitle}>
                  <LucideIcon name="Music" />
                  MIDI Connection
                </h3>

                {browserMidiError && (
                  <div className={styles.errorMessage}>
                    <LucideIcon name="AlertCircle" />
                    MIDI Error: {browserMidiError}
                  </div>
                )}

                {!browserMidiSupported && (
                  <div className={styles.warningMessage}>
                    <LucideIcon name="AlertTriangle" />
                    No MIDI support available
                  </div>
                )}

                {browserMidiSupported && (
                  <div className={styles.midiDevices}>
                    <div className={styles.deviceHeader}>
                      <label className={styles.deviceLabel}>
                        Available MIDI Devices:
                      </label>
                      <button
                        className={styles.refreshButton}
                        onClick={handleRefreshMidiDevices}
                        title="Refresh MIDI devices"
                      >
                        <LucideIcon name="RefreshCw" />
                        Refresh
                      </button>
                    </div>

                    {(() => {
                      const devices = browserInputs;
                      const connectedDevices = activeBrowserInputs;

                      if (devices.length === 0) {
                        return (
                          <div className={styles.noDevices}>
                            No MIDI devices found. Connect a MIDI device and click Refresh.
                          </div>
                        );
                      }

                      return (
                        <div className={styles.deviceList}>
                          {devices.map((input) => {
                            const isConnected = connectedDevices.includes(input.id);
                            return (
                              <div key={input.id} className={styles.deviceItem}>
                                <div className={styles.deviceInfo}>
                                  <span className={styles.deviceName}>{input.name}</span>
                                  <span className={styles.deviceId}>{input.id}</span>
                                </div>
                                <div className={styles.deviceActions}>
                                  {isConnected ? (
                                    <button
                                      className={styles.disconnectButton}
                                      onClick={() => handleMidiDisconnect(input.id)}
                                      title="Disconnect MIDI device"
                                    >
                                      <LucideIcon name="X" />
                                      Disconnect
                                    </button>
                                  ) : (
                                    <button
                                      className={styles.connectButton}
                                      onClick={() => handleMidiConnect(input.id)}
                                      title="Connect MIDI device"
                                    >
                                      <LucideIcon name="Link" />
                                      Connect
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embedded MIDI Monitor section removed */}

          {/* Pinned Channels Section */}
          {pinnedChannels && pinnedChannels.length > 0 && (
            <div className={styles.sceneSection}>
              <h3 className={styles.sectionTitle}>
                <LucideIcon name="Pin" />
                Pinned Channels
                <span className={styles.activeCount}>({pinnedChannels.length})</span>
              </h3>
              <div className={styles.pinnedChannelsContainer}>
                {pinnedChannels.map(channelIndex => {
                  const value = dmxChannels[channelIndex] || 0;
                  const fixtureInfo = getChannelInfo(channelIndex);
                  const hasFixtureAssignment = isChannelAssigned(channelIndex);
                  const fixtureColor = fixtureInfo ? getFixtureColor(fixtureInfo.fixtureId) : '#64748b';
                  const channelName = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
                  const hasMidiMapping = !!midiMappings[channelIndex];
                  const mapping = midiMappings[channelIndex];
                  const oscAddress = oscAssignments[channelIndex];
                  const channelRange = getChannelRange(channelIndex);

                  return (
                    <div
                      key={channelIndex}
                      className={styles.pinnedChannel}
                      style={{
                        borderLeftColor: hasFixtureAssignment ? fixtureColor : '#10b981',
                        borderLeftWidth: '4px',
                      }}
                    >
                      <div className={styles.pinnedChannelHeader}>
                        <span className={styles.channelNumber}>CH {channelIndex + 1}</span>
                        {hasFixtureAssignment && (
                          <span className={styles.fixtureBadge} style={{ backgroundColor: fixtureColor }}>
                            {fixtureInfo?.fixtureName}
                          </span>
                        )}
                        <div className={styles.pinnedChannelActions}>
                          <button
                            className={styles.jumpToChannelButton}
                            onClick={() => scrollToChannel(channelIndex)}
                            title="Jump to this channel in the main list"
                          >
                            <LucideIcon name="ArrowRight" size={14} />
                          </button>
                          <button
                            className={styles.unpinButton}
                            onClick={() => togglePinChannel(channelIndex)}
                            title="Unpin channel"
                          >
                            <LucideIcon name="X" size={14} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.pinnedChannelInfo}>
                        {hasFixtureAssignment ? (
                          <>
                            <span className={styles.channelFunction}>{fixtureInfo?.channelName}</span>
                            <span className={styles.channelTypeSmall}>{fixtureInfo?.channelType}</span>
                          </>
                        ) : (
                          <span className={styles.channelFunction}>{channelName}</span>
                        )}
                      </div>

                      {/* Main Slider */}
                      <div className={styles.pinnedSliderContainer}>
                        <input
                          type="range"
                          min={channelRange.min}
                          max={channelRange.max}
                          value={value}
                          onChange={(e) => setDmxChannel(channelIndex, parseInt(e.target.value))}
                          className={styles.pinnedSlider}
                        />
                        <span className={styles.pinnedValue}>{value}</span>
                      </div>

                      {/* Range Controls */}
                      <div className={styles.pinnedRangeControls}>
                        <div className={styles.pinnedRangeGroup}>
                          <label>MIN</label>
                          <input
                            type="number"
                            min="0"
                            max="255"
                            value={channelRange.min}
                            onChange={(e) => {
                              const newMin = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                              setChannelRange(channelIndex, newMin, Math.max(newMin, channelRange.max));
                            }}
                            className={styles.pinnedRangeInput}
                          />
                        </div>
                        <div className={styles.pinnedRangeGroup}>
                          <label>MAX</label>
                          <input
                            type="number"
                            min="0"
                            max="255"
                            value={channelRange.max}
                            onChange={(e) => {
                              const newMax = Math.max(0, Math.min(255, parseInt(e.target.value) || 255));
                              setChannelRange(channelIndex, Math.min(channelRange.min, newMax), newMax);
                            }}
                            className={styles.pinnedRangeInput}
                          />
                        </div>
                      </div>

                      {/* OSC Address */}
                      {showOscControls && (
                        <div className={styles.pinnedOscControl}>
                          <label>OSC</label>
                          <input
                            type="text"
                            value={oscAddress}
                            onChange={(e) => setOscAssignment(channelIndex, e.target.value)}
                            className={styles.pinnedOscInput}
                            placeholder="/osc/address"
                          />
                        </div>
                      )}

                      {/* MIDI Learn/Forget */}
                      {showMidiControls && (
                        <div className={styles.pinnedMidiControls}>
                          {hasMidiMapping ? (
                            <>
                              <div className={styles.pinnedMidiInfo}>
                                <span>MIDI: Ch{mapping.channel + 1} CC{mapping.controller}</span>
                              </div>
                              <button
                                className={styles.pinnedMidiForget}
                                onClick={() => removeMidiMapping(channelIndex)}
                                title="Forget MIDI mapping"
                              >
                                <LucideIcon name="Trash2" size={12} />
                                Forget
                              </button>
                            </>
                          ) : (
                            <button
                              className={styles.pinnedMidiLearn}
                              onClick={() => startLearn(channelIndex)}
                              title="Learn MIDI mapping"
                            >
                              <LucideIcon name="Radio" size={12} />
                              Learn
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active DMX Channels Summary - Always Visible */}
          {(() => {
            const activeChannels = Array.from({ length: 512 }, (_, i) => i).filter(i => (dmxChannels[i] || 0) > 0);
            const activeChannelsSet = new Set(activeChannels);

            return (
              <div className={styles.sceneSection}>
                <h3 className={styles.sectionTitle}>
                  <LucideIcon name="Zap" />
                  Active Channels
                  <span className={styles.activeCount}>({activeChannels.length})</span>
                </h3>
                <div className={styles.activeChannelsContainer}>
                  {/* Visual Grid Representation - Always show grid */}
                  <div className={styles.channelsGrid}>
                    {Array.from({ length: 512 }, (_, i) => {
                      const isActive = activeChannelsSet.has(i);
                      const value = dmxChannels[i] || 0;
                      const intensity = value / 255;
                      const channelColor = channelColors[i] || '';
                      const hasName = !!(channelNames[i] &&
                        channelNames[i] !== `CH ${i + 1}` &&
                        channelNames[i] !== `Channel ${i + 1}` &&
                        channelNames[i].trim() !== '');

                      // Use custom color if set, otherwise use default behavior
                      const backgroundColor = channelColor
                        ? channelColor // Show color even when inactive
                        : (isActive
                          ? `hsl(${(i * 137.5) % 360}, 70%, ${50 + (intensity * 30)}%)`
                          : 'transparent');

                      return (
                        <div
                          key={i}
                          className={`${styles.channelCell} ${isActive ? styles.active : ''} ${hasName ? styles.hasName : ''}`}
                          style={{
                            opacity: isActive ? 0.3 + (intensity * 0.7) : (channelColor ? 0.2 : 0.1),
                            backgroundColor: backgroundColor,
                            borderColor: hasName ? channelColor || '#10b981' : undefined,
                            borderWidth: hasName ? '2px' : undefined,
                          }}
                          title={`Channel ${i + 1}: ${value > 0 ? `${value} (${Math.round(intensity * 100)}%)` : 'Inactive'}${hasName ? ` - ${channelNames[i]}` : ''}`}
                          onClick={() => scrollToChannel(i)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setRandomChannelColor(i);
                          }}
                        >
                          {isActive && (
                            <span className={styles.channelNumber}>{i + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Compact Text List - Only show if there are active channels */}
                  {activeChannels.length > 0 && (
                    <div className={styles.channelsList}>
                      <div className={styles.listHeader}>
                        <span>Active Channel Numbers:</span>
                        <span className={styles.channelCount}>{activeChannels.length} channels</span>
                      </div>
                      <div className={styles.channelTags}>
                        {activeChannels.map((i) => {
                          const value = dmxChannels[i] || 0;
                          const intensity = value / 255;
                          return (
                            <span
                              key={i}
                              className={styles.channelTag}
                              style={{
                                opacity: 0.7 + (intensity * 0.3),
                                backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, ${50 + (intensity * 20)}%)`,
                                cursor: 'pointer'
                              }}
                              title={`CH ${i + 1}: ${value} (${Math.round(intensity * 100)}%) - Click to scroll to slider`}
                              onClick={() => scrollToChannel(i)}
                            >
                              CH {i + 1}
                              <span className={styles.channelValue}>{value}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {activeChannels.length === 0 && (
                    <div className={styles.noActiveChannels}>No active channels (Idle)</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* DMX Channels Display */}
          <div className={`${styles.dmxChannelsContainer} ${styles[viewMode]}`}>
            {displayedChannels.map(channelIndex => {
              const value = dmxChannels[channelIndex] || 0;
              const channelName = channelNames[channelIndex] || `Channel ${channelIndex + 1}`;
              const isSelected = selectedChannels.includes(channelIndex);
              const hasMidiMapping = !!midiMappings[channelIndex];
              const isChannelLearning = isLearning && currentLearningChannel === channelIndex;
              const mapping = midiMappings[channelIndex];

              // Use new store helper functions
              const fixtureInfo = getChannelInfo(channelIndex);
              const hasFixtureAssignment = isChannelAssigned(channelIndex);
              const fixtureColor = fixtureInfo ? getFixtureColor(fixtureInfo.fixtureId) : '#64748b';

              const isEditingName = editingChannelName === channelIndex;

              // Check if channel has a custom name (not default)
              const hasCustomName = !!(channelNames[channelIndex] &&
                channelNames[channelIndex] !== `CH ${channelIndex + 1}` &&
                channelNames[channelIndex] !== `Channel ${channelIndex + 1}` &&
                channelNames[channelIndex].trim() !== '');

              return (
                <div
                  key={channelIndex}
                  id={`dmx-channel-${channelIndex}`}
                  className={`${styles.dmxChannel} ${isSelected ? styles.selected : ''} ${value > 0 ? styles.active : ''} ${highlightedChannel === channelIndex ? styles.highlighted : ''} ${hasCustomName ? styles.hasName : ''} ${hasFixtureAssignment ? styles.fixtureAssigned : ''} ${channelColors[channelIndex] ? styles.hasColor : ''}`}
                  style={{
                    borderColor: hasFixtureAssignment
                      ? fixtureColor
                      : (channelColors[channelIndex] || (hasCustomName ? '#10b981' : undefined)),
                    borderWidth: channelColors[channelIndex] 
                      ? '4px' 
                      : (hasFixtureAssignment || hasCustomName ? '2px' : undefined),
                    borderLeftWidth: hasFixtureAssignment ? '4px' : (channelColors[channelIndex] ? '6px' : undefined),
                    backgroundColor: channelColors[channelIndex] && !hasFixtureAssignment 
                      ? `${channelColors[channelIndex]}25` 
                      : (hasFixtureAssignment && fixtureColor
                        ? `${fixtureColor}15`
                        : undefined),
                    // Add a subtle gradient overlay for better visibility
                    backgroundImage: channelColors[channelIndex] && !hasFixtureAssignment
                      ? `linear-gradient(135deg, ${channelColors[channelIndex]}20 0%, ${channelColors[channelIndex]}10 100%)`
                      : (hasFixtureAssignment && fixtureColor
                        ? `linear-gradient(135deg, ${fixtureColor}12 0%, ${fixtureColor}08 100%)`
                        : undefined),
                  }}
                >
                  <div className={styles.channelHeader}>
                    <div className={styles.channelInfo}>
                      <span className={styles.channelNumber}>{channelIndex + 1}</span>
                      {hasFixtureAssignment && fixtureInfo && (
                        <div className={styles.fixtureLabel} style={{ color: fixtureColor }}>
                          <LucideIcon name="LampDesk" size={12} />
                          <span>{fixtureInfo.fixtureName}</span>
                          {fixtureInfo.channelName && (
                            <span className={styles.fixtureChannelFunction}> • {fixtureInfo.channelName}</span>
                          )}
                        </div>
                      )}
                      {isEditingName ? (
                        <div className={styles.channelNameEdit}>
                          <input
                            type="text"
                            value={editingChannelNameValue}
                            onChange={(e) => setEditingChannelNameValue(e.target.value)}
                            onBlur={() => handleSaveChannelName(channelIndex)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveChannelName(channelIndex);
                              } else if (e.key === 'Escape') {
                                handleCancelEditName();
                              }
                            }}
                            autoFocus
                            className={styles.channelNameInput}
                          />
                        </div>
                      ) : (
                        <div className={styles.channelNameWrapper}>
                          <span
                            className={styles.channelName}
                            onDoubleClick={(e) => handleStartEditName(channelIndex, e)}
                            title={hasFixtureAssignment
                              ? `Fixture: ${fixtureInfo?.fixtureName} | Channel: ${fixtureInfo?.channelName} | Type: ${fixtureInfo?.channelType}${channelName ? ` | Custom: ${channelName}` : ''} | Double-click to edit`
                              : 'Double-click to edit name'}
                            style={{ cursor: 'pointer' }}
                          >
                            {hasFixtureAssignment
                              ? fixtureInfo?.channelName
                              : (channelName || `CH ${channelIndex + 1}`)}
                            <small>{value > 0 ? 'Active' : '(Idle)'}</small>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.channelHeaderActions}>
                      {(() => {
                        // Find envelope for this channel
                        const channelEnvelope = envelopeAutomation.envelopes.find(e => e.channel === channelIndex);
                        const hasEnvelope = !!channelEnvelope;
                        const envelopeEnabled = channelEnvelope?.enabled ?? false;

                        if (hasEnvelope) {
                          return (
                            <button
                              className={`${styles.envelopeToggleButton} ${envelopeEnabled ? styles.active : ''}`}
                              onClick={() => channelEnvelope && toggleEnvelope(channelEnvelope.id)}
                              title={envelopeEnabled ? 'Stop Envelope' : 'Start Envelope'}
                              disabled={!envelopeAutomation.globalEnabled}
                            >
                              <LucideIcon name={envelopeEnabled ? "Square" : "Play"} size={14} />
                              {envelopeEnabled ? 'Stop' : 'Start'}
                            </button>
                          );
                        }
                        return null;
                      })()}
                      <div className={styles.channelValue}>
                        <span className={styles.valueDisplay}>{value}</span>
                        <span className={styles.valuePercent}>{Math.round((value / 255) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.channelSlider}>
                    <input
                      type="range"
                      min={getChannelRange(channelIndex).min}
                      max={getChannelRange(channelIndex).max}
                      value={value}
                      onChange={(e) => setDmxChannel(channelIndex, parseInt(e.target.value))}
                      className={styles.slider}
                    />
                  </div>

                  {/* Channel Range Controls */}
                  <div className={styles.channelRangeControls}>
                    <div className={styles.rangeInputGroup}>
                      <label className={styles.rangeLabel}>MIN</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={getChannelRange(channelIndex).min}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value);
                          const currentMax = getChannelRange(channelIndex).max;
                          setChannelRange(channelIndex, newMin, Math.max(newMin, currentMax));
                        }}
                        className={styles.rangeSlider}
                      />
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={getChannelRange(channelIndex).min}
                        onChange={(e) => {
                          const newMin = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                          const currentMax = getChannelRange(channelIndex).max;
                          setChannelRange(channelIndex, newMin, Math.max(newMin, currentMax));
                        }}
                        className={styles.rangeInput}
                      />
                    </div>
                    <div className={styles.rangeInputGroup}>
                      <label className={styles.rangeLabel}>MAX</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={getChannelRange(channelIndex).max}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value);
                          const currentMin = getChannelRange(channelIndex).min;
                          setChannelRange(channelIndex, Math.min(currentMin, newMax), newMax);
                        }}
                        className={styles.rangeSlider}
                      />
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={getChannelRange(channelIndex).max}
                        onChange={(e) => {
                          const newMax = Math.max(0, Math.min(255, parseInt(e.target.value) || 255));
                          const currentMin = getChannelRange(channelIndex).min;
                          setChannelRange(channelIndex, Math.min(currentMin, newMax), newMax);
                        }}
                        className={styles.rangeInput}
                      />
                    </div>
                  </div>

                  <div 
                    className={styles.channelActions}
                    style={channelColors[channelIndex] ? {
                      backgroundColor: `${channelColors[channelIndex]}08`,
                      borderColor: `${channelColors[channelIndex]}20`,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderRadius: '8px',
                      padding: '8px',
                    } : undefined}
                  >
                    <button
                      className={`${styles.selectButton} ${isSelected ? styles.selected : ''}`}
                      onClick={() => toggleChannelSelection(channelIndex)}
                      title="Select/Deselect channel"
                    >
                      <LucideIcon name={isSelected ? "CheckSquare" : "Square"} />
                    </button>

                    <button
                      className={styles.colorButton}
                      onClick={() => {
                        setRandomChannelColor(channelIndex);
                        addNotification({
                          type: 'success',
                          message: `Random color set for channel ${channelIndex + 1}`
                        });
                      }}
                      title="Set random color for this channel (for visual organization)"
                      style={{
                        backgroundColor: channelColors[channelIndex] 
                          ? `${channelColors[channelIndex]}20` 
                          : undefined,
                        borderColor: channelColors[channelIndex] || undefined,
                        borderWidth: channelColors[channelIndex] ? '1px' : undefined,
                      }}
                    >
                      <LucideIcon name="Palette" />
                    </button>

                    <button
                      className={`${styles.pinButton} ${pinnedChannels?.includes(channelIndex) ? styles.pinned : ''}`}
                      onClick={() => togglePinChannel(channelIndex)}
                      title={pinnedChannels?.includes(channelIndex) ? "Unpin channel" : "Pin channel to left sidebar"}
                    >
                      <LucideIcon name={pinnedChannels?.includes(channelIndex) ? "Pin" : "PinOff"} />
                    </button>

                    {showMidiControls && (
                      <div className={styles.midiControls}>
                        <button
                          className={`${styles.midiLearnButton} ${isChannelLearning ? styles.learning : ''} ${hasMidiMapping ? styles.mapped : ''}`}
                          onClick={() => handleMidiLearn(channelIndex)}
                          title={isChannelLearning ? 'Cancel MIDI Learn' : hasMidiMapping ? 'Remap MIDI' : 'Learn MIDI'}
                        >
                          <LucideIcon name={isChannelLearning ? "Radio" : hasMidiMapping ? "Unlink" : "Link"} />
                          {isChannelLearning ? 'Learning...' : hasMidiMapping ? 'Mapped' : 'Learn'}
                        </button>

                        {hasMidiMapping && !isChannelLearning && (
                          <button
                            className={styles.midiForgetButton}
                            onClick={() => handleMidiForget(channelIndex)}
                            title="Remove MIDI mapping"
                          >
                            <LucideIcon name="Trash2" />
                            Forget
                          </button>
                        )}
                      </div>
                    )}

                    {showOscControls && (
                      <div className={styles.oscControls}>
                        <button
                          className={styles.oscAddressButton}
                          onClick={() => handleSetOscAddress(channelIndex)}
                          title="Set OSC address for this channel"
                        >
                          <LucideIcon name="Globe" />
                          OSC
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MIDI Mapping Display */}
                  {showMidiControls && hasMidiMapping && mapping && (
                    <div className={styles.midiMappingDisplay}>
                      <span className={styles.midiMappingText}>
                        {mapping.controller !== undefined
                          ? `CC ${mapping.controller} (Ch ${mapping.channel + 1})`
                          : `Note ${mapping.note} (Ch ${mapping.channel + 1})`
                        }
                      </span>
                    </div>
                  )}

                  {/* OSC Address Display */}
                  {showOscControls && oscAssignments[channelIndex] && (
                    <div className={styles.oscAddressDisplay}>
                      <span className={styles.oscAddressText}>
                        OSC: {oscAssignments[channelIndex]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className={styles.footer}>
            <div className={styles.footerInfo}>
              <span>Showing {displayedChannels.length} of {filteredChannels.length} channels</span>
              <span>•</span>
              <span>Page {currentPage + 1} of {totalPages}</span>
              <span>•</span>
              <span>{Object.keys(midiMappings).length} MIDI mappings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DmxChannelControlPage;

