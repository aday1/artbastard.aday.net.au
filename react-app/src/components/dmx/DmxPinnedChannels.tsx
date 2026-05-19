import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { DmxChannelFader, RangeWindowControl } from '../ui/controls';
import { useAppContextMenu } from '../../context/ContextMenuContext';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxPinnedChannelsProps {
  pinnedChannels: number[];
  dmxChannels: number[];
  channelNames: string[];
  midiMappings: Record<number, any>;
  oscAssignments: string[];
  showOscControls: boolean;
  showMidiControls: boolean;
  getChannelInfo: (channelIndex: number) => any;
  isChannelAssigned: (channelIndex: number) => boolean;
  getFixtureColor: (fixtureId: string) => string;
  getChannelRange: (channelIndex: number) => { min: number; max: number };
  setDmxChannel: (channelIndex: number, value: number) => void;
  setChannelRange: (channelIndex: number, min: number, max: number) => void;
  setOscAssignment: (channelIndex: number, address: string) => void;
  removeMidiMapping: (channelIndex: number) => void;
  startLearn: (channelIndex: number) => void;
  scrollToChannel: (channelIndex: number) => void;
  togglePinChannel: (channelIndex: number) => void;
  verticalFaders?: boolean;
  getChannelTicksOnly: (channelIndex: number) => boolean;
  setChannelTicksOnly: (channelIndex: number, ticksOnly: boolean) => void;
}

export const DmxPinnedChannels: React.FC<DmxPinnedChannelsProps> = ({
  pinnedChannels,
  dmxChannels,
  channelNames,
  midiMappings,
  oscAssignments,
  showOscControls,
  showMidiControls,
  getChannelInfo,
  isChannelAssigned,
  getFixtureColor,
  getChannelRange,
  setDmxChannel,
  setChannelRange,
  setOscAssignment,
  removeMidiMapping,
  startLearn,
  scrollToChannel,
  togglePinChannel,
  verticalFaders = false,
  getChannelTicksOnly,
  setChannelTicksOnly,
}) => {
  const { openChannelMenu } = useAppContextMenu();

  if (!pinnedChannels || pinnedChannels.length === 0) {
    return null;
  }

  return (
    <div className={styles.sceneSection}>
      <h3 className={styles.sectionTitle}>
        <LucideIcon name="Pin" />
        Pinned Channels
        <span className={styles.activeCount}>({pinnedChannels.length})</span>
      </h3>
      <div className={styles.pinnedChannelsContainer}>
        {pinnedChannels.map((channelIndex) => {
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
              onContextMenu={(e) => openChannelMenu(e, channelIndex)}
            >
              <div className={styles.pinnedChannelHeader}>
                <span className={styles.channelNumber}>CH {channelIndex + 1}</span>
                {hasFixtureAssignment && (
                  <span className={styles.fixtureBadge} style={{ backgroundColor: fixtureColor }}>
                    {fixtureInfo?.fixtureName}
                  </span>
                )}
                <div className={styles.pinnedChannelActions}>
                  {fixtureInfo?.ranges && fixtureInfo.ranges.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.ticksModeButton} ${styles.ticksModeButtonCompact} ${
                        getChannelTicksOnly(channelIndex) ? styles.ticksModeActive : ''
                      }`}
                      onClick={() =>
                        setChannelTicksOnly(channelIndex, !getChannelTicksOnly(channelIndex))
                      }
                      title="Toggle ticks mode"
                    >
                      <LucideIcon name="ListOrdered" size={14} />
                    </button>
                  )}
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

              <div
                className={`${styles.pinnedSliderContainer} ${
                  verticalFaders ? styles.pinnedSliderVertical : ''
                }`}
              >
                <DmxChannelFader
                  vertical={verticalFaders}
                  faderSize={verticalFaders ? 'touch' : 'default'}
                  min={channelRange.min}
                  max={channelRange.max}
                  value={value}
                  onChange={(v) => setDmxChannel(channelIndex, v)}
                  fixtureRanges={fixtureInfo?.ranges}
                  ticksOnly={getChannelTicksOnly(channelIndex)}
                />
                <span className={styles.pinnedValue}>{value}</span>
              </div>

              <div className={styles.pinnedRangeControls}>
                <RangeWindowControl
                  label="Channel window"
                  showNumericInputs
                  dense
                  min={0}
                  max={255}
                  minValue={channelRange.min}
                  maxValue={channelRange.max}
                  onChange={(newMin, newMax) => setChannelRange(channelIndex, newMin, newMax)}
                />
              </div>

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
  );
};
