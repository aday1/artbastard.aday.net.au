import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TouchChannelMatrix.module.scss';

interface TouchChannelMatrixProps {
  channels?: number[];
  maxChannels?: number;
  columns?: number;
  showLabels?: boolean;
  compact?: boolean;
}

export const TouchChannelMatrix: React.FC<TouchChannelMatrixProps> = ({
  channels = [],
  maxChannels = 512,
  columns = 8,
  showLabels = true,
  compact = false
}) => {
  const { 
    dmxChannels, 
    setDmxChannelValue, 
    channelNames,
    selectedChannels,
    toggleChannelSelection,
    getChannelInfo,
    getFixtureColor,
    isChannelAssigned,
  } = useStore();

  const [localValues, setLocalValues] = useState<number[]>([]);

  // Initialize local values
  useEffect(() => {
    const initialValues = channels.length > 0 
      ? channels.map(ch => dmxChannels[ch - 1] || 0)
      : Array.from({ length: maxChannels }, (_, i) => dmxChannels[i] || 0);
    setLocalValues(initialValues);
  }, [channels, maxChannels, dmxChannels]);

  const handleSliderChange = (index: number, value: number) => {
    const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
    const newValues = [...localValues];
    newValues[index] = value;
    setLocalValues(newValues);
    setDmxChannelValue(channelIndex, value);
  };

  const handleChannelSelect = (index: number) => {
    const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
    toggleChannelSelection(channelIndex);
  };

  const handleMasterFader = (value: number) => {
    const newValues = localValues.map(v => Math.round((v * value) / 255));
    setLocalValues(newValues);
    
    newValues.forEach((val, index) => {
      const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
      setDmxChannelValue(channelIndex, val);
    });
  };

  const handleBlackout = () => {
    const newValues = new Array(localValues.length).fill(0);
    setLocalValues(newValues);
    
    newValues.forEach((val, index) => {
      const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
      setDmxChannelValue(channelIndex, val);
    });
  };

  const handleFullOn = () => {
    const newValues = new Array(localValues.length).fill(255);
    setLocalValues(newValues);
    
    newValues.forEach((val, index) => {
      const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
      setDmxChannelValue(channelIndex, val);
    });
  };

  const renderChannel = (index: number) => {
    const channelIndex = channels.length > 0 ? channels[index] - 1 : index;
    const value = localValues[index] || 0;
    const isSelected = selectedChannels.includes(channelIndex);
    const channelName = channelNames[channelIndex] || `Ch ${channelIndex + 1}`;
    const intensity = (value / 255) * 100;
    
    // Get fixture info using store helper functions
    const fixtureInfo = getChannelInfo(channelIndex);
    const hasFixtureAssignment = isChannelAssigned(channelIndex);
    const fixtureColor = fixtureInfo ? getFixtureColor(fixtureInfo.fixtureId) : '#64748b';

    return (
      <div
        key={index}
        className={`${styles.channel} ${isSelected ? styles.selected : ''} ${compact ? styles.compact : ''} ${hasFixtureAssignment ? styles.fixtureAssigned : ''}`}
        onClick={() => handleChannelSelect(index)}
        style={{
          borderLeftColor: hasFixtureAssignment ? fixtureColor : undefined,
          borderLeftWidth: hasFixtureAssignment ? '3px' : undefined,
        }}
      >
        {/* Channel Header */}
        <div className={styles.channelHeader}>
          <div className={styles.channelNumber}>
            {channelIndex + 1}
          </div>
          {showLabels && (
            <div className={styles.channelName}>
              {hasFixtureAssignment ? (
                <div className={styles.fixtureInfo}>
                  <span className={styles.fixtureBadge} style={{ backgroundColor: fixtureColor }}>
                    {fixtureInfo?.fixtureName}
                  </span>
                  <span className={styles.channelFunction}>{fixtureInfo?.channelName}</span>
                  <span className={styles.channelTypeLabel}>{fixtureInfo?.channelType}</span>
                </div>
              ) : (
                channelName
              )}
            </div>
          )}
          <div className={styles.channelValue}>
            {value}
          </div>
        </div>

        {/* Slider */}
        <div className={styles.sliderContainer}>
          <input
            type="range"
            min="0"
            max="255"
            value={value}
            onChange={(e) => handleSliderChange(index, parseInt(e.target.value))}
            className={styles.slider}
            style={{
              background: `linear-gradient(to right, 
                var(--color-interactive) 0%, 
                var(--color-interactive) ${intensity}%, 
                var(--color-border) ${intensity}%, 
                var(--color-border) 100%)`
            }}
          />
        </div>

        {/* Intensity Bar */}
        <div className={styles.intensityBar}>
          <div 
            className={styles.intensityFill}
            style={{ 
              height: `${intensity}%`,
              background: `linear-gradient(to top, 
                var(--color-interactive) 0%, 
                rgba(78, 205, 196, 0.6) 50%,
                rgba(78, 205, 196, 0.2) 100%)`
            }}
          />
        </div>

        {/* Quick Controls */}
        <div className={styles.quickControls}>
          <button
            className={styles.quickButton}
            onClick={(e) => {
              e.stopPropagation();
              handleSliderChange(index, 0);
            }}
            title="Blackout"
          >
            <LucideIcon name="Minus" size={12} />
          </button>
          <button
            className={styles.quickButton}
            onClick={(e) => {
              e.stopPropagation();
              handleSliderChange(index, 255);
            }}
            title="Full On"
          >
            <LucideIcon name="Plus" size={12} />
          </button>
        </div>
      </div>
    );
  };

  const totalChannels = channels.length > 0 ? channels.length : maxChannels;
  const rows = Math.ceil(totalChannels / columns);

  return (
    <div className={`${styles.touchChannelMatrix} ${compact ? styles.compact : ''}`}>
      {/* Master Controls */}
      <div className={styles.masterControls}>
        <div className={styles.masterFader}>
          <label>Master</label>
          <input
            type="range"
            min="0"
            max="255"
            defaultValue="255"
            onChange={(e) => handleMasterFader(parseInt(e.target.value))}
            className={styles.masterSlider}
          />
        </div>
        
        <div className={styles.masterButtons}>
          <button
            className={`${styles.masterButton} ${styles.blackout}`}
            onClick={handleBlackout}
            title="Blackout All"
          >
            <LucideIcon name="Minus" size={16} />
            <span>Blackout</span>
          </button>
          <button
            className={`${styles.masterButton} ${styles.fullOn}`}
            onClick={handleFullOn}
            title="Full On All"
          >
            <LucideIcon name="Plus" size={16} />
            <span>Full On</span>
          </button>
        </div>
      </div>

      {/* Channel Grid */}
      <div 
        className={styles.channelGrid}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {Array.from({ length: totalChannels }, (_, index) => renderChannel(index))}
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <span>Channels: {totalChannels}</span>
        </div>
        <div className={styles.statusItem}>
          <span>Selected: {selectedChannels.length}</span>
        </div>
        <div className={styles.statusItem}>
          <span>Active: {localValues.filter(v => v > 0).length}</span>
        </div>
      </div>
    </div>
  );
};
