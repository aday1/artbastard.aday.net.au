import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';
import { MidiLearnButton } from '../midi/MidiLearnButton';
import { DmxFaderRow, HorizontalFader, RangeWindowControl } from '../ui/controls';
import { getFixtureInfoForChannel } from '../../utils/fixturePresentation';
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
    fixtures,
    dmxFaderOrientation,
  } = useStore(state => ({
    dmxChannels: state.dmxChannels,
    channelNames: state.channelNames,
    selectedChannels: state.selectedChannels,
    toggleChannelSelection: state.toggleChannelSelection,
    setDmxChannel: state.setDmxChannel,
    oscAssignments: state.oscAssignments,
    setOscAssignment: state.setOscAssignment,
    oscActivity: state.oscActivity,
    fixtures: state.fixtures,
    dmxFaderOrientation: state.dmxFaderOrientation,
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
  const fixtureInfo = getFixtureInfoForChannel(index, fixtures || []) ?? {};
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

      <div className={styles.slider} data-dmx-channel={index} onClick={(e) => e.stopPropagation()}>
        <DmxFaderRow
          compact
          layout={dmxFaderOrientation}
          label={displayName}
          subtitle={fixtureInfo.fixtureName ? `${fixtureInfo.fixtureName} · ${fixtureInfo.shortFunction}` : undefined}
          controlName={`dmx-ch-${index}`}
          min={channelRangeMin}
          max={channelRangeMax}
          value={value}
          showOsc={false}
          showMidi={false}
          showPresets={false}
          onChange={(v) => handleValueChange({ target: { value: String(v) } } as React.ChangeEvent<HTMLInputElement>)}
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
          <RangeWindowControl
            label="Channel window"
            showNumericInputs
            dense
            min={0}
            max={255}
            minValue={channelRangeMin}
            maxValue={channelRangeMax}
            onChange={(newMin, newMax) => {
              setChannelRangeMin(newMin);
              setChannelRangeMax(newMax);
              setChannelRange(index, newMin, newMax);
            }}
          />
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
                    <RangeWindowControl
                      min={0}
                      max={127}
                      minValue={midiRangeMapping.inputMin}
                      maxValue={midiRangeMapping.inputMax}
                      onChange={(a, b) => {
                        handleMidiRangeChange('inputMin', a);
                        handleMidiRangeChange('inputMax', b);
                      }}
                    />
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
                    <RangeWindowControl
                      min={0}
                      max={255}
                      minValue={midiRangeMapping.outputMin}
                      maxValue={midiRangeMapping.outputMax}
                      onChange={(a, b) => {
                        handleMidiRangeChange('outputMin', a);
                        handleMidiRangeChange('outputMax', b);
                      }}
                    />
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
                      <HorizontalFader
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={midiRangeMapping.curve}
                        onChange={(v) => handleMidiRangeChange('curve', v)}
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
            <DmxFaderRow
              label={displayName}
              subtitle={`CH ${dmxAddress}`}
              controlName={`dmx-ch-fs-${index}`}
              value={value}
              showOsc={false}
              showMidi={false}
              onChange={(v) => handleValueChange({ target: { value: String(v) } } as React.ChangeEvent<HTMLInputElement>)}
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