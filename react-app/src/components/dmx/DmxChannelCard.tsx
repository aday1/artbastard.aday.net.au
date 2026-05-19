import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { ChannelRoleIcon } from '../ui/ChannelRoleIcon';
import { DmxChannelFader, RangeWindowControl } from '../ui/controls';
import { ChannelEnvelopeStrip } from './ChannelEnvelopeStrip';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxChannelCardProps {
  channelIndex: number;
  value: number;
  channelName: string;
  isSelected: boolean;
  highlighted: boolean;
  hasMidiMapping: boolean;
  isChannelLearning: boolean;
  mapping: any;
  fixtureInfo: any;
  hasFixtureAssignment: boolean;
  fixtureColor: string;
  isEditingName: boolean;
  hasCustomName: boolean;
  channelColor?: string;
  showMidiControls: boolean;
  showOscControls: boolean;
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
  isPinned: boolean;
  togglePinChannel: (channelIndex: number) => void;
  handleMidiLearn: (channelIndex: number) => void;
  handleMidiForget: (channelIndex: number) => void;
  handleSetOscAddress: (channelIndex: number) => void;
  oscAddress?: string;
  verticalFader?: boolean;
  ticksOnly?: boolean;
  auxFullRange?: boolean;
  onToggleAuxFullRange?: () => void;
  canUseTicksMode?: boolean;
  onToggleTicksOnly?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export const DmxChannelCard: React.FC<DmxChannelCardProps> = ({
  channelIndex,
  value,
  channelName,
  isSelected,
  highlighted,
  hasMidiMapping,
  isChannelLearning,
  mapping,
  fixtureInfo,
  hasFixtureAssignment,
  fixtureColor,
  isEditingName,
  hasCustomName,
  channelColor,
  showMidiControls,
  showOscControls,
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
  isPinned,
  togglePinChannel,
  handleMidiLearn,
  handleMidiForget,
  handleSetOscAddress,
  oscAddress,
  verticalFader = false,
  ticksOnly = false,
  auxFullRange = false,
  onToggleAuxFullRange,
  canUseTicksMode = false,
  onToggleTicksOnly,
  onContextMenu,
}) => {
  return (
    <div
      id={`dmx-channel-${channelIndex}`}
      className={`${styles.dmxChannel} ${isSelected ? styles.selected : ''} ${value > 0 ? styles.active : ''} ${highlighted ? styles.highlighted : ''} ${hasCustomName ? styles.hasName : ''} ${hasFixtureAssignment ? styles.fixtureAssigned : ''} ${channelColor ? styles.hasColor : ''} ${verticalFader ? styles.channelStripCard : ''}`}
      onContextMenu={onContextMenu}
      style={{
        borderColor: hasFixtureAssignment
          ? fixtureColor
          : (channelColor || (hasCustomName ? '#10b981' : undefined)),
        borderWidth: channelColor
          ? '4px'
          : (hasFixtureAssignment || hasCustomName ? '2px' : undefined),
        borderLeftWidth: hasFixtureAssignment ? '4px' : (channelColor ? '6px' : undefined),
        backgroundColor: channelColor && !hasFixtureAssignment
          ? `${channelColor}25`
          : (hasFixtureAssignment && fixtureColor
            ? `${fixtureColor}15`
            : undefined),
        backgroundImage: channelColor && !hasFixtureAssignment
          ? `linear-gradient(135deg, ${channelColor}20 0%, ${channelColor}10 100%)`
          : (hasFixtureAssignment && fixtureColor
            ? `linear-gradient(135deg, ${fixtureColor}12 0%, ${fixtureColor}08 100%)`
            : undefined),
      }}
    >
      <div className={styles.channelHeader}>
        <div className={styles.channelInfo}>
          <span className={styles.channelNumber}>
            <ChannelRoleIcon
              channelType={fixtureInfo?.channelType}
              fixtureType={fixtureInfo?.fixtureType}
              size={14}
              showFixtureType
            />
            {channelIndex + 1}
          </span>
          {hasFixtureAssignment && fixtureInfo && (
            <div className={styles.fixtureLabel} style={{ color: fixtureColor }}>
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
          <div className={styles.channelValue}>
            <span className={styles.valueDisplay}>{value}</span>
            <span className={styles.valuePercent}>{Math.round((value / 255) * 100)}%</span>
          </div>
        </div>
      </div>

      <div className={`${styles.channelSlider} ${verticalFader ? styles.channelSliderVertical : ''}`}>
        <DmxChannelFader
          vertical={verticalFader}
          min={getChannelRange(channelIndex).min}
          max={getChannelRange(channelIndex).max}
          value={value}
          onChange={(v) => setDmxChannel(channelIndex, v)}
          fixtureRanges={fixtureInfo?.ranges}
          ticksOnly={ticksOnly}
          auxFullRange={auxFullRange}
          onToggleAuxFullRange={onToggleAuxFullRange}
        />
      </div>

      <ChannelEnvelopeStrip channelIndex={channelIndex} />

      <div className={styles.channelRangeControls}>
        <RangeWindowControl
          label="Channel window"
          showNumericInputs
          dense={!!verticalFader}
          min={0}
          max={255}
          minValue={getChannelRange(channelIndex).min}
          maxValue={getChannelRange(channelIndex).max}
          onChange={(newMin, newMax) => setChannelRange(channelIndex, newMin, newMax)}
        />
      </div>

      <div
        className={`${styles.channelActions} ${verticalFader ? styles.channelActionsStrip : ''}`}
        style={channelColor ? {
          backgroundColor: `${channelColor}08`,
          borderColor: `${channelColor}20`,
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
          <LucideIcon name={isSelected ? 'CheckSquare' : 'Square'} />
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
            backgroundColor: channelColor
              ? `${channelColor}20`
              : undefined,
            borderColor: channelColor || undefined,
            borderWidth: channelColor ? '1px' : undefined,
          }}
        >
          <LucideIcon name="Palette" />
        </button>

        <button
          className={`${styles.pinButton} ${isPinned ? styles.pinned : ''}`}
          onClick={() => togglePinChannel(channelIndex)}
          title={isPinned ? 'Unpin channel' : 'Pin channel to left sidebar'}
        >
          <LucideIcon name={isPinned ? 'Pin' : 'PinOff'} />
        </button>

        {verticalFader && canUseTicksMode && onToggleTicksOnly && (
          <button
            type="button"
            className={`${styles.ticksModeButton} ${styles.ticksModeButtonCompact} ${ticksOnly ? styles.ticksModeActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (e.altKey && ticksOnly && onToggleAuxFullRange) {
                onToggleAuxFullRange();
                return;
              }
              onToggleTicksOnly();
            }}
            title={
              ticksOnly
                ? 'Disable ticks mode. Alt+click: toggle full 0-255 fader.'
                : 'Enable ticks mode (fixture DMX ranges). Alt+click TICKS when on: full 0-255 fader.'
            }
          >
            <LucideIcon name="ListOrdered" size={14} />
          </button>
        )}

        {showMidiControls && (
          <div className={styles.midiControls}>
            <button
              className={`${styles.midiLearnButton} ${isChannelLearning ? styles.learning : ''} ${hasMidiMapping ? styles.mapped : ''}`}
              onClick={() => handleMidiLearn(channelIndex)}
              title={isChannelLearning ? 'Cancel MIDI Learn' : hasMidiMapping ? 'Remap MIDI' : 'Learn MIDI'}
              aria-label={isChannelLearning ? 'Cancel MIDI Learn' : hasMidiMapping ? 'Remap MIDI' : 'Learn MIDI'}
            >
              <LucideIcon name={isChannelLearning ? 'Radio' : hasMidiMapping ? 'Unlink' : 'Link'} />
              {!verticalFader && (
                <span className={styles.actionBtnLabel}>
                  {isChannelLearning ? 'Learning...' : hasMidiMapping ? 'Mapped' : 'Learn'}
                </span>
              )}
            </button>

            {hasMidiMapping && !isChannelLearning && (
              <button
                className={styles.midiForgetButton}
                onClick={() => handleMidiForget(channelIndex)}
                title="Remove MIDI mapping"
                aria-label="Forget MIDI mapping"
              >
                <LucideIcon name="Trash2" />
                {!verticalFader && <span className={styles.actionBtnLabel}>Forget</span>}
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
              aria-label="Set OSC address"
            >
              <LucideIcon name="Globe" />
              {!verticalFader && <span className={styles.actionBtnLabel}>OSC</span>}
            </button>
          </div>
        )}
      </div>

      {showMidiControls && hasMidiMapping && mapping && (
        <div className={styles.midiMappingDisplay}>
          <span className={styles.midiMappingText}>
            {mapping.pitch
              ? `Pitch Bend (Ch ${mapping.channel + 1})`
              : mapping.controller !== undefined
                ? `CC ${mapping.controller} (Ch ${mapping.channel + 1})`
                : `Note ${mapping.note} (Ch ${mapping.channel + 1})`
            }
          </span>
        </div>
      )}

      {showOscControls && oscAddress && (
        <div className={styles.oscAddressDisplay}>
          <span className={styles.oscAddressText}>
            OSC: {oscAddress}
          </span>
        </div>
      )}
    </div>
  );
};
