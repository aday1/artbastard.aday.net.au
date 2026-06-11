import React from 'react';
import { DmxChannelCard } from './DmxChannelCard';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxChannelsViewportProps {
  viewMode: 'grid' | 'list' | 'compact';
  faderOrientation?: 'horizontal' | 'vertical';
  displayedChannels: number[];
  dmxChannels: number[];
  channelNames: string[];
  selectedChannels: number[];
  highlightedChannel: number | null;
  channelColors: Record<number, string>;
  pinnedChannels: number[];
  midiMappings: Record<number, any>;
  oscAssignments: string[];
  isLearning: boolean;
  currentLearningChannel: number | null;
  showMidiControls: boolean;
  showOscControls: boolean;
  editingChannelName: number | null;
  editingChannelNameValue: string;
  setEditingChannelNameValue: (value: string) => void;
  getChannelRange: (channelIndex: number) => { min: number; max: number };
  setChannelRange: (channelIndex: number, min: number, max: number) => void;
  setDmxChannel: (channelIndex: number, value: number) => void;
  handleSaveChannelName: (channelIndex: number) => void;
  handleCancelEditName: () => void;
  handleStartEditName: (channelIndex: number, event: React.MouseEvent) => void;
  toggleChannelSelection: (channelIndex: number) => void;
  setRandomChannelColor: (channelIndex: number) => void;
  addNotification: (payload: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
  togglePinChannel: (channelIndex: number) => void;
  handleMidiLearn: (channelIndex: number) => void;
  handleMidiForget: (channelIndex: number) => void;
  handleSetOscAddress: (channelIndex: number) => void;
  getChannelInfo: (channelIndex: number) => any;
  isChannelAssigned: (channelIndex: number) => boolean;
  getFixtureColor: (fixtureId: string) => string;
  channelsPerRow?: number;
  getChannelTicksOnly: (channelIndex: number) => boolean;
  setChannelTicksOnly: (channelIndex: number, ticksOnly: boolean) => void;
  getChannelAuxFullFader: (channelIndex: number) => boolean;
  toggleChannelAuxFullFader: (channelIndex: number) => void;
  onChannelContextMenu?: (event: React.MouseEvent, channelIndex: number) => void;
}

export const DmxChannelsViewport: React.FC<DmxChannelsViewportProps> = ({
  viewMode,
  faderOrientation = 'horizontal',
  displayedChannels,
  dmxChannels,
  channelNames,
  selectedChannels,
  highlightedChannel,
  channelColors,
  pinnedChannels,
  midiMappings,
  oscAssignments,
  isLearning,
  currentLearningChannel,
  showMidiControls,
  showOscControls,
  editingChannelName,
  editingChannelNameValue,
  setEditingChannelNameValue,
  getChannelRange,
  setChannelRange,
  setDmxChannel,
  handleSaveChannelName,
  handleCancelEditName,
  handleStartEditName,
  toggleChannelSelection,
  setRandomChannelColor,
  addNotification,
  togglePinChannel,
  handleMidiLearn,
  handleMidiForget,
  handleSetOscAddress,
  getChannelInfo,
  isChannelAssigned,
  getFixtureColor,
  channelsPerRow = 0,
  getChannelTicksOnly,
  setChannelTicksOnly,
  getChannelAuxFullFader,
  toggleChannelAuxFullFader,
  onChannelContextMenu,
}) => {
  const gridColumnStyle = (() => {
    if (viewMode === 'list' || channelsPerRow <= 0) {
      return undefined;
    }
    let minCol = '320px';
    if (faderOrientation === 'vertical') {
      minCol = '9.5rem';
    } else if (viewMode === 'compact') {
      minCol = '280px';
    }
    return {
      gridTemplateColumns: `repeat(${channelsPerRow}, minmax(${minCol}, 1fr))`,
    } as React.CSSProperties;
  })();

  if (displayedChannels.length === 0) {
    return (
      <div
        className={`${styles.dmxChannelsContainer} ${styles[viewMode]} ${
          faderOrientation === 'vertical' ? styles.channelStrip : ''
        } ${styles.emptyChannelViewport}`}
        style={gridColumnStyle}
        data-channels-per-row={channelsPerRow > 0 ? channelsPerRow : undefined}
      >
        <div className={styles.emptyChannelStrip}>
          No DMX channels match the current visibility and filter controls.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.dmxChannelsContainer} ${styles[viewMode]} ${
        faderOrientation === 'vertical' ? styles.channelStrip : ''
      } ${channelsPerRow > 0 && viewMode !== 'list' ? styles.columnsFixed : ''}`}
      style={gridColumnStyle}
      data-channels-per-row={channelsPerRow > 0 ? channelsPerRow : undefined}
    >
      {displayedChannels.map((channelIndex) => {
        const value = dmxChannels[channelIndex] || 0;
        const channelName = channelNames[channelIndex] || `Channel ${channelIndex + 1}`;
        const isSelected = selectedChannels.includes(channelIndex);
        const hasMidiMapping = !!midiMappings[channelIndex];
        const isChannelLearning = isLearning && currentLearningChannel === channelIndex;
        const mapping = midiMappings[channelIndex];
        const fixtureInfo = getChannelInfo(channelIndex);
        const hasFixtureAssignment = isChannelAssigned(channelIndex);
        const fixtureColor = fixtureInfo ? getFixtureColor(fixtureInfo.fixtureId) : '#64748b';
        const isEditingName = editingChannelName === channelIndex;
        const hasCustomName = !!(channelNames[channelIndex] &&
          channelNames[channelIndex] !== `CH ${channelIndex + 1}` &&
          channelNames[channelIndex] !== `Channel ${channelIndex + 1}` &&
          channelNames[channelIndex].trim() !== '');

        return (
          <DmxChannelCard
            key={channelIndex}
            channelIndex={channelIndex}
            value={value}
            channelName={channelName}
            isSelected={isSelected}
            highlighted={highlightedChannel === channelIndex}
            hasMidiMapping={hasMidiMapping}
            isChannelLearning={isChannelLearning}
            mapping={mapping}
            fixtureInfo={fixtureInfo}
            hasFixtureAssignment={hasFixtureAssignment}
            fixtureColor={fixtureColor}
            isEditingName={isEditingName}
            hasCustomName={hasCustomName}
            channelColor={channelColors[channelIndex]}
            showMidiControls={showMidiControls}
            showOscControls={showOscControls}
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
            addNotification={addNotification}
            isPinned={!!pinnedChannels?.includes(channelIndex)}
            togglePinChannel={togglePinChannel}
            handleMidiLearn={handleMidiLearn}
            handleMidiForget={handleMidiForget}
            handleSetOscAddress={handleSetOscAddress}
            oscAddress={oscAssignments[channelIndex]}
            verticalFader={faderOrientation === 'vertical'}
            ticksOnly={getChannelTicksOnly(channelIndex)}
            auxFullRange={getChannelAuxFullFader(channelIndex)}
            onToggleAuxFullRange={() => toggleChannelAuxFullFader(channelIndex)}
            canUseTicksMode={Boolean(fixtureInfo?.ranges && fixtureInfo.ranges.length > 0)}
            onToggleTicksOnly={() =>
              setChannelTicksOnly(channelIndex, !getChannelTicksOnly(channelIndex))
            }
            onContextMenu={
              onChannelContextMenu
                ? (e) => onChannelContextMenu(e, channelIndex)
                : undefined
            }
          />
        );
      })}
    </div>
  );
};
