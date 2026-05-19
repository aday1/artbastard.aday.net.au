import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import CustomPathEditor from '../automation/CustomPathEditor';
import { useSuperControlMidiLearn } from '../../hooks/useSuperControlMidiLearn';
import { useMobile } from '../../hooks/useMobile';
import { TouchChannelMatrix } from './TouchChannelMatrix';
import styles from './SuperControl.module.scss';
// Removed react-grid-layout - using CSS auto-layout instead

interface SuperControlProps {
  isDockable?: boolean;
}

type SelectionMode = 'channels' | 'fixtures' | 'groups' | 'capabilities';

interface FixtureCapability {
  type: string;
  fixtures: string[];
}

const SuperControl: React.FC<SuperControlProps> = ({ isDockable = false }) => {
  const { isMobile, isTablet, isTouch } = useMobile();
  const {
    fixtures,
    groups,
    selectedChannels,
    selectedFixtures,
    setSelectedFixtures,
    getDmxChannelValue,
    setDmxChannelValue,
    getChannelInfo,
    getFixtureColor,
    isChannelAssigned,
    midiMessages,
    // BPM for autopilot timing
    bpm,
    // Autopilot functions
    autopilotTrackEnabled,
    autopilotTrackType,
    autopilotTrackPosition,
    autopilotTrackSize,
    autopilotTrackSpeed,
    autopilotTrackCenterX,
    autopilotTrackCenterY,
    setAutopilotTrackEnabled,
    setAutopilotTrackType,
    setAutopilotTrackPosition,
    setAutopilotTrackSize,
    setAutopilotTrackSpeed,
    setAutopilotTrackCenter,
    autopilotTrackCustomPoints,
    setAutopilotTrackCustomPoints,
    updatePanTiltFromTrack,
    calculateTrackPosition,
    startAutopilotTrackAnimation,
    stopAutopilotTrackAnimation,
    // Color Autopilot functions
    colorSliderAutopilot,
    setColorSliderAutopilot,
    toggleColorSliderAutopilot,
    // Pan/Tilt Autopilot functions
    panTiltAutopilot,
    setPanTiltAutopilot,
    togglePanTiltAutopilot,
    // Debug functions
    debugAutopilotState,
    // Scene functions from global store
    scenes,
    saveScene,
    deleteScene,
    loadScene: storeLoadScene,
  } = useStore();

  // MIDI Learn functionality
  const {
    isLearning,
    learnStatus,
    currentLearningControlName,
    startLearn,
    cancelLearn,
    forgetMapping,
    processMidiForControl,
    mappings: superControlMappings
  } = useSuperControlMidiLearn();

  // Removed layout state and template functions - using CSS auto-layout instead

  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('channels');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  // Control values state
  const [dimmer, setDimmer] = useState(255);
  const [panValue, setPanValue] = useState(127);
  const [tiltValue, setTiltValue] = useState(127);
  const [red, setRed] = useState(255);
  const [green, setGreen] = useState(255);
  const [blue, setBlue] = useState(255);
  const [gobo, setGobo] = useState(0);
  const [shutter, setShutter] = useState(255);
  const [strobe, setStrobe] = useState(0);
  const [lamp, setLamp] = useState(255);
  const [reset, setReset] = useState(0);

  // XY Pad state
  const [panTiltXY, setPanTiltXY] = useState({ x: 50, y: 50 });
  const xyPadRef = useRef<HTMLDivElement>(null);
  const [isDraggingXY, setIsDraggingXY] = useState(false);

  // Canvas ref for path visualization
  const pathCanvasRef = useRef<HTMLCanvasElement>(null);

  // MIDI Learn Processing
  useEffect(() => {
    if (midiMessages.length > 0) {
      const latestMidiMessage = midiMessages[midiMessages.length - 1];

      const controlHandlers = {
        'pan': (value: number) => {
          setPanValue(value);
          updatePanTilt(value, tiltValue);
        },
        'tilt': (value: number) => {
          setTiltValue(value);
          updatePanTilt(panValue, value);
        },
        'red': (value: number) => {
          setRed(value);
          updateRGB(value, green, blue);
        },
        'green': (value: number) => {
          setGreen(value);
          updateRGB(red, value, blue);
        },
        'blue': (value: number) => {
          setBlue(value);
          updateRGB(red, green, value);
        },
        'dimmer': (value: number) => {
          setDimmer(value);
          updateDimmer(value);
        },
        'gobo': (value: number) => {
          setGobo(value);
          updateGobo(value);
        },
        'shutter': (value: number) => {
          setShutter(value);
          updateShutter(value);
        },
        'strobe': (value: number) => {
          setStrobe(value);
          updateStrobe(value);
        },
        // Add other controls as needed
      };

      processMidiForControl(latestMidiMessage, controlHandlers);
    }
  }, [midiMessages, processMidiForControl, panValue, tiltValue, red, green, blue]);

  // MIDI Learn Button Component
  const renderMidiButtons = (controlName: string, displayName: string) => {
    const isMapped = superControlMappings[controlName];
    const isCurrentlyLearning = isLearning && currentLearningControlName === controlName;

    return (
      <div className={styles.midiButtons}>
        <button
          className={`${styles.midiLearnButton} ${isCurrentlyLearning ? styles.learning : ''}`}
          onClick={() => isCurrentlyLearning ? cancelLearn() : startLearn(controlName)}
          title={isCurrentlyLearning ? 'Cancel MIDI Learn' : `MIDI Learn ${displayName}`}
        >
          {isCurrentlyLearning ? 'Cancel' : 'Learn'}
        </button>
        {isMapped && (
          <button
            className={styles.midiForgetButton}
            onClick={() => forgetMapping(controlName)}
            title={`Forget MIDI mapping for ${displayName}`}
          >
            Forget
          </button>
        )}
        {isMapped && (
          <div className={styles.oscAddress} title={`OSC Address: /${controlName}`}>
            /{controlName}
          </div>
        )}
      </div>
    );
  };

  // Helper functions for MIDI control updates
  const updatePanTilt = (panVal: number, tiltVal: number) => {
    applyControl('pan', panVal);
    applyControl('tilt', tiltVal);
  };

  const updateRGB = (redVal: number, greenVal: number, blueVal: number) => {
    applyControl('red', redVal);
    applyControl('green', greenVal);
    applyControl('blue', blueVal);
  };

  const updateDimmer = (dimmerVal: number) => {
    applyControl('dimmer', dimmerVal);
  };

  const updateGobo = (goboVal: number) => {
    applyControl('gobo', goboVal);
  };

  const updateShutter = (shutterVal: number) => {
    applyControl('shutter', shutterVal);
  };

  const updateStrobe = (strobeVal: number) => {
    applyControl('strobe', strobeVal);
  };

  // Custom path editor state
  const [showTrackCustomPathEditor, setShowTrackCustomPathEditor] = useState(false);

  // Color wheel state
  const [colorHue, setColorHue] = useState(0);
  const [colorSaturation, setColorSaturation] = useState(100);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  // MIDI Learn state
  const [midiLearnTarget, setMidiLearnTarget] = useState<string | null>(null);
  const [oscAddresses, setOscAddresses] = useState<Record<string, string>>({
    fixturePrev: '/supercontrol/fixture/prev',
    fixtureNext: '/supercontrol/fixture/next',
    groupPrev: '/supercontrol/group/prev',
    groupNext: '/supercontrol/group/next',
  });
  const [oscEnabled, setOscEnabled] = useState<Record<string, boolean>>({
    fixtureNav: true,
    groupNav: true,
  });
  // Enhanced MIDI Learn state with range support
  const [midiMappings, setMidiMappings] = useState<Record<string, {
    channel?: number;
    note?: number;
    cc?: number;
    minValue: number;
    maxValue: number;
    oscAddress?: string;
  }>>({});

  // Fixture/Group navigation state
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

  // Scene management state (using global store for scenes)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneAutoSave, setSceneAutoSave] = useState(false);

  // Configuration management state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sceneOscAddresses, setSceneOscAddresses] = useState<Record<string, string>>({});

  // Get fixture capabilities (fixtures grouped by shared channel types)
  const getFixtureCapabilities = (): FixtureCapability[] => {
    const capabilities: Record<string, string[]> = {};

    fixtures.forEach(fixture => {
      fixture.channels.forEach(channel => {
        const type = channel.type.toLowerCase();
        if (!capabilities[type]) {
          capabilities[type] = [];
        }
        if (!capabilities[type].includes(fixture.id)) {
          capabilities[type].push(fixture.id);
        }
      });
    });

    return Object.entries(capabilities).map(([type, fixtureIds]) => ({
      type,
      fixtures: fixtureIds
    })).filter(cap => cap.fixtures.length > 1); // Only show capabilities shared by multiple fixtures
  };
  // Get all affected fixtures based on selection mode
  const getAffectedFixtures = () => {
    let targetFixtures: string[] = [];
    console.log(`getAffectedFixtures called - selectionMode: ${selectionMode}`);
    console.log(`Selected channels: ${selectedChannels.length}`, selectedChannels);
    console.log(`Selected fixtures: ${selectedFixtures.length}`, selectedFixtures);
    console.log(`Selected groups: ${selectedGroups.length}`, selectedGroups);

    switch (selectionMode) {
      case 'channels':
        if (selectedChannels.length === 0) return [];

        const affectedFixtures: Array<{
          fixture: any;
          channels: { [key: string]: number };
        }> = [];

        fixtures.forEach(fixture => {
          const fixtureChannels: { [key: string]: number } = {};
          let hasSelectedChannel = false; fixture.channels.forEach((channel, index) => {
            const dmxAddress = fixture.startAddress + index - 1;
            if (selectedChannels.includes(dmxAddress)) {
              hasSelectedChannel = true;
              fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
            }
          });

          if (hasSelectedChannel) {
            affectedFixtures.push({
              fixture,
              channels: fixtureChannels
            });
          }
        });

        return affectedFixtures;

      case 'fixtures':
        targetFixtures = selectedFixtures;
        break;

      case 'groups':
        targetFixtures = selectedGroups.flatMap(groupId => {
          const group = groups.find(g => g.id === groupId);
          return group ? group.fixtureIndices.map(idx => fixtures[idx]?.id).filter(Boolean) : [];
        });
        break;

      case 'capabilities':
        const capabilities = getFixtureCapabilities();
        targetFixtures = selectedCapabilities.flatMap(capType => {
          const capability = capabilities.find(c => c.type === capType);
          return capability ? capability.fixtures : [];
        });
        break;
    }

    return targetFixtures
      .map(fixtureId => {
        const fixture = fixtures.find(f => f.id === fixtureId);
        if (!fixture) return null;
        const fixtureChannels: { [key: string]: number } = {};
        fixture.channels.forEach((channel, index) => {
          const dmxAddress = fixture.startAddress + index - 1;
          fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
        });

        return {
          fixture,
          channels: fixtureChannels
        };
      })
      .filter((item): item is { fixture: any; channels: { [key: string]: number } } => item !== null);
  };

  // Helper function to check if selected fixtures have a specific control type
  const hasControlType = (controlType: string): boolean => {
    const affectedFixtures = getAffectedFixtures();
    if (affectedFixtures.length === 0) return false;

    // Map control types to possible channel type variations
    const channelTypeMap: Record<string, string[]> = {
      'pan': ['pan', 'pan_coarse', 'pan_fine'],
      'tilt': ['tilt', 'tilt_coarse', 'tilt_fine'],
      'dimmer': ['dimmer', 'intensity', 'master'],
      'red': ['red', 'r'],
      'green': ['green', 'g'],
      'blue': ['blue', 'b'],
      'gobo': ['gobo', 'gobowheel', 'gobo_wheel'],
      'shutter': ['shutter'],
      'strobe': ['strobe'],
      'lamp': ['lamp', 'lamp_on', 'lamp_control'],
      'reset': ['reset', 'reset_control', 'function'],
    };

    const possibleTypes = channelTypeMap[controlType.toLowerCase()] || [controlType.toLowerCase()];

    // Check if any affected fixture has this channel type
    return affectedFixtures.some(({ channels }) => {
      return possibleTypes.some(type => channels[type] !== undefined);
    });
  };

  // Apply control value to DMX channels
  const applyControl = (controlType: string, value: number) => {
    const affectedFixtures = getAffectedFixtures();
    console.log(`applyControl called: type=${controlType}, value=${value}, fixtures=${affectedFixtures.length}`);

    affectedFixtures.forEach(({ channels }, index) => {
      let targetChannel: number | undefined;

      switch (controlType) {
        case 'dimmer':
          targetChannel = channels['dimmer'] || channels['intensity'] || channels['master'];
          break;
        case 'pan':
          targetChannel = channels['pan'];
          break;
        case 'tilt':
          targetChannel = channels['tilt'];
          break;
        case 'red':
          targetChannel = channels['red'] || channels['r'];
          break;
        case 'green':
          targetChannel = channels['green'] || channels['g'];
          break;
        case 'blue':
          targetChannel = channels['blue'] || channels['b'];
          break;
        case 'gobo':
          targetChannel = channels['gobo'] || channels['gobowheel'] || channels['gobo_wheel'];
          break;
        case 'shutter':
          targetChannel = channels['shutter'];
          break; case 'strobe':
          targetChannel = channels['strobe'];
          break;
        case 'lamp':
          targetChannel = channels['lamp'] || channels['lamp_on'] || channels['lamp_control'];
          break;
        case 'reset':
          targetChannel = channels['reset'] || channels['reset_control'] || channels['function'];
          break;
      }      if (targetChannel !== undefined) {
        console.log(`[DMX] Setting channel ${targetChannel} to ${value} for ${controlType}`);
        setDmxChannelValue(targetChannel, value);

        // Additional verification - check if the value was actually set
        setTimeout(() => {
          const actualValue = getDmxChannelValue(targetChannel);
          console.log(`[DMX] Verification: Channel ${targetChannel} is now ${actualValue} (expected ${value})`);
        }, 100);
      } else {
        console.log(`[DMX] ERROR: No target channel found for ${controlType} in fixture ${index}`, channels);
      }
    });
  };

  // XY Pad handlers
  const handleXYPadMouseDown = (e: React.MouseEvent) => {
    setIsDraggingXY(true);
    updateXYPosition(e);
  };

  const handleXYPadMouseMove = (e: React.MouseEvent) => {
    if (isDraggingXY) {
      updateXYPosition(e);
    }
  };

  const handleXYPadMouseUp = () => {
    setIsDraggingXY(false);
  };

  const updateXYPosition = (e: React.MouseEvent) => {
    if (!xyPadRef.current) return;

    // If Pan/Tilt autopilot is active, temporarily disable it when user manually controls
    if (panTiltAutopilot.enabled) {
      console.log('Manual Pan/Tilt control detected - disabling autopilot');
      togglePanTiltAutopilot();
    }

    const rect = xyPadRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setPanTiltXY({ x, y });

    const panVal = Math.round((x / 100) * 255);
    const tiltVal = Math.round(((100 - y) / 100) * 255); // Invert Y axis

    setPanValue(panVal);
    setTiltValue(tiltVal);
    applyControl('pan', panVal);
    applyControl('tilt', tiltVal);
  };

  // Reset Pan/Tilt to center position
  const resetPanTiltToCenter = () => {
    // If Pan/Tilt autopilot is active, disable it when user manually resets
    if (panTiltAutopilot.enabled) {
      console.log('Manual Pan/Tilt reset detected - disabling autopilot');
      togglePanTiltAutopilot();
    }

    const centerValue = 127; // DMX center position (50% of 255)
    const centerPercentage = 50; // 50% for XY pad

    setPanValue(centerValue);
    setTiltValue(centerValue);
    setPanTiltXY({ x: centerPercentage, y: centerPercentage });

    applyControl('pan', centerValue);
    applyControl('tilt', centerValue);
  };

  // Color wheel handlers
  const handleColorWheelMouseDown = (e: React.MouseEvent) => {
    setIsDraggingColor(true);
    updateColorPosition(e);
  };

  const handleColorWheelMouseMove = (e: React.MouseEvent) => {
    if (isDraggingColor) {
      updateColorPosition(e);
    }
  };

  const handleColorWheelMouseUp = () => {
    setIsDraggingColor(false);
  };

  const updateColorPosition = (e: React.MouseEvent) => {
    if (!colorWheelRef.current) return;

    const rect = colorWheelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const hue = (angle + 360) % 360;
    const distance = Math.min(Math.sqrt(x * x + y * y), centerX);
    const saturation = (distance / centerX) * 100;

    setColorHue(hue);
    setColorSaturation(saturation);

    // Convert HSV to RGB
    const { r, g, b } = hsvToRgb(hue, saturation, 100);
    setRed(r);
    setGreen(g);
    setBlue(b);
    applyControl('red', r);
    applyControl('green', g);
    applyControl('blue', b);
  };

  // HSV to RGB conversion
  const hsvToRgb = (h: number, s: number, v: number) => {
    h = h / 360;
    s = s / 100;
    v = v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h < 1 / 6) { r = c; g = x; b = 0; }
    else if (h < 2 / 6) { r = x; g = c; b = 0; }
    else if (h < 3 / 6) { r = 0; g = c; b = x; }
    else if (h < 4 / 6) { r = 0; g = x; b = c; }
    else if (h < 5 / 6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  };
  // Enhanced MIDI Learn with range support
  const startMidiLearn = (controlType: string, minValue: number = 0, maxValue: number = 255) => {
    setMidiLearnTarget(controlType);
    console.log(`Starting MIDI learn for ${controlType} (range: ${minValue}-${maxValue})`);

    // Listen for MIDI input
    const handleMidiMessage = (event: any) => {
      const [status, data1, data2] = event.data;
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      let mapping: any = { channel, minValue, maxValue };

      if (messageType === 0x90 || messageType === 0x80) { // Note on/off
        mapping.note = data1;
      } else if (messageType === 0xB0) { // Control Change
        mapping.cc = data1;
      }

      setMidiMappings(prev => ({
        ...prev,
        [controlType]: mapping
      }));

      setMidiLearnTarget(null);
      console.log(`MIDI learned for ${controlType}:`, mapping);
    };

    // Add MIDI listener
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((midiAccess) => {
        const inputs = Array.from(midiAccess.inputs.values());
        inputs.forEach(input => {
          input.addEventListener('midimessage', handleMidiMessage);

          // Remove listener after 5 seconds or when learning is complete
          setTimeout(() => {
            input.removeEventListener('midimessage', handleMidiMessage);
            if (midiLearnTarget === controlType) {
              setMidiLearnTarget(null);
            }
          }, 5000);
        });
      }).catch(err => {
        console.error('MIDI access denied:', err);
        setMidiLearnTarget(null);
      });
    }
  };

  // Handle MIDI-triggered actions
  useEffect(() => {
    const handleMidiInput = (event: any) => {
      const [status, data1, data2] = event.data;
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      Object.entries(midiMappings).forEach(([action, mapping]) => {
        if (mapping.channel !== channel) return;

        let midiValue = 0;
        let triggered = false;

        if (mapping.note !== undefined && (messageType === 0x90 || messageType === 0x80)) {
          if (mapping.note === data1) {
            triggered = data2 > 0; // Note on with velocity > 0
            midiValue = data2;
          }
        } else if (mapping.cc !== undefined && messageType === 0xB0) {
          if (mapping.cc === data1) {
            triggered = true;
            midiValue = data2;
          }
        }
        if (triggered) {
          // Scale MIDI value (0-127) to control range
          const scaledValue = Math.round(
            mapping.minValue + (midiValue / 127) * (mapping.maxValue - mapping.minValue)
          );

          console.log(`MIDI triggered for ${action}: value=${midiValue}, scaled=${scaledValue}`);

          // Check affected fixtures before applying control
          const affectedFixtures = getAffectedFixtures();
          console.log(`Affected fixtures for ${action}:`, affectedFixtures.length, affectedFixtures);

          // Apply the action based on the control type
          switch (action) {
            case 'dimmer':
              setDimmer(scaledValue);
              applyControl('dimmer', scaledValue);
              break;
            case 'pan':
              setPanValue(scaledValue);
              setPanTiltXY(prev => ({ ...prev, x: (scaledValue / 255) * 100 }));
              applyControl('pan', scaledValue);
              break;
            case 'tilt':
              setTiltValue(scaledValue);
              setPanTiltXY(prev => ({ ...prev, y: (scaledValue / 255) * 100 }));
              applyControl('tilt', scaledValue);
              break;
            case 'red':
              setRed(scaledValue);
              applyControl('red', scaledValue);
              break;
            case 'green':
              setGreen(scaledValue);
              applyControl('green', scaledValue);
              break;
            case 'blue':
              setBlue(scaledValue);
              applyControl('blue', scaledValue);
              break;
            case 'gobo':
              setGobo(scaledValue);
              applyControl('gobo', scaledValue);
              break;
            case 'shutter':
              setShutter(scaledValue);
              applyControl('shutter', scaledValue);
              break;
            case 'strobe':
              setStrobe(scaledValue);
              applyControl('strobe', scaledValue);
              break;
            case 'lamp':
              setLamp(scaledValue);
              applyControl('lamp', scaledValue);
              break;
            case 'reset':
              setReset(scaledValue);
              applyControl('reset', scaledValue);
              break; case 'fixture_next':
              if (midiValue > 63) selectNextFixture();
              break;
            case 'fixture_prev':
            case 'fixture_previous':
              if (midiValue > 63) selectPreviousFixture();
              break;
            case 'group_next':
              if (midiValue > 63) selectNextGroup();
              break;
            case 'group_prev':
            case 'group_previous':
              if (midiValue > 63) selectPreviousGroup();
              break;
            case 'scene_next':
              if (midiValue > 63) selectNextScene();
              break;
            case 'scene_prev':
            case 'scene_previous':
              if (midiValue > 63) selectPreviousScene();
              break;
            case 'scene_save':
            case 'scene_capture':
              if (midiValue > 63) captureCurrentScene();
              break;
            case 'scene_load':
              if (midiValue > 63) loadSceneByIndex(currentSceneIndex);
              break;
            default:
              // Check for individual scene mappings
              if (action.startsWith('scene-')) {
                const sceneName = action.replace('scene-', '');
                const sceneIndex = scenes.findIndex(s => s.name === sceneName);
                if (sceneIndex !== -1 && midiValue > 63) {
                  loadSceneByIndex(sceneIndex);
                }
              }
              break;
          }
        }
      });
    };

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((midiAccess) => {
        const inputs = Array.from(midiAccess.inputs.values());
        inputs.forEach(input => {
          input.addEventListener('midimessage', handleMidiInput);
        });

        return () => {
          inputs.forEach(input => {
            input.removeEventListener('midimessage', handleMidiInput);
          });
        };
      });
    }
  }, [midiMappings, currentSceneIndex, scenes]);

  const stopMidiLearn = () => {
    setMidiLearnTarget(null);
  };

  const setMidiMapping = (controlType: string, midiData: {
    channel?: number;
    note?: number;
    cc?: number;
    minValue: number;
    maxValue: number;
    oscAddress?: string;
  }) => {
    setMidiMappings(prev => ({
      ...prev,
      [controlType]: midiData
    }));
  };

  const clearMidiMapping = (controlType: string) => {
    setMidiMappings(prev => {
      const updated = { ...prev };
      delete updated[controlType];
      return updated;
    });
  };

  // Fixture Navigation Functions
  const selectNextFixture = () => {
    if (fixtures.length === 0) return;
    const nextIndex = (currentFixtureIndex + 1) % fixtures.length;
    setCurrentFixtureIndex(nextIndex);
    setSelectedFixtures([fixtures[nextIndex].id]);
    setSelectionMode('fixtures');
  };

  const selectPreviousFixture = () => {
    if (fixtures.length === 0) return;
    const prevIndex = currentFixtureIndex === 0 ? fixtures.length - 1 : currentFixtureIndex - 1;
    setCurrentFixtureIndex(prevIndex);
    setSelectedFixtures([fixtures[prevIndex].id]);
    setSelectionMode('fixtures');
  };

  // Auto-animation for autopilot is now handled in the store
  // This was removed to prevent conflicts with the centralized animation system

  // Path visualization canvas drawing effect
  useEffect(() => {
    const canvas = pathCanvasRef.current;
    if (!canvas) return;

    const drawPath = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get container dimensions and set canvas size to match
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width || 300;
      const height = rect.height || 200;

      // Set canvas dimensions to match container
      canvas.width = width;
      canvas.height = height;

      // Clear canvas with background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      // Draw grid for reference
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      // Vertical grid lines
      for (let i = 1; i < 4; i++) {
        const x = (width / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal grid lines  
      for (let i = 1; i < 3; i++) {
        const y = (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.setLineDash([]); // Reset line dash

      // Calculate center position from DMX values (0-255) to canvas coordinates
      const centerX = (autopilotTrackCenterX / 255) * width;
      const centerY = (autopilotTrackCenterY / 255) * height;

      // Calculate scale based on track size and canvas dimensions
      const maxRadius = Math.min(width, height) * 0.35;
      const scale = maxRadius * (autopilotTrackSize / 100);

      // Draw the path based on type
      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();

      switch (autopilotTrackType) {
        case 'circle':
          ctx.arc(centerX, centerY, scale, 0, 2 * Math.PI);
          break;

        case 'square':
          const halfScale = scale * 0.707; // Adjust for square inscribed in circle
          ctx.moveTo(centerX - halfScale, centerY - halfScale);
          ctx.lineTo(centerX + halfScale, centerY - halfScale);
          ctx.lineTo(centerX + halfScale, centerY + halfScale);
          ctx.lineTo(centerX - halfScale, centerY + halfScale);
          ctx.closePath();
          break;

        case 'triangle':
          const triScale = scale * 0.8;
          ctx.moveTo(centerX, centerY - triScale);
          ctx.lineTo(centerX + triScale * 0.866, centerY + triScale * 0.5);
          ctx.lineTo(centerX - triScale * 0.866, centerY + triScale * 0.5);
          ctx.closePath();
          break;

        case 'figure8':
          // Improved figure-8 path with better proportions
          let firstPoint = true;
          for (let t = 0; t <= 4 * Math.PI; t += 0.05) {
            const x = centerX + scale * 0.8 * Math.sin(t);
            const y = centerY + scale * 0.6 * Math.sin(t * 0.5) * Math.cos(t * 0.5);
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          break;

        case 'linear':
          ctx.moveTo(centerX - scale, centerY);
          ctx.lineTo(centerX + scale, centerY);
          break;

        case 'random':
          // Draw a wavy random-looking path
          ctx.moveTo(centerX - scale, centerY);
          for (let i = 0; i <= 20; i++) {
            const t = (i / 20) * 2 * Math.PI;
            const x = centerX + scale * Math.cos(t) + scale * 0.3 * Math.sin(t * 3.7);
            const y = centerY + scale * Math.sin(t) + scale * 0.2 * Math.cos(t * 2.3);
            ctx.lineTo(x, y);
          }
          break;

        case 'custom':
          // For now, draw a basic path - could be extended to support user-defined paths
          ctx.arc(centerX, centerY, scale, 0, 2 * Math.PI);
          ctx.moveTo(centerX - scale * 0.5, centerY);
          ctx.lineTo(centerX + scale * 0.5, centerY);
          ctx.moveTo(centerX, centerY - scale * 0.5);
          ctx.lineTo(centerX, centerY + scale * 0.5);
          break;

        default:
          ctx.arc(centerX, centerY, scale, 0, 2 * Math.PI);
          break;
      }

      ctx.stroke();

      // Draw current position indicator if autopilot is active
      if (autopilotTrackEnabled) {
        const pos = calculateTrackPosition(
          autopilotTrackType,
          autopilotTrackPosition,
          autopilotTrackSize,
          autopilotTrackCenterX,
          autopilotTrackCenterY
        );

        // Convert DMX values (0-255) to canvas coordinates
        const posX = (pos.pan / 255) * width;
        const posY = (pos.tilt / 255) * height;

        // Draw position indicator with glow effect
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(posX, posY, 10, 0, 2 * Math.PI);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw inner dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(posX, posY, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Draw crosshairs
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(posX - 20, posY);
        ctx.lineTo(posX + 20, posY);
        ctx.moveTo(posX, posY - 20);
        ctx.lineTo(posX, posY + 20);
        ctx.stroke();
      }

      // Draw center point indicator
      ctx.fillStyle = '#ffd93d';
      ctx.shadowColor = '#ffd93d';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw center point label
      ctx.fillStyle = '#ffd93d';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CENTER', centerX, centerY - 15);
    };

    // Draw initial path
    drawPath();

    // Set up animation frame for smooth updates when autopilot is active
    let animationFrameId: number;

    if (autopilotTrackEnabled) {
      const animate = () => {
        drawPath();
        animationFrameId = requestAnimationFrame(animate);
      };
      animate();
    }

    // Cleanup function
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    autopilotTrackType,
    autopilotTrackSize,
    autopilotTrackCenterX,
    autopilotTrackCenterY,
    autopilotTrackPosition,
    autopilotTrackEnabled,
    calculateTrackPosition
  ]);

  const selectNextGroup = () => {
    if (groups.length === 0) return;
    const nextIndex = (currentGroupIndex + 1) % groups.length;
    setCurrentGroupIndex(nextIndex);
    setSelectedGroups([groups[nextIndex].id]);
    setSelectionMode('groups');
  };

  const selectPreviousGroup = () => {
    if (groups.length === 0) return;
    const prevIndex = currentGroupIndex === 0 ? groups.length - 1 : currentGroupIndex - 1;
    setCurrentGroupIndex(prevIndex);
    setSelectedGroups([groups[prevIndex].id]);
    setSelectionMode('groups');
  };

  // Scene Management Functions
  const captureCurrentScene = (name?: string) => {
    const sceneValues: Record<number, number> = {};

    // Capture all current DMX values
    for (let i = 1; i <= 512; i++) {
      const value = getDmxChannelValue(i);
      if (value > 0) {
        sceneValues[i] = value;
      }
    }

    // Convert to global scene format
    const channelValues = new Array(512).fill(0);
    Object.entries(sceneValues).forEach(([ch, val]) => {
      channelValues[parseInt(ch) - 1] = val; // Convert 1-based to 0-based
    });

    const sceneName = name || `Scene ${scenes.length + 1}`;
    const oscAddress = `/scene/${sceneName.toLowerCase().replace(/\s+/g, '_')}`;

    // Save to global store
    saveScene(sceneName, oscAddress);
    setCurrentSceneIndex(scenes.length);

    return { name: sceneName, channelValues, oscAddress };
  };

  const loadSceneByIndex = (sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;

    const scene = scenes[sceneIndex];
    // Use global store's loadScene function
    storeLoadScene(scene.name);
    setCurrentSceneIndex(sceneIndex);
  };

  const saveCurrentScene = () => {
    if (sceneAutoSave) {
      captureCurrentScene(`Auto Scene ${new Date().toLocaleTimeString()}`);
    }
  };

  const deleteSceneByIndex = (sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;

    const scene = scenes[sceneIndex];
    // Use global store's deleteScene function
    deleteScene(scene.name);

    if (currentSceneIndex >= sceneIndex && currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
  };

  const selectNextScene = () => {
    if (scenes.length === 0) return;
    const nextIndex = (currentSceneIndex + 1) % scenes.length;
    loadSceneByIndex(nextIndex);
  };

  const selectPreviousScene = () => {
    if (scenes.length === 0) return;
    const prevIndex = currentSceneIndex === 0 ? scenes.length - 1 : currentSceneIndex - 1;
    loadSceneByIndex(prevIndex);
  };

  // Scene OSC address management
  const updateSceneOscAddress = (sceneId: string, address: string) => {
    setSceneOscAddresses(prev => ({
      ...prev,
      [sceneId]: address
    }));
  };

  const copyOscAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // Could add a toast notification here
  };

  // Configuration Export/Import Functions
  const exportSettings = () => {
    const config = {
      version: "1.0.0",
      timestamp: Date.now(),
      midiMappings,
      oscAddresses,
      sceneOscAddresses,
      scenes,
      settings: {
        sceneAutoSave,
        currentSceneIndex,
        selectionMode,
        controlValues: {
          dimmer,
          panValue,
          tiltValue,
          red,
          green,
          blue,
          gobo,
          shutter,
          strobe,
          lamp,
          reset
        }
      },
      fixtures: fixtures.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        startAddress: f.startAddress,
        channels: f.channels
      })),
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        fixtureIndices: g.fixtureIndices
      }))
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `artbastard-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importSettings = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);

        // Validate config structure
        if (!config.version || !config.midiMappings) {
          alert('Invalid configuration file format');
          return;
        }

        // Import configuration
        if (config.midiMappings) setMidiMappings(config.midiMappings);
        if (config.oscAddresses) setOscAddresses(config.oscAddresses);
        if (config.sceneOscAddresses) setSceneOscAddresses(config.sceneOscAddresses);
        // Scenes are managed globally now, not imported here
        // Layouts are now auto-managed, no need to import
        if (config.settings) {
          const settings = config.settings;
          if (settings.sceneAutoSave !== undefined) setSceneAutoSave(settings.sceneAutoSave);
          if (settings.currentSceneIndex !== undefined) setCurrentSceneIndex(settings.currentSceneIndex);
          if (settings.selectionMode) setSelectionMode(settings.selectionMode);
          if (settings.controlValues) {
            const cv = settings.controlValues;
            if (cv.dimmer !== undefined) setDimmer(cv.dimmer);
            if (cv.panValue !== undefined) setPanValue(cv.panValue);
            if (cv.tiltValue !== undefined) setTiltValue(cv.tiltValue);
            if (cv.red !== undefined) setRed(cv.red);
            if (cv.green !== undefined) setGreen(cv.green);
            if (cv.blue !== undefined) setBlue(cv.blue);
            if (cv.gobo !== undefined) setGobo(cv.gobo);
            if (cv.shutter !== undefined) setShutter(cv.shutter);
            if (cv.strobe !== undefined) setStrobe(cv.strobe);
            if (cv.lamp !== undefined) setLamp(cv.lamp);
            if (cv.reset !== undefined) setReset(cv.reset);
          }
        }

        alert('Configuration imported successfully!');
      } catch (error) {
        console.error('Failed to import configuration:', error);
        alert('Failed to import configuration. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const saveAsDefault = () => {
    const config = {
      version: "1.0.0",
      timestamp: Date.now(),
      isDefault: true,
      midiMappings,
      oscAddresses,
      sceneOscAddresses,
      scenes,
      settings: {
        sceneAutoSave,
        currentSceneIndex: 0, // Reset to first scene
        selectionMode,
        controlValues: {
          dimmer,
          panValue,
          tiltValue,
          red,
          green,
          blue,
          gobo,
          shutter,
          strobe,
          lamp,
          reset
        }
      }
    };

    localStorage.setItem('artbastard-default-config', JSON.stringify(config));
    alert('Current settings saved as default configuration!');
  };

  const factoryReset = () => {
    if (!confirm('Are you sure you want to reset all settings to factory defaults? This cannot be undone.')) {
      return;
    }

    // Reset all state to defaults
    setMidiMappings({});
    setOscAddresses({});
    setSceneOscAddresses({});
    // Scenes are managed globally, not reset here
    setCurrentSceneIndex(0);
    setSceneAutoSave(false);
    setSelectionMode('channels');
    setSelectedGroups([]);
    setSelectedCapabilities([]);

    // Reset control values
    setDimmer(255);
    setPanValue(127);
    setTiltValue(127);
    setRed(255);
    setGreen(255);
    setBlue(255);
    setGobo(0);
    setShutter(255);
    setStrobe(0);
    setLamp(255);
    setReset(0);

    // Layouts are now auto-managed, no need to reset

    // Clear localStorage
    localStorage.removeItem('artbastard-default-config');
    localStorage.removeItem('superControlLayouts');

    alert('Factory reset complete! All settings have been restored to defaults.');
  };

  // Load default configuration on startup
  useEffect(() => {
    try {
      const defaultConfig = localStorage.getItem('artbastard-default-config');
      if (defaultConfig) {
        const config = JSON.parse(defaultConfig);
        if (config.isDefault) {
          // Load default settings
          if (config.midiMappings) setMidiMappings(config.midiMappings);
          if (config.oscAddresses) setOscAddresses(config.oscAddresses);
          if (config.sceneOscAddresses) setSceneOscAddresses(config.sceneOscAddresses);
          // Scenes are managed globally, not loaded here
          // Layouts are now auto-managed, no need to load
          console.log('Default configuration loaded successfully');
        }
      }
    } catch (error) {
      console.error('Failed to load default configuration:', error);
    }
  }, []);

  // MIDI/OSC Integration for Navigation and Scenes
  const setupNavigationMidiOsc = () => {
    // These would be called when MIDI/OSC messages are received
    const midiHandlers = {
      'fixture_next': selectNextFixture,
      'fixture_previous': selectPreviousFixture,
      'group_next': selectNextGroup,
      'group_previous': selectPreviousGroup,
      'scene_save': () => captureCurrentScene(),
      'scene_next': selectNextScene,
      'scene_previous': selectPreviousScene,
    };

    return midiHandlers;
  };

  // Get selection info
  const getSelectionInfo = () => {
    const affected = getAffectedFixtures();

    switch (selectionMode) {
      case 'channels':
        return selectedChannels.length === 0
          ? 'Select DMX channels to control'
          : `Controlling ${selectedChannels.length} channel(s) across ${affected.length} fixture(s)`;
      case 'fixtures':
        return selectedFixtures.length === 0
          ? 'Select fixtures to control'
          : `Controlling ${selectedFixtures.length} fixture(s)`;
      case 'groups':
        return selectedGroups.length === 0
          ? 'Select groups to control'
          : `Controlling ${selectedGroups.length} group(s) (${affected.length} fixtures)`;
      case 'capabilities':
        return selectedCapabilities.length === 0
          ? 'Select capabilities to control'
          : `Controlling ${selectedCapabilities.length} capability type(s) (${affected.length} fixtures)`;
    }
  };

  const hasSelection = getAffectedFixtures().length > 0;
  const capabilities = getFixtureCapabilities();

  // Global mouse event handlers for drag operations
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingXY) {
        const mouseEvent = e as any;
        mouseEvent.clientX = e.clientX;
        mouseEvent.clientY = e.clientY;
        updateXYPosition(mouseEvent);
      }
      if (isDraggingColor) {
        const mouseEvent = e as any;
        mouseEvent.clientX = e.clientX;
        mouseEvent.clientY = e.clientY;
        updateColorPosition(mouseEvent);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingXY(false);
      setIsDraggingColor(false);
    };

    if (isDraggingXY || isDraggingColor) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingXY, isDraggingColor]);

  // Pan/Tilt autopilot UI sync - Update XY pad position when autopilot is running
  useEffect(() => {
    if (!panTiltAutopilot.enabled) return;

    // Find fixtures with pan/tilt channels to get their current values
    const affectedFixtures = getAffectedFixtures();
    const panTiltFixtures = affectedFixtures.filter(({ channels }) =>
      channels.pan !== undefined && channels.tilt !== undefined
    );

    if (panTiltFixtures.length === 0) return;

    // Use the first fixture's pan/tilt values for UI synchronization
    const firstFixture = panTiltFixtures[0];
    const currentPanValue = getDmxChannelValue(firstFixture.channels.pan!);
    const currentTiltValue = getDmxChannelValue(firstFixture.channels.tilt!);

    // Update UI states to reflect autopilot position
    if (currentPanValue !== panValue) {
      setPanValue(currentPanValue);
      setPanTiltXY(prev => ({ ...prev, x: (currentPanValue / 255) * 100 }));
    }

    if (currentTiltValue !== tiltValue) {
      setTiltValue(currentTiltValue);
      setPanTiltXY(prev => ({ ...prev, y: ((255 - currentTiltValue) / 255) * 100 })); // Invert Y for UI
    }

    // Check every 100ms when autopilot is active
    const interval = setInterval(() => {
      const newPanValue = getDmxChannelValue(firstFixture.channels.pan!);
      const newTiltValue = getDmxChannelValue(firstFixture.channels.tilt!);

      if (newPanValue !== panValue) {
        setPanValue(newPanValue);
        setPanTiltXY(prev => ({ ...prev, x: (newPanValue / 255) * 100 }));
      }

      if (newTiltValue !== tiltValue) {
        setTiltValue(newTiltValue);
        setPanTiltXY(prev => ({ ...prev, y: ((255 - newTiltValue) / 255) * 100 })); // Invert Y for UI
      }
    }, 100);

    return () => clearInterval(interval);
  }, [panTiltAutopilot.enabled, panValue, tiltValue, getDmxChannelValue]);

  return (
    <div className={styles.superControl}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LucideIcon name="Settings" />
              Super Control
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#ccc' }}>{getSelectionInfo()}</p>
          </div>
        </div>
      </div>

      <div className={styles.autoLayoutContainer}>
        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="ListChecks" /> Selection
          </div>
          <div className={styles.gridItemContent}>
            {/* Selection Mode */}
            <div className={styles.fixtureSelection}>
              <div className={styles.selectionTabs}>
                <button
                  className={selectionMode === 'channels' ? styles.active : ''}
                  onClick={() => setSelectionMode('channels')}
                >
                  <LucideIcon name="Radio" />
                  Channels
                </button>
                <button
                  className={selectionMode === 'fixtures' ? styles.active : ''}
                  onClick={() => setSelectionMode('fixtures')}
                >
                  <LucideIcon name="Lightbulb" />
                  Fixtures
                </button>
                <button
                  className={selectionMode === 'groups' ? styles.active : ''}
                  onClick={() => setSelectionMode('groups')}
                >
                  <LucideIcon name="Users" />
                  Groups
                </button>
                <button
                  className={selectionMode === 'capabilities' ? styles.active : ''}
                  onClick={() => setSelectionMode('capabilities')}
                >
                  <LucideIcon name="Zap" />
                  Capabilities
                </button>
              </div>

              {selectionMode === 'fixtures' && (
                <div className={styles.fixtureList}>
                  {fixtures.map(fixture => (
                    <div
                      key={fixture.id}
                      className={`${styles.fixtureItem} ${selectedFixtures.includes(fixture.id) ? styles.selected : ''}`}
                      onClick={() => {
                        const newSelection = selectedFixtures.includes(fixture.id)
                          ? selectedFixtures.filter(id => id !== fixture.id)
                          : [...selectedFixtures, fixture.id];
                        setSelectedFixtures(newSelection);
                      }}
                    >
                      <span className={styles.fixtureName}>{fixture.name}</span>
                      <span className={styles.fixtureChannels}>
                        CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectionMode === 'groups' && (
                <div className={styles.fixtureList}>
                  {groups.map(group => (
                    <div
                      key={group.id}
                      className={`${styles.fixtureItem} ${selectedGroups.includes(group.id) ? styles.selected : ''}`}
                      onClick={() => {
                        setSelectedGroups(prev =>
                          prev.includes(group.id)
                            ? prev.filter(id => id !== group.id)
                            : [...prev, group.id]
                        );
                      }}
                    >
                      <span className={styles.fixtureName}>{group.name}</span>
                      <span className={styles.fixtureChannels}>
                        {group.fixtureIndices.length} fixtures
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectionMode === 'capabilities' && (
                <div className={styles.fixtureList}>            {capabilities.map(capability => (
                  <div
                    key={capability.type}
                    className={`${styles.fixtureItem} ${selectedCapabilities.includes(capability.type) ? styles.selected : ''}`}
                    onClick={() => {
                      setSelectedCapabilities(prev =>
                        prev.includes(capability.type)
                          ? prev.filter(type => type !== capability.type)
                          : [...prev, capability.type]
                      );
                    }}
                  >
                    <span className={styles.fixtureName}>{capability.type.toUpperCase()}</span>
                    <span className={styles.fixtureChannels}>
                      {capability.fixtures.length} fixtures
                    </span>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Activity" /> Monitoring
          </div>
          <div className={styles.gridItemContent}>
            {/* Channel/Fixture Monitoring */}
            {hasSelection ? (
              <div className={styles.monitoringSection}>
                <div className={styles.sectionHeader}>
                  <h4>
                    <LucideIcon name="Activity" />
                    Active Channels & Values
                  </h4>
                  <span className={styles.totalFixtures}>
                    {getAffectedFixtures().length} fixture(s) selected
                  </span>
                </div>

                <div className={styles.channelMonitor}>
                  {getAffectedFixtures().map(({ fixture, channels }, index) => (
                    <div key={`${fixture.id}-${index}`} className={styles.fixtureMonitor}>
                      <div className={styles.fixtureHeader}>
                        <LucideIcon name="Lightbulb" />
                        <span className={styles.fixtureName}>{fixture.name}</span>
                        <span className={styles.fixtureRange}>
                          CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                        </span>
                      </div>

                      <div className={styles.channelGrid}>
                        {Object.entries(channels).map(([channelType, dmxAddress]) => {
                          const currentValue = getDmxChannelValue(dmxAddress);
                          const isControlled = (() => {
                            switch (channelType) {
                              case 'dimmer':
                              case 'intensity':
                              case 'master':
                                return currentValue === dimmer;
                              case 'pan':
                                return currentValue === panValue;
                              case 'tilt':
                                return currentValue === tiltValue;
                              case 'red':
                              case 'r':
                                return currentValue === red;
                              case 'green':
                              case 'g':
                                return currentValue === green;
                              case 'blue':
                              case 'b':
                                return currentValue === blue;
                              case 'gobo':
                              case 'gobowheel':
                              case 'gobo_wheel':
                                return currentValue === gobo;
                              case 'shutter':
                                return currentValue === shutter; case 'strobe':
                                return currentValue === strobe;
                              case 'lamp':
                              case 'lamp_on':
                              case 'lamp_control':
                                return currentValue === lamp;
                              case 'reset':
                              case 'reset_control':
                              case 'function':
                                return currentValue === reset;
                              default:
                                return false;
                            }
                          })();

                          return (
                            <div
                              key={`${dmxAddress}-${channelType}`}
                              className={`${styles.channelItem} ${isControlled ? styles.controlled : ''}`}
                            >
                              <div className={styles.channelInfo}>
                                <span className={styles.channelType}>{channelType.toUpperCase()}</span>
                                <span className={styles.channelAddress}>CH {dmxAddress}</span>
                              </div>
                              <div className={styles.channelValue}>
                                <span className={styles.dmxValue}>{currentValue}</span>
                                <div
                                  className={styles.valueBar}
                                  style={{
                                    width: `${(currentValue / 255) * 100}%`,
                                    backgroundColor: isControlled ? '#00d4ff' : '#666'
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Real-time control indicators */}
                <div className={styles.controlIndicators}>
                  <div className={styles.indicatorRow}>
                    <div className={`${styles.indicator} ${dimmer > 0 ? styles.active : ''}`}>
                      <LucideIcon name="Sun" />
                      <span>Dimmer: {dimmer}</span>
                    </div>
                    <div className={`${styles.indicator} ${panValue !== 127 || tiltValue !== 127 ? styles.active : ''}`}>
                      <LucideIcon name="Move" />
                      <span>P/T: {panValue}/{tiltValue}</span>
                    </div>
                    <div className={`${styles.indicator} ${red !== 255 || green !== 255 || blue !== 255 ? styles.active : ''}`}>
                      <LucideIcon name="Palette" />
                      <span>RGB: {red}/{green}/{blue}</span>
                    </div>
                    <div className={`${styles.indicator} ${gobo > 0 ? styles.active : ''}`}>
                      <LucideIcon name="Circle" />
                      <span>Gobo: {gobo}</span>
                    </div>              <div className={`${styles.indicator} ${strobe > 0 ? styles.active : ''}`}>
                      <LucideIcon name="Zap" />
                      <span>Strobe: {strobe}</span>
                    </div>
                    <div className={`${styles.indicator} ${lamp > 0 ? styles.active : ''}`}>
                      <LucideIcon name="Power" />
                      <span>Lamp: {lamp}</span>
                    </div>
                    <div className={`${styles.indicator} ${reset > 0 ? styles.active : ''}`}>
                      <LucideIcon name="RotateCcw" />
                      <span>Reset: {reset}</span>              </div>            </div>
                </div>
              </div>
            ) : (
              <div className={styles.placeholder}>Select fixtures, groups, or channels to monitor.</div>
            )}
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Music" /> MIDI/OSC & Navigation
          </div>
          <div className={styles.gridItemContent}>
            {/* MIDI/OSC Learning and Navigation Controls */}
            <div className={styles.midiOscSection}>
              <div className={styles.navigationGrid}>
                {/* Fixture Navigation */}
                <div className={styles.navigationGroup}>
                  <h5>Fixture Navigation</h5>
                  <div className={styles.navigationControls}>
                    <button
                      className={styles.navBtn}
                      onClick={selectPreviousFixture}
                      disabled={fixtures.length === 0}
                    >
                      <LucideIcon name="ChevronLeft" />
                      Prev
                    </button>
                    <div className={styles.currentSelection}>
                      {fixtures.length > 0 ? fixtures[currentFixtureIndex]?.name || 'Unknown' : 'No fixtures'}
                      <span className={styles.indexInfo}>({currentFixtureIndex + 1}/{fixtures.length})</span>
                    </div>
                    <button
                      className={styles.navBtn}
                      onClick={selectNextFixture}
                      disabled={fixtures.length === 0}
                    >
                      Next
                      <LucideIcon name="ChevronRight" />
                    </button>
                  </div>
                  <div className={styles.midiLearnRow}>
                    <button
                      className={`${styles.navMidiBtn} ${midiLearnTarget === 'fixture_previous' ? styles.learning : ''} ${superControlMappings['fixture_previous'] ? styles.mapped : ''}`}
                      onClick={() => midiLearnTarget === 'fixture_previous' ? stopMidiLearn() : startMidiLearn('fixture_previous')}
                      title={superControlMappings['fixture_previous'] ? `MIDI: ${superControlMappings['fixture_previous'].channel ? `Ch${superControlMappings['fixture_previous'].channel}` : ''} ${superControlMappings['fixture_previous'].controller !== undefined ? `CC${superControlMappings['fixture_previous'].controller}` : superControlMappings['fixture_previous'].note !== undefined ? `Note${superControlMappings['fixture_previous'].note}` : ''}` : 'Click to learn MIDI'}
                    >
                      <LucideIcon name="ChevronLeft" size={14} />
                      Prev
                    </button>
                    <button
                      className={`${styles.navMidiBtn} ${midiLearnTarget === 'fixture_next' ? styles.learning : ''} ${superControlMappings['fixture_next'] ? styles.mapped : ''}`}
                      onClick={() => midiLearnTarget === 'fixture_next' ? stopMidiLearn() : startMidiLearn('fixture_next')}
                      title={superControlMappings['fixture_next'] ? `MIDI: ${superControlMappings['fixture_next'].channel ? `Ch${superControlMappings['fixture_next'].channel}` : ''} ${superControlMappings['fixture_next'].controller !== undefined ? `CC${superControlMappings['fixture_next'].controller}` : superControlMappings['fixture_next'].note !== undefined ? `Note${superControlMappings['fixture_next'].note}` : ''}` : 'Click to learn MIDI'}
                    >
                      Next
                      <LucideIcon name="ChevronRight" size={14} />
                    </button>
                    <div className={styles.oscControlGroup}>
                      <input
                        type="text"
                        placeholder="OSC: /fixture/prev"
                        className={styles.oscInput}
                        value={oscAddresses.fixturePrev || ''}
                        onChange={(e) => setOscAddresses(prev => ({ ...prev, fixturePrev: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="OSC: /fixture/next"
                        className={styles.oscInput}
                        value={oscAddresses.fixtureNext || ''}
                        onChange={(e) => setOscAddresses(prev => ({ ...prev, fixtureNext: e.target.value }))}
                      />
                      <button
                        className={`${styles.oscToggleBtn} ${oscEnabled.fixtureNav ? styles.active : ''}`}
                        onClick={() => setOscEnabled(prev => ({ ...prev, fixtureNav: !prev.fixtureNav }))}
                        title={oscEnabled.fixtureNav ? 'OSC Enabled - Click to disable' : 'OSC Disabled - Click to enable'}
                      >
                        <LucideIcon name={oscEnabled.fixtureNav ? "CheckCircle" : "Circle"} size={14} />
                        OSC
                      </button>
                    </div>
                  </div>
                </div>

                {/* Group Navigation */}
                <div className={styles.navigationGroup}>
                  <h5>Group Navigation</h5>
                  <div className={styles.navigationControls}>
                    <button
                      className={styles.navBtn}
                      onClick={selectPreviousGroup}
                      disabled={groups.length === 0}
                    >
                      <LucideIcon name="ChevronLeft" />
                      Prev
                    </button>
                    <div className={styles.currentSelection}>
                      {groups.length > 0 ? groups[currentGroupIndex]?.name || 'Unknown' : 'No groups'}
                      <span className={styles.indexInfo}>({currentGroupIndex + 1}/{groups.length})</span>
                    </div>
                    <button
                      className={styles.navBtn}
                      onClick={selectNextGroup}
                      disabled={groups.length === 0}
                    >
                      Next
                      <LucideIcon name="ChevronRight" />
                    </button>
                  </div>
                  <div className={styles.midiLearnRow}>
                    <button
                      className={`${styles.navMidiBtn} ${midiLearnTarget === 'group_previous' ? styles.learning : ''} ${superControlMappings['group_previous'] ? styles.mapped : ''}`}
                      onClick={() => midiLearnTarget === 'group_previous' ? stopMidiLearn() : startMidiLearn('group_previous')}
                      title={superControlMappings['group_previous'] ? `MIDI: ${superControlMappings['group_previous'].channel ? `Ch${superControlMappings['group_previous'].channel}` : ''} ${superControlMappings['group_previous'].controller !== undefined ? `CC${superControlMappings['group_previous'].controller}` : superControlMappings['group_previous'].note !== undefined ? `Note${superControlMappings['group_previous'].note}` : ''}` : 'Click to learn MIDI'}
                    >
                      <LucideIcon name="ChevronLeft" size={14} />
                      Prev
                    </button>
                    <button
                      className={`${styles.navMidiBtn} ${midiLearnTarget === 'group_next' ? styles.learning : ''} ${superControlMappings['group_next'] ? styles.mapped : ''}`}
                      onClick={() => midiLearnTarget === 'group_next' ? stopMidiLearn() : startMidiLearn('group_next')}
                      title={superControlMappings['group_next'] ? `MIDI: ${superControlMappings['group_next'].channel ? `Ch${superControlMappings['group_next'].channel}` : ''} ${superControlMappings['group_next'].controller !== undefined ? `CC${superControlMappings['group_next'].controller}` : superControlMappings['group_next'].note !== undefined ? `Note${superControlMappings['group_next'].note}` : ''}` : 'Click to learn MIDI'}
                    >
                      Next
                      <LucideIcon name="ChevronRight" size={14} />
                    </button>
                    <div className={styles.oscControlGroup}>
                      <input
                        type="text"
                        placeholder="OSC: /group/prev"
                        className={styles.oscInput}
                        value={oscAddresses.groupPrev || ''}
                        onChange={(e) => setOscAddresses(prev => ({ ...prev, groupPrev: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="OSC: /group/next"
                        className={styles.oscInput}
                        value={oscAddresses.groupNext || ''}
                        onChange={(e) => setOscAddresses(prev => ({ ...prev, groupNext: e.target.value }))}
                      />
                      <button
                        className={`${styles.oscToggleBtn} ${oscEnabled.groupNav ? styles.active : ''}`}
                        onClick={() => setOscEnabled(prev => ({ ...prev, groupNav: !prev.groupNav }))}
                        title={oscEnabled.groupNav ? 'OSC Enabled - Click to disable' : 'OSC Disabled - Click to enable'}
                      >
                        <LucideIcon name={oscEnabled.groupNav ? "CheckCircle" : "Circle"} size={14} />
                        OSC
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Film" /> Scene Management
          </div>
          <div className={styles.gridItemContent}>
            {/* Scene Management */}
            <div className={styles.navigationGroup}>
              <h5>Scene Controls</h5>
              <div className={styles.sceneControls}>
                <div className={styles.sceneButtonRow}>
                  <button
                    className={styles.sceneBtn}
                    onClick={() => captureCurrentScene()}
                  >
                    <LucideIcon name="Camera" />
                    Save Scene
                  </button>
                  <button
                    className={styles.sceneBtn}
                    onClick={selectPreviousScene}
                    disabled={scenes.length === 0}
                  >
                    <LucideIcon name="ChevronLeft" />
                    Previous
                  </button>
                  <button
                    className={styles.sceneBtn}
                    onClick={selectNextScene}
                    disabled={scenes.length === 0}
                  >
                    Next
                    <LucideIcon name="ChevronRight" />
                  </button>
                </div>
                <div className={styles.sceneInfo}>
                  <span className={styles.currentScene}>
                    {scenes.length > 0 ? scenes[currentSceneIndex]?.name || 'No scene' : 'No scenes'}
                  </span>
                  <span className={styles.sceneCount}>({scenes.length} saved)</span>
                </div>
                <div className={styles.sceneOptions}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={sceneAutoSave}
                      onChange={(e) => setSceneAutoSave(e.target.checked)}
                    />
                    Auto-save scenes
                  </label>
                </div>
              </div>
              <div className={styles.midiLearnRow}>
                <button
                  className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_save' ? styles.learning : ''}`}
                  onClick={() => midiLearnTarget === 'scene_save' ? stopMidiLearn() : startMidiLearn('scene_save')}
                >
                  <LucideIcon name="Music" />
                  MIDI Save
                </button>
                <button
                  className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_previous' ? styles.learning : ''}`}
                  onClick={() => midiLearnTarget === 'scene_previous' ? stopMidiLearn() : startMidiLearn('scene_previous')}
                >
                  <LucideIcon name="Music" />
                  MIDI Prev
                </button>
                <button
                  className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_next' ? styles.learning : ''}`}
                  onClick={() => midiLearnTarget === 'scene_next' ? stopMidiLearn() : startMidiLearn('scene_next')}
                >
                  <LucideIcon name="Music" />
                  MIDI Next
                </button>
                <input
                  type="text"
                  placeholder="OSC: /scene/control"
                  className={styles.oscInput}
                  defaultValue="/scene/control"
                />
              </div>
            </div>
            {/* Saved Scenes List */}
            {scenes.length > 0 && (
              <div className={styles.scenesList}>
                <h5>Saved Scenes ({scenes.length})</h5>
                <div className={styles.scenesGrid}>
                  {scenes.map((scene, index) => (
                    <div
                      key={scene.name}
                      className={`${styles.sceneItem} ${index === currentSceneIndex ? styles.active : ''}`}
                    >
                      <div className={styles.sceneHeader}>
                        <span className={styles.sceneName}>{scene.name}</span>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => deleteSceneByIndex(index)}
                        >
                          <LucideIcon name="X" />
                        </button>
                      </div>
                      <div className={styles.sceneDetails}>
                        <span className={styles.sceneChannels}>
                          {scene.channelValues.filter(v => v > 0).length} channels
                        </span>
                        <span className={styles.sceneTime}>
                          {scene.oscAddress || `/scene/${index + 1}`}
                        </span>
                      </div>

                      {/* Scene MIDI/OSC Controls */}
                      <div className={styles.sceneConnectionControls}>
                        <div className={styles.sceneMidiSection}>
                          <button
                            className={`${styles.midiLearnBtn} ${styles.small} ${midiLearnTarget === `scene-${scene.name}` ? styles.learning : ''}`}
                            onClick={() => midiLearnTarget === `scene-${scene.name}` ? stopMidiLearn() : startMidiLearn(`scene-${scene.name}`)}
                          >
                            <LucideIcon name="Music" />
                            MIDI
                          </button>
                          {midiMappings[`scene-${scene.name}`] && (
                            <div className={styles.midiInfo}>
                              <span>CH{midiMappings[`scene-${scene.name}`].channel} CC{midiMappings[`scene-${scene.name}`].cc}</span>
                              <button
                                className={styles.clearBtn}
                                onClick={() => clearMidiMapping(`scene-${scene.name}`)}
                              >
                                <LucideIcon name="X" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={styles.sceneOscSection}>
                          <input
                            type="text"
                            placeholder="OSC Address"
                            className={`${styles.oscInput} ${styles.small}`}
                            defaultValue={scene.oscAddress || `/scene/${index + 1}`}
                            onBlur={(e) => updateSceneOscAddress(scene.name, e.target.value)}
                          />
                          <button
                            className={styles.copyOscBtn}
                            onClick={() => copyOscAddress(`/scene/${index + 1}`)}
                            title="Copy OSC Address"
                          >
                            <LucideIcon name="Copy" />
                          </button>
                        </div>
                      </div>

                      <button
                        className={styles.loadSceneBtn}
                        onClick={() => storeLoadScene(scene.name)}
                      >
                        <LucideIcon name="Play" />
                        Load Scene
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="SlidersHorizontal" /> Basic Controls
          </div>
          <div className={styles.gridItemContent}>
            <div className={styles.section}>
              <div className={styles.controlRow}>
                <label>Dimmer</label>
                {renderMidiButtons('dimmer', 'Dimmer')}
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={dimmer}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setDimmer(val);
                    applyControl('dimmer', val);
                  }}
                  disabled={!hasSelection}
                />
                <span>{dimmer}</span>
                <div className={styles.connectionControls}>
                  <div className={styles.midiRangeSection}>
                    <button
                      className={`${styles.midiLearnBtn} ${midiLearnTarget === 'dimmer' ? styles.learning : ''}`}
                      onClick={() => midiLearnTarget === 'dimmer' ? stopMidiLearn() : startMidiLearn('dimmer')}
                    >
                      <LucideIcon name="Music" />
                      MIDI Learn
                    </button>
                    {midiMappings.dimmer && (
                      <div className={styles.midiInfo}>
                        <span>CH{midiMappings.dimmer.channel} CC{midiMappings.dimmer.cc}</span>
                        <button
                          className={styles.clearBtn}
                          onClick={() => clearMidiMapping('dimmer')}
                        >
                          <LucideIcon name="X" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.oscSection}>
                    <input
                      type="text"
                      placeholder="OSC Address"
                      className={styles.oscInput}
                      defaultValue="/dimmer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(hasControlType('pan') || hasControlType('tilt')) && (
          <div className={styles.gridItem}>
            <div className={styles.gridItemHeader}>
              <LucideIcon name="Move" /> Pan/Tilt
              {panTiltAutopilot.enabled && (
                <span
                  className={styles.autopilotIndicator}
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    animation: 'pulse 2s infinite'
                  }}
                  title={`Autopilot active: ${panTiltAutopilot.pathType} pattern`}
                >
                  AUTO
                </span>
              )}
            </div>
            <div className={styles.gridItemContent}>
            <div className={styles.section}>
              <div className={styles.panTiltSliders}>
                <div className={styles.controlRow}>
                  <label>Pan</label>
                  {renderMidiButtons('pan', 'Pan')}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={panValue}
                    onChange={(e) => {
                      // If Pan/Tilt autopilot is active, disable it when user manually controls
                      if (panTiltAutopilot.enabled) {
                        console.log('Manual Pan slider control detected - disabling autopilot');
                        togglePanTiltAutopilot();
                      }

                      const val = parseInt(e.target.value);
                      setPanValue(val);
                      applyControl('pan', val);
                      setPanTiltXY(prev => ({ ...prev, x: (val / 255) * 100 }));
                    }}
                    disabled={!hasSelection}
                  />
                  <span>{panValue}</span>
                </div>
                <div className={styles.controlRow}>
                  <label>Tilt</label>
                  {renderMidiButtons('tilt', 'Tilt')}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={tiltValue}
                    onChange={(e) => {
                      // If Pan/Tilt autopilot is active, disable it when user manually controls
                      if (panTiltAutopilot.enabled) {
                        console.log('Manual Tilt slider control detected - disabling autopilot');
                        togglePanTiltAutopilot();
                      }

                      const val = parseInt(e.target.value);
                      setTiltValue(val);
                      applyControl('tilt', val);
                      setPanTiltXY(prev => ({ ...prev, y: (val / 255) * 100 }));
                    }}
                    disabled={!hasSelection}
                  />
                  <span>{tiltValue}</span>
                </div>
              </div>

              <h5>XY Pad Control</h5>
              <div
                className={styles.xyPad}
                ref={xyPadRef}
                onMouseDown={handleXYPadMouseDown}
                onMouseMove={handleXYPadMouseMove}
                onMouseUp={handleXYPadMouseUp}
              >
                <div className={styles.xyGridLines} />
                <div
                  className={styles.xyHandle}
                  style={{
                    left: `${panTiltXY.x}%`,
                    top: `${panTiltXY.y}%`
                  }}
                />
              </div>
              <div className={styles.panTiltControls}>
                <button
                  className={styles.centerResetBtn}
                  onClick={resetPanTiltToCenter}
                  disabled={!hasSelection}
                  title="Reset Pan/Tilt to center position"
                >
                  <LucideIcon name="Target" />
                  Reset to Center
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {(hasControlType('red') || hasControlType('green') || hasControlType('blue')) && (
          <div className={styles.gridItem}>
            <div className={styles.gridItemHeader}>
              <LucideIcon name="Palette" /> RGB Color
            </div>
            <div className={styles.gridItemContent}>
            <div className={styles.section}>
              <div
                className={styles.colorWheel}
                ref={colorWheelRef}
                onMouseDown={handleColorWheelMouseDown}
                onMouseMove={handleColorWheelMouseMove}
                onMouseUp={handleColorWheelMouseUp}
              >
                <div className={styles.colorSaturation}>
                  <div
                    className={styles.colorHandle}
                    style={{
                      left: `${50 + (colorSaturation / 100) * Math.cos(colorHue * Math.PI / 180) * 45}%`,
                      top: `${50 + (colorSaturation / 100) * Math.sin(colorHue * Math.PI / 180) * 45}%`
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem', justifyContent: 'center' }}>
                <span style={{ color: '#ff0000' }}>R: {red}</span>
                <span style={{ color: '#00ff00' }}>G: {green}</span>
                <span style={{ color: '#0000ff' }}>B: {blue}</span>
              </div>
              <div className={styles.rgbSliders}>
                <div className={styles.controlRow}>
                  <label style={{ color: '#ff0000' }}>Red</label>
                  {renderMidiButtons('red', 'Red')}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={red}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setRed(val);
                      applyControl('red', val);
                    }}
                    disabled={!hasSelection}
                  />
                  <span>{red}</span>
                </div>
                <div className={styles.controlRow}>
                  <label style={{ color: '#00ff00' }}>Green</label>
                  {renderMidiButtons('green', 'Green')}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={green}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setGreen(val);
                      applyControl('green', val);
                    }}
                    disabled={!hasSelection}
                  />
                  <span>{green}</span>
                </div>
                <div className={styles.controlRow}>
                  <label style={{ color: '#0000ff' }}>Blue</label>
                  {renderMidiButtons('blue', 'Blue')}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={blue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setBlue(val);
                      applyControl('blue', val);
                    }}
                    disabled={!hasSelection}
                  />
                  <span>{blue}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {(hasControlType('gobo') || hasControlType('shutter') || hasControlType('strobe') || hasControlType('lamp') || hasControlType('reset')) && (
          <div className={styles.gridItem}>
            <div className={styles.gridItemHeader}>
              <LucideIcon name="Zap" /> Effects
            </div>
            <div className={styles.gridItemContent}>
              <div className={styles.section}>
                {hasControlType('gobo') && (
                  <>
                    <div className={styles.controlRow}>
                      <label>GOBO Wheel</label>
                {renderMidiButtons('gobo', 'GOBO')}
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={gobo}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setGobo(val);
                    applyControl('gobo', val);
                  }}
                  disabled={!hasSelection}
                />
                <span>{gobo}</span>
              </div>
              <div className={styles.goboVisualSection}>
                <label>GOBO Visual Selection</label>
                <div className={styles.goboGrid}>
                  {[
                    { value: 0, name: 'Open', image: '/gobos/open.svg' },
                    { value: 32, name: 'Gobo 1', image: '/gobos/gobo1.svg' },
                    { value: 64, name: 'Gobo 2', image: '/gobos/gobo2.svg' },
                    { value: 96, name: 'Gobo 3', image: '/gobos/gobo3.svg' },
                    { value: 128, name: 'Gobo 4', image: '/gobos/gobo4.svg' },
                    { value: 160, name: 'Gobo 5', image: '/gobos/gobo5.svg' },
                    { value: 192, name: 'Gobo 6', image: '/gobos/gobo6.svg' },
                    { value: 224, name: 'Gobo 7', image: '/gobos/gobo7.svg' }
                  ].map((goboOption) => (<div
                    key={goboOption.value}
                    className={`${styles.goboOption} ${Math.abs(gobo - goboOption.value) <= 16 ? styles.active : ''} ${!hasSelection ? styles.disabled : ''}`}
                    onClick={() => {
                      if (hasSelection) {
                        setGobo(goboOption.value);
                        applyControl('gobo', goboOption.value);
                      }
                    }}
                  >
                    <div className={styles.goboImage}>
                      <img
                        src={goboOption.image}
                        alt={goboOption.name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                      <div className={styles.goboFallback} style={{ display: 'none' }}>
                        <LucideIcon name="Circle" />
                      </div>
                    </div>
                    <span className={styles.goboName}>{goboOption.name}</span>
                    <span className={styles.goboValue}>{goboOption.value}</span>
                  </div>
                  ))}
                </div>
              </div>
              </>
                )}
                {hasControlType('shutter') && (
                  <div className={styles.controlRow}>
                    <label>Shutter</label>
                    {renderMidiButtons('shutter', 'Shutter')}
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={shutter}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setShutter(val);
                        applyControl('shutter', val);
                      }}
                      disabled={!hasSelection}
                    />
                    <span>{shutter}</span>
                  </div>
                )}
                {hasControlType('strobe') && (
                  <div className={styles.controlRow}>
                    <label>Strobe Speed</label>
                    {renderMidiButtons('strobe', 'Strobe')}
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={strobe}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setStrobe(val);
                        applyControl('strobe', val);
                      }}
                      disabled={!hasSelection}
                    />
                    <span>{strobe}</span>
                  </div>
                )}
                {hasControlType('lamp') && (
                  <div className={styles.controlRow}>
                    <label>Lamp Control</label>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={lamp}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setLamp(val);
                        applyControl('lamp', val);
                      }}
                      disabled={!hasSelection}
                    />
                    <span>{lamp}</span>
                  </div>
                )}
                {hasControlType('reset') && (
                  <div className={styles.controlRow}>
                    <label>Reset</label>
                    <button onClick={() => applyControl('reset', 255)} disabled={!hasSelection}>
                      <LucideIcon name="RefreshCw" /> Trigger Reset
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
        )}

        {selectionMode === 'channels' && selectedChannels.length > 0 && (
          <div className={styles.gridItem}>
            <div className={styles.gridItemHeader}>
              <LucideIcon name="Sliders" /> Direct DMX
            </div>
            <div className={styles.gridItemContent}>
              {/* Direct DMX Channel Controls */}
              <div className={styles.dmxChannelSection}>
                <div className={styles.sectionHeader}>
                  <h4>
                    <LucideIcon name="Sliders" />
                    Direct DMX Channel Controls
                  </h4>
                  <span className={styles.channelCount}>
                    {selectedChannels.length} channel(s) selected
                  </span>
                </div>

                <div className={styles.channelControlGrid}>
                  {selectedChannels.map(channelAddress => {
                    const currentValue = getDmxChannelValue(channelAddress);

                    let channelInfo: { fixture: string; type: string; name: string } | null = null;
                    fixtures.forEach(fixture => {
                      fixture.channels.forEach((channel, index) => {
                        const fixtureChannelAddress = fixture.startAddress + index - 1;
                        if (fixtureChannelAddress === channelAddress) {
                          channelInfo = {
                            fixture: fixture.name,
                            type: channel.type,
                            name: channel.name || channel.type
                          };
                        }
                      });
                    });

                    return (
                      <div key={channelAddress} className={styles.dmxChannelControl}>
                        <div className={styles.channelHeader}>
                          <span className={styles.channelNumber}>CH {channelAddress}</span>
                          {channelInfo && (
                            <div className={styles.channelDetails}>
                              <span className={styles.fixtureRef}>{channelInfo.fixture}</span>
                              <span className={styles.channelType}>{channelInfo.type}</span>
                            </div>
                          )}
                        </div>

                        <div className={styles.channelSliderContainer}>
                          <input
                            type="range"
                            min="0"
                            max="255"
                            value={currentValue}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setDmxChannelValue(channelAddress, val);
                            }}
                            className={styles.verticalSlider}
                          />
                          <div className={styles.channelValueDisplay}>
                            <input
                              type="number"
                              min="0"
                              max="255"
                              value={currentValue}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                                setDmxChannelValue(channelAddress, val);
                              }}
                              className={styles.valueInput}
                            />
                          </div>
                        </div>

                        <div className={styles.channelQuickActions}>
                          <button
                            className={styles.quickBtn}
                            onClick={() => setDmxChannelValue(channelAddress, 0)}
                          >
                            0
                          </button>
                          <button
                            className={styles.quickBtn}
                            onClick={() => setDmxChannelValue(channelAddress, 127)}
                          >
                            50%
                          </button>
                          <button
                            className={styles.quickBtn}
                            onClick={() => setDmxChannelValue(channelAddress, 255)}
                          >
                            100%
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Autopilot Panel */}
        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Navigation" /> Enhanced Autopilot
          </div>
          <div className={styles.gridItemContent}>
            {/* Autopilot Enable/Disable */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => {
                  const newState = !autopilotTrackEnabled;
                  setAutopilotTrackEnabled(newState);

                  // If enabling autopilot, start animation and apply initial position
                  if (newState) {
                    console.log('🤖 Autopilot enabled - starting animation and applying initial position');
                    // Start the animation loop
                    startAutopilotTrackAnimation();
                    // Apply initial position immediately
                    setTimeout(() => {
                      updatePanTiltFromTrack();
                    }, 100);
                  } else {
                    console.log('🛑 Autopilot disabled - stopping animation');
                    // Stop the animation loop
                    stopAutopilotTrackAnimation();
                  }
                }}
                style={{
                  background: autopilotTrackEnabled ? '#28a745' : '#6c757d',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <LucideIcon name={autopilotTrackEnabled ? "Play" : "Pause"} />
                {autopilotTrackEnabled ? 'Autopilot ON' : 'Autopilot OFF'}
              </button>
            </div>

            {/* Path Visualization Canvas */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#ccc' }}>
                Path Visualization
              </label>
              <div style={{
                position: 'relative',
                width: '100%',
                height: '200px',
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <canvas
                  ref={pathCanvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block'
                  }}
                />
              </div>
            </div>

            {/* Track Type Selection with Custom Option */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Track Pattern
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={autopilotTrackType}
                  onChange={(e) => {
                    setAutopilotTrackType(e.target.value as any);
                    // Apply new pattern immediately if autopilot is enabled
                    if (autopilotTrackEnabled) {
                      setTimeout(() => updatePanTiltFromTrack(), 50);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#2a2a2a',
                    color: '#fff'
                  }}
                >
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="figure8">Figure 8</option>
                  <option value="triangle">Triangle</option>
                  <option value="linear">Linear</option>
                  <option value="random">Random</option>
                  <option value="custom">Custom Path</option>
                </select>
                {autopilotTrackType === 'custom' && (
                  <button
                    onClick={() => {
                      setShowTrackCustomPathEditor(true);
                    }}
                    style={{
                      background: '#7c3aed',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <LucideIcon name="Edit" />
                    {autopilotTrackCustomPoints && autopilotTrackCustomPoints.length > 0
                      ? `${autopilotTrackCustomPoints.length} points`
                      : 'Create Path'
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Live Position Sliders - These move automatically when autopilot is running */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Position: {autopilotTrackPosition.toFixed(1)}%
                {autopilotTrackEnabled && <span style={{ color: '#28a745', marginLeft: '8px' }}>● LIVE</span>}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={autopilotTrackPosition}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setAutopilotTrackPosition(value);
                  if (autopilotTrackEnabled) {
                    setTimeout(() => updatePanTiltFromTrack(), 10);
                  }
                }}
                style={{
                  width: '100%',
                  background: autopilotTrackEnabled ? 'linear-gradient(90deg, #28a745 0%, #28a745 ' + autopilotTrackPosition + '%, #444 ' + autopilotTrackPosition + '%)' : undefined
                }}
              />
            </div>

            {/* Real-time Pan/Tilt Value Display */}
            {autopilotTrackEnabled && (
              <div style={{
                marginBottom: '12px',
                padding: '8px',
                background: 'rgba(40, 167, 69, 0.1)',
                border: '1px solid rgba(40, 167, 69, 0.3)',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '11px', color: '#28a745', marginBottom: '4px' }}>
                  Live DMX Values:
                </div>
                {(() => {
                  const pos = calculateTrackPosition(
                    autopilotTrackType,
                    autopilotTrackPosition,
                    autopilotTrackSize,
                    autopilotTrackCenterX,
                    autopilotTrackCenterY
                  );
                  return (
                    <div style={{ fontSize: '12px', color: '#ccc' }}>
                      Pan: {pos.pan} | Tilt: {pos.tilt}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Size Slider */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Size: {autopilotTrackSize}
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={autopilotTrackSize}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setAutopilotTrackSize(value);
                  if (autopilotTrackEnabled) {
                    setTimeout(() => updatePanTiltFromTrack(), 10);
                  }
                }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Speed Slider */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Speed: {autopilotTrackSpeed}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={autopilotTrackSpeed}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setAutopilotTrackSpeed(value);
                }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Center Position Controls */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#ccc' }}>
                Center Position
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#aaa' }}>X (Pan): {autopilotTrackCenterX}</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={autopilotTrackCenterX}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setAutopilotTrackCenter(value, autopilotTrackCenterY);
                      if (autopilotTrackEnabled) {
                        setTimeout(() => updatePanTiltFromTrack(), 10);
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#aaa' }}>Y (Tilt): {autopilotTrackCenterY}</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={autopilotTrackCenterY}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setAutopilotTrackCenter(autopilotTrackCenterX, value);
                      if (autopilotTrackEnabled) {
                        setTimeout(() => updatePanTiltFromTrack(), 10);
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Test Button */}
            <button
              onClick={() => {
                if (autopilotTrackEnabled) {
                  updatePanTiltFromTrack();
                  console.log('🎯 Manual position update triggered');
                } else {
                  alert('Enable autopilot first!');
                }
              }}
              disabled={!autopilotTrackEnabled}
              style={{
                background: autopilotTrackEnabled ? '#28a745' : '#6c757d',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                color: 'white',
                cursor: autopilotTrackEnabled ? 'pointer' : 'not-allowed',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <LucideIcon name="Target" />
              Test Position
            </button>
          </div>
        </div>

        {/* Color Autopilot Panel */}
        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Palette" /> Color Autopilot
          </div>
          <div className={styles.gridItemContent}>
            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={toggleColorSliderAutopilot}
                style={{
                  background: colorSliderAutopilot.enabled ? '#10b981' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <LucideIcon name={colorSliderAutopilot.enabled ? "Palette" : "PaintBucket"} />
                {colorSliderAutopilot.enabled ? 'Disable Color Auto' : 'Enable Color Auto'}
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Color Pattern
              </label>
              <select
                value={colorSliderAutopilot.type}
                onChange={(e) => setColorSliderAutopilot({
                  type: e.target.value as 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth'
                })}
                disabled={!colorSliderAutopilot.enabled}
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  background: colorSliderAutopilot.enabled ? '#2a2a2a' : '#1a1a1a',
                  color: colorSliderAutopilot.enabled ? '#fff' : '#666',
                  cursor: colorSliderAutopilot.enabled ? 'pointer' : 'not-allowed'
                }}
              >
                <option value="sine">Rainbow Sine</option>
                <option value="cycle">Rainbow Cycle</option>
                <option value="triangle">Triangle Wave</option>
                <option value="sawtooth">Sawtooth Ramp</option>
                <option value="ping-pong">Ping Pong</option>
                <option value="random">Random Colors</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Speed: {colorSliderAutopilot.speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={colorSliderAutopilot.speed}
                onChange={(e) => setColorSliderAutopilot({ speed: parseFloat(e.target.value) })}
                disabled={!colorSliderAutopilot.enabled}
                style={{
                  width: '100%',
                  cursor: colorSliderAutopilot.enabled ? 'pointer' : 'not-allowed',
                  opacity: colorSliderAutopilot.enabled ? 1 : 0.5
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#ccc',
                cursor: colorSliderAutopilot.enabled ? 'pointer' : 'not-allowed',
                opacity: colorSliderAutopilot.enabled ? 1 : 0.5
              }}>
                <input
                  type="checkbox"
                  checked={colorSliderAutopilot.syncToBPM}
                  onChange={(e) => setColorSliderAutopilot({ syncToBPM: e.target.checked })}
                  disabled={!colorSliderAutopilot.enabled}
                />
                Sync to BPM ({bpm})
              </label>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                Hue Range: {colorSliderAutopilot.range.min}° - {colorSliderAutopilot.range.max}°
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={colorSliderAutopilot.range.min}
                  onChange={(e) => setColorSliderAutopilot({
                    range: { ...colorSliderAutopilot.range, min: parseInt(e.target.value) }
                  })}
                  disabled={!colorSliderAutopilot.enabled}
                  style={{
                    flex: 1,
                    cursor: colorSliderAutopilot.enabled ? 'pointer' : 'not-allowed',
                    opacity: colorSliderAutopilot.enabled ? 1 : 0.5
                  }}
                />
                <span style={{ color: '#888', fontSize: '10px' }}>to</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={colorSliderAutopilot.range.max}
                  onChange={(e) => setColorSliderAutopilot({
                    range: { ...colorSliderAutopilot.range, max: parseInt(e.target.value) }
                  })}
                  disabled={!colorSliderAutopilot.enabled}
                  style={{
                    flex: 1,
                    cursor: colorSliderAutopilot.enabled ? 'pointer' : 'not-allowed',
                    opacity: colorSliderAutopilot.enabled ? 1 : 0.5
                  }}
                />
              </div>
            </div>

            {colorSliderAutopilot.enabled ? (
              <div style={{
                padding: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#10b981'
              }}>
                ✨ Color Autopilot Active! RGB fixtures will cycle through {colorSliderAutopilot.type} pattern.
                {colorSliderAutopilot.syncToBPM && ` Synced to ${bpm} BPM.`}
              </div>
            ) : (
              <div style={{
                padding: '8px',
                background: 'rgba(107, 114, 128, 0.1)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#6b7280'
              }}>
                Enable to automatically cycle colors on RGB fixtures with customizable patterns and BPM sync.
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomPathEditor
        isOpen={showTrackCustomPathEditor}
        onClose={() => setShowTrackCustomPathEditor(false)}
        mode="track"
        initialPoints={autopilotTrackCustomPoints || []}
      />
    </div>
  );
};

export default SuperControl;
