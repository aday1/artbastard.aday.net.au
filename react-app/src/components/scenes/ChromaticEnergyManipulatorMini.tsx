import React, { useState, useEffect } from 'react';
import styles from './ChromaticEnergyManipulatorMini.module.scss';
import { useStore, Fixture } from '../../store';

export const ChromaticEnergyManipulatorMini: React.FC = () => {
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [showColorControls, setShowColorControls] = useState(true);
  const [showMovementControls, setShowMovementControls] = useState(true);
  const [showColorPresets, setShowColorPresets] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { fixtures, theme, getDmxChannelValue, setDmxChannelValue } = useStore((state) => ({
    fixtures: state.fixtures,
    theme: state.theme,
    getDmxChannelValue: state.getDmxChannelValue,
    setDmxChannelValue: state.setDmxChannelValue
  }));

  // Find RGB and Pan/Tilt channels for the selected fixture
  const getFixtureChannels = (fixtureId: string) => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return { rgbChannels: {}, movementChannels: {} };
    
    const rgbChannels: {
      redChannel?: number;
      greenChannel?: number;
      blueChannel?: number;
    } = {};
    
    const movementChannels: {
      panChannel?: number;
      tiltChannel?: number;
    } = {};
    
    // Find the channel indices based on channel types
    fixture.channels.forEach((channel, index) => {
      const dmxAddress = fixture.startAddress + index;
      
      switch (channel.type) {
        case 'red':
          rgbChannels.redChannel = dmxAddress - 1; // 0-indexed
          break;
        case 'green':
          rgbChannels.greenChannel = dmxAddress - 1;
          break;
        case 'blue':
          rgbChannels.blueChannel = dmxAddress - 1;
          break;
        case 'pan':
          movementChannels.panChannel = dmxAddress - 1;
          break;
        case 'tilt':
          movementChannels.tiltChannel = dmxAddress - 1;
          break;
      }
    });
    
    return { rgbChannels, movementChannels };
  };

  // Show all fixtures regardless of channel types
  const compatibleFixtures = fixtures;
  
  // Auto-select the first fixture if none selected and fixtures exist
  useEffect(() => {
    if (!selectedFixture && fixtures.length > 0) {
      setSelectedFixture(fixtures[0].id);
    }
  }, [selectedFixture, fixtures]);
  
  // Get the channels for the currently selected fixture
  const { rgbChannels, movementChannels } = selectedFixture ? 
    getFixtureChannels(selectedFixture) : 
    { rgbChannels: {}, movementChannels: {} };

  // Get current values from DMX channels
  const getCurrentValues = () => {
    return {
      red: rgbChannels.redChannel !== undefined ? getDmxChannelValue(rgbChannels.redChannel) : 0,
      green: rgbChannels.greenChannel !== undefined ? getDmxChannelValue(rgbChannels.greenChannel) : 0,
      blue: rgbChannels.blueChannel !== undefined ? getDmxChannelValue(rgbChannels.blueChannel) : 0,
      pan: movementChannels.panChannel !== undefined ? getDmxChannelValue(movementChannels.panChannel) : 127,
      tilt: movementChannels.tiltChannel !== undefined ? getDmxChannelValue(movementChannels.tiltChannel) : 127
    };
  };

  const currentValues = getCurrentValues();
  // Handle color value changes
  const handleColorChange = (channel: 'red' | 'green' | 'blue', value: number) => {
    try {
      setConnectionError(null);
      const channelMap = {
        red: rgbChannels.redChannel,
        green: rgbChannels.greenChannel,
        blue: rgbChannels.blueChannel
      };
      
      const channelNumber = channelMap[channel];
      if (channelNumber !== undefined && channelNumber >= 0) {
        const clampedValue = Math.max(0, Math.min(255, value));
        setDmxChannelValue(channelNumber, clampedValue);
      }
    } catch (error) {
      setConnectionError(`Failed to update ${channel} channel`);
      console.error(`Color change error for ${channel}:`, error);
    }
  };

  // Handle movement value changes
  const handleMovementChange = (axis: 'pan' | 'tilt', value: number) => {
    try {
      setConnectionError(null);
      const channelMap = {
        pan: movementChannels.panChannel,
        tilt: movementChannels.tiltChannel
      };
      
      const channelNumber = channelMap[axis];
      if (channelNumber !== undefined && channelNumber >= 0) {
        const clampedValue = Math.max(0, Math.min(255, value));
        setDmxChannelValue(channelNumber, clampedValue);
      }
    } catch (error) {
      setConnectionError(`Failed to update ${axis} axis`);
      console.error(`Movement change error for ${axis}:`, error);
    }
  };

  // Quick color presets
  const colorPresets = [
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'Off', r: 0, g: 0, b: 0 }
  ];
  const applyColorPreset = (preset: { r: number; g: number; b: number }) => {
    try {
      setIsUpdating(true);
      setConnectionError(null);
      
      handleColorChange('red', preset.r);
      handleColorChange('green', preset.g);
      handleColorChange('blue', preset.b);
    } catch (error) {
      setConnectionError('Failed to apply color preset');
      console.error('Color preset error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Movement presets
  const centerMovement = () => {
    try {
      setIsUpdating(true);
      setConnectionError(null);
      
      handleMovementChange('pan', 127);
      handleMovementChange('tilt', 127);
    } catch (error) {
      setConnectionError('Failed to center movement');
      console.error('Movement center error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const randomizeColor = () => {
    const randomColor = {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256)
    };
    applyColorPreset(randomColor);
  };

  const hasRGBChannels = Object.keys(rgbChannels).length > 0;
  const hasMovementChannels = Object.keys(movementChannels).length > 0;

  const getThemeTitle = () => {
    switch (theme) {
      case 'artsnob':
        return '🎨 Chromatic Energy';
      case 'standard':
        return 'Color & Movement';
      case 'minimal':
        return 'Color/Move';
      default:
        return 'Color & Movement';
    }
  };
  return (
    <div className={styles.chromaticEnergyMini}>
      {/* Error Display */}
      {connectionError && (
        <div className={styles.errorMessage}>
          <span>⚠️ {connectionError}</span>
          <button 
            onClick={() => setConnectionError(null)}
            className={styles.closeError}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isUpdating && (
        <div className={styles.loadingIndicator}>
          <span>⟳ Updating...</span>
        </div>
      )}

      <div className={styles.header}>
        <h4 className={styles.title}>{getThemeTitle()}</h4>
        
        <div className={styles.fixtureSelector}>
          <select 
            value={selectedFixture || ''} 
            onChange={(e) => setSelectedFixture(e.target.value)}
            className={styles.fixtureSelect}
          >
            <option value="">-- Select fixture --</option>
              {fixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedFixture && (hasRGBChannels || hasMovementChannels) ? (
        <div className={styles.content}>
          {/* Color Controls */}
          {hasRGBChannels && (
            <div className={styles.colorSection}>
              <div 
                className={styles.sectionHeader}
                onClick={() => setShowColorControls(!showColorControls)}
              >
                <span className={styles.sectionTitle}>
                  {theme === 'artsnob' ? 'Chromatic Essence' : 'Color'}
                </span>
                <span className={`${styles.toggleIcon} ${showColorControls ? styles.expanded : ''}`}>
                  ▼
                </span>
              </div>
              
              {showColorControls && (
                <div className={styles.colorControls}>
                  {/* RGB Sliders */}
                  <div className={styles.rgbControls}>
                    {rgbChannels.redChannel !== undefined && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>R</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={currentValues.red}
                          onChange={(e) => handleColorChange('red', parseInt(e.target.value))}
                          className={`${styles.slider} ${styles.redSlider}`}
                        />
                        <span className={styles.value}>{currentValues.red}</span>
                      </div>
                    )}
                    
                    {rgbChannels.greenChannel !== undefined && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>G</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={currentValues.green}
                          onChange={(e) => handleColorChange('green', parseInt(e.target.value))}
                          className={`${styles.slider} ${styles.greenSlider}`}
                        />
                        <span className={styles.value}>{currentValues.green}</span>
                      </div>
                    )}
                    
                    {rgbChannels.blueChannel !== undefined && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>B</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={currentValues.blue}
                          onChange={(e) => handleColorChange('blue', parseInt(e.target.value))}
                          className={`${styles.slider} ${styles.blueSlider}`}
                        />
                        <span className={styles.value}>{currentValues.blue}</span>
                      </div>
                    )}
                  </div>

                  {/* Color Preview */}
                  <div 
                    className={styles.colorPreview}
                    style={{
                      backgroundColor: `rgb(${currentValues.red}, ${currentValues.green}, ${currentValues.blue})`
                    }}
                  />                  {/* Color Presets */}
                  <div className={styles.colorPresets}>
                    <div className={styles.presetHeader}>
                      <span>Quick Colors</span>
                      <button
                        className={styles.togglePresets}
                        onClick={() => setShowColorPresets(!showColorPresets)}
                      >
                        {showColorPresets ? '▼' : '▶'}
                      </button>
                    </div>
                    
                    {showColorPresets && (
                      <div className={styles.presetsGrid}>
                        {colorPresets.map((preset, index) => (
                          <button
                            key={index}
                            className={styles.presetButton}
                            style={{
                              backgroundColor: `rgb(${preset.r}, ${preset.g}, ${preset.b})`,
                              border: `1px solid ${preset.r + preset.g + preset.b < 100 ? '#666' : '#333'}`
                            }}
                            onClick={() => applyColorPreset(preset)}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    )}
                    
                    <div className={styles.presetActions}>
                      <button 
                        className={styles.actionButton}
                        onClick={randomizeColor}
                        title="Random Color"
                      >
                        🎲 Random
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Movement Controls */}
          {hasMovementChannels && (
            <div className={styles.movementSection}>
              <div 
                className={styles.sectionHeader}
                onClick={() => setShowMovementControls(!showMovementControls)}
              >
                <span className={styles.sectionTitle}>
                  {theme === 'artsnob' ? 'Spatial Dynamics' : 'Movement'}
                </span>
                <span className={`${styles.toggleIcon} ${showMovementControls ? styles.expanded : ''}`}>
                  ▼
                </span>
              </div>
              
              {showMovementControls && (
                <div className={styles.movementControls}>
                  {/* Pan/Tilt Sliders */}
                  <div className={styles.movementSliders}>
                    {movementChannels.panChannel !== undefined && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Pan</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={currentValues.pan}
                          onChange={(e) => handleMovementChange('pan', parseInt(e.target.value))}
                          className={styles.slider}
                        />
                        <span className={styles.value}>{currentValues.pan}</span>
                      </div>
                    )}
                    
                    {movementChannels.tiltChannel !== undefined && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Tilt</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={currentValues.tilt}
                          onChange={(e) => handleMovementChange('tilt', parseInt(e.target.value))}
                          className={styles.slider}
                        />
                        <span className={styles.value}>{currentValues.tilt}</span>
                      </div>
                    )}
                  </div>                  {/* Movement Presets */}
                  <div className={styles.movementPresets}>
                    <button 
                      className={styles.actionButton}
                      onClick={centerMovement}
                      title="Center Position"
                    >
                      🎯 Center
                    </button>
                    <button 
                      className={styles.actionButton}
                      onClick={() => {
                        handleMovementChange('pan', 0);
                        handleMovementChange('tilt', 0);
                      }}
                      title="Home Position"
                    >
                      🏠 Home
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.noFixture}>
          {selectedFixture ? (
            <p>No compatible channels found</p>
          ) : compatibleFixtures.length > 0 ? (
            <p>Select a fixture above</p>
          ) : (
            <p>No compatible fixtures</p>
          )}
        </div>
      )}
    </div>
  );
};
