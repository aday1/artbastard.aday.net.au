import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useStore } from '../../store';
import { useMidiLearn } from '../../hooks/useMidiLearn';
import { useGlobalBrowserMidi } from '../../hooks/useGlobalBrowserMidi';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from '../../context/RouterContext';
import { useMobile } from '../../hooks/useMobile';
import {
  DMX_EDIT_CHANNEL_NAME,
  useAppContextMenu,
} from '../../context/ContextMenuContext';
import { AutomationWorkbench } from '../automation/AutomationWorkbench';
import { GlobalChannelNames } from '../channels/GlobalChannelNames';
import { DmxControlsPanel } from '../dmx/DmxControlsPanel';
import { DmxFixtureSelector } from '../dmx/DmxFixtureSelector';
import { DmxSceneControls } from '../dmx/DmxSceneControls';
import { DmxFooterInfo } from '../dmx/DmxFooterInfo';
import { DmxMidiConnections } from '../dmx/DmxMidiConnections';
import { DmxPinnedChannels } from '../dmx/DmxPinnedChannels';
import { DmxActiveChannelsSummary } from '../dmx/DmxActiveChannelsSummary';
import { DmxChannelsViewport } from '../dmx/DmxChannelsViewport';
import { DmxPageHeader } from '../dmx/DmxPageHeader';
import { filterDmxChannels, filterFixtures, isFixtureActive } from '../dmx/dmxFiltering';
import styles from './DmxChannelControlPage.module.scss';
import pageStyles from '../../pages/Pages.module.scss';
import { useSceneCapture } from '../../hooks/useSceneCapture';

