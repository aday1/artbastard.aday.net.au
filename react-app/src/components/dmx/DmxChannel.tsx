import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';
import { MidiLearnButton } from '../midi/MidiLearnButton';
import styles from './DmxChannel.module.scss';

interface DmxChannelProps {
  index: number;
  key?: number | string;
  allowFullscreen?: boolean;
  touchOptimized?: boolean;
}

interface ExtendedMidiRangeMapping extends MidiRangeMapping {
  curve?: number;
  inverted?: boolean;
}

interface FixtureChannelInfo {
  fixtureName?: string;
  channelFunction?: string;
  channelType?: string;
  shortFunction?: string;
}

// Helper function to get fixture information for a DMX channel
const getFixtureInfoForChannel = (channelIndex: number, fixtures: any[]): FixtureChannelInfo => {
  const dmxAddress = channelIndex + 1; // Convert 0-based index to 1-based address
  
  for (const fixture of fixtures) {
    const fixtureStartAddress = fixture.startAddress;
    const fixtureEndAddress = fixtureStartAddress + fixture.channels.length - 1;
    
    if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
      const channelOffset = dmxAddress - fixtureStartAddress;
      const channel = fixture.channels[channelOffset];
      
      if (channel) {
        // Generate short function name for display
        const shortFunction = (() => {
          switch (channel.type) {
            case 'red': case 'green': case 'blue': case 'white': case 'amber': case 'uv': 
              return channel.type.toUpperCase();
            case 'pan': case 'tilt': return channel.type.toUpperCase();
            case 'pan_fine': return 'PAN-F';
            case 'tilt_fine': return 'TILT-F';
            case 'dimmer': return 'DIM';
            case 'shutter': return 'SHUT';
            case 'strobe': return 'STRB';
            case 'color_wheel': return 'CW';
            case 'gobo_wheel': return 'GOBO';
            case 'gobo_rotation': return 'G-ROT';
            case 'zoom': return 'ZOOM';
            case 'focus': return 'FOCUS';
            case 'prism': return 'PRISM';
            case 'iris': return 'IRIS';            case 'speed': return 'SPEED';
            case 'macro': return 'MACRO';
            case 'effect': return 'FX';
            // NEW: Professional channel types
            case 'frost': 
            case 'diffusion': return 'FROST';
            case 'animation': return 'ANIM';
            case 'animation_speed': return 'A-SPD';
            case 'cto': 
            case 'color_temperature_orange': return 'CTO';
            case 'ctb':
            case 'color_temperature_blue': return 'CTB';
            case 'reset': return 'RESET';
            case 'lamp_control': return 'LAMP';
            case 'fan_control': return 'FAN';
            case 'display': return 'DISP';
            case 'function': return 'FUNC';
            default: return channel.type.toUpperCase();
          }
        })();
        
        return {
          fixtureName: fixture.name,
          channelFunction: channel.name || `${channel.type} Channel`,
          channelType: channel.type,
          shortFunction
        };
      }
    }
  }
  
  return {};
};

