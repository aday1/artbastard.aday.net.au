"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useDmxStore, getFixtureInfoForDmxChannel } from '../../store/dmxStore';
import styles from './ChannelFader.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

interface ChannelFaderProps {
  channelIndex: number; // 0-511
}

const ChannelFader: React.FC<ChannelFaderProps> = ({ channelIndex }) => {
  const {
    dmxValue,
    channelName,
    isSelected,
    fixtures,
    setDmxValue, // This now handles debouncing internally
    toggleChannelSelection
  } = useDmxStore(state => ({
    dmxValue: state.dmxValues[channelIndex] ?? 0,
    channelName: state.channelNames[channelIndex] ?? `CH ${channelIndex + 1}`,
    isSelected: state.selectedChannels.includes(channelIndex),
    fixtures: state.fixtures,
    setDmxValue: state.setDmxValue,
    toggleChannelSelection: state.toggleChannelSelection,
  }));

  // inputValue is for the text input field, allowing temporary non-numeric values
  const [inputValue, setInputValue] = useState<string>(dmxValue.toString());

  // Effect to sync inputValue when dmxValue changes from the store (e.g., due to external update)
  useEffect(() => {
    setInputValue(dmxValue.toString());
  }, [dmxValue]);

  const fixtureInfo = getFixtureInfoForDmxChannel(channelIndex, fixtures);
  const displayAddress = channelIndex + 1;
  const displayName = fixtureInfo.shortFunction
    ? `${fixtureInfo.name} (${fixtureInfo.shortFunction})`
    : channelName;

  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10);
    setInputValue(newValue.toString()); // Keep input in sync with slider
    setDmxValue(channelIndex, newValue, true); // True to indicate it's an interactive update for debouncing
  }, [channelIndex, setDmxValue]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value); // Allow any text temporarily
  }, []);

  const handleInputBlur = useCallback(() => {
    let numericValue = parseInt(inputValue, 10);
    if (isNaN(numericValue)) {
      // If input is not a number, revert to current dmxValue from store
      setInputValue(dmxValue.toString());
    } else {
      numericValue = Math.max(0, Math.min(255, numericValue));
      setInputValue(numericValue.toString());
      setDmxValue(channelIndex, numericValue, true);
    }
  }, [inputValue, dmxValue, channelIndex, setDmxValue]);

  const handleInputKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleInputBlur();
      (event.target as HTMLInputElement).blur(); // Remove focus
    }
  }, [handleInputBlur]);

  const adjustValue = (amount: number) => {
    const currentValue = dmxValue; // Use the value from the store as the base
    const newValue = Math.max(0, Math.min(255, currentValue + amount));
    setInputValue(newValue.toString()); // Update input field
    setDmxValue(channelIndex, newValue, true);
  };

  const percentage = Math.round((dmxValue / 255) * 100);

  // Dynamic background for the fader track in the style prop of the input range
  // The CSS variable `--value-percent-dynamic` will be set inline.
  const faderStyleProp = {
    '--value-percent-dynamic': `${percentage}%`
  } as React.CSSProperties;


  return (
    <div
      className={`${styles.channelFader} ${isSelected ? styles.selected : ''}`}
      onClick={() => toggleChannelSelection(channelIndex)}
      title={fixtureInfo.function ? `${fixtureInfo.name} - ${fixtureInfo.function} (${fixtureInfo.type})` : channelName}
    >
      <div className={styles.header}>
        <span className={styles.address}>{displayAddress}</span>
        <span className={styles.name} title={displayName}>{displayName}</span>
      </div>

      <div className={styles.faderContainer}>
        <button onClick={(e) => { e.stopPropagation(); adjustValue(10); }} className={`${styles.stepButton} ${styles.plusButton}`}>
          <FontAwesomeIcon icon={faPlus} />10
        </button>
        <button onClick={(e) => { e.stopPropagation(); adjustValue(1); }} className={`${styles.stepButton} ${styles.plusButtonSmall}`}>
          <FontAwesomeIcon icon={faPlus} />
        </button>

        <div className={styles.faderTrackWrapper} style={faderStyleProp}>
          <input
            type="range"
            min="0"
            max="255"
            value={dmxValue} // Bind directly to store value for slider position
            onChange={handleSliderChange}
            // onMouseUp and onTouchEnd are not strictly needed if relying on onChange for debounced updates via store
            className={styles.fader}
            orient="vertical"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <button onClick={(e) => { e.stopPropagation(); adjustValue(-1); }} className={`${styles.stepButton} ${styles.minusButtonSmall}`}>
          <FontAwesomeIcon icon={faMinus} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); adjustValue(-10); }} className={`${styles.stepButton} ${styles.minusButton}`}>
          <FontAwesomeIcon icon={faMinus} />10
        </button>
      </div>

      <div className={styles.valueDisplay}>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyPress={handleInputKeyPress}
          className={styles.valueInput}
          onClick={(e) => e.stopPropagation()}
        />
        <span className={styles.percentage}>{percentage}%</span>
      </div>
    </div>
  );
};

export default ChannelFader;