export const DmxChannelControlPage: React.FC = () => {
  const { theme } = useTheme();
  const { openAppMenu, openChannelMenu, openFixtureMenu } = useAppContextMenu();
  const { isMobile, isTablet, isTouch } = useMobile();

  // Adapt defaults to viewport. On phones and tablets a fully expanded
  // page with eight optional sections + 64 channels per page produces
  // a wall of UI that is unusable. Start with the essentials shown
  // (the channel grid) and let the user expand on demand.
  const compactByDefault = isMobile || isTablet;

  // State management
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(
    compactByDefault ? 'compact' : 'grid'
  );
  const [filter, setFilter] = useState<'all' | 'active' | 'selected' | 'range' | 'selectedFixtures'>('all');
  const [range, setRange] = useState({ start: 1, end: 32 });
  const [searchTerm, setSearchTerm] = useState('');
  const [channelsPerPage, setChannelsPerPage] = useState(compactByDefault ? 32 : 64);
  const [currentPage, setCurrentPage] = useState(0);
  const [showSceneControls, setShowSceneControls] = useState(!compactByDefault);
  const [showMidiControls, setShowMidiControls] = useState(false);
  const [showOscControls, setShowOscControls] = useState(!compactByDefault);
  const [showEnvelopeAutomation, setShowEnvelopeAutomation] = useState(!compactByDefault);
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
    loadScene,
    addNotification,

    channelJumpTarget,
    dmxFaderOrientation: faderOrientation,
    setDmxFaderOrientation: handleFaderOrientationChange,
    dmxChannelsPerRow,
    setDmxChannelsPerRow,
    getChannelTicksOnly,
    setChannelTicksOnly,
    getChannelAuxFullFader,
    toggleChannelAuxFullFader,
  } = useStore();

  useEffect(() => {
    document.body.classList.toggle('dmx-faders-vertical', faderOrientation === 'vertical');
    return () => document.body.classList.remove('dmx-faders-vertical');
  }, [faderOrientation]);

  // Listen for channel jump requests (e.g. from PinnedChannels sidebar)
  useEffect(() => {
    if (channelJumpTarget !== null) {
      scrollToChannel(channelJumpTarget);
    }
  }, [channelJumpTarget]);

  useEffect(() => {
    const onRename = (ev: Event) => {
      const detail = (ev as CustomEvent<{ channelIndex: number }>).detail;
      if (detail == null || typeof detail.channelIndex !== 'number') return;
      const channelIndex = detail.channelIndex;
      setEditingChannelName(channelIndex);
      setEditingChannelNameValue(
        channelNames[channelIndex] || `Channel ${channelIndex + 1}`
      );
      scrollToChannel(channelIndex);
    };
    window.addEventListener(DMX_EDIT_CHANNEL_NAME, onRename);
    return () => window.removeEventListener(DMX_EDIT_CHANNEL_NAME, onRename);
  }, [channelNames]);

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


  const filteredChannels = useMemo(() => filterDmxChannels({
    filter,
    dmxChannels,
    selectedChannels,
    selectedFixtures,
    fixtures,
    range,
    searchTerm,
    channelNames,
  }), [filter, dmxChannels, selectedChannels, selectedFixtures, fixtures, range, searchTerm, channelNames]);
  const totalPages = Math.ceil(filteredChannels.length / channelsPerPage);
  const startIndex = currentPage * channelsPerPage;
  const endIndex = Math.min(startIndex + channelsPerPage, filteredChannels.length);
  const displayedChannels = filteredChannels.slice(startIndex, endIndex);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [filter, range, searchTerm, selectedFixtures]);

  const filteredFixtures = useMemo(() => filterFixtures({
    fixtures,
    dmxChannels,
    fixtureSearchTerm,
    fixtureFilter,
    fixtureTypeFilter,
    fixtureAddressRange,
  }), [fixtures, dmxChannels, fixtureSearchTerm, fixtureFilter, fixtureTypeFilter, fixtureAddressRange]);

  const fixtureTypes = useMemo(() => Array.from(new Set(fixtures.map(f => f.type).filter(Boolean))).sort(), [fixtures]);

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
    if (isLearning && currentLearningChannel === channelIndex) {
      cancelLearn();
    } else {
      startLearn(channelIndex);
    }
  };

  const handleMidiForget = (channelIndex: number) => {
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

  const { captureScene, sceneNameToOscPath } = useSceneCapture();

  const handleSaveScene = () => {
    const sceneName = prompt('Enter scene name:');
    if (!sceneName?.trim()) return;
    const oscDefault = sceneNameToOscPath(sceneName);
    const oscInput = prompt('Enter OSC address (optional):', oscDefault);
    if (oscInput === null) return;
    captureScene({
      name: sceneName.trim(),
      oscAddress: oscInput.trim() || oscDefault,
      notify: true,
    });
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
  const handleRenameFixture = useCallback((fixtureId: string, newName: string) => {
    const state = useStore.getState();
    const updated = state.fixtures.map((f) =>
      f.id === fixtureId ? { ...f, name: newName } : f
    );
    useStore.setState({ fixtures: updated });
    try {
      localStorage.setItem('artbastard-fixtures', JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    const row = updated.find((f) => f.id === fixtureId);
    if (row) {
      axios.post(`/api/fixtures/${row.id}`, row).catch(() => undefined);
    }
    addNotification({
      message: `Fixture renamed to "${newName}"`,
      type: 'success',
      priority: 'normal',
    });
  }, [addNotification]);

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
        <div
          ref={pageRef}
          className={styles.dmxChannelControlPage}
          onContextMenu={openAppMenu}
        >
          <DmxPageHeader
            theme={theme}
            activeChannelCount={Object.values(dmxChannels).filter((v) => v > 0).length}
            selectedFixturesCount={selectedFixtures.length}
            selectedChannelsCount={selectedChannels.length}
            midiMappingsCount={Object.keys(midiMappings).length}
            isLearning={isLearning}
            currentLearningChannel={currentLearningChannel}
            faderOrientation={faderOrientation}
            onFaderOrientationChange={handleFaderOrientationChange}
            fixtureSelector={(
              <DmxFixtureSelector
                fixtures={fixtures}
                groups={groups}
                selectedFixtures={selectedFixtures}
                setSelectedFixtures={setSelectedFixtures}
                toggleFixtureSelection={toggleFixtureSelection}
                showFixtureSelector={showFixtureSelector}
                setShowFixtureSelector={setShowFixtureSelector}
                fixtureSelectorRef={fixtureSelectorRef}
                fixtureSearchTerm={fixtureSearchTerm}
                setFixtureSearchTerm={setFixtureSearchTerm}
                fixtureFilter={fixtureFilter}
                setFixtureFilter={setFixtureFilter}
                fixtureTypeFilter={fixtureTypeFilter}
                setFixtureTypeFilter={setFixtureTypeFilter}
                fixtureAddressRange={fixtureAddressRange}
                setFixtureAddressRange={setFixtureAddressRange}
                fixtureTypes={fixtureTypes}
                filteredFixtures={filteredFixtures}
                isFixtureActive={(fixture) => isFixtureActive(fixture, dmxChannels)}
                getFixtureColor={getFixtureColor}
                onFixtureContextMenu={(e, fixture) =>
                  openFixtureMenu(e, fixture, handleRenameFixture)
                }
              />
            )}
          />

          <DmxControlsPanel
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            faderOrientation={faderOrientation}
            onFaderOrientationChange={handleFaderOrientationChange}
            channelsPerRow={dmxChannelsPerRow}
            onChannelsPerRowChange={setDmxChannelsPerRow}
            filter={filter}
            onFilterChange={(nextFilter) => setFilter(nextFilter)}
            selectedFixturesCount={selectedFixtures.length}
            selectedChannelsCount={selectedChannels.length}
            range={range}
            onRangeChange={setRange}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onShowSelectedOnly={() => {
              setFilter('selected');
              setCurrentPage(0);
            }}
            onSelectAllChannels={selectAllChannels}
            onDeselectAllChannels={deselectAllChannels}
            channelsPerPage={channelsPerPage}
            onChannelsPerPageChange={setChannelsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            showSceneControls={showSceneControls}
            onToggleSceneControls={() => setShowSceneControls(!showSceneControls)}
            showMidiControls={showMidiControls}
            onToggleMidiControls={() => setShowMidiControls(!showMidiControls)}
            showOscControls={showOscControls}
            onToggleOscControls={() => setShowOscControls(!showOscControls)}
            showEnvelopeAutomation={showEnvelopeAutomation}
            onToggleEnvelopeAutomation={() => setShowEnvelopeAutomation(!showEnvelopeAutomation)}
            showGlobalChannelNames={showGlobalChannelNames}
            onToggleGlobalChannelNames={() => setShowGlobalChannelNames(!showGlobalChannelNames)}
          />

          {/* Global Channel Names */}
          {showGlobalChannelNames && (
            <div className={styles.globalChannelNamesSection}>
              <GlobalChannelNames />
            </div>
          )}

          {/* Envelope Automation */}
          {showEnvelopeAutomation && (
            <div className={styles.envelopeAutomationSection}>
              <AutomationWorkbench />
            </div>
          )}

          {/* Scene Controls */}
          {showSceneControls && (
            <DmxSceneControls
              scenes={scenes}
              onSaveScene={handleSaveScene}
              onLoadScene={handleLoadScene}
            />
          )}

          {/* MIDI Connection Controls */}
          {showMidiControls && (
            <DmxMidiConnections
              browserMidiError={browserMidiError}
              browserMidiSupported={browserMidiSupported}
              browserInputs={browserInputs}
              activeBrowserInputs={activeBrowserInputs}
              onRefreshMidiDevices={handleRefreshMidiDevices}
              onConnectMidiDevice={handleMidiConnect}
              onDisconnectMidiDevice={handleMidiDisconnect}
            />
          )}

          {/* Embedded MIDI Monitor section removed */}

          {/* Pinned Channels Section */}
          <DmxPinnedChannels
            pinnedChannels={pinnedChannels || []}
            dmxChannels={dmxChannels}
            channelNames={channelNames}
            midiMappings={midiMappings}
            oscAssignments={oscAssignments}
            showOscControls={showOscControls}
            showMidiControls={showMidiControls}
            getChannelInfo={getChannelInfo}
            isChannelAssigned={isChannelAssigned}
            getFixtureColor={getFixtureColor}
            getChannelRange={getChannelRange}
            setDmxChannel={setDmxChannel}
            setChannelRange={setChannelRange}
            setOscAssignment={setOscAssignment}
            removeMidiMapping={removeMidiMapping}
            startLearn={startLearn}
            scrollToChannel={scrollToChannel}
            togglePinChannel={togglePinChannel}
            verticalFaders={faderOrientation === 'vertical'}
            getChannelTicksOnly={getChannelTicksOnly}
            setChannelTicksOnly={setChannelTicksOnly}
            getChannelAuxFullFader={getChannelAuxFullFader}
            toggleChannelAuxFullFader={toggleChannelAuxFullFader}
          />

          {/* Active DMX Channels Summary - Always Visible */}
          <DmxActiveChannelsSummary
            dmxChannels={dmxChannels}
            channelColors={channelColors}
            channelNames={channelNames}
            onScrollToChannel={scrollToChannel}
            onChannelContextMenu={openChannelMenu}
          />

          {/* DMX Channels Display */}
          <DmxChannelsViewport
            viewMode={viewMode}
            faderOrientation={faderOrientation}
            displayedChannels={displayedChannels}
            dmxChannels={dmxChannels}
            channelNames={channelNames}
            selectedChannels={selectedChannels}
            highlightedChannel={highlightedChannel}
            channelColors={channelColors}
            pinnedChannels={pinnedChannels || []}
            midiMappings={midiMappings}
            oscAssignments={oscAssignments}
            isLearning={isLearning}
            currentLearningChannel={currentLearningChannel}
            showMidiControls={showMidiControls}
            showOscControls={showOscControls}
            editingChannelName={editingChannelName}
            editingChannelNameValue={editingChannelNameValue}
            setEditingChannelNameValue={setEditingChannelNameValue}
            getChannelRange={getChannelRange}
            setChannelRange={setChannelRange}
            setDmxChannel={setDmxChannel}
            handleSaveChannelName={handleSaveChannelName}
            handleCancelEditName={handleCancelEditName}
            handleStartEditName={handleStartEditName}
            toggleChannelSelection={toggleChannelSelection}
            setRandomChannelColor={setRandomChannelColor}
            addNotification={(payload) => addNotification({ ...payload, priority: 'normal' })}
            togglePinChannel={togglePinChannel}
            handleMidiLearn={handleMidiLearn}
            handleMidiForget={handleMidiForget}
            handleSetOscAddress={handleSetOscAddress}
            getChannelInfo={getChannelInfo}
            isChannelAssigned={isChannelAssigned}
            getFixtureColor={getFixtureColor}
            channelsPerRow={dmxChannelsPerRow}
            getChannelTicksOnly={getChannelTicksOnly}
            setChannelTicksOnly={setChannelTicksOnly}
            getChannelAuxFullFader={getChannelAuxFullFader}
            toggleChannelAuxFullFader={toggleChannelAuxFullFader}
            onChannelContextMenu={openChannelMenu}
          />

          {/* Footer Info */}
          <DmxFooterInfo
            displayedCount={displayedChannels.length}
            filteredCount={filteredChannels.length}
            currentPage={currentPage}
            totalPages={totalPages}
            midiMappingCount={Object.keys(midiMappings).length}
          />
        </div>
      </div>
    </div>
  );
};

export default DmxChannelControlPage;