const DmxChannelComponent: React.FC<DmxChannelProps> = ({ index, allowFullscreen = true, touchOptimized = false }) => {
  const {
    dmxChannels,
    channelNames,
    selectedChannels,
    toggleChannelSelection,
    setDmxChannel,
    oscAssignments,
    setOscAssignment,
    oscActivity,
    fixtures
  } = useStore(state => ({
    dmxChannels: state.dmxChannels,
    channelNames: state.channelNames,
    selectedChannels: state.selectedChannels,
    toggleChannelSelection: state.toggleChannelSelection,
    setDmxChannel: state.setDmxChannel,
    oscAssignments: state.oscAssignments,
    setOscAssignment: state.setOscAssignment,
    oscActivity: state.oscActivity,
    fixtures: state.fixtures
  }));

  const getChannelRange = useStore(state => state.getChannelRange);
  const setChannelRange = useStore(state => state.setChannelRange);

  const [showDetails, setShowDetails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localOscAddress, setLocalOscAddress] = useState('');
  const [activityIndicator, setActivityIndicator] = useState(false);
  const [showChannelRangeControls, setShowChannelRangeControls] = useState(false);
  const [channelRangeMin, setChannelRangeMin] = useState(0);
  const [channelRangeMax, setChannelRangeMax] = useState(255);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<HTMLDivElement>(null);

  const [showMidiRangeControls, setShowMidiRangeControls] = useState(false);  const [midiRangeMapping, setMidiRangeMapping] = useState<ExtendedMidiRangeMapping>({
    inputMin: 0,
    inputMax: 127,
    outputMin: 0,
    outputMax: 255,
    curve: 1,
    inverted: false
  });

  useEffect(() => {
    if (oscAssignments && oscAssignments[index]) {
      setLocalOscAddress(oscAssignments[index]);
    }
  }, [oscAssignments, index]);

  useEffect(() => {
    const range = getChannelRange(index);
    setChannelRangeMin(range.min);
    setChannelRangeMax(range.max);
  }, [index, getChannelRange]);

  useEffect(() => {
    const currentActivity = oscActivity[index];
    if (currentActivity && currentActivity.value > 0) {
      setActivityIndicator(true);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        setActivityIndicator(false);
      }, 300);
    }
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [oscActivity, index]);

  const applyMidiRangeSettings = () => {
    if (window.midiDmxProcessor && typeof window.midiDmxProcessor.setChannelRangeMapping === 'function') {
      window.midiDmxProcessor.setChannelRangeMapping(index, midiRangeMapping);
    }
  };
  const handleMidiRangeChange = (field: keyof ExtendedMidiRangeMapping, value: number | boolean) => {
    setMidiRangeMapping(prev => {
      const newMapping = { ...prev, [field]: value };
      
      // Only apply validation for numeric fields
      if (typeof value === 'number') {
        if (field === 'inputMin' && value > prev.inputMax!) {
          newMapping.inputMin = prev.inputMax;
        }
        if (field === 'inputMax' && value < prev.inputMin!) {
          newMapping.inputMax = prev.inputMin;
        }
        if (field === 'outputMin' && value > prev.outputMax!) {
          newMapping.outputMin = prev.outputMax;
        }
        if (field === 'outputMax' && value < prev.outputMin!) {
          newMapping.outputMax = prev.outputMin;
        }
      }
      
      return newMapping;
    });
  };

  useEffect(() => {
    applyMidiRangeSettings();
  }, [midiRangeMapping, index]);

  useEffect(() => {
    if (window.midiDmxProcessor && typeof window.midiDmxProcessor.getChannelRangeMappings === 'function') {
      const mappings = window.midiDmxProcessor.getChannelRangeMappings();
      if (mappings && mappings[index]) {
        setMidiRangeMapping(prev => ({
          ...prev,
          ...mappings[index]
        }));
      }
    }
  }, [index]);

  useEffect(() => {
    const handleDmxChannelUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{channel: number, value: number}>;
      if (customEvent.detail && customEvent.detail.channel === index) {
        setDmxChannel(index, customEvent.detail.value);
      }
    };
    
    window.addEventListener('dmxChannelUpdate', handleDmxChannelUpdate);
    
    return () => {
      window.removeEventListener('dmxChannelUpdate', handleDmxChannelUpdate);
    };
  }, [index, setDmxChannel]);
  const value = dmxChannels[index] || 0;
  const name = channelNames[index] || `CH ${index + 1}`;
  const isSelected = selectedChannels.includes(index);
  
  // Get fixture information for this channel
  const fixtureInfo = getFixtureInfoForChannel(index, fixtures || []);
  const displayName = fixtureInfo.fixtureName 
    ? `${fixtureInfo.fixtureName} - ${fixtureInfo.shortFunction}` 
    : name;

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setDmxChannel(index, newValue);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= 0 && newValue <= 255) {
      setDmxChannel(index, newValue);
    }
  };

  const handleOscAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalOscAddress(e.target.value);
  };

  const handleOscAddressBlur = () => {
    if (setOscAssignment && oscAssignments[index] !== localOscAddress) {
      setOscAssignment(index, localOscAddress);
    }
  };

  const handleOscAddressKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (setOscAssignment && oscAssignments[index] !== localOscAddress) {
        setOscAssignment(index, localOscAddress);
        (e.target as HTMLInputElement).blur();
      }
    }
  };

  const getBackgroundColor = () => {
    const hue = value === 0 ? 240 : 200;
    const lightness = 20 + (value / 255) * 50;
    return `hsl(${hue}, 80%, ${lightness}%)`;
  };

  const dmxAddress = index + 1;
  const currentOscValue = oscActivity[index]?.value;
  const lastOscTimestamp = oscActivity[index]?.timestamp;
  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    
    // Automatically show details when entering fullscreen
    if (newFullscreenState && !showDetails) {
      setShowDetails(true);
    }
    
    // Handle document body classes for fullscreen mode
    if (newFullscreenState) {
      document.body.classList.add('dmx-channel-fullscreen-active');
    } else {
      document.body.classList.remove('dmx-channel-fullscreen-active');
    }
    
    // Scroll into view when maximizing
    if (newFullscreenState && channelRef.current) {
      setTimeout(() => {
        channelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };
  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Auto-show details when expanding
    if (newExpandedState) {
      setShowDetails(true);
    }
    
    // Scroll into view when expanding
    if (newExpandedState && channelRef.current) {
      setTimeout(() => {
        channelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };


  // Add ESC key handler to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Extract regular content to reuse in both normal and fullscreen views
  const regularContent = (
    <>
      {!isFullscreen && (
        <div className={styles.header}>
          <div className={styles.address}>{dmxAddress}</div>
          <div className={styles.name}>
            <div className={styles.primaryName}>{displayName}</div>
            {fixtureInfo.fixtureName && (
              <div className={styles.channelFunction} title={fixtureInfo.channelFunction}>
                {fixtureInfo.channelFunction}
              </div>
            )}
          </div>
          <div className={styles.headerControls}>
            <button
              className={styles.detailsToggle}
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
            >
              <i className={`fas fa-${showDetails ? 'chevron-up' : 'chevron-down'}`}></i>
            </button>
          </div>
        </div>
      )}
      
      <div className={`${styles.value}`} style={{ backgroundColor: getBackgroundColor() }}>
        {value}
      </div>

      <div className={`${styles.slider}`} data-dmx-channel={index}>
        <input
          type="range"
          min={channelRangeMin}
          max={channelRangeMax}
          value={value}
          onChange={handleValueChange}
          onClick={(e) => e.stopPropagation()}
          data-slider-index={index}
        />
      </div>

      {/* MIN/MAX Range Controls Toggle */}
      <button
        onClick={() => setShowChannelRangeControls(!showChannelRangeControls)}
        style={{
          width: '100%',
          padding: '4px 8px',
          marginTop: '4px',
          backgroundColor: showChannelRangeControls ? '#3b82f6' : '#475569',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
        title="Adjust MIN and MAX values for this channel"
      >
        {showChannelRangeControls ? 'Hide Range' : 'Show MIN/MAX'}
      </button>

      {/* MIN/MAX Range Controls */}
      {showChannelRangeControls && (
        <div style={{
          marginTop: '6px',
          padding: '8px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                MIN: {channelRangeMin}
              </label>
              <input
                type="range"
                min="0"
                max={channelRangeMax - 1}
                value={channelRangeMin}
                onChange={(e) => {
                  const newMin = parseInt(e.target.value);
                  setChannelRangeMin(newMin);
                  setChannelRange(index, newMin, channelRangeMax);
                }}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                MAX: {channelRangeMax}
              </label>
              <input
                type="range"
                min={channelRangeMin + 1}
                max="255"
                value={channelRangeMax}
                onChange={(e) => {
                  const newMax = parseInt(e.target.value);
                  setChannelRangeMax(newMax);
                  setChannelRange(index, channelRangeMin, newMax);
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          {/* Numeric inputs for precise values */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                max={channelRangeMax - 1}
                value={channelRangeMin}
                onChange={(e) => {
                  const newMin = parseInt(e.target.value);
                  if (!isNaN(newMin) && newMin >= 0 && newMin < channelRangeMax) {
                    setChannelRangeMin(newMin);
                    setChannelRange(index, newMin, channelRangeMax);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '4px',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: '3px',
                  fontSize: '10px'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min={channelRangeMin + 1}
                max="255"
                value={channelRangeMax}
                onChange={(e) => {
                  const newMax = parseInt(e.target.value);
                  if (!isNaN(newMax) && newMax > channelRangeMin && newMax <= 255) {
                    setChannelRangeMax(newMax);
                    setChannelRange(index, channelRangeMin, newMax);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '4px',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: '3px',
                  fontSize: '10px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className={styles.details} onClick={(e) => e.stopPropagation()}>
          <div className={styles.directInput}>
            <label htmlFor={`dmx-value-${index}`}>Value:</label>
            <input
              id={`dmx-value-${index}`}
              type="number"
              min="0"
              max="255"
              value={value}
              onChange={handleDirectInput}
            />
          </div>

          <div className={styles.oscAddressInput}>
            <label htmlFor={`osc-address-${index}`}>OSC Address:</label>
            <input
              id={`osc-address-${index}`}
              type="text"
              value={localOscAddress}
              onChange={handleOscAddressChange}
              onBlur={handleOscAddressBlur}
              onKeyPress={handleOscAddressKeyPress}
              placeholder="/dmx/channel/X"
              className={activityIndicator ? styles.oscActive : ''}
            />
          </div>

          {currentOscValue !== undefined && (
            <div className={styles.oscActivityDisplay}>
              Last OSC: {currentOscValue.toFixed(3)}
              {lastOscTimestamp && (
                <span className={styles.oscTimestamp}>
                  ({new Date(lastOscTimestamp).toLocaleTimeString()})
                </span>
              )}
            </div>
          )}          <MidiLearnButton channelIndex={index} />

          <div className={styles.midiRangeControls}>
            <button
              className={styles.rangeToggle}
              onClick={() => setShowMidiRangeControls(!showMidiRangeControls)}
            >
              {showMidiRangeControls ? 'Hide MIDI Range Controls' : 'Show MIDI Range Controls'}
            </button>
              {showMidiRangeControls && (
              <div className={styles.midiRangeForm}>
                <div className={styles.midiInvertRow}>
                  <label className={styles.midiInvertLabel}>
                    <input 
                      type="checkbox" 
                      checked={midiRangeMapping.inverted || false}
                      onChange={(e) => handleMidiRangeChange('inverted', e.target.checked)}
                      className={styles.midiInvertCheckbox}
                    />
                    <span>Invert MIDI Input</span>
                  </label>
                </div>
                
                <div className={styles.midiRangeSection}>
                  <h4 className={styles.midiSectionTitle}>MIDI Input Range (0-127)</h4>
                  <div className={styles.midiRangeRow}>
                    <div className={styles.midiRangeColumn}>
                      <label>Min:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="127" 
                        value={midiRangeMapping.inputMin}
                        onChange={(e) => handleMidiRangeChange('inputMin', parseInt(e.target.value))}
                      />
                    </div>
                    <div className={styles.midiRangeColumn}>
                      <label>Max:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="127" 
                        value={midiRangeMapping.inputMax}
                        onChange={(e) => handleMidiRangeChange('inputMax', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className={styles.midiRangeSliderRow}>
                    <div className={styles.midiDualSlider}>
                      <input 
                        type="range" 
                        min="0" 
                        max="127" 
                        value={midiRangeMapping.inputMin}
                        onChange={(e) => handleMidiRangeChange('inputMin', parseInt(e.target.value))}
                        className={styles.midiRangeSliderMin}
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="127" 
                        value={midiRangeMapping.inputMax}
                        onChange={(e) => handleMidiRangeChange('inputMax', parseInt(e.target.value))}
                        className={styles.midiRangeSliderMax}
                      />
                      <div className={styles.sliderLabels}>
                        <span>{midiRangeMapping.inputMin}</span>
                        <span>{midiRangeMapping.inputMax}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={styles.midiRangeSection}>
                  <h4 className={styles.midiSectionTitle}>DMX Output Range (0-255)</h4>
                  <div className={styles.midiRangeRow}>
                    <div className={styles.midiRangeColumn}>
                      <label>Min:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="255" 
                        value={midiRangeMapping.outputMin}
                        onChange={(e) => handleMidiRangeChange('outputMin', parseInt(e.target.value))}
                      />
                    </div>
                    <div className={styles.midiRangeColumn}>
                      <label>Max:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="255" 
                        value={midiRangeMapping.outputMax}
                        onChange={(e) => handleMidiRangeChange('outputMax', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className={styles.midiRangeSliderRow}>
                    <div className={styles.midiDualSlider}>
                      <input 
                        type="range" 
                        min="0" 
                        max="255" 
                        value={midiRangeMapping.outputMin}
                        onChange={(e) => handleMidiRangeChange('outputMin', parseInt(e.target.value))}
                        className={styles.midiRangeSliderMin}
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="255" 
                        value={midiRangeMapping.outputMax}
                        onChange={(e) => handleMidiRangeChange('outputMax', parseInt(e.target.value))}
                        className={styles.midiRangeSliderMax}
                      />
                      <div className={styles.sliderLabels}>
                        <span>{midiRangeMapping.outputMin}</span>
                        <span>{midiRangeMapping.outputMax}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={styles.midiRangeSection}>
                  <h4 className={styles.midiSectionTitle}>
                    Response Curve
                    <span 
                      className={styles.curveTooltip}
                      title="Controls how MIDI input values are mapped to DMX output. Values less than 1.0 create a logarithmic curve (more sensitive at low values), 1.0 is linear, and values greater than 1.0 create an exponential curve (more sensitive at high values)."
                    >
                      <i className="fas fa-info-circle"></i>
                    </span>
                  </h4>
                  <div className={styles.midiRangeRow}>
                    <div className={styles.midiRangeColumn}>
                      <label title="Controls how MIDI input values are mapped to DMX output. Values less than 1.0 create a logarithmic curve (more sensitive at low values), 1.0 is linear, and values greater than 1.0 create an exponential curve (more sensitive at high values).">
                        Curve:
                      </label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="3" 
                        step="0.1" 
                        value={midiRangeMapping.curve}
                        onChange={(e) => handleMidiRangeChange('curve', parseFloat(e.target.value))}
                        className={styles.midiCurveSlider}
                        title="Controls how MIDI input values are mapped to DMX output. Values less than 1.0 create a logarithmic curve (more sensitive at low values), 1.0 is linear, and values greater than 1.0 create an exponential curve (more sensitive at high values)."
                      />
                      <span className={styles.curveValue}>{midiRangeMapping.curve?.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  className={styles.applyMidiRangeButton}
                  onClick={applyMidiRangeSettings}
                >
                  Apply MIDI Settings
                </button>
              </div>
            )}
          </div>

          <div className={styles.valueDisplay}>
            <div className={styles.valueHex}>
              HEX: {value.toString(16).padStart(2, '0').toUpperCase()}
            </div>
            <div className={styles.valuePercent}>
              {Math.round((value / 255) * 100)}%
            </div>
          </div>
          
          <div className={styles.detailButtons}>
            {!isFullscreen && allowFullscreen && (
              <button 
                className={styles.fullscreenButton} 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                title="Fullscreen Mode"
              >
                <i className="fas fa-expand"></i>
                <span>Fullscreen</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Regular channel view */}
      <div
        ref={channelRef}
        className={`${styles.channel} ${isSelected ? styles.selected : ''} ${showDetails ? styles.expanded : ''} ${isExpanded ? styles.maximized : ''} ${touchOptimized ? styles.touchOptimized : ''}`}
        onClick={() => toggleChannelSelection(index)}
        style={isFullscreen ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {}}
      >
        {regularContent}
      </div>
      
      {/* Fullscreen view via portal - renders directly to body */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className={`${styles.channel} ${styles.fullscreen}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.fullscreenHeader}>
            <h2>DMX Channel {dmxAddress}</h2>
            <p>{displayName}</p>
            {fixtureInfo.fixtureName && (
              <div className={styles.fullscreenFixtureInfo}>
                <span className={styles.fixtureName}>{fixtureInfo.fixtureName}</span>
                <span className={styles.channelFunction}>{fixtureInfo.channelFunction}</span>
              </div>
            )}
          </div>
          
          <div 
            className={`${styles.value} ${styles.fullscreenValue}`} 
            style={{ backgroundColor: getBackgroundColor() }}
          >
            {value}
            <div className={styles.valuePercentOverlay}>
              {Math.round((value / 255) * 100)}%
            </div>
          </div>
          
          <div className={`${styles.slider} ${styles.fullscreenSlider}`} data-dmx-channel={index}>
            <input
              type="range"
              min="0"
              max="255"
              value={value}
              onChange={handleValueChange}
              onClick={(e) => e.stopPropagation()}
              data-slider-index={index}
            />
          </div>
          
          {/* Details section in fullscreen */}
          <div className={styles.details}>
            {regularContent}
          </div>
          
          {/* Exit Fullscreen button - always visible in fullscreen */}
          {allowFullscreen && (
            <button 
              className={styles.fullscreenButton} 
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              title="Exit Fullscreen (ESC)"
            >
              <i className="fas fa-compress"></i>
              <span>Exit Fullscreen</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}; 

// Named export for use in other components (e.g., DmxControlPanel)
export const DmxChannel = React.memo(DmxChannelComponent);

export default DmxChannelComponent;