import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { useSuperControlMidiLearn } from '../../hooks/useSuperControlMidiLearn';
import { useSocket } from '../../context/SocketContext';
import ModularAutomation from '../automation/ModularAutomation';
import styles from './SuperControl.module.scss';

interface SuperControlProps {
  isDockable?: boolean;
}

type SelectionMode = 'channels' | 'fixtures' | 'groups' | 'capabilities';

interface FixtureCapability {
  type: string;
  fixtures: string[];
}

const SuperControl: React.FC<SuperControlProps> = ({ isDockable = false }) => {  const {
    fixtures, 
    groups,
    setGroups,
    selectedChannels,
    selectAllChannels,
    deselectAllChannels,
    selectChannel,
    deselectChannel,
    toggleChannelSelection,
    selectedFixtures,
    selectNextFixture,
    selectPreviousFixture,
    selectAllFixtures,    selectFixturesByType,
    selectFixtureGroup,
    deselectAllFixtures,
    setSelectedFixtures,
    toggleFixtureSelection,
    getDmxChannelValue,
    setDmxChannelValue,
    dmxChannels,// Smooth DMX Functions
    smoothDmxEnabled,
    colorSliderAutopilot,
    // setSmoothDmxChannelValue, // TODO: Implement these functions
    // enableSmoothDmxMode,    // flushSmoothDmxUpdates,
    // Autopilot Track System
    autopilotTrackEnabled,
    autopilotTrackType,
    autopilotTrackPosition,
    autopilotTrackSize,
    autopilotTrackSpeed,
    autopilotTrackCenterX,
    autopilotTrackCenterY,
    autopilotTrackAutoPlay,
    setAutopilotTrackEnabled,
    setAutopilotTrackType,
    setAutopilotTrackPosition,
    setAutopilotTrackSize,
    setAutopilotTrackSpeed,
    setAutopilotTrackCenter,
    setAutopilotTrackAutoPlay,
    updatePanTiltFromTrack,
    calculateTrackPosition,
    midiMessages,
    superControlOscAddresses,
    setSuperControlOscAddress
  } = useStore();  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('fixtures');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [showOnlyAssignedChannels, setShowOnlyAssignedChannels] = useState(false);
  
  // Column layout state (2 or 3 columns)
  const [columnLayout, setColumnLayout] = useState<'2' | '3'>(() => {
    try {
      const saved = localStorage.getItem('superControlColumnLayout');
      return (saved === '2' || saved === '3') ? saved : '3';
    } catch (e) {
      return '3';
    }
  });  // MIDI Learn functionality
  const {
    startLearn: startSuperControlMidiLearn,
    cancelLearn: cancelSuperControlMidiLearn,
    forgetMapping: forgetSuperControlMidiMapping,
    isLearning: isSuperControlLearning,
    learnStatus: superControlLearnStatus,
    currentLearningControlName,
    mappings: superControlMappings,
    processMidiForControl
  } = useSuperControlMidiLearn();

  // Log fixtures prop changes
  useEffect(() => {
    console.log('[SuperControl] Fixtures updated:', fixtures.map(f => f.id));
  }, [fixtures]);

  // Log selectedFixtures state changes
  useEffect(() => {
    console.log('[SuperControl] selectedFixtures state updated:', selectedFixtures);
  }, [selectedFixtures]);
  // Auto-select first fixture if none are selected in fixtures mode
  useEffect(() => {
    if (selectionMode === 'fixtures' && fixtures.length > 0 && selectedFixtures.length === 0) {
      console.log('[SuperControl] Auto-selecting first fixture:', fixtures[0].id);
      setSelectedFixtures([fixtures[0].id]);
    }
  }, [selectionMode, fixtures, selectedFixtures, setSelectedFixtures]);

  // Debug selection mode changes
  useEffect(() => {
    console.log('[SuperControl] Selection mode changed to:', selectionMode);
    console.log('[SuperControl] Current selectedFixtures:', selectedFixtures);
    console.log('[SuperControl] Available fixtures:', fixtures.map(f => ({ id: f.id, name: f.name })));
  }, [selectionMode, selectedFixtures, fixtures]);

  // Group Navigation Functions
  const selectNextGroup = () => {
    if (groups.length === 0) return;
    const currentIndex = selectedGroups.length > 0 
      ? groups.findIndex(g => (g.id || g.name) === selectedGroups[0])
      : -1;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % groups.length;
    const nextGroup = groups[nextIndex];
    if (nextGroup) {
      setSelectedGroups([nextGroup.id || nextGroup.name]);
      setSelectionMode('groups');
      selectFixtureGroup(nextGroup.id || nextGroup.name);
    }
  };

  const selectPreviousGroup = () => {
    if (groups.length === 0) return;
    const currentIndex = selectedGroups.length > 0 
      ? groups.findIndex(g => (g.id || g.name) === selectedGroups[0])
      : -1;
    const prevIndex = currentIndex <= 0 ? groups.length - 1 : currentIndex - 1;
    const prevGroup = groups[prevIndex];
    if (prevGroup) {
      setSelectedGroups([prevGroup.id || prevGroup.name]);
      setSelectionMode('groups');
      selectFixtureGroup(prevGroup.id || prevGroup.name);
    }
  };

  // Fixture Selection Action Handlers for MIDI Learn
  const handleFixtureSelectionAction = (actionType: string, param?: string) => {
    console.log(`[SuperControl] Fixture selection action: ${actionType}`, param);
    
    switch (actionType) {
      case 'next':
        selectNextFixture();
        break;
      case 'previous':
        selectPreviousFixture();
        break;
      case 'selectAll':
        selectAllFixtures();
        break;
      case 'deselectAll':
        deselectAllFixtures();
        break;
      case 'byTypeMoving':
        selectFixturesByType('pan');
        break;
      case 'byTypeRGB':
        selectFixturesByType('red');
        break;
      case 'byTypeDimmer':
        selectFixturesByType('dimmer');
        break;
      case 'byTypeGobo':
        selectFixturesByType('gobo');
        break;
      case 'group':
        if (param) {
          const group = groups.find(g => g.name === param);
          if (group) {
            selectFixtureGroup(group.id);
          }
        }
        break;
      case 'groupNext':
        selectNextGroup();
        break;
      case 'groupPrevious':
        selectPreviousGroup();
        break;
      default:
        console.warn(`Unknown fixture selection action: ${actionType}`);
    }
  };

  // MIDI processing for SuperControl
  useEffect(() => {
    if (!midiMessages || midiMessages.length === 0) return;

    const latestMessage = midiMessages[midiMessages.length - 1];
    
    // Create control handlers for MIDI
    const controlHandlers: Record<string, (value: number) => void> = {
      // Slider controls
      dimmer: (value) => {
        setDimmer(value);
        applyControl('dimmer', value);
      },
      pan: (value) => {
        setPanValue(value);
        applyControl('pan', value);
      },
      tilt: (value) => {
        setTiltValue(value);
        applyControl('tilt', value);
      },
      red: (value) => {
        setRed(value);
        applyControl('red', value);
      },
      green: (value) => {
        setGreen(value);
        applyControl('green', value);
      },
      blue: (value) => {
        setBlue(value);
        applyControl('blue', value);
      },
      gobo: (value) => {
        setGobo(value);
        applyControl('gobo', value);
      },
      shutter: (value) => {
        setShutter(value);
        applyControl('shutter', value);
      },
      strobe: (value) => {
        setStrobe(value);
        applyControl('strobe', value);
      },
      // Additional Controls
      focus: (value) => {
        setFocus(value);
        applyControl('focus', value);
      },
      iris: (value) => {
        setIris(value);
        applyControl('iris', value);
      },
      prism: (value) => {
        setPrism(value);
        applyControl('prism', value);
      },
      colorWheel: (value) => {
        setColorWheel(value);
        applyControl('colorwheel', value);
      },
      goboRotation: (value) => {
        setGoboRotation(value);
        applyControl('gobo_rotation', value);
      },
      finePan: (value) => {
        setFinePanValue(value);
        applyControl('fine_pan', value);
      },
      fineTilt: (value) => {
        setFineTiltValue(value);
        applyControl('fine_tilt', value);
      },
      // Fixture selection actions (bang controls)
      fixture_next: () => handleFixtureSelectionAction('next'),
      fixture_previous: () => handleFixtureSelectionAction('previous'),
      fixture_selectAll: () => handleFixtureSelectionAction('selectAll'),
      fixture_deselectAll: () => handleFixtureSelectionAction('deselectAll'),
      fixture_byTypeMoving: () => handleFixtureSelectionAction('byTypeMoving'),
      fixture_byTypeRGB: () => handleFixtureSelectionAction('byTypeRGB'),
      fixture_byTypeDimmer: () => handleFixtureSelectionAction('byTypeDimmer'),
      fixture_byTypeGobo: () => handleFixtureSelectionAction('byTypeGobo'),
      // Group navigation actions
      group_next: () => handleFixtureSelectionAction('groupNext'),
      group_previous: () => handleFixtureSelectionAction('groupPrevious'),
    };

    // Add group selection handlers dynamically
    groups.forEach(group => {
      controlHandlers[`fixture_group_${group.name}`] = () => handleFixtureSelectionAction('group', group.name);
    });

    processMidiForControl(latestMessage, controlHandlers);
  }, [midiMessages, groups, processMidiForControl]);

  // OSC message handling for SuperControl
  const { socket, connected: socketConnected } = useSocket();
  
  useEffect(() => {
    if (!socket || !socketConnected) return;
    
    const handleSuperControlOsc = (data: { controlName: string; value: number; address: string }) => {
      const { controlName, value } = data;
      
      // Normalize value from 0.0-1.0 to 0-255 for DMX
      const dmxValue = Math.round(Math.max(0, Math.min(1, value)) * 255);
      
      console.log(`[SuperControl] OSC received: ${controlName} = ${value} (${dmxValue} DMX) from ${data.address}`);
      
      // Map OSC control names to SuperControl handlers
      const controlHandlers: Record<string, (value: number) => void> = {
        // Slider controls
        dimmer: (val) => {
          setDimmer(val);
          applyControl('dimmer', val);
        },
        pan: (val) => {
          setPanValue(val);
          applyControl('pan', val);
          // Sync with XY pad
          setPanTiltXY(prev => ({ ...prev, x: (val / 255) * 100 }));
        },
        tilt: (val) => {
          setTiltValue(val);
          applyControl('tilt', val);
          // Sync with XY pad (invert Y for display)
          setPanTiltXY(prev => ({ ...prev, y: ((255 - val) / 255) * 100 }));
        },
        red: (val) => {
          setRed(val);
          applyControl('red', val);
        },
        green: (val) => {
          setGreen(val);
          applyControl('green', val);
        },
        blue: (val) => {
          setBlue(val);
          applyControl('blue', val);
        },
        gobo: (val) => {
          setGobo(val);
          applyControl('gobo', val);
        },
        shutter: (val) => {
          setShutter(val);
          applyControl('shutter', val);
        },
        strobe: (val) => {
          setStrobe(val);
          applyControl('strobe', val);
        },
        focus: (val) => {
          setFocus(val);
          applyControl('focus', val);
        },
        zoom: (val) => {
          setZoom(val);
          applyControl('zoom', val);
        },
        iris: (val) => {
          setIris(val);
          applyControl('iris', val);
        },
        prism: (val) => {
          setPrism(val);
          applyControl('prism', val);
        },
        colorwheel: (val) => {
          setColorWheel(val);
          applyControl('colorWheel', val);
        },
        'gobo/rotation': (val) => {
          setGoboRotation(val);
          applyControl('goboRotation', val);
        },
        'pan/fine': (val) => {
          setFinePanValue(val);
          applyControl('finePan', val);
        },
        'tilt/fine': (val) => {
          setFineTiltValue(val);
          applyControl('fineTilt', val);
        },
        gobo2: (val) => {
          setGobo2(val);
          applyControl('gobo2', val);
        },
        frost: (val) => {
          setFrost(val);
          applyControl('frost', val);
        },
        macro: (val) => {
          setMacro(val);
          applyControl('macro', val);
        },
        speed: (val) => {
          setSpeed(val);
          applyControl('speed', val);
        },
        // Autopilot controls
        'autopilot/enabled': (val) => {
          setAutopilotTrackEnabled(val > 127);
        },
        'autopilot/type': (val) => {
          const types = ['circle', 'square', 'figure8', 'triangle', 'linear', 'random'];
          const typeIndex = Math.round((val / 255) * (types.length - 1));
          setAutopilotTrackType(types[typeIndex] as any);
        },
        'autopilot/position': (val) => {
          setAutopilotTrackPosition(Math.round((val / 255) * 100));
        },
        'autopilot/size': (val) => {
          setAutopilotTrackSize(Math.round((val / 255) * 100));
        },
        'autopilot/speed': (val) => {
          setAutopilotTrackSpeed((val / 255) * 100);
        },
        'autopilot/center/x': (val) => {
          setAutopilotTrackCenter(val, autopilotTrackCenterY);
        },
        'autopilot/center/y': (val) => {
          setAutopilotTrackCenter(autopilotTrackCenterX, val);
        },
        'autopilot/autoplay': (val) => {
          setAutopilotTrackAutoPlay(val > 127);
        },
      };
      
      // Execute handler if found
      const handler = controlHandlers[controlName];
      if (handler) {
        handler(dmxValue);
      } else {
        // Handle action controls (bang/trigger - value > 127 triggers)
        if (controlName === 'action/flash' && dmxValue > 127) {
          handleFlash();
        } else if (controlName === 'action/strobe/toggle' && dmxValue > 127) {
          handleStrobe();
        } else if (controlName === 'action/reset/all' && dmxValue > 127) {
          handleResetAll();
        } else if (controlName === 'action/flash/speed') {
          setFlashSpeed(Math.round((dmxValue / 255) * 500));
        } else if (controlName === 'action/strobe/speed') {
          setStrobeSpeed(Math.round((dmxValue / 255) * 20));
        } else if (controlName === 'action/pantilt/center' && dmxValue > 127) {
          resetPanTiltToCenter();
        } else if (controlName === 'action/pantilt/fine/reset' && dmxValue > 127) {
          setFinePanValue(0);
          setFineTiltValue(0);
          applyControl('finePan', 0);
          applyControl('fineTilt', 0);
        } else if (controlName === 'scene/next' && dmxValue > 127) {
          selectNextScene();
        } else if (controlName === 'scene/prev' && dmxValue > 127) {
          selectPreviousScene();
        } else if (controlName === 'scene/save' && dmxValue > 127) {
          captureCurrentScene();
        } else if (controlName === 'fixture/next' && dmxValue > 127) {
          selectNextFixture();
        } else if (controlName === 'fixture/prev' && dmxValue > 127) {
          selectPreviousFixture();
        } else if (controlName === 'fixture/selectall' && dmxValue > 127) {
          selectAllFixtures();
        } else if (controlName === 'fixture/deselectall' && dmxValue > 127) {
          deselectAllFixtures();
        } else if (controlName === 'fixture/type/moving' && dmxValue > 127) {
          selectFixturesByType('pan');
        } else if (controlName === 'fixture/type/rgb' && dmxValue > 127) {
          selectFixturesByType('red');
        } else if (controlName === 'fixture/type/dimmer' && dmxValue > 127) {
          selectFixturesByType('dimmer');
        } else if (controlName === 'fixture/type/gobo' && dmxValue > 127) {
          selectFixturesByType('gobo');
        } else if (controlName === 'group/next' && dmxValue > 127) {
          selectNextGroup();
        } else if (controlName === 'group/prev' && dmxValue > 127) {
          selectPreviousGroup();
        } else if (controlName.startsWith('group/select/') && dmxValue > 127) {
          const groupName = controlName.replace('group/select/', '');
          const group = groups.find(g => g.name === groupName || g.id === groupName);
          if (group) {
            selectFixtureGroup(group.id);
          }
        } else {
          console.warn(`[SuperControl] Unknown OSC control: ${controlName} from ${data.address}`);
        }
      }
    };
    
    socket.on('superControlOsc', handleSuperControlOsc);
    
    return () => {
      socket.off('superControlOsc', handleSuperControlOsc);
    };
  }, [socket, socketConnected, groups, selectNextFixture, selectPreviousFixture, selectAllFixtures, deselectAllFixtures, selectFixturesByType, selectFixtureGroup, selectNextGroup, selectPreviousGroup, setAutopilotTrackEnabled, setAutopilotTrackType, setAutopilotTrackPosition, setAutopilotTrackSize, setAutopilotTrackSpeed, setAutopilotTrackCenter, setAutopilotTrackAutoPlay, autopilotTrackCenterX, autopilotTrackCenterY]);

  // Sync SuperControl sliders with actual DMX channel values
  // This is crucial for showing autocolor/autopilot updates in the UI
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const affectedFixtures = getAffectedFixtures();
      
      if (affectedFixtures.length > 0) {
        // Take the first fixture as reference for display values
        const referenceFixture = affectedFixtures[0];
        
        // Sync color values (RGB)
        const redChannel = referenceFixture.channels.find(c => c.type === 'red');
        if (redChannel) {
          let redAddress: number;
          if (redChannel.dmxAddress !== undefined) {
            redAddress = redChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(redChannel);
            redAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentRed = getDmxChannelValue(redAddress);
          if (currentRed !== undefined && currentRed !== red) {
            setRed(currentRed);
          }
        }
        
        const greenChannel = referenceFixture.channels.find(c => c.type === 'green');
        if (greenChannel) {
          let greenAddress: number;
          if (greenChannel.dmxAddress !== undefined) {
            greenAddress = greenChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(greenChannel);
            greenAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentGreen = getDmxChannelValue(greenAddress);
          if (currentGreen !== undefined && currentGreen !== green) {
            setGreen(currentGreen);
          }
        }
        
        const blueChannel = referenceFixture.channels.find(c => c.type === 'blue');
        if (blueChannel) {
          let blueAddress: number;
          if (blueChannel.dmxAddress !== undefined) {
            blueAddress = blueChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(blueChannel);
            blueAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentBlue = getDmxChannelValue(blueAddress);
          if (currentBlue !== undefined && currentBlue !== blue) {
            setBlue(currentBlue);
          }
        }
        
        // Sync dimmer
        const dimmerChannel = referenceFixture.channels.find(c => c.type === 'dimmer');
        if (dimmerChannel) {
          let dimmerAddress: number;
          if (dimmerChannel.dmxAddress !== undefined) {
            dimmerAddress = dimmerChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(dimmerChannel);
            dimmerAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentDimmer = getDmxChannelValue(dimmerAddress);
          if (currentDimmer !== undefined && currentDimmer !== dimmer) {
            setDimmer(currentDimmer);
          }
        }
        
        // Sync pan/tilt
        const panChannel = referenceFixture.channels.find(c => c.type === 'pan');
        if (panChannel) {
          let panAddress: number;
          if (panChannel.dmxAddress !== undefined) {
            panAddress = panChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(panChannel);
            panAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentPan = getDmxChannelValue(panAddress);
          if (currentPan !== undefined && currentPan !== panValue) {
            setPanValue(currentPan);
            // Update XY pad position
            const newX = (currentPan / 255) * 100;
            setPanTiltXY(prev => ({ ...prev, x: newX }));
          }
        }
        
        const tiltChannel = referenceFixture.channels.find(c => c.type === 'tilt');
        if (tiltChannel) {
          let tiltAddress: number;
          if (tiltChannel.dmxAddress !== undefined) {
            tiltAddress = tiltChannel.dmxAddress;
          } else {
            const channelIndex = referenceFixture.channels.indexOf(tiltChannel);
            tiltAddress = (referenceFixture.startAddress || 1) + channelIndex - 1;
          }
          const currentTilt = getDmxChannelValue(tiltAddress);
          if (currentTilt !== undefined && currentTilt !== tiltValue) {
            setTiltValue(currentTilt);
            // Update XY pad position (invert Y axis)
            const newY = (1 - currentTilt / 255) * 100;
            setPanTiltXY(prev => ({ ...prev, y: newY }));
          }
        }
      }
    }, 100); // Update every 100ms for responsive UI
    
    return () => clearInterval(syncInterval);
  }, [selectedFixtures, fixtures, getDmxChannelValue]);

  // Basic Control State
  const [dimmer, setDimmer] = useState(255);
  const [panValue, setPanValue] = useState(127);
  const [tiltValue, setTiltValue] = useState(127);
  const [finePanValue, setFinePanValue] = useState(0);
  const [fineTiltValue, setFineTiltValue] = useState(0);
  const [red, setRed] = useState(255);
  const [green, setGreen] = useState(255);
  const [blue, setBlue] = useState(255);
  const [gobo, setGobo] = useState(0);
  const [shutter, setShutter] = useState(255);
  const [strobe, setStrobe] = useState(0);
  const [lamp, setLamp] = useState(255);
  const [reset, setReset] = useState(0);

  // Enhanced Movement Controls
  const [focus, setFocus] = useState(127);
  const [zoom, setZoom] = useState(127);
  const [iris, setIris] = useState(255);  const [prism, setPrism] = useState(0);
  const [colorWheel, setColorWheel] = useState(0);
  const [goboRotation, setGoboRotation] = useState(127);
  const [gobo2, setGobo2] = useState(0);
  const [frost, setFrost] = useState(0);
  const [macro, setMacro] = useState(0);
  const [speed, setSpeed] = useState(127);
  
  // Enhanced button controls
  const [isFlashing, setIsFlashing] = useState(false);
  const [isStrobing, setIsStrobing] = useState(false);
  const [flashSpeed, setFlashSpeed] = useState(100);
  const [strobeSpeed, setStrobeSpeed] = useState(10);
  
  // GOBO presets for common gobo types
  const goboPresets = [
    { id: 0, name: 'Open', value: 0, icon: '○' },
    { id: 1, name: 'Dots', value: 32, icon: '⋅⋅⋅' },
    { id: 2, name: 'Lines', value: 64, icon: '|||' },
    { id: 3, name: 'Breakup', value: 96, icon: '◦◉◦' },
    { id: 4, name: 'Stars', value: 128, icon: '✦' },
    { id: 5, name: 'Spiral', value: 160, icon: '🌀' },
    { id: 6, name: 'Prism', value: 192, icon: '◆' },
    { id: 7, name: 'Pattern', value: 224, icon: '⟐' }
  ];

  // XY Pad state
  const [panTiltXY, setPanTiltXY] = useState({ x: 50, y: 50 });
  const xyPadRef = useRef<HTMLDivElement>(null);
  const [isDraggingXY, setIsDraggingXY] = useState(false);

  // Color wheel state
  const [colorHue, setColorHue] = useState(0);
  const [colorSaturation, setColorSaturation] = useState(100);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  // MIDI Learn state
  const [midiLearnTarget, setMidiLearnTarget] = useState<string | null>(null);
  // OSC addresses are now stored in the global store (superControlOscAddresses)

  // Enhanced MIDI Learn state with range support
  const [midiMappings, setMidiMappings] = useState<Record<string, {
    channel?: number;
    note?: number;
    cc?: number;
    minValue: number;
    maxValue: number;
    oscAddress?: string;
  }>>({});

  // Scene management state
  const [scenes, setScenes] = useState<Array<{
    id: string;
    name: string;
    values: Record<number, number>; // DMX channel -> value
    timestamp: number;
  }>>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneAutoSave, setSceneAutoSave] = useState(false);
  
  // OSC Help state
  const [showOscHelp, setShowOscHelp] = useState(false);

  // Helper functions
  const getFixtureCapabilities = (): FixtureCapability[] => {
    const capabilities: Record<string, string[]> = {};
    
    // Map channel types to capability categories
    const capabilityMap: Record<string, string> = {
      'pan': 'PAN TILT',
      'tilt': 'PAN TILT',
      'pan fine': 'PAN TILT',
      'tilt fine': 'PAN TILT',
      'pan_fine': 'PAN TILT',
      'tilt_fine': 'PAN TILT',
      'finepan': 'PAN TILT',
      'finetilt': 'PAN TILT',
      'fine_pan': 'PAN TILT',
      'fine_tilt': 'PAN TILT',
      'red': 'COLOR',
      'green': 'COLOR',
      'blue': 'COLOR',
      'white': 'COLOR',
      'amber': 'COLOR',
      'cyan': 'COLOR',
      'magenta': 'COLOR',
      'yellow': 'COLOR',
      'uv': 'UV',
      'uv light': 'UV',
      'ultraviolet': 'UV',
      'laser': 'LASER',
      'laser on/off': 'LASER',
      'laser_on_off': 'LASER',
      'color wheel': 'COLOR',
      'color_wheel': 'COLOR',
      'gobo': 'GOBO',
      'gobo rotation': 'GOBO',
      'gobo_rotation': 'GOBO',
      'gobo_wheel': 'GOBO',
      'strobe': 'STROBE',
      'shutter': 'SHUTTER',
      'dimmer': 'DIMMER',
      'intensity': 'DIMMER',
      'zoom': 'ZOOM',
      'focus': 'FOCUS',
      'prism': 'PRISM',
      'frost': 'FROST',
      'diffusion': 'FROST',
      'iris': 'IRIS',
      'animation': 'EFFECTS',
      'animation_speed': 'EFFECTS',
      'effect': 'EFFECTS',
      'speed': 'EFFECTS',
      'macro': 'MACRO',
      'cto': 'COLOR TEMP',
      'ctb': 'COLOR TEMP',
      'color_temperature_orange': 'COLOR TEMP',
      'color_temperature_blue': 'COLOR TEMP'
    };
    
    fixtures.forEach(fixture => {
      // Skip fixtures without channels
      if (!fixture.channels || fixture.channels.length === 0) {
        return;
      }
      
      const fixtureCapabilities = new Set<string>();
      
      fixture.channels.forEach(channel => {
        // Skip channels without a type
        if (!channel || !channel.type) {
          return;
        }
        
        const channelType = channel.type.toLowerCase().trim();
        const capability = capabilityMap[channelType] || channelType.toUpperCase();
        fixtureCapabilities.add(capability);
      });

      fixtureCapabilities.forEach(capability => {
        if (!capabilities[capability]) {
          capabilities[capability] = [];
        }
        if (!capabilities[capability].includes(fixture.id)) {
          capabilities[capability].push(fixture.id);
        }
      });
    });
    
    // Sort by fixture count (most fixtures first)
    return Object.entries(capabilities)
      .map(([type, fixtureIds]) => ({
        type,
        fixtures: fixtureIds
      }))
      .sort((a, b) => b.fixtures.length - a.fixtures.length);
  };

  const getAffectedFixtures = () => {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [getAffectedFixtures]`;

    console.log(`${logPrefix} Called. selectionMode: ${selectionMode}`);
    console.log(`${logPrefix} All fixtures in store:`, fixtures.map(f => f.id));

    let affectedFixtures: any[] = [];

    if (selectionMode === 'channels') {
      console.log(`${logPrefix} Mode: channels. Selected channels:`, selectedChannels);
      if (selectedChannels.length > 0) {
        affectedFixtures = fixtures.filter(fixture =>
          fixture.channels.some(channel =>
            selectedChannels.includes(channel.dmxAddress || 0)
          )
        );
      }
    } else if (selectionMode === 'fixtures') {
      const storeSelectedFixtures = useStore.getState().selectedFixtures;
      console.log(`${logPrefix} Mode: fixtures. Selected fixtures (prop):`, selectedFixtures);
      console.log(`${logPrefix} Mode: fixtures. Selected fixtures (store):`, storeSelectedFixtures);
      if (storeSelectedFixtures.length > 0) {
        affectedFixtures = fixtures.filter(fixture =>
          storeSelectedFixtures.includes(fixture.id) // Use fixture.id
        );
      }
    } else if (selectionMode === 'groups') {
      console.log(`${logPrefix} Mode: groups. Selected groups:`, selectedGroups);
      if (selectedGroups.length > 0) {
        const groupFixturesNames = groups
          .filter(group => selectedGroups.includes(group.name))
          .flatMap(group => group.fixtureIndices.map(idx => fixtures[idx]?.name).filter(Boolean));
        affectedFixtures = fixtures.filter(fixture =>
          groupFixturesNames.includes(fixture.name)
        );
      }
    } else if (selectionMode === 'capabilities') {
      console.log(`${logPrefix} Mode: capabilities. Selected capabilities:`, selectedCapabilities);
      if (selectedCapabilities.length > 0) {
        affectedFixtures = fixtures.filter(fixture =>
          fixture.channels.some(channel =>
            selectedCapabilities.includes(channel.type)
          )
        );
      }
    }

    console.log(`${logPrefix} Affected fixtures before return:`, affectedFixtures.map(f => f.id));
    if (affectedFixtures.length === 0) {
      console.log(`${logPrefix} No fixtures affected - no valid selection or empty selection.`);
    }
    return affectedFixtures;
  };

  const applyControl = (controlType: string, value: number) => {
    console.log(`[SuperControl] applyControl: Entered. controlType=${controlType}, value=${value}`);
    const affectedFixtures = getAffectedFixtures();
    console.log(`[SuperControl] 🎛️ applyControl: Affected fixtures length from getAffectedFixtures(): ${affectedFixtures.length}`);
    // The existing log above is slightly different from the one requested to be here, 
    // but it serves a similar purpose of logging type, value, and count. I'll keep it and add the new ones.

    console.log(`[SuperControl] Selection mode: ${selectionMode}`);
    
    if (selectionMode === 'channels') {
      console.log(`[SuperControl] Selected channels:`, selectedChannels);
    } else if (selectionMode === 'fixtures') {
      console.log(`[SuperControl] Selected fixtures (prop):`, selectedFixtures); // Note: SuperControl uses prop selectedFixtures here
    } else if (selectionMode === 'groups') {
      console.log(`[SuperControl] Selected groups:`, selectedGroups);
    } else if (selectionMode === 'capabilities') {
      console.log(`[SuperControl] Selected capabilities:`, selectedCapabilities);
    }
    
    if (affectedFixtures.length === 0) {
      console.warn('[SuperControl] ❌ No fixtures to apply control to - please select fixtures first!');
      console.warn('[SuperControl] 💡 Try clicking "Select All" or choose specific fixtures to control');
      console.log('[SuperControl] applyControl: No affected fixtures. Will not call setDmxChannelValue.');
      return;
    }
    
    console.log(`[SuperControl] applyControl: Processing ${affectedFixtures.length} affected fixtures.`);
    console.log(`[SuperControl] ✅ Applying ${controlType}=${value} to ${affectedFixtures.length} fixtures:`);
    affectedFixtures.forEach(fixture => console.log(`  - ${fixture.name} (channels: ${fixture.startAddress}-${fixture.startAddress + fixture.channels.length - 1})`));
    
    let updateCount = 0;
    let errorCount = 0;
      affectedFixtures.forEach((fixture, index) => {
      const channels = fixture.channels;
      
      // Find the channel by type first  
      let foundChannel: any = null;
      
      // Enhanced channel finding with multiple matching patterns
      switch (controlType) {
        case 'dimmer':
          foundChannel = channels.find(c => c.type === 'dimmer');
          break;
        case 'pan':
          foundChannel = channels.find(c => c.type === 'pan');
          break;
        case 'finePan':
          foundChannel = channels.find(c => c.type === 'finePan' || c.type === 'fine_pan' || c.type === 'pan_fine');
          break;
        case 'tilt':
          foundChannel = channels.find(c => c.type === 'tilt');
          break;
        case 'fineTilt':
          foundChannel = channels.find(c => c.type === 'fineTilt' || c.type === 'fine_tilt' || c.type === 'tilt_fine');
          break;
        case 'red':
          foundChannel = channels.find(c => c.type.toLowerCase() === 'red' || c.type.toLowerCase() === 'r');
          break;
        case 'green':
          foundChannel = channels.find(c => c.type.toLowerCase() === 'green' || c.type.toLowerCase() === 'g');
          break;
        case 'blue':
          foundChannel = channels.find(c => c.type.toLowerCase() === 'blue' || c.type.toLowerCase() === 'b');
          break;
        case 'gobo':
          foundChannel = channels.find(c => c.type === 'gobo');
          break;
        case 'goboRotation':
          foundChannel = channels.find(c => c.type === 'goboRotation' || c.type === 'gobo_rotation');
          break;
        case 'gobo2':
          foundChannel = channels.find(c => c.type === 'gobo2');
          break;
        case 'shutter':
          foundChannel = channels.find(c => c.type === 'shutter');
          break;
        case 'strobe':
          foundChannel = channels.find(c => c.type === 'strobe');
          break;
        case 'lamp':
          foundChannel = channels.find(c => c.type === 'lamp');
          break;
        case 'reset':
          foundChannel = channels.find(c => c.type === 'reset');
          break;
        case 'focus':
          foundChannel = channels.find(c => c.type === 'focus');
          break;
        case 'zoom':
          foundChannel = channels.find(c => c.type === 'zoom');
          break;
        case 'iris':
          foundChannel = channels.find(c => c.type === 'iris');
          break;
        case 'prism':
          foundChannel = channels.find(c => c.type === 'prism');
          break;
        case 'colorWheel':
          foundChannel = channels.find(c => c.type === 'colorWheel' || c.type === 'color_wheel');
          break;
        case 'frost':
          foundChannel = channels.find(c => c.type === 'frost');
          break;
        case 'macro':
          foundChannel = channels.find(c => c.type === 'macro');
          break;
        case 'speed':
          foundChannel = channels.find(c => c.type === 'speed');
          break;
        default:
          console.warn(`[SuperControl] ⚠️ Unknown control type: ${controlType}`);
          break;
      }
      
      let targetChannel = -1;
      
      if (foundChannel) {
        // Calculate DMX address if missing
        if (foundChannel.dmxAddress !== undefined && foundChannel.dmxAddress !== null && foundChannel.dmxAddress >= 1) {
          // Use explicit dmxAddress if provided (1-based), convert to 0-based
          targetChannel = foundChannel.dmxAddress - 1;
          console.log(`[SuperControl] Using explicit DMX address for ${fixture.name} channel ${foundChannel.type}: ${targetChannel + 1} (0-based: ${targetChannel})`);
        } else {
          // Calculate DMX address: startAddress + channel index
          const channelIndex = channels.indexOf(foundChannel);
          // startAddress is 1-based, channelIndex is 0-based, so we need to convert
          targetChannel = (fixture.startAddress || 1) + channelIndex - 1; // Convert to 0-based
          console.log(`[SuperControl] Calculated DMX address for ${fixture.name} channel ${foundChannel.type}: ${targetChannel + 1} (0-based: ${targetChannel}, startAddress: ${fixture.startAddress}, index: ${channelIndex})`);
        }
      }
      
      if (targetChannel >= 0 && targetChannel < 512) {
        // Clamp value to valid DMX range
        const clampedValue = Math.max(0, Math.min(255, Math.round(value)));
        console.log(`[DMX] 📡 Setting channel ${targetChannel + 1} (0-based: ${targetChannel}) to ${clampedValue} for ${controlType} on fixture "${fixture.name}"`);
        setDmxChannelValue(targetChannel, clampedValue);
        updateCount++;
        
        // Verification with more detailed logging
        setTimeout(() => {
          const actualValue = getDmxChannelValue(targetChannel);
          if (actualValue === clampedValue) {
            console.log(`[DMX] ✅ Verification SUCCESS: Channel ${targetChannel + 1} = ${actualValue} (${controlType})`);
          } else {
            console.error(`[DMX] ❌ Verification FAILED: Channel ${targetChannel + 1} = ${actualValue}, expected ${clampedValue} (${controlType})`);
          }
        }, 50);
      } else {
        console.error(`[DMX] ❌ ERROR: No valid target channel found for ${controlType} in fixture "${fixture.name}"`, {
          fixtureChannels: channels.map(c => ({ type: c.type, dmxAddress: c.dmxAddress, name: c.name })),
          requestedControlType: controlType,
          calculatedTargetChannel: targetChannel
        });
        errorCount++;
      }
    });
    
    // Summary logging
    console.log(`[SuperControl] 📊 Control application summary: ${updateCount} successful updates, ${errorCount} errors`);
    
    if (errorCount > 0) {
      console.warn(`[SuperControl] ⚠️ Some controls failed to apply. Check fixture definitions and channel mappings.`);
    }
  };
  // OSC Address Management (now using global store)

  // Get DMX channel assignments for a control type
  // Check if a control has an active DMX channel
  // Helper function to check if a control type exists in selected fixtures
  const hasControlType = (controlType: string): boolean => {
    const affectedFixtures = getAffectedFixtures();
    if (affectedFixtures.length === 0) return false;
    
    return affectedFixtures.some((fixtureObj: any) => {
      const fixture = fixtureObj.fixture || fixtureObj;
      const channels = fixture.channels || [];
      
      const foundChannel = channels.find((c: any) => {
        const channelType = c.type?.toLowerCase() || '';
        return channelType === controlType.toLowerCase() || 
               (controlType === 'pan' && (channelType.includes('pan') && !channelType.includes('fine'))) ||
               (controlType === 'tilt' && (channelType.includes('tilt') && !channelType.includes('fine'))) ||
               (controlType === 'finePan' && (channelType.includes('pan_fine') || channelType.includes('fine_pan'))) ||
               (controlType === 'fineTilt' && (channelType.includes('tilt_fine') || channelType.includes('fine_tilt'))) ||
               (controlType === 'red' && (channelType.includes('red') || channelType === 'r')) ||
               (controlType === 'green' && (channelType.includes('green') || channelType === 'g')) ||
               (controlType === 'blue' && (channelType.includes('blue') || channelType === 'b')) ||
               (controlType === 'white' && channelType.includes('white')) ||
               (controlType === 'dimmer' && channelType.includes('dimmer')) ||
               (controlType === 'strobe' && channelType.includes('strobe')) ||
               (controlType === 'shutter' && channelType.includes('shutter')) ||
               (controlType === 'gobo' && (channelType.includes('gobo') && !channelType.includes('rotation') && !channelType.includes('2'))) ||
               (controlType === 'goboRotation' && (channelType.includes('gobo_rotation') || channelType.includes('goborotation'))) ||
               (controlType === 'gobo2' && channelType.includes('gobo2')) ||
               (controlType === 'zoom' && channelType.includes('zoom')) ||
               (controlType === 'focus' && channelType.includes('focus')) ||
               (controlType === 'iris' && channelType.includes('iris')) ||
               (controlType === 'prism' && channelType.includes('prism')) ||
               (controlType === 'frost' && channelType.includes('frost')) ||
               (controlType === 'colorWheel' && (channelType.includes('color_wheel') || channelType.includes('colorwheel'))) ||
               (controlType === 'macro' && channelType.includes('macro')) ||
               (controlType === 'speed' && channelType.includes('speed')) ||
               (controlType === 'lamp' && channelType.includes('lamp')) ||
               (controlType === 'reset' && channelType.includes('reset'));
      });
      
      return !!foundChannel;
    });
  };

  const hasActiveDmxChannel = (controlType: string): boolean => {
    const affectedFixtures = getAffectedFixtures();
    if (affectedFixtures.length === 0) return false;
    
    return affectedFixtures.some((fixtureObj: any) => {
      const fixture = fixtureObj.fixture || fixtureObj;
      const channels = fixture.channels || [];
      
      const foundChannel = channels.find((c: any) => {
        const channelType = c.type?.toLowerCase() || '';
        return channelType === controlType.toLowerCase() || 
               (controlType === 'pan' && channelType.includes('pan')) ||
               (controlType === 'tilt' && channelType.includes('tilt')) ||
               (controlType === 'red' && channelType.includes('red')) ||
               (controlType === 'green' && channelType.includes('green')) ||
               (controlType === 'blue' && channelType.includes('blue')) ||
               (controlType === 'white' && channelType.includes('white')) ||
               (controlType === 'dimmer' && channelType.includes('dimmer')) ||
               (controlType === 'strobe' && channelType.includes('strobe')) ||
               (controlType === 'shutter' && channelType.includes('shutter')) ||
               (controlType === 'gobo' && channelType.includes('gobo')) ||
               (controlType === 'zoom' && channelType.includes('zoom')) ||
               (controlType === 'focus' && channelType.includes('focus')) ||
               (controlType === 'iris' && channelType.includes('iris')) ||
               (controlType === 'prism' && channelType.includes('prism')) ||
               (controlType === 'frost' && channelType.includes('frost'));
      });
      
      if (foundChannel) {
        const channelIndex = foundChannel.dmxAddress !== undefined
          ? foundChannel.dmxAddress
          : (fixture.startAddress + channels.indexOf(foundChannel) - 1);
        const value = getDmxChannelValue(channelIndex);
        return value > 0;
      }
      return false;
    });
  };

  const getDmxChannelForControl = (controlType: string): string => {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [getDmxChannelForControl]`;

    console.log(`${logPrefix} Called for controlType: ${controlType}`);

    const affectedFixtures = getAffectedFixtures();
    console.log(`${logPrefix} Affected fixtures count: ${affectedFixtures.length}`, affectedFixtures.map(f => ({ id: f.id, name: f.name })));

    if (affectedFixtures.length === 0) {
      const returnMsg = 'No fixtures selected';
      console.log(`${logPrefix} Returning: "${returnMsg}"`);
      return returnMsg;
    }
    
    const channels: number[] = [];
    affectedFixtures.forEach(fixture => {      console.log(`${logPrefix} Processing fixture - ID: ${fixture.id}, Name: ${fixture.name}`);
      console.log(`${logPrefix} Fixture channels for ${fixture.name}:`, fixture.channels.map((ch: any) => ({ type: ch.type, dmxAddress: ch.dmxAddress })));
      
      // Find the channel by type first
      let foundChannel: any = null;
      const controlTypeLower = controlType.toLowerCase();
      
      // Enhanced channel finding with multiple matching patterns
      switch (controlTypeLower) {
        case 'dimmer':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'dimmer');
          break;
        case 'pan':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'pan');
          break;
        case 'tilt':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'tilt');
          break;
        case 'finepan':
          foundChannel = fixture.channels.find((c: any) => {
            const typeLower = c.type.toLowerCase();
            return typeLower === 'finepan' || typeLower === 'fine_pan' || typeLower === 'pan_fine';
          });
          break;
        case 'finetilt':
          foundChannel = fixture.channels.find((c: any) => {
            const typeLower = c.type.toLowerCase();
            return typeLower === 'finetilt' || typeLower === 'fine_tilt' || typeLower === 'tilt_fine';
          });
          break;
        case 'red':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'red');
          break;
        case 'green':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'green');
          break;
        case 'blue':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'blue');
          break;
        case 'gobo':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'gobo');
          break;
        case 'shutter':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'shutter');
          break;
        case 'goborotation':
          foundChannel = fixture.channels.find((c: any) => {
            const typeLower = c.type.toLowerCase();
            return typeLower === 'goborotation' || typeLower === 'gobo_rotation';
          });
          break;
        case 'colorwheel':
          foundChannel = fixture.channels.find((c: any) => {
            const typeLower = c.type.toLowerCase();
            return typeLower === 'colorwheel' || typeLower === 'color_wheel';
          });
          break;
        case 'focus':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'focus');
          break;
        case 'zoom':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'zoom');
          break;
        case 'iris':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'iris');
          break;
        case 'prism':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'prism');
          break;
        case 'frost':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'frost');
          break;
        case 'macro':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'macro');
          break;
        case 'speed':
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === 'speed');
          break;
        default:
          foundChannel = fixture.channels.find((c: any) => c.type.toLowerCase() === controlTypeLower);
          break;
      }
      
      let targetChannel = -1;
      
      if (foundChannel) {
        // Calculate DMX address if missing
        if (foundChannel.dmxAddress !== undefined && foundChannel.dmxAddress !== null) {
          targetChannel = foundChannel.dmxAddress;
        } else {
          // Calculate DMX address: startAddress + channel index
          const channelIndex = fixture.channels.indexOf(foundChannel);
          targetChannel = (fixture.startAddress || 1) + channelIndex - 1; // 0-based calculation
          console.log(`${logPrefix} Calculated DMX address for ${fixture.name} channel ${foundChannel.type}: ${targetChannel} (startAddress: ${fixture.startAddress}, index: ${channelIndex})`);
        }
      }
      
      console.log(`${logPrefix} Target channel for ${fixture.name} (type: ${controlType}, searched as: ${controlTypeLower}): ${targetChannel}`);
      
      if (targetChannel >= 0) {
        channels.push(targetChannel + 1); // Convert to 1-based for display
      }
    });
    
    console.log(`${logPrefix} Collected DMX channels (1-based, before processing):`, channels);

    if (channels.length === 0) {
      const returnMsg = 'No channels';
      console.log(`${logPrefix} Returning: "${returnMsg}"`);
      return returnMsg;
    }
    if (channels.length === 1) {
      const returnMsg = `Ch ${channels[0]}`;
      console.log(`${logPrefix} Returning: "${returnMsg}"`);
      return returnMsg;
    }
    
    // Group consecutive channels for better display
    const sortedChannels = [...new Set(channels)].sort((a, b) => a - b);
    let finalStr;
    if (sortedChannels.length <= 3) {
      finalStr = `Ch ${sortedChannels.join(', ')}`;
    } else {
      finalStr = `Ch ${sortedChannels[0]}-${sortedChannels[sortedChannels.length - 1]} (${sortedChannels.length})`;
    }
    console.log(`${logPrefix} Returning: "${finalStr}"`);
    return finalStr;
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
    const centerValue = 127; // DMX center position (50% of 255)
    const centerPercentage = 50; // 50% for XY pad
    
    setPanValue(centerValue);
    setTiltValue(centerValue);
    setPanTiltXY({ x: centerPercentage, y: centerPercentage });
    
    applyControl('pan', centerValue);
    applyControl('tilt', centerValue);
  };

  // Flash function - quick bright pulse
  const handleFlash = () => {
    if (isFlashing) return;
    
    setIsFlashing(true);
    const originalDimmer = dimmer;
    
    // Flash to full brightness
    setDimmer(255);
    applyControl('dimmer', 255);
    applyControl('shutter', 255); // Open shutter
    
    setTimeout(() => {
      setDimmer(originalDimmer);
      applyControl('dimmer', originalDimmer);
      setIsFlashing(false);
    }, flashSpeed);
  };

  // Strobe function - continuous strobing
  const handleStrobe = () => {
    setIsStrobing(!isStrobing);
    
    if (!isStrobing) {
      // Start strobing
      const strobeValue = Math.max(128, Math.min(255, 128 + strobeSpeed * 8)); // Strobe range typically 128-255
      applyControl('shutter', strobeValue);
    } else {
      // Stop strobing - open shutter
      applyControl('shutter', 255);
    }
  };

  // Reset all controls to default values
  const handleResetAll = () => {
    const resetConfirm = window.confirm('Reset all SuperControl values to defaults?');
    if (!resetConfirm) return;    // Reset all state values
    setDimmer(0);
    setPanValue(127);
    setTiltValue(127);
    setFinePanValue(0);
    setFineTiltValue(0);
    setRed(0);
    setGreen(0);
    setBlue(0);
    setGobo(0);
    setShutter(255);
    setStrobe(0);
    setLamp(0);
    setReset(0);
    setFocus(127);
    setZoom(127);
    setIris(127);
    setPrism(0);
    setColorWheel(0);
    setGoboRotation(127);
    setGobo2(0);
    setFrost(0);
    setMacro(0);
    setSpeed(127);
    setPanTiltXY({ x: 50, y: 50 });
    setColorHue(0);
    setColorSaturation(0);
    setIsStrobing(false);

    // Apply reset values to fixtures
    const affectedFixtures = getAffectedFixtures();
    if (affectedFixtures.length > 0) {
      affectedFixtures.forEach(fixture => {
        fixture.channels.forEach(channel => {
          if (channel.dmxAddress) {
            let resetValue = 0;            // Special reset values for certain channel types
            if (channel.type === 'pan' || channel.type === 'tilt' || 
                channel.type === 'focus' || channel.type === 'zoom' || 
                channel.type === 'iris' || channel.type === 'goboRotation' || 
                channel.type === 'speed') {
              resetValue = 127; // Center position
            } else if (channel.type === 'finePan' || channel.type === 'fineTilt' ||
                       channel.type === 'fine_pan' || channel.type === 'fine_tilt' ||
                       channel.type === 'pan_fine' || channel.type === 'tilt_fine') {
              resetValue = 0; // Fine controls start at 0
            } else if (channel.type === 'shutter') {
              resetValue = 255; // Open shutter
            }
            applyControl(channel.type, resetValue);
          }
        });
      });
    }
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
    
    if (h < 1/6) { r = c; g = x; b = 0; }
    else if (h < 2/6) { r = x; g = c; b = 0; }
    else if (h < 3/6) { r = 0; g = c; b = x; }
    else if (h < 4/6) { r = 0; g = x; b = c; }
    else if (h < 5/6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };  };

  // Enhanced MIDI/OSC Learn Button Component for SuperControl
  const [editingOscAddress, setEditingOscAddress] = useState<string | null>(null);
  const [oscInputValue, setOscInputValue] = useState<string>('');
  const [oscSaveConfirmed, setOscSaveConfirmed] = useState<string | null>(null);

  const renderMidiButtons = (controlName: string) => {
    const isCurrentlyLearning = isSuperControlLearning && currentLearningControlName === controlName;
    const hasMapping = superControlMappings[controlName];
    const oscAddress = superControlOscAddresses[controlName];
    const isEditingOsc = editingOscAddress === controlName;
    const isOscSaved = oscSaveConfirmed === controlName;
    
    const handleOscEdit = () => {
      setEditingOscAddress(controlName);
      setOscInputValue(oscAddress || '');
      setOscSaveConfirmed(null);
    };

    const handleOscSave = () => {
      if (oscInputValue.trim()) {
        setSuperControlOscAddress(controlName, oscInputValue.trim());
        setOscSaveConfirmed(controlName);
        // Clear confirmation after 2 seconds
        setTimeout(() => {
          setOscSaveConfirmed(null);
        }, 2000);
      }
      setEditingOscAddress(null);
      setOscInputValue('');
    };

    const handleOscCancel = () => {
      setEditingOscAddress(null);
      setOscInputValue('');
    };

    const handleOscDelete = () => {
      setSuperControlOscAddress(controlName, '');
      setEditingOscAddress(null);
    };
    
    return (
      <div className={styles.midiOscButtons}>
        {/* OSC Address Section */}
        <div className={styles.oscSection}>
          {isEditingOsc ? (
            <div className={styles.oscEditMode}>
              <input
                type="text"
                value={oscInputValue}
                onChange={(e) => setOscInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOscSave();
                  if (e.key === 'Escape') handleOscCancel();
                }}
                placeholder="/supercontrol/..."
                className={styles.oscInput}
                autoFocus
              />
              <div className={styles.oscEditActions}>
                <button
                  className={styles.oscSaveButton}
                  onClick={handleOscSave}
                  title="Save OSC address"
                >
                  <LucideIcon name="Check" />
                </button>
                <button
                  className={styles.oscCancelButton}
                  onClick={handleOscCancel}
                  title="Cancel editing"
                >
                  <LucideIcon name="X" />
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.oscDisplayMode}>
              {oscAddress ? (
                <>
                  <div className={`${styles.oscInfo} ${isOscSaved ? styles.oscSaved : ''}`}>
                    <LucideIcon name={isOscSaved ? "Check" : "Globe"} className={styles.oscIcon} />
                    <span className={styles.oscAddress} title={`OSC: ${oscAddress}${isOscSaved ? ' (Saved!)' : ''}`}>
                      {oscAddress}
                    </span>
                    {isOscSaved && <span className={styles.oscSavedBadge}>Saved!</span>}
                  </div>
                  <div className={styles.oscActions}>
                    <button
                      className={styles.oscEditButton}
                      onClick={handleOscEdit}
                      title="Edit OSC address"
                    >
                      <LucideIcon name="Edit" />
                    </button>
                    <button
                      className={styles.oscDeleteButton}
                      onClick={handleOscDelete}
                      title="Remove OSC address"
                    >
                      <LucideIcon name="Trash2" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className={styles.oscAddButton}
                  onClick={handleOscEdit}
                  title="Add OSC address"
                >
                  <LucideIcon name="Plus" />
                  <span>OSC</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* MIDI Learn/Forget Buttons */}
        <div className={styles.midiControls}>
          {!hasMapping ? (
            <button
              className={`${styles.midiLearnButton} ${isCurrentlyLearning ? styles.learning : ''} ${hasMapping ? styles.learned : ''}`}
              onClick={() => startSuperControlMidiLearn(controlName)}
              disabled={isSuperControlLearning && !isCurrentlyLearning}
              title={isCurrentlyLearning ? 'Send MIDI CC or Note...' : hasMapping ? `MIDI Mapped: ${hasMapping.controller ? `CC${hasMapping.controller}` : `Note${hasMapping.note}`} on CH${hasMapping.channel + 1}` : 'Learn MIDI mapping'}
            >
              <LucideIcon name={isCurrentlyLearning ? "Radio" : hasMapping ? "Link" : "Music"} />
              {isCurrentlyLearning ? 'Listening...' : hasMapping ? 'Mapped' : 'Learn'}
            </button>
          ) : (
            <div className={styles.midiMappingInfo}>
              <div className={styles.midiMappedIndicator} title={`Mapped to ${hasMapping.controller ? `CC${hasMapping.controller}` : `Note${hasMapping.note}`} on channel ${hasMapping.channel + 1}`}>
                <LucideIcon name="Link" />
                <span>{hasMapping.controller ? `CC${hasMapping.controller}` : `N${hasMapping.note}`}</span>
                <span className={styles.midiChannel}>CH{hasMapping.channel + 1}</span>
              </div>
              <button
                className={styles.midiForgetButton}
                onClick={() => forgetSuperControlMidiMapping(controlName)}
                title="Remove MIDI mapping"
              >
                <LucideIcon name="Unlink" />
              </button>
            </div>
          )}
        </div>
        
        {/* Always show OSC address if it exists */}
        {oscAddress && (
          <div className={styles.oscAddressDisplay} title={`OSC Address: ${oscAddress}`}>
            <LucideIcon name="Globe" size={12} />
            <span>{oscAddress}</span>
          </div>
        )}
      </div>
    );
  };

  // MIDI Learn functionality
  const startMidiLearn = (controlType: string, minValue: number = 0, maxValue: number = 255) => {
    setMidiLearnTarget(controlType);
    console.log(`Starting MIDI learn for ${controlType} (range: ${minValue}-${maxValue})`);
  };

  const stopMidiLearn = () => {
    setMidiLearnTarget(null);
    console.log('Stopped MIDI learn');
  };

  const clearMidiMapping = (controlType: string) => {
    setMidiMappings(prev => {
      const updated = { ...prev };
      delete updated[controlType];
      return updated;
    });
    console.log(`Cleared MIDI mapping for ${controlType}`);
  };

  const startFixtureSelectionMidiLearn = (actionType: string, param?: string) => {
    const midiKey = param ? `fixture_${actionType}_${param}` : `fixture_${actionType}`;
    setMidiLearnTarget(midiKey);
    console.log(`Starting MIDI learn for fixture selection: ${actionType}`, param);
  };

  const clearFixtureSelectionMidiMapping = (actionType: string, param?: string) => {
    const midiKey = param ? `fixture_${actionType}_${param}` : `fixture_${actionType}`;
    setMidiMappings(prev => {
      const updated = { ...prev };
      delete updated[midiKey];
      return updated;
    });
    console.log(`Cleared MIDI mapping for fixture selection: ${actionType}`, param);
  };

  // Fixture Selection MIDI Learn Button Component
  const FixtureSelectionMidiLearnButton = ({ 
    actionType, 
    param, 
    title,
    oscKey
  }: { 
    actionType: string; 
    param?: string; 
    title: string; 
    oscKey: string;
  }) => {
    const midiKey = param ? `fixture_${actionType}_${param}` : `fixture_${actionType}`;
    const hasMapping = superControlMappings[midiKey];
    const isCurrentlyLearning = isSuperControlLearning && currentLearningControlName === midiKey;

    return (
      <div className={styles.controlActions}>
        <div className={styles.midiLearnContainer}>
          <button
            className={`${styles.midiLearnBtn} ${hasMapping ? styles.mapped : ''} ${isCurrentlyLearning ? styles.learning : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isCurrentlyLearning) {
                cancelSuperControlMidiLearn();
              } else {
                startSuperControlMidiLearn(midiKey, 0, 127);
              }
            }}
            title={isCurrentlyLearning ? 'Send MIDI CC or Note...' : title}
          >
            M
          </button>
          {hasMapping && (
            <div className={styles.midiMappingInfo}>
              <span className={styles.midiMappedIndicator} title={`Mapped to ${hasMapping.controller ? `CC${hasMapping.controller}` : `Note${hasMapping.note}`} on channel ${hasMapping.channel}`}>
                ●
              </span>
              <button
                className={styles.midiForgetBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  forgetSuperControlMidiMapping(midiKey);
                }}
                title="Remove MIDI mapping"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <div className={styles.oscAddress} title={`OSC Address: ${superControlOscAddresses[oscKey]}`}>
          {superControlOscAddresses[oscKey]}
        </div>
      </div>
    );
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

    const newScene = {
      id: `scene_${Date.now()}`,
      name: name || `Scene ${scenes.length + 1}`,
      values: sceneValues,
      timestamp: Date.now()
    };

    setScenes(prev => [...prev, newScene]);
    setCurrentSceneIndex(scenes.length);
    return newScene;
  };

  const loadScene = (sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;
    
    const scene = scenes[sceneIndex];
    Object.entries(scene.values).forEach(([channel, value]) => {
      setDmxChannelValue(parseInt(channel), value);
    });
    
    setCurrentSceneIndex(sceneIndex);
  };

  const saveCurrentScene = () => {
    if (sceneAutoSave) {
      captureCurrentScene(`Auto Scene ${new Date().toLocaleTimeString()}`);
    }
  };

  const deleteScene = (sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;
    
    setScenes(prev => prev.filter((_, index) => index !== sceneIndex));
    if (currentSceneIndex >= sceneIndex && currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
  };

  const selectNextScene = () => {
    if (scenes.length === 0) return;
    const nextIndex = (currentSceneIndex + 1) % scenes.length;
    loadScene(nextIndex);
  };

  const selectPreviousScene = () => {
    if (scenes.length === 0) return;
    const prevIndex = currentSceneIndex === 0 ? scenes.length - 1 : currentSceneIndex - 1;
    loadScene(prevIndex);
  };  // Autopilot track animation - enhanced for faster and more responsive control
  const animationFrameRef = useRef<number>(0);
  const lastUpdateTime = useRef<number>(0);
  const currentPositionRef = useRef<number>(autopilotTrackPosition);

  // Keep position ref updated
  // Keep position ref updated for other uses
  useEffect(() => {
    currentPositionRef.current = autopilotTrackPosition;
  }, [autopilotTrackPosition]);  // Sync Pan/Tilt sliders with autopilot track position
  useEffect(() => {
    if (autopilotTrackEnabled) {
      const { pan, tilt } = calculateTrackPosition(
        autopilotTrackType,
        autopilotTrackPosition,
        autopilotTrackSize,
        autopilotTrackCenterX,
        autopilotTrackCenterY
      );
      
      console.log(`[AUTOPILOT UI] Calculated position: pan=${pan}, tilt=${tilt}`);
      
      // Update the Pan/Tilt slider values and XY pad to reflect track position
      setPanValue(pan);
      setTiltValue(tilt);
      
      // Update XY pad position to reflect the calculated pan/tilt
      const xPercent = (pan / 255) * 100;
      const yPercent = ((255 - tilt) / 255) * 100; // Invert Y for display
      setPanTiltXY({ x: xPercent, y: yPercent });
        // Also ensure DMX channels are updated with the calculated values
      console.log('[AUTOPILOT UI] Applying calculated Pan/Tilt values to fixtures');
      applyControl('pan', pan);
      applyControl('tilt', tilt);
    }
  }, [autopilotTrackEnabled, autopilotTrackType, autopilotTrackPosition, autopilotTrackSize, autopilotTrackCenterX, autopilotTrackCenterY, calculateTrackPosition]);
  const getVisualTrackIndicatorPosition = (
    trackType: string,
    positionPercent: number, // 0-100
    sizePercent: number, // 0-100
    centerXPercent: number, // 0-100
    centerYPercent: number // 0-100
  ): { x: number; y: number } => {
    const visualCenterX = centerXPercent;
    const visualCenterY = centerYPercent;
    const baseRadius = sizePercent / 2;
    
    // Apply the same bounds constraints as in generateTrackPath
    const maxRadiusX = Math.min(visualCenterX, 100 - visualCenterX);
    const maxRadiusY = Math.min(visualCenterY, 100 - visualCenterY);
    const maxRadius = Math.min(maxRadiusX, maxRadiusY, 45); // Max 45% to leave some padding
    const radius = Math.min(baseRadius, maxRadius);
    const visualSize = radius * 2;
    
    const progress = positionPercent / 100; // 0-1

    let x = visualCenterX;
    let y = visualCenterY;

    switch (trackType) {
      case 'circle':
        x = visualCenterX + radius * Math.cos(progress * 2 * Math.PI - Math.PI / 2); // Start from top
        y = visualCenterY + radius * Math.sin(progress * 2 * Math.PI - Math.PI / 2);
        break;
      case 'square':
        const sideLength = visualSize;
        const halfSide = sideLength / 2;
        const perimeter = sideLength * 4;
        const distance = progress * perimeter;

        if (distance < sideLength) { // Top edge
          x = visualCenterX - halfSide + distance;
          y = visualCenterY - halfSide;
        } else if (distance < sideLength * 2) { // Right edge
          x = visualCenterX + halfSide;
          y = visualCenterY - halfSide + (distance - sideLength);
        } else if (distance < sideLength * 3) { // Bottom edge
          x = visualCenterX + halfSide - (distance - sideLength * 2);
          y = visualCenterY + halfSide;
        } else { // Left edge
          x = visualCenterX - halfSide;
          y = visualCenterY + halfSide - (distance - sideLength * 3);
        }
        break;
      case 'triangle':
        const triHeight = visualSize; // Treat visualSize as height
        const triHalfBase = (visualSize * Math.sqrt(3)) / 2 / 2; // Equilateral assumption for simplicity

        // Define points of the triangle (approximate for visual)
        const p1 = { x: visualCenterX, y: visualCenterY - (2/3) * triHeight / 2 }; // Top point
        const p2 = { x: visualCenterX - triHalfBase, y: visualCenterY + (1/3) * triHeight / 2 }; // Bottom-left
        const p3 = { x: visualCenterX + triHalfBase, y: visualCenterY + (1/3) * triHeight / 2 }; // Bottom-right
        
        if (progress < 1/3) { // p1 to p2
            x = p1.x + (p2.x - p1.x) * (progress * 3);
            y = p1.y + (p2.y - p1.y) * (progress * 3);
        } else if (progress < 2/3) { // p2 to p3
            x = p2.x + (p3.x - p2.x) * ((progress - 1/3) * 3);
            y = p2.y + (p3.y - p2.y) * ((progress - 1/3) * 3);
        } else { // p3 to p1
            x = p3.x + (p1.x - p3.x) * ((progress - 2/3) * 3);
            y = p3.y + (p1.y - p3.y) * ((progress - 2/3) * 3);
        }
        break;
      case 'linear':
        // Horizontal line for simplicity
        x = (visualCenterX - radius) + progress * visualSize;
        y = visualCenterY;
        break;
      case 'figure8':
        // Simplified figure 8 for visual representation
        // This will trace two circles side-by-side, scaled to fit within the size
        const R = radius / 2; // Radius of each lobe
        const centerOffset = R;
        if (progress < 0.5) { // First lobe (left or top)
            const currentProgress = progress * 2; // 0-1 for this lobe
            x = (visualCenterX - centerOffset) + R * Math.cos(currentProgress * 2 * Math.PI - Math.PI / 2);
            y = visualCenterY + R * Math.sin(currentProgress * 2 * Math.PI - Math.PI / 2);
        } else { // Second lobe (right or bottom)
            const currentProgress = (progress - 0.5) * 2; // 0-1 for this lobe
            x = (visualCenterX + centerOffset) + R * Math.cos(currentProgress * 2 * Math.PI - Math.PI / 2 + Math.PI); // Start opposite
            y = visualCenterY + R * Math.sin(currentProgress * 2 * Math.PI - Math.PI / 2 + Math.PI);
        }
        break;
      case 'random':
        // Deterministic "random" based on positionPercent for visual stability in one cycle
        // Using sine/cosine with varying frequencies/phases based on positionPercent
        // The goal is not true randomness, but a pseudo-random-looking path that is repeatable.
        const angle1 = (positionPercent / 100) * Math.PI * 2 * 3; // Multiply for more "randomness"
        const angle2 = (positionPercent / 100) * Math.PI * 2 * 5;
        x = visualCenterX + radius * Math.cos(angle1) * (0.5 + 0.5 * Math.sin(angle2));
        y = visualCenterY + radius * Math.sin(angle1) * (0.5 + 0.5 * Math.cos(angle2));        // Clamp to bounds if complex functions might exceed radius
        const dist = Math.sqrt(Math.pow(x - visualCenterX, 2) + Math.pow(y - visualCenterY, 2));
        if (dist > radius) {
          // Normalize to stay within radius
          x = visualCenterX + (x - visualCenterX) * (radius / dist);
          y = visualCenterY + (y - visualCenterY) * (radius / dist);
        }
        break;
        
      default: // Circle as default
        x = visualCenterX + radius * Math.cos(progress * 2 * Math.PI - Math.PI / 2);
        y = visualCenterY + radius * Math.sin(progress * 2 * Math.PI - Math.PI / 2);
        break;
    }
    // Ensure visual indicator stays within the 0-100 bounds of the pad approximately
    return { 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    };
  };  // Generate SVG path for track visualization
  const generateTrackPath = () => {
    // Convert DMX range (0-255) to SVG coordinates (0-100)
    const cx = (autopilotTrackCenterX / 255) * 100;
    const cy = (autopilotTrackCenterY / 255) * 100;
    const baseSize = autopilotTrackSize / 2;
    
    // Constrain size to keep track within bounds (0-100 SVG coordinates)
    const maxRadiusX = Math.min(cx, 100 - cx);
    const maxRadiusY = Math.min(cy, 100 - cy);
    const maxRadius = Math.min(maxRadiusX, maxRadiusY, 45); // Max 45% to leave some padding
    const size = Math.min(baseSize, maxRadius);
    
    console.log(`[TRACK_PATH] Center: (${cx.toFixed(1)}, ${cy.toFixed(1)}), Base size: ${baseSize}, Constrained size: ${size.toFixed(1)}`);
    
    switch (autopilotTrackType) {
      case 'circle':
        return `M ${cx + size} ${cy} A ${size} ${size} 0 1 1 ${cx + size - 0.01} ${cy}`;
      
      case 'square':
        return `M ${cx - size} ${cy - size} L ${cx + size} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z`;
      
      case 'triangle':
        return `M ${cx} ${cy - size} L ${cx + size * 0.866} ${cy + size * 0.5} L ${cx - size * 0.866} ${cy + size * 0.5} Z`;
      
      case 'figure8':
        return `M ${cx} ${cy} Q ${cx + size} ${cy - size} ${cx} ${cy} Q ${cx - size} ${cy + size} ${cx} ${cy}`;
        
      case 'linear':
        return `M ${cx - size} ${cy} L ${cx + size} ${cy}`;
      
      case 'random':
        // For random, just show a dotted circle as placeholder
        return `M ${cx + size} ${cy} A ${size} ${size} 0 1 1 ${cx + size - 0.01} ${cy}`;
      
      default:
        return `M ${cx + size} ${cy} A ${size} ${size} 0 1 1 ${cx + size - 0.01} ${cy}`;
    }
  };

  // Enhanced debugging for DMX control issues
  const debugDmxControls = () => {
    console.log('🔧 DMX Control Debug Report');
    console.log('========================');
    
    // Check fixtures
    console.log(`📋 Total fixtures loaded: ${fixtures.length}`);
    if (fixtures.length === 0) {
      console.warn('❌ No fixtures loaded! Please add fixtures to the workspace first.');
      console.log('💡 Go to Fixture Creator page and create test fixtures.');
      return;
    }
    
    fixtures.forEach((fixture, index) => {
      console.log(`  ${index + 1}. ${fixture.name} (ID: ${fixture.id})`);
      console.log(`     Type: ${fixture.type || 'Generic'}`);
      console.log(`     Start Address: ${fixture.startAddress}`);
      console.log(`     Channels: ${fixture.channels.length}`);
      fixture.channels.forEach((channel, chIndex) => {
        console.log(`       ${chIndex}: ${channel.name} (${channel.type}) -> DMX ${channel.dmxAddress}`);
      });
    });
    
    // Check selection
    console.log(`\n🎯 Selection Status:`);
    console.log(`   Mode: ${selectionMode}`);
    console.log(`   Selected fixtures: ${selectedFixtures.length}`);
    console.log(`   Selected channels: ${selectedChannels.length}`);
    console.log(`   Selected groups: ${selectedGroups.length}`);
    
    if (selectionMode === 'fixtures' && selectedFixtures.length === 0) {
      console.warn('❌ No fixtures selected! Click on fixtures in the list or use "Select All" button.');
    }
    
    // Test affected fixtures
    const affected = getAffectedFixtures();
    console.log(`\n🎛️ Affected fixtures for controls: ${affected.length}`);
    affected.forEach(fixture => {
      console.log(`   - ${fixture.name} (${fixture.channels.length} channels)`);
    });
    
    if (affected.length === 0) {
      console.error('❌ ISSUE FOUND: No affected fixtures - controls will not work!');
      if (fixtures.length > 0 && selectedFixtures.length === 0) {
        console.log('💡 SOLUTION: Select fixtures by clicking on them or using "Select All" button');
      }
    } else {
      console.log('✅ Good: Fixtures are available for control');
    }
    
    // Test DMX functions
    console.log(`\n🔌 Testing DMX functions:`);
    try {
      const testChannel = 1;
      const currentValue = getDmxChannelValue(testChannel);
      console.log(`   getDmxChannelValue(${testChannel}) = ${currentValue} ✅`);
      
      console.log(`   Testing setDmxChannelValue(${testChannel}, 100)...`);
      setDmxChannelValue(testChannel, 100);
      console.log(`   ✅ setDmxChannelValue executed (check network tab for HTTP request)`);
    } catch (error) {
      console.error('❌ DMX function error:', error);
    }
    
    console.log('\n📝 Next Steps:');
    if (fixtures.length === 0) {
      console.log('1. Add fixtures using Fixture Creator');
    } else if (selectedFixtures.length === 0) {
      console.log('1. Select fixtures in SuperControl');
    } else {
      console.log('1. Move controls and check for DMX logs');
      console.log('2. Check Network tab for /api/dmx requests');
      console.log('3. Check server terminal for incoming requests');
    }
  };
  
  // Expose debug function to window for console access
  useEffect(() => {
    (window as any).debugDmxControls = debugDmxControls;
    console.log('🔧 Debug function available: window.debugDmxControls()');
    
    return () => {
      delete (window as any).debugDmxControls;
    };
  }, [fixtures, selectedFixtures, selectedChannels, selectedGroups, selectionMode]);
  return (
    <div className={styles.superControl}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h3>
            <LucideIcon name="Settings" />
            Super Control
            {/* Column Layout Selection */}
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setColumnLayout('2');
                  localStorage.setItem('superControlColumnLayout', '2');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: columnLayout === '2' ? '#10b981' : 'rgba(71, 85, 105, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                title="2 Column Layout"
              >
                <LucideIcon name="Columns" size={14} />
                2 Col
              </button>
              <button
                onClick={() => {
                  setColumnLayout('3');
                  localStorage.setItem('superControlColumnLayout', '3');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: columnLayout === '3' ? '#10b981' : 'rgba(71, 85, 105, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                title="3 Column Layout"
              >
                <LucideIcon name="LayoutGrid" size={14} />
                3 Col
              </button>
            </div>
            {/* Status Indicators */}
            <div className={styles.statusIndicators}>
              {isFlashing && (
                <span className={`${styles.statusBadge} ${styles.flashStatus}`}>
                  <LucideIcon name="Zap" />
                  FLASH
                </span>
              )}
              {isStrobing && (
                <span className={`${styles.statusBadge} ${styles.strobeStatus}`}>
                  <LucideIcon name="Sun" />
                  STROBE
                </span>
              )}
              <span className={`${styles.statusBadge} ${styles.selectionStatus}`}>
                {getAffectedFixtures().length} selected
              </span>
            </div>
          </h3>
          <p>Advanced DMX Control Interface with Enhanced GOBO Controls</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.filterBtn} ${showOnlyAssignedChannels ? styles.active : ''}`}
            onClick={() => setShowOnlyAssignedChannels(!showOnlyAssignedChannels)}
            title={showOnlyAssignedChannels ? "Show all controls" : "Show only controls available for selected fixtures"}
            style={{
              padding: '6px 12px',
              backgroundColor: showOnlyAssignedChannels ? '#10b981' : '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: showOnlyAssignedChannels ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
            }}
          >
            <LucideIcon name={showOnlyAssignedChannels ? "Filter" : "Filter"} size={14} />
            {showOnlyAssignedChannels ? 'Assigned Only' : 'Show All'}
          </button>
          <button
            className={styles.helpBtn}
            onClick={() => setShowOscHelp(true)}
            title="Show OSC Addresses"
          >
            <LucideIcon name="HelpCircle" />
            OSC Help
          </button>
        </div>
      </div>

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
        </div>        {selectionMode === 'fixtures' && (
          <div className={styles.fixtureList}>
            {fixtures.length === 0 ? (
              <div className={styles.noFixtures}>
                <LucideIcon name="AlertCircle" />
                <span>No fixtures available</span>
                <small>Add fixtures to the workspace to control them</small>
              </div>
            ) : (
              fixtures.map(fixture => (
                <div
                  key={fixture.id}
                  className={`${styles.fixtureItem} ${
                    selectedFixtures.includes(fixture.id) ? styles.selected : ''
                  } ${
                    (!fixture.startAddress || fixture.startAddress === 0 || fixture.channels.length === 0) ? styles.noDmxFixture : ''
                  }`}
                  onClick={() => {
                    console.log('[SuperControl] Clicking fixture ID:', fixture.id, 'Current name:', fixture.name);
                    console.log('[SuperControl] Current selectedFixtures (before toggle):', useStore.getState().selectedFixtures);
                    toggleFixtureSelection(fixture.id);
                    const newSelected = useStore.getState().selectedFixtures;
                    console.log('[SuperControl] selectedFixtures from store AFTER toggle:', newSelected);
                    console.log(`[SuperControl] Does new selection include ${fixture.id}? : ${newSelected.includes(fixture.id)}`);
                  }}
                >                  <div className={styles.fixtureInfo}>
                    <span className={styles.fixtureName}>{fixture.name}</span>
                    <span className={styles.fixtureType}>{fixture.type || 'Generic'}</span>
                  </div>
                  <div className={styles.fixtureDetails}>
                    <span className={styles.fixtureChannels}>
                      CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                    </span>
                    <span className={styles.channelCount}>
                      {fixture.channels.length} channels
                    </span>                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectionMode === 'groups' && (
          <div className={styles.fixtureList}>
            {groups.length === 0 ? (
              <div className={styles.noFixtures}>
                <LucideIcon name="Users" />
                <span>No fixture groups available</span>
                <small>Select fixtures below and click "Add to Group" to create a group</small>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fixtures.filter(f => !groups.some(g => g.fixtureIndices.includes(fixtures.indexOf(f)))).length > 0 && (
                    <>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Ungrouped Fixtures:</div>
                      {fixtures
                        .filter(f => !groups.some(g => g.fixtureIndices.includes(fixtures.indexOf(f))))
                        .map(fixture => (
                          <div
                            key={fixture.id}
                            className={styles.fixtureItem}
                            onClick={() => toggleFixtureSelection(fixture.id)}
                          >
                            <div className={styles.fixtureInfo}>
                              <span className={styles.fixtureName}>{fixture.name}</span>
                              <span className={styles.fixtureType}>{fixture.type || 'Generic'}</span>
                            </div>
                            <div className={styles.fixtureDetails}>
                              <span className={styles.fixtureChannels}>
                                CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                              </span>
                            </div>
                          </div>
                        ))}
                      {selectedFixtures.length > 0 && (
                        <button
                          className={styles.addToGroupButton}
                          onClick={() => {
                            const groupName = prompt('Enter group name:');
                            if (groupName && groupName.trim()) {
                              const selectedIndices = selectedFixtures
                                .map(id => fixtures.findIndex(f => f.id === id))
                                .filter(idx => idx !== -1);
                              if (selectedIndices.length > 0) {
                                const newGroup = {
                                  id: `group_${Date.now()}`,
                                  name: groupName.trim(),
                                  fixtureIndices: selectedIndices,
                                  lastStates: new Array(selectedIndices.length).fill(0),
                                  isMuted: false,
                                  isSolo: false,
                                  masterValue: 255
                                };
                                const updatedGroups = [...groups, newGroup];
                                setGroups(updatedGroups);
                                setSelectedFixtures([]);
                              }
                            }
                          }}
                        >
                          <LucideIcon name="Users" size={14} />
                          Add Selected to Group
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {groups.map(group => (
                  <div
                    key={group.id}
                    className={`${styles.fixtureItem} ${selectedGroups.includes(group.id || group.name) ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedGroups(prev => 
                      prev.includes(group.id || group.name) 
                        ? prev.filter(id => id !== (group.id || group.name))
                        : [...prev, group.id || group.name]
                    );
                  }}
                  >
                    <div className={styles.fixtureInfo}>
                      <span className={styles.fixtureName}>{group.name}</span>
                      <span className={styles.fixtureType}>Group</span>
                    </div>
                    <div className={styles.fixtureDetails}>
                      <span className={styles.fixtureChannels}>
                        {group.fixtureIndices.length} fixtures
                      </span>
                      <span className={styles.channelCount}>
                        {group.fixtureIndices.map(index => fixtures[index]?.name).filter(Boolean).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
                {fixtures.filter(f => !groups.some(g => g.fixtureIndices.includes(fixtures.indexOf(f)))).length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>Ungrouped Fixtures:</div>
                    {fixtures
                      .filter(f => !groups.some(g => g.fixtureIndices.includes(fixtures.indexOf(f))))
                      .map(fixture => (
                        <div
                          key={fixture.id}
                          className={styles.fixtureItem}
                          onClick={() => toggleFixtureSelection(fixture.id)}
                        >
                          <div className={styles.fixtureInfo}>
                            <span className={styles.fixtureName}>{fixture.name}</span>
                            <span className={styles.fixtureType}>{fixture.type || 'Generic'}</span>
                          </div>
                          <div className={styles.fixtureDetails}>
                            <span className={styles.fixtureChannels}>
                              CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    {selectedFixtures.length > 0 && (
                      <button
                        className={styles.addToGroupButton}
                        onClick={() => {
                          const groupName = prompt('Enter group name:');
                          if (groupName && groupName.trim()) {
                            const selectedIndices = selectedFixtures
                              .map(id => fixtures.findIndex(f => f.id === id))
                              .filter(idx => idx !== -1);
                            if (selectedIndices.length > 0) {
                              const newGroup = {
                                id: `group_${Date.now()}`,
                                name: groupName.trim(),
                                fixtureIndices: selectedIndices,
                                lastStates: new Array(selectedIndices.length).fill(0),
                                isMuted: false,
                                isSolo: false,
                                masterValue: 255
                              };
                              const updatedGroups = [...groups, newGroup];
                              setGroups(updatedGroups);
                              setSelectedFixtures([]);
                            }
                          }
                        }}
                        style={{ marginTop: '8px', width: '100%' }}
                      >
                        <LucideIcon name="Users" size={14} />
                        Add Selected to Group
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}{selectionMode === 'capabilities' && (
          <div className={styles.fixtureList}>
            {getFixtureCapabilities().length === 0 ? (
              <div className={styles.noFixtures}>
                <LucideIcon name="Zap" />
                <span>No fixture capabilities detected</span>
                <small>
                  {fixtures.length === 0 
                    ? 'No fixtures configured. Add fixtures first.'
                    : fixtures.filter(f => !f.channels || f.channels.length === 0).length > 0
                      ? `${fixtures.filter(f => !f.channels || f.channels.length === 0).length} fixture(s) have no channels defined.`
                      : 'Fixtures need channels with recognized types (pan, tilt, dimmer, red, green, blue, etc.) to show capabilities.'}
                </small>
              </div>
            ) : (
              getFixtureCapabilities().map(capability => (
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
                  <div className={styles.fixtureInfo}>
                    <span className={styles.fixtureName}>{capability.type.toUpperCase()}</span>
                    <span className={styles.fixtureType}>Capability</span>
                  </div>
                  <div className={styles.fixtureDetails}>
                    <span className={styles.fixtureChannels}>
                      {capability.fixtures.length} fixtures
                    </span>                    <span className={styles.channelCount}>
                      {capability.fixtures.join(', ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selection Status and Quick Actions */}
      {getAffectedFixtures().length === 0 && (
        <div className={styles.selectionWarning}>
          <div className={styles.warningContent}>
            <LucideIcon name="AlertTriangle" />
            <span>No fixtures selected - controls will have no effect</span>
            <button 
              className={styles.selectAllBtn}
              onClick={() => {                if (selectionMode === 'fixtures') {
                  selectAllFixtures();
                } else if (selectionMode === 'groups') {
                  setSelectedGroups(groups.map(g => g.id || g.name));
                } else if (selectionMode === 'capabilities') {
                  setSelectedCapabilities(getFixtureCapabilities().map(c => c.type));                } else if (selectionMode === 'channels') {
                  // Select first 50 channels instead of all 512 to avoid UI lag
                  deselectAllChannels();
                  for (let i = 1; i <= 50; i++) {
                    selectChannel(i);
                  }
                }
              }}
            >
              Select All
            </button>
          </div>
        </div>
      )}      {/* Active Selection Summary */}
      {getAffectedFixtures().length > 0 && (
        <div className={styles.selectionSummary}>
          <LucideIcon name="Check" />
          <span>{getAffectedFixtures().length} fixture{getAffectedFixtures().length !== 1 ? 's' : ''} selected</span>
        </div>
      )}

      {/* Fixture Selection Controls */}
      <div className={styles.controlsSection}>
        <div className={styles.sectionHeader}>
          <h4>
            <LucideIcon name="Target" />
            Fixture Selection
          </h4>
        </div>
        
        <div className={styles.selectionControls}>          <div className={styles.selectionButtonGrid}>
            <button 
              className={styles.selectionButton}
              onClick={() => {
                console.log('[SuperControl] "Next Fixture" clicked. Current fixtures count from store:', useStore.getState().fixtures.length);
                selectNextFixture();
              }}
              title="Select Next Fixture"
              disabled={fixtures.length < 2}
            >
              <LucideIcon name="ArrowRight" />
              Next
              <FixtureSelectionMidiLearnButton 
                actionType="next" 
                title="MIDI Learn: Select Next Fixture" 
                oscKey="fixtureNext"
              />
            </button>
              <button 
              className={styles.selectionButton}
              onClick={() => {
                console.log('[SuperControl] "Previous Fixture" clicked. Current fixtures count from store:', useStore.getState().fixtures.length);
                selectPreviousFixture();
              }}
              title="Select Previous Fixture"
              disabled={fixtures.length < 2}
            >
              <LucideIcon name="ArrowLeft" />
              Previous
              <FixtureSelectionMidiLearnButton 
                actionType="previous" 
                title="MIDI Learn: Select Previous Fixture" 
                oscKey="fixturePrev"
              />
            </button>
            
            <button 
              className={styles.selectionButton}
              onClick={() => {
                console.log('[SuperControl] "Select All" clicked. Current fixtures count from store:', useStore.getState().fixtures.length);
                selectAllFixtures();
              }}
              title="Select All Fixtures"
              disabled={fixtures.length === 0 || selectedFixtures.length === fixtures.length}
            >
              <LucideIcon name="CheckSquare" />
              All
              <FixtureSelectionMidiLearnButton 
                actionType="selectAll" 
                title="MIDI Learn: Select All Fixtures" 
                oscKey="fixtureSelectAll"
              />
            </button>
            
            <button 
              className={styles.selectionButton}
              onClick={deselectAllFixtures}
              title="Deselect All Fixtures"
              disabled={selectedFixtures.length === 0}
            >
              <LucideIcon name="X" />
              None
              <FixtureSelectionMidiLearnButton 
                actionType="deselectAll" 
                title="MIDI Learn: Deselect All Fixtures" 
                oscKey="fixtureDeselectAll"
              />
            </button>
          </div>
          
          <div className={styles.selectionByType}>
            <label>Select by Type:</label>
            <div className={styles.typeButtonGrid}>
              <button 
                className={styles.typeButton}
                onClick={() => selectFixturesByType('pan')}
                title="Select Moving Head Fixtures"
              >
                Moving Heads
                <FixtureSelectionMidiLearnButton 
                  actionType="byTypeMoving" 
                  title="MIDI Learn: Select Moving Head Fixtures" 
                  oscKey="fixtureByTypeMoving"
                />
              </button>
              
              <button 
                className={styles.typeButton}
                onClick={() => selectFixturesByType('red')}
                title="Select RGB/Color Fixtures"
              >
                RGB/Color
                <FixtureSelectionMidiLearnButton 
                  actionType="byTypeRGB" 
                  title="MIDI Learn: Select RGB/Color Fixtures" 
                  oscKey="fixtureByTypeRGB"
                />
              </button>
              
              <button 
                className={styles.typeButton}
                onClick={() => selectFixturesByType('dimmer')}
                title="Select Dimmer Fixtures"
              >
                Dimmers
                <FixtureSelectionMidiLearnButton 
                  actionType="byTypeDimmer" 
                  title="MIDI Learn: Select Dimmer Fixtures" 
                  oscKey="fixtureByTypeDimmer"
                />
              </button>
              
              <button 
                className={styles.typeButton}
                onClick={() => selectFixturesByType('gobo')}
                title="Select Fixtures with Gobos"
              >
                Gobos
                <FixtureSelectionMidiLearnButton 
                  actionType="byTypeGobo" 
                  title="MIDI Learn: Select Fixtures with Gobos" 
                  oscKey="fixtureByTypeGobo"
                />
              </button>
            </div>
          </div>
          
          {groups.length > 0 && (
            <div className={styles.selectionByGroup}>
              <label>Select by Group:</label>
              <div className={styles.selectionButtonGrid}>
                <button 
                  className={styles.selectionButton}
                  onClick={selectPreviousGroup}
                  title="Select Previous Group"
                  disabled={groups.length < 2}
                >
                  <LucideIcon name="ArrowLeft" />
                  Prev
                  <FixtureSelectionMidiLearnButton 
                    actionType="groupPrevious" 
                    title="MIDI Learn: Select Previous Group" 
                    oscKey="groupPrev"
                  />
                </button>
                <button 
                  className={styles.selectionButton}
                  onClick={selectNextGroup}
                  title="Select Next Group"
                  disabled={groups.length < 2}
                >
                  <LucideIcon name="ArrowRight" />
                  Next
                  <FixtureSelectionMidiLearnButton 
                    actionType="groupNext" 
                    title="MIDI Learn: Select Next Group" 
                    oscKey="groupNext"
                  />
                </button>
              </div>
              <div className={styles.groupButtonGrid}>
                {groups.map(group => (
                  <button 
                    key={group.id}
                    className={styles.groupButton}
                    onClick={() => selectFixtureGroup(group.id)}
                    title={`Select group: ${group.name}`}
                  >
                    <LucideIcon name="Users" />
                    {group.name}
                    <FixtureSelectionMidiLearnButton 
                      actionType="group" 
                      param={group.name}
                      title={`MIDI Learn: Select Group ${group.name}`} 
                      oscKey="groupSelect"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>      {/* Enhanced Controls Layout with XY Pad */}
      <div className={`${styles.controlsMainGrid} ${columnLayout === '2' ? styles.twoColumns : styles.threeColumns}`}>
        {/* Left Controls Column */}
        <div className={styles.leftControls}>
          {/* Movement & Position Controls */}
          <div className={styles.sliderSection}>
            <h4>Movement & Position</h4>
            
            {/* Pan Control */}
            {(!showOnlyAssignedChannels || hasControlType('pan')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('pan') ? styles.hasActiveChannel : ''}`}>
              <label>Pan</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={panValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPanValue(val);
                    applyControl('pan', val);
                    // Sync with XY pad
                    setPanTiltXY(prev => ({ ...prev, x: (val / 255) * 100 }));
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={panValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPanValue(val);
                    applyControl('pan', val);
                    // Sync with XY pad
                    setPanTiltXY(prev => ({ ...prev, x: (val / 255) * 100 }));
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.pan}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('pan')}</div>
              {renderMidiButtons('pan')}
            </div>
            )}

            {/* Tilt Control */}
            {(!showOnlyAssignedChannels || hasControlType('tilt')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('tilt') ? styles.hasActiveChannel : ''}`}>
              <label>Tilt</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={tiltValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTiltValue(val);
                    applyControl('tilt', val);
                    // Sync with XY pad (invert Y for display)
                    setPanTiltXY(prev => ({ ...prev, y: ((255 - val) / 255) * 100 }));
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={tiltValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setTiltValue(val);
                    applyControl('tilt', val);
                    // Sync with XY pad (invert Y for display)
                    setPanTiltXY(prev => ({ ...prev, y: ((255 - val) / 255) * 100 }));
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.tilt}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('tilt')}</div>
              {renderMidiButtons('tilt')}
            </div>
            )}
            
              {/* Focus Control */}
            {(!showOnlyAssignedChannels || hasControlType('focus')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('focus') ? styles.hasActiveChannel : ''}`}>
              <label>Focus</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={focus}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFocus(val);
                    applyControl('focus', val);
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={focus}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setFocus(val);
                    applyControl('focus', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.focus}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('focus')}</div>
              {renderMidiButtons('focus')}
            </div>
            )}

            {/* Zoom Control */}
            {(!showOnlyAssignedChannels || hasControlType('zoom')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('zoom') ? styles.hasActiveChannel : ''}`}>
              <label>Zoom</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={zoom}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setZoom(val);
                    applyControl('zoom', val);
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={zoom}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setZoom(val);
                    applyControl('zoom', val);
                  }}
                  className={styles.valueInput}
                />              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('zoom')}</div>
              {renderMidiButtons('zoom')}
            </div>
            )}

            {/* Iris Control */}
            {(!showOnlyAssignedChannels || hasControlType('iris')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('iris') ? styles.hasActiveChannel : ''}`}>
              <label>Iris</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={iris}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setIris(val);
                    applyControl('iris', val);
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={iris}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setIris(val);
                    applyControl('iris', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.iris}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('iris')}</div>
              {renderMidiButtons('iris')}
            </div>
            )}
          </div>
        </div>

        {/* Center Controls - XY Pad and Color Wheel */}
        <div className={styles.centerControls}>
          {/* Pan/Tilt XY Pad Control with Fine Adjustments */}
          {(!showOnlyAssignedChannels || hasControlType('pan') || hasControlType('tilt')) && (
            <div className={styles.controlsSection}>
              <div className={styles.sectionHeader}>
                <h4>Pan/Tilt XY Control</h4>
              </div>
              <div 
              className={styles.xyPad}
              ref={xyPadRef}
              onMouseDown={handleXYPadMouseDown}
              onMouseMove={handleXYPadMouseMove}
              onMouseUp={handleXYPadMouseUp}
            >
              <div className={styles.xyGridLines} />
              
              {/* Autopilot Track Visualization */}
              {autopilotTrackEnabled && (
                <div className={styles.trackPath}>
                  <svg className={styles.trackSvg} viewBox="0 0 100 100">
                    <path
                      d={generateTrackPath()}
                      stroke="rgba(0, 255, 128, 0.4)"
                      strokeWidth="0.5"
                      fill="none"
                      strokeDasharray="2,2"
                    />                    {/* Current position indicator */}
                    <circle
                      cx={getVisualTrackIndicatorPosition(
                        autopilotTrackType,
                        autopilotTrackPosition,
                        autopilotTrackSize,
                        (autopilotTrackCenterX / 255) * 100, // Convert DMX to percentage for visual
                        (autopilotTrackCenterY / 255) * 100  // Convert DMX to percentage for visual
                      ).x}
                      cy={getVisualTrackIndicatorPosition(
                        autopilotTrackType,
                        autopilotTrackPosition,
                        autopilotTrackSize,
                        (autopilotTrackCenterX / 255) * 100, // Convert DMX to percentage for visual
                        (autopilotTrackCenterY / 255) * 100  // Convert DMX to percentage for visual
                      ).y}
                      r="1" // Radius of the indicator dot
                      fill="rgba(0, 255, 128, 0.8)"
                    />
                  </svg>
                </div>
              )}
              
              <div 
                className={styles.xyHandle}
                style={{
                  left: `${panTiltXY.x}%`,
                  top: `${panTiltXY.y}%`
                }}
              />
            </div>
            
            {/* Fine Controls underneath XY Pad */}
            <div className={styles.fineControls}>
              {(!showOnlyAssignedChannels || hasControlType('finePan')) && (
              <div className={styles.fineControlRow}>
                <label>Fine Pan</label>
                <div className={styles.fineControlInputs}>
                  <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={finePanValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFinePanValue(val);
                      applyControl('finePan', val);
                    }}
                    className={styles.fineSlider}
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="255" 
                    value={finePanValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setFinePanValue(val);
                      applyControl('finePan', val);
                    }}
                    className={styles.fineValueInput}
                  />
                  <span className={styles.oscAddress}>{superControlOscAddresses.finePan}</span>
                </div>
                <div className={styles.fineChannelDisplay}>{getDmxChannelForControl('finePan')}</div>
                {renderMidiButtons('finePan')}
              </div>
              )}
              
              {(!showOnlyAssignedChannels || hasControlType('fineTilt')) && (
              <div className={styles.fineControlRow}>
                <label>Fine Tilt</label>
                <div className={styles.fineControlInputs}>
                  <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={fineTiltValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFineTiltValue(val);
                      applyControl('fineTilt', val);
                    }}
                    className={styles.fineSlider}
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="255" 
                    value={fineTiltValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setFineTiltValue(val);
                      applyControl('fineTilt', val);
                    }}
                    className={styles.fineValueInput}
                  />
                  <span className={styles.oscAddress}>{superControlOscAddresses.fineTilt}</span>
                </div>
                <div className={styles.fineChannelDisplay}>{getDmxChannelForControl('fineTilt')}</div>
                {renderMidiButtons('fineTilt')}
              </div>
              )}
            </div>
            
            <div className={styles.panTiltControls}>
              <div className={styles.controlWithChannel}>
                <button 
                  className={styles.centerResetBtn}
                  onClick={resetPanTiltToCenter}
                  title="Reset Pan/Tilt to center position"
                >
                  <LucideIcon name="Target" />
                  Reset to Center
                </button>
                {renderMidiButtons('resetPanTiltToCenter')}
              </div>
              <div className={styles.controlWithChannel}>
                <button 
                  className={styles.fineResetBtn}
                  onClick={() => {
                    setFinePanValue(0);
                    setFineTiltValue(0);
                    applyControl('finePan', 0);
                    applyControl('fineTilt', 0);
                  }}
                  title="Reset Fine adjustments to 0"
                >
                  <LucideIcon name="RotateCcw" />
                  Reset Fine
                </button>
                {renderMidiButtons('resetFinePanTilt')}
              </div>
            </div>
            
            <div className={styles.xyPositionDisplay}>
              <div className={styles.coarseValues}>
                <span>Pan: {panValue} <small>({getDmxChannelForControl('pan')})</small></span>
                <span>Tilt: {tiltValue} <small>({getDmxChannelForControl('tilt')})</small></span>
              </div>
              <div className={styles.fineValues}>
                <span>Fine Pan: {finePanValue}</span>
                <span>Fine Tilt: {fineTiltValue}</span>
              </div>
            </div>
            </div>
          )}

          {/* Autopilot Track Controls */}
          <div className={styles.controlsSection}>
            <div className={styles.sectionHeader}>
              <h4>
                <LucideIcon name="Navigation" />
                Autopilot Track
              </h4>
              <div className={styles.controlRow}>
                <button
                  className={`${styles.autopilotToggle} ${autopilotTrackEnabled ? styles.active : ''}`}
                  onClick={() => setAutopilotTrackEnabled(!autopilotTrackEnabled)}
                  title={autopilotTrackEnabled ? "Disable Autopilot" : "Enable Autopilot"}
                >
                  <LucideIcon name={autopilotTrackEnabled ? "Pause" : "Play"} />
                  {autopilotTrackEnabled ? "Stop" : "Start"}
                </button>
                {renderMidiButtons('autopilotTrackEnabled')}
              </div>
            </div>
              {autopilotTrackEnabled && (
              <div className={styles.autopilotSettings}>
                <div className={styles.controlRow}>
                  <label>Track Type</label>
                  <div className={styles.controlInputs}>
                    <select
                      value={autopilotTrackType}
                      onChange={(e) => {
                        setAutopilotTrackType(e.target.value as any);
                        // Trigger immediate update when track type changes
                        console.log('[AUTOPILOT] Track type changed to:', e.target.value);
                        setTimeout(() => {
                          console.log('[AUTOPILOT] Triggering updatePanTiltFromTrack after track type change');
                          updatePanTiltFromTrack();
                        }, 50);
                      }}
                      className={styles.autopilotSelect}
                    >
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="figure8">Figure 8</option>
                      <option value="triangle">Triangle</option>
                      <option value="linear">Linear</option>
                      <option value="random">Random</option>
                    </select>
                  </div>
                  {renderMidiButtons('autopilotTrackType')}
                </div>

                <div className={styles.controlRow}>
                  <label>Position</label>
                  <div className={styles.controlInputs}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={autopilotTrackPosition}
                      onChange={(e) => {
                        const newPosition = parseInt(e.target.value);
                        console.log('[AUTOPILOT] Position slider changed from', autopilotTrackPosition, 'to', newPosition);
                        setAutopilotTrackPosition(newPosition);
                        console.log('[AUTOPILOT] Position changed to:', newPosition);
                        
                        // Debug: Check autopilot state
                        if (!autopilotTrackEnabled) {
                          console.warn('[AUTOPILOT] WARNING: Autopilot not enabled - DMX update will be skipped');
                        }
                        
                        if (selectedFixtures.length === 0 && fixtures.length > 0) {
                          console.warn('[AUTOPILOT] WARNING: No fixtures selected - consider selecting fixtures for targeted control');
                        }
                        
                        // Note: updatePanTiltFromTrack() is automatically called by setAutopilotTrackPosition in store
                      }}
                      className={styles.slider}
                    />
                    <span className={styles.valueDisplay}>{autopilotTrackPosition}%</span>
                  </div>
                  {renderMidiButtons('autopilotTrackPosition')}
                </div>
                
                <div className={styles.controlRow}>
                  <label>Speed</label>
                  <div className={styles.controlInputs}>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={autopilotTrackSpeed}
                      onChange={(e) => setAutopilotTrackSpeed(parseFloat(e.target.value))}
                      className={styles.slider}
                    />
                    <span className={styles.valueDisplay}>{autopilotTrackSpeed.toFixed(0)}x</span>
                  </div>
                  {renderMidiButtons('autopilotTrackSpeed')}
                </div>
                
                <div className={styles.controlRow}>
                  <label>Size</label>
                  <div className={styles.controlInputs}>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={autopilotTrackSize}
                      onChange={(e) => {
                        setAutopilotTrackSize(parseInt(e.target.value));
                        console.log('[AUTOPILOT] Size changed to:', e.target.value);
                        // Note: updatePanTiltFromTrack() is automatically called by setAutopilotTrackSize in store
                      }}
                      className={styles.slider}
                    />
                    <span className={styles.valueDisplay}>{autopilotTrackSize}%</span>
                  </div>
                  {renderMidiButtons('autopilotTrackSize')}
                </div>
                <div className={styles.controlRow}>
                  <label>Center X</label>
                  <div className={styles.controlInputs}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(autopilotTrackCenterX / 255) * 100}
                      onChange={(e) => {
                        const percentValue = parseInt(e.target.value);
                        const dmxValue = Math.round((percentValue / 100) * 255);
                        setAutopilotTrackCenter(dmxValue, autopilotTrackCenterY);
                        console.log('[AUTOPILOT] Center X changed to:', percentValue, '% (DMX:', dmxValue, ')');
                        // Note: updatePanTiltFromTrack() is automatically called by setAutopilotTrackCenter in store
                      }}
                      className={styles.slider}
                    />
                    <span className={styles.valueDisplay}>{Math.round((autopilotTrackCenterX / 255) * 100)}%</span>
                  </div>
                  {renderMidiButtons('autopilotTrackCenterX')}
                </div>
                
                <div className={styles.controlRow}>
                  <label>Center Y</label>
                  <div className={styles.controlInputs}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(autopilotTrackCenterY / 255) * 100}
                      onChange={(e) => {
                        const percentValue = parseInt(e.target.value);
                        const dmxValue = Math.round((percentValue / 100) * 255);
                        setAutopilotTrackCenter(autopilotTrackCenterX, dmxValue);
                        console.log('[AUTOPILOT] Center Y changed to:', percentValue, '% (DMX:', dmxValue, ')');
                        // Note: updatePanTiltFromTrack() is automatically called by setAutopilotTrackCenter in store
                      }}
                      className={styles.slider}
                    />
                    <span className={styles.valueDisplay}>{Math.round((autopilotTrackCenterY / 255) * 100)}%</span>
                  </div>
                  {renderMidiButtons('autopilotTrackCenterY')}
                </div>
                
                <div className={styles.controlRow}>
                  <div className={styles.actionRow}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      updatePanTiltFromTrack();
                    }}
                    title="Apply current track position to fixtures"
                  >
                    <LucideIcon name="Target" />
                    Apply Position
                  </button>                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      setAutopilotTrackCenter(127, 127); // DMX center values
                      setAutopilotTrackSize(50);
                      setAutopilotTrackSpeed(1);
                      setAutopilotTrackPosition(0);
                      // Trigger immediate update after reset
                      console.log('[AUTOPILOT] Reset button clicked');
                      setTimeout(() => {
                        console.log('[AUTOPILOT] Triggering updatePanTiltFromTrack after reset');
                        updatePanTiltFromTrack();
                      }, 50);
                    }}
                    title="Reset to default values"
                  >
                    <LucideIcon name="RotateCcw" />
                    Reset
                  </button>
                  <button
                    className={`${styles.actionBtn} ${autopilotTrackAutoPlay ? styles.active : ''}`}
                    onClick={() => setAutopilotTrackAutoPlay(!autopilotTrackAutoPlay)}
                    title={autopilotTrackAutoPlay ? "Disable Auto Loop" : "Enable Auto Loop"}
                  >
                    <LucideIcon name="Repeat" />
                    Auto Loop
                  </button>
                  {renderMidiButtons('autopilotTrackAutoPlay')}
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      console.log('🔧 ENHANCED AUTOPILOT DEBUG REPORT');
                      console.log('===================================');
                      
                      // Basic autopilot state
                      console.log('📊 Autopilot State:');
                      console.log('  Enabled:', autopilotTrackEnabled);
                      console.log('  Track type:', autopilotTrackType);
                      console.log('  Position:', autopilotTrackPosition, '%');
                      console.log('  Size:', autopilotTrackSize, '%');
                      console.log('  Center X:', autopilotTrackCenterX, '(DMX) =', Math.round((autopilotTrackCenterX / 255) * 100), '%');
                      console.log('  Center Y:', autopilotTrackCenterY, '(DMX) =', Math.round((autopilotTrackCenterY / 255) * 100), '%');
                      console.log('  Auto play:', autopilotTrackAutoPlay);
                      console.log('  Speed:', autopilotTrackSpeed, 'x');
                      
                      // Fixture analysis
                      console.log('\n🎯 Fixture Analysis:');
                      console.log('  Total fixtures:', fixtures.length);
                      console.log('  Selected fixtures:', selectedFixtures.length);
                      
                      if (fixtures.length === 0) {
                        console.error('❌ CRITICAL: No fixtures loaded!');
                        console.log('💡 Solution: Go to Fixture Creator and add fixtures');
                        return;
                      }
                      
                      if (selectedFixtures.length === 0) {
                        console.warn('⚠️ WARNING: No fixtures selected!');
                        console.log('💡 Solution: Select fixtures in the fixture list');
                      }
                      
                      // Check fixtures for Pan/Tilt channels
                      const targetFixtures = selectedFixtures.length > 0 
                        ? fixtures.filter(f => selectedFixtures.includes(f.id))
                        : fixtures;
                        
                      console.log('  Target fixtures for autopilot:', targetFixtures.length);
                      
                      let panChannels = 0;
                      let tiltChannels = 0;
                      
                      targetFixtures.forEach((fixture, index) => {
                        console.log(`    ${index + 1}. ${fixture.name} (${fixture.channels.length} channels)`);
                        
                        fixture.channels.forEach(channel => {
                          if (channel.type.toLowerCase() === 'pan') {
                            panChannels++;
                            console.log(`      ✅ Pan channel: ${channel.name} -> DMX ${channel.dmxAddress}`);
                          } else if (channel.type.toLowerCase() === 'tilt') {
                            tiltChannels++;
                            console.log(`      ✅ Tilt channel: ${channel.name} -> DMX ${channel.dmxAddress}`);
                          }
                        });
                      });
                      
                      console.log(`  Pan channels found: ${panChannels}`);
                      console.log(`  Tilt channels found: ${tiltChannels}`);
                      
                      if (panChannels === 0 || tiltChannels === 0) {
                        console.error('❌ CRITICAL: No Pan/Tilt channels found!');
                        console.log('💡 Solution: Ensure fixtures have channels with type "pan" and "tilt"');
                        return;
                      }
                      
                      // Test calculation
                      console.log('\n🧮 Track Position Calculation:');
                      try {
                        const { pan, tilt } = calculateTrackPosition(
                          autopilotTrackType,
                          autopilotTrackPosition,
                          autopilotTrackSize,
                          autopilotTrackCenterX,
                          autopilotTrackCenterY
                        );
                        console.log('  Calculated Pan:', pan, '(DMX 0-255)');
                        console.log('  Calculated Tilt:', tilt, '(DMX 0-255)');
                        
                        // Visual bounds check
                        const visualCenterX = (autopilotTrackCenterX / 255) * 100;
                        const visualCenterY = (autopilotTrackCenterY / 255) * 100;
                        const baseRadius = autopilotTrackSize / 2;
                        const maxRadiusX = Math.min(visualCenterX, 100 - visualCenterX);
                        const maxRadiusY = Math.min(visualCenterY, 100 - visualCenterY);
                        const maxRadius = Math.min(maxRadiusX, maxRadiusY, 45);
                        const constrainedRadius = Math.min(baseRadius, maxRadius);
                        
                        console.log('\n📐 Visual Bounds Analysis:');
                        console.log('  Visual center:', visualCenterX.toFixed(1), ',', visualCenterY.toFixed(1), '%');
                        console.log('  Requested radius:', baseRadius, '%');
                        console.log('  Max allowed radius:', maxRadius.toFixed(1), '%');
                        console.log('  Constrained radius:', constrainedRadius.toFixed(1), '%');
                        
                        if (constrainedRadius < baseRadius) {
                          console.warn('⚠️ Track size constrained to fit bounds');
                        } else {
                          console.log('✅ Track fits within bounds');
                        }
                        
                      } catch (error) {
                        console.error('❌ Calculation error:', error);
                        return;
                      }
                      
                      // Test DMX update
                      console.log('\n🔌 Testing DMX Update:');
                      console.log('  Triggering updatePanTiltFromTrack()...');
                      try {
                        updatePanTiltFromTrack();
                        console.log('✅ DMX update function called successfully');
                        console.log('💡 Check console for [STORE] updatePanTiltFromTrack messages');
                        console.log('💡 Check Network tab for DMX HTTP requests');
                      } catch (error) {
                        console.error('❌ DMX update error:', error);
                      }
                      
                      console.log('\n📋 Summary:');
                      if (autopilotTrackEnabled && targetFixtures.length > 0 && panChannels > 0 && tiltChannels > 0) {
                        console.log('✅ Autopilot should be working - check for DMX updates in console/network');
                      } else {
                        console.log('❌ Issues found - fix the problems listed above');
                      }
                    }}
                    title="Enhanced autopilot debug with full analysis"
                  >
                    <LucideIcon name="Bug" />
                    Debug
                  </button>
                  
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      console.log('🎯 TESTING AUTOPILOT DMX UPDATES');
                      console.log('================================');
                      
                      if (!autopilotTrackEnabled) {
                        console.error('❌ Autopilot not enabled! Enable autopilot first.');
                        return;
                      }
                      
                      // Calculate current position
                      const { pan, tilt } = calculateTrackPosition(
                        autopilotTrackType,
                        autopilotTrackPosition,
                        autopilotTrackSize,
                        autopilotTrackCenterX,
                        autopilotTrackCenterY
                      );
                      
                      console.log(`📊 Current calculated position: pan=${pan}, tilt=${tilt}`);
                      console.log('🔄 Triggering direct DMX update...');
                      
                      // Apply via SuperControl function
                      applyControl('pan', pan);
                      applyControl('tilt', tilt);
                      
                      // Also trigger store update
                      updatePanTiltFromTrack();
                      
                      console.log('✅ DMX update commands sent! Check console for [STORE] messages.');
                    }}
                    title="Test current autopilot position with direct DMX update"
                  >
                    <LucideIcon name="Zap" />
                    Test DMX
                  </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Modular Automation System */}
          <div className={styles.controlsSection}>
            <div className={styles.sectionHeader}>
              <h4>
                <LucideIcon name="Zap" />
                Modular Automation
              </h4>
            </div>
            <ModularAutomation />
          </div>

          {/* RGB Color Wheel Control */}
          {(!showOnlyAssignedChannels || hasControlType('red') || hasControlType('green') || hasControlType('blue')) && (
          <div className={styles.controlsSection}>
            <div className={styles.sectionHeader}>
              <h4>RGB Color Control</h4>
            </div>
            
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
            
            <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem', justifyContent: 'center', marginTop: '10px', alignItems: 'center' }}>
              <span style={{ color: '#ff6b6b' }}>R: {red} <small>({getDmxChannelForControl('red')})</small></span>
              <span style={{ color: '#51cf66' }}>G: {green} <small>({getDmxChannelForControl('green')})</small></span>
              <span style={{ color: '#339af0' }}>B: {blue} <small>({getDmxChannelForControl('blue')})</small></span>
              {colorSliderAutopilot?.enabled && (
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: '#8b5cf6', 
                  backgroundColor: 'rgba(139, 92, 246, 0.2)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }} title={`Auto Color Active: ${colorSliderAutopilot.type} pattern at ${colorSliderAutopilot.speed.toFixed(1)}x speed`}>
                  <span>🎨</span> Auto Color
                </span>
              )}
            </div>

            {/* Individual RGB Sliders with MIDI Learn */}
            <div className={styles.rgbSliders}>
              {/* Red Control */}
              {(!showOnlyAssignedChannels || hasControlType('red')) && (
              <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('red') ? styles.hasActiveChannel : ''} ${colorSliderAutopilot?.enabled ? styles.autoColorActive : ''}`}>
                <label style={{ color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Red
                  {colorSliderAutopilot?.enabled && (
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6', opacity: 0.8 }} title="Auto Color is updating this channel">🎨</span>
                  )}
                </label>
                <div className={styles.controlInputs}>
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
                    className={styles.slider}
                    style={{ accentColor: '#ff6b6b' }}
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="255" 
                    value={red}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setRed(val);
                      applyControl('red', val);
                    }}
                    className={styles.valueInput}
                  />
                  <span className={styles.oscAddress}>{superControlOscAddresses.red}</span>
                </div>
                <div className={styles.channelDisplay}>{getDmxChannelForControl('red')}</div>
                {renderMidiButtons('red')}
              </div>
              )}

              {/* Green Control */}
              {(!showOnlyAssignedChannels || hasControlType('green')) && (
              <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('green') ? styles.hasActiveChannel : ''} ${colorSliderAutopilot?.enabled ? styles.autoColorActive : ''}`}>
                <label style={{ color: '#51cf66', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Green
                  {colorSliderAutopilot?.enabled && (
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6', opacity: 0.8 }} title="Auto Color is updating this channel">🎨</span>
                  )}
                </label>
                <div className={styles.controlInputs}>
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
                    className={styles.slider}
                    style={{ accentColor: '#51cf66' }}
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="255" 
                    value={green}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setGreen(val);
                      applyControl('green', val);
                    }}
                    className={styles.valueInput}
                  />
                  <span className={styles.oscAddress}>{superControlOscAddresses.green}</span>
                </div>
                <div className={styles.channelDisplay}>{getDmxChannelForControl('green')}</div>
                {renderMidiButtons('green')}
              </div>
              )}

              {/* Blue Control */}
              {(!showOnlyAssignedChannels || hasControlType('blue')) && (
              <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('blue') ? styles.hasActiveChannel : ''} ${colorSliderAutopilot?.enabled ? styles.autoColorActive : ''}`}>
                <label style={{ color: '#339af0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Blue
                  {colorSliderAutopilot?.enabled && (
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6', opacity: 0.8 }} title="Auto Color is updating this channel">🎨</span>
                  )}
                </label>
                <div className={styles.controlInputs}>
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
                    className={styles.slider}
                    style={{ accentColor: '#339af0' }}
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="255" 
                    value={blue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBlue(val);
                      applyControl('blue', val);
                    }}
                    className={styles.valueInput}
                  />
                  <span className={styles.oscAddress}>{superControlOscAddresses.blue}</span>
                </div>
                <div className={styles.channelDisplay}>{getDmxChannelForControl('blue')}</div>
                {renderMidiButtons('blue')}
              </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Right Controls Column */}
        <div className={styles.rightControls}>
          {/* Basic Controls */}
          <div className={styles.sliderSection}>
            <h4>Basic Controls</h4>
            
            {/* Dimmer Control */}
            {(!showOnlyAssignedChannels || hasControlType('dimmer')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('dimmer') ? styles.hasActiveChannel : ''}`}>
              <label>Dimmer</label>
              <div className={styles.controlInputs}>
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
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={dimmer}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setDimmer(val);
                    applyControl('dimmer', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.dimmer}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('dimmer')}</div>
              {renderMidiButtons('dimmer')}
            </div>
            )}

            {/* Shutter Control */}
            {(!showOnlyAssignedChannels || hasControlType('shutter')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('shutter') ? styles.hasActiveChannel : ''}`}>
              <label>Shutter</label>
              <div className={styles.controlInputs}>
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
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={shutter}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setShutter(val);
                    applyControl('shutter', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.shutter}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('shutter')}</div>
              {renderMidiButtons('shutter')}
            </div>
            )}

            {/* Strobe Control */}
            {(!showOnlyAssignedChannels || hasControlType('strobe')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('strobe') ? styles.hasActiveChannel : ''}`}>
              <label>Strobe</label>
              <div className={styles.controlInputs}>
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
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={strobe}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setStrobe(val);
                    applyControl('strobe', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.strobe}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('strobe')}</div>
              {renderMidiButtons('strobe')}
            </div>
            )}

            {/* GOBO Control */}
            {(!showOnlyAssignedChannels || hasControlType('gobo')) && (
            <div className={`${styles.controlWithChannel} ${hasActiveDmxChannel('gobo') ? styles.hasActiveChannel : ''}`}>
              <label>GOBO</label>
              <div className={styles.controlInputs}>
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
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={gobo}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setGobo(val);
                    applyControl('gobo', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.gobo}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('gobo')}</div>
              {renderMidiButtons('gobo')}
            </div>
            )}

            {/* Color Wheel Control */}
            {(!showOnlyAssignedChannels || hasControlType('colorWheel')) && (
            <div className={styles.controlWithChannel}>
              <label>Color Wheel</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={colorWheel}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setColorWheel(val);
                    applyControl('colorWheel', val);
                  }}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="255" 
                  value={colorWheel}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setColorWheel(val);
                    applyControl('colorWheel', val);
                  }}
                  className={styles.valueInput}
                />
                <span className={styles.oscAddress}>{superControlOscAddresses.colorWheel}</span>
              </div>
              <div className={styles.channelDisplay}>{getDmxChannelForControl('colorWheel')}</div>
              {renderMidiButtons('colorWheel')}
            </div>
            )}
          </div>
        </div>
      </div>      {/* Additional Controls */}
      <div className={styles.controlsSection}>
        <div className={styles.sectionHeader}>
          <h4>Additional Controls</h4>
        </div>
          <div className={styles.controlGrid}>
          {/* Enhanced GOBO Control with Presets */}
          {(!showOnlyAssignedChannels || hasControlType('gobo')) && (
          <div className={styles.goboSection}>
            <label>GOBO Selection</label>
            <div className={styles.goboPresets}>
              {goboPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`${styles.goboPresetBtn} ${gobo === preset.value ? styles.active : ''}`}
                  onClick={() => {
                    setGobo(preset.value);
                    applyControl('gobo', preset.value);
                  }}
                  title={`${preset.name} (${preset.value})`}
                >
                  <span className={styles.goboIcon}>{preset.icon}</span>
                  <span className={styles.goboName}>{preset.name}</span>
                </button>
              ))}
            </div>
            
            {/* GOBO Fine Control */}
            <div className={styles.controlInputs}>
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
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={gobo}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGobo(val);
                  applyControl('gobo', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.gobo}</span>
            </div>
          </div>
          )}

          {/* GOBO Rotation Control */}
          {(!showOnlyAssignedChannels || hasControlType('goboRotation')) && (
          <div className={styles.controlRow}>
            <label>GOBO Rotation</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={goboRotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setGoboRotation(val);
                  applyControl('goboRotation', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={goboRotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGoboRotation(val);
                  applyControl('goboRotation', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.goboRotation}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('goboRotation')}</div>
            {renderMidiButtons('goboRotation')}
          </div>
          )}
          <div className={styles.actionButtons}>
            <div className={styles.controlWithChannel}>
              <button
                className={`${styles.actionBtn} ${styles.flashBtn} ${isFlashing ? styles.active : ''}`}
                onClick={handleFlash}
                disabled={isFlashing}
                title="Flash (Quick Bright Pulse)"
              >
                <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Flash
              </button>
              {renderMidiButtons('flash')}
            </div>

            <div className={styles.controlWithChannel}>
              <button
                className={`${styles.actionBtn} ${styles.strobeBtn} ${isStrobing ? styles.active : ''}`}
                onClick={handleStrobe}
                title={isStrobing ? "Stop Strobing" : "Start Strobing"}
              >
                <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="4" />
                  <path d="m21.17 8.17-2.83-2.83" />
                  <path d="m6.66 8.17 2.83-2.83" />
                  <path d="m21.17 15.83-2.83 2.83" />
                  <path d="m6.66 15.83 2.83 2.83" />
                  <path d="M8.17 21.17 8.17 18.34" />
                  <path d="M15.83 21.17 15.83 18.34" />
                  <path d="M8.17 6.66 8.17 2.83" />
                  <path d="M15.83 6.66 15.83 2.83" />
                </svg>
                {isStrobing ? 'Stop' : 'Strobing'}
              </button>
              {renderMidiButtons('strobeToggle')}
            </div>

            <div className={styles.controlWithChannel}>
              <button
                className={`${styles.actionBtn} ${styles.resetBtn}`}
                onClick={handleResetAll}
                title="Reset All Controls to Default"
              >
                <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                Reset All
              </button>
              {renderMidiButtons('resetAll')}
            </div>
          </div>

          {/* Flash/Strobe Speed Controls */}
          <div className={styles.speedControls}>
            <div className={styles.controlWithChannel}>
              <label>Flash Speed (ms)</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="50" 
                  max="500" 
                  value={flashSpeed}
                  onChange={(e) => setFlashSpeed(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="50" 
                  max="500" 
                  value={flashSpeed}
                  onChange={(e) => setFlashSpeed(parseInt(e.target.value) || 100)}
                  className={styles.valueInput}
                />
              </div>
              {renderMidiButtons('flashSpeed')}
            </div>

            <div className={styles.controlWithChannel}>
              <label>Strobe Speed</label>
              <div className={styles.controlInputs}>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={strobeSpeed}
                  onChange={(e) => setStrobeSpeed(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={strobeSpeed}
                  onChange={(e) => setStrobeSpeed(parseInt(e.target.value) || 10)}
                  className={styles.valueInput}
                />
              </div>
              {renderMidiButtons('strobeSpeed')}
            </div>
          </div>

          {/* Shutter Control */}
          <div className={styles.controlRow}>
            <label>Shutter</label>
            <div className={styles.controlInputs}>
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
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={shutter}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setShutter(val);
                  applyControl('shutter', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.shutter}</span>
            </div>
          </div>

          {/* Strobe Control */}
          <div className={styles.controlRow}>
            <label>Strobe</label>
            <div className={styles.controlInputs}>
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
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={strobe}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setStrobe(val);
                  applyControl('strobe', val);
                }}
                className={styles.valueInput}
              />              <span className={styles.oscAddress}>{superControlOscAddresses.strobe}</span>
            </div>
          </div>
        </div>

        {/* Enhanced Movement Controls Section */}
        <div className={styles.controlSection}>
          <h3>Enhanced Movement Controls</h3>
          
          {/* Focus Control */}
          <div className={styles.controlRow}>
            <label>Focus</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={focus}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFocus(val);
                  applyControl('focus', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={focus}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setFocus(val);
                  applyControl('focus', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.focus}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('focus')}</div>
            {renderMidiButtons('focus')}
          </div>

          {/* Zoom Control */}
          <div className={styles.controlRow}>
            <label>Zoom</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={zoom}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setZoom(val);
                  applyControl('zoom', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={zoom}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setZoom(val);
                  applyControl('zoom', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.zoom}</span>
            </div>
          </div>          {/* Iris Control */}
          <div className={styles.controlRow}>
            <label>Iris</label>
            <div className={styles.controlInputs}>
              <input
                type="range"
                min="0"
                max="255"
                value={iris}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setIris(val);
                  applyControl('iris', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={iris}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setIris(val);
                  applyControl('iris', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.iris}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('iris')}</div>
            {renderMidiButtons('iris')}
          </div>

          {/* Macro Control */}
          <div className={styles.controlRow}>

          {/* Prism Control */}
          <div className={styles.controlRow}>
            <label>Prism</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={prism}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setPrism(val);
                  applyControl('prism', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={prism}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setPrism(val);
                  applyControl('prism', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.prism}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('prism')}</div>
            {renderMidiButtons('prism')}
          </div>

          {/* Color Wheel Control */}
          <div className={styles.controlRow}>
            <label>Color Wheel</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={colorWheel}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setColorWheel(val);
                  applyControl('colorWheel', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={colorWheel}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setColorWheel(val);
                  applyControl('colorWheel', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.colorWheel}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('colorWheel')}</div>
            {renderMidiButtons('colorWheel')}
          </div>

          {/* Frost Control */}
          <div className={styles.controlRow}>
            <label>Frost</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={frost}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFrost(val);
                  applyControl('frost', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={frost}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setFrost(val);
                  applyControl('frost', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.frost}</span>
            </div>
          </div>          {/* Macro Control */}
          <div className={styles.controlRow}>
            <label>Macro</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={macro}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMacro(val);
                  applyControl('macro', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={macro}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setMacro(val);
                  applyControl('macro', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.macro}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('macro')}</div>
            {renderMidiButtons('macro')}
          </div>          {/* Speed Control */}
          <div className={styles.controlRow}>
            <label>Speed</label>
            <div className={styles.controlInputs}>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={speed}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSpeed(val);
                  applyControl('speed', val);
                }}
                className={styles.slider}
              />
              <input 
                type="number" 
                min="0" 
                max="255" 
                value={speed}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setSpeed(val);
                  applyControl('speed', val);
                }}
                className={styles.valueInput}
              />
              <span className={styles.oscAddress}>{superControlOscAddresses.speed}</span>
            </div>
            <div className={styles.channelDisplay}>{getDmxChannelForControl('speed')}</div>
            {renderMidiButtons('speed')}
          </div>
        </div>
      </div>

      {/* OSC Help Modal */}
      {showOscHelp && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>OSC Addresses Reference</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowOscHelp(false)}
              >
                <LucideIcon name="X" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>OSC control addresses for the SuperControl interface:</p>
              
              <div className={styles.oscAddressSection}>
                <h4>Basic Controls</h4>
                <div className={styles.oscAddressList}>
                  <div className={styles.oscAddress}>
                    <code>/dimmer</code>
                    <span>Master Dimmer (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/red</code>
                    <span>Red Color (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/green</code>
                    <span>Green Color (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/blue</code>
                    <span>Blue Color (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/white</code>
                    <span>White Color (0.0 - 1.0)</span>
                  </div>
                </div>
              </div>

              <div className={styles.oscAddressSection}>
                <h4>Movement Controls</h4>
                <div className={styles.oscAddressList}>
                  <div className={styles.oscAddress}>
                    <code>/pan</code>
                    <span>Pan Position (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/tilt</code>
                    <span>Tilt Position (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/xy</code>
                    <span>Combined Pan/Tilt (x, y values 0.0 - 1.0)</span>
                  </div>
                </div>
              </div>

              <div className={styles.oscAddressSection}>
                <h4>GOBO & Effects</h4>
                <div className={styles.oscAddressList}>
                  <div className={styles.oscAddress}>
                    <code>/gobo</code>
                    <span>GOBO Selection (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/gobo_rotation</code>
                    <span>GOBO Rotation (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/strobe</code>
                    <span>Strobe Speed (0.0 - 1.0)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/focus</code>
                    <span>Focus/Zoom (0.0 - 1.0)</span>
                  </div>
                </div>
              </div>

              <div className={styles.oscAddressSection}>
                <h4>Scene Control</h4>
                <div className={styles.oscAddressList}>
                  <div className={styles.oscAddress}>
                    <code>/scene/save</code>
                    <span>Save Current Scene (bang/trigger)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/scene/prev</code>
                    <span>Previous Scene (bang/trigger)</span>
                  </div>
                  <div className={styles.oscAddress}>
                    <code>/scene/next</code>
                    <span>Next Scene (bang/trigger)</span>
                  </div>
                </div>
              </div>

              <div className={styles.oscInfo}>
                <h4>Usage Notes</h4>
                <ul>
                  <li>All values should be normalized between 0.0 and 1.0</li>
                  <li>Bang/trigger messages can be sent with any value</li>
                  <li>Default OSC port: 8000 (configurable in settings)</li>
                  <li>Use OSC-compatible apps to control remotely</li>
                </ul>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setShowOscHelp(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scene Management */}
      <div className={styles.controlsSection}>
        <div className={styles.sectionHeader}>
          <h4>Scene Management</h4>
        </div>
        
        <div className={styles.sceneControls}>
          <div className={styles.sceneButtonRow}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                className={styles.sceneBtn}
                onClick={() => captureCurrentScene()}
              >
                <LucideIcon name="Camera" />
                Save Scene
              </button>
              {renderMidiButtons('sceneSave')}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                className={styles.sceneBtn}
                onClick={selectPreviousScene}
                disabled={scenes.length === 0}
              >
                <LucideIcon name="ChevronLeft" />
                Previous
              </button>
              {renderMidiButtons('scenePrev')}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                className={styles.sceneBtn}
                onClick={selectNextScene}
                disabled={scenes.length === 0}
              >
                Next
                <LucideIcon name="ChevronRight" />
              </button>
              {renderMidiButtons('sceneNext')}
            </div>
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

        {/* Saved Scenes List */}
        {scenes.length > 0 && (
          <div className={styles.scenesList}>
            <h5>Saved Scenes ({scenes.length})</h5>
            <div className={styles.scenesGrid}>
              {scenes.map((scene, index) => (
                <div 
                  key={scene.id}
                  className={`${styles.sceneItem} ${index === currentSceneIndex ? styles.active : ''}`}
                >
                  <div className={styles.sceneHeader}>
                    <span className={styles.sceneName}>{scene.name}</span>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => deleteScene(index)}
                    >
                      <LucideIcon name="X" />
                    </button>
                  </div>
                  <div className={styles.sceneDetails}>
                    <span className={styles.sceneChannels}>
                      {Object.keys(scene.values).length} channels
                    </span>
                    <span className={styles.sceneTime}>
                      {new Date(scene.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <button 
                    className={styles.loadSceneBtn}
                    onClick={() => loadScene(index)}
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
    
    </div>
  );
};

export default SuperControl;
