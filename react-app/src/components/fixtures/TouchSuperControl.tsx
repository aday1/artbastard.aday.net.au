import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TouchSuperControl.module.scss';

interface TouchSuperControlProps {
  isFullscreen?: boolean;
  onSelectionChange?: (count: number) => void;
  enableHapticFeedback?: boolean;
  autoHideInterface?: boolean;
}

type TouchSelectionMode = 'channels' | 'fixtures' | 'groups' | 'capabilities';

interface FixtureCapability {
  type: string;
  fixtures: string[];
  count: number;
}

interface QuickAction {
  name: string;
  action: () => void;
  icon: string;
  color: string;
  description?: string;
}

const TouchSuperControl: React.FC<TouchSuperControlProps> = ({
  isFullscreen = true,
  onSelectionChange,
  enableHapticFeedback = true,
  autoHideInterface = false
}) => {
  const fixtures = useStore(state => state.fixtures);
  const groups = useStore(state => state.groups);
  const selectedChannels = useStore(state => state.selectedChannels);
  const getDmxChannelValue = useStore(state => state.getDmxChannelValue);
  const setDmxChannelValue = useStore(state => state.setDmxChannelValue);
  const globalSelectedFixtures = useStore(state => state.selectedFixtures);
  const toggleFixtureSelection = useStore(state => state.toggleFixtureSelection);
  // Selection state - Default to 'fixtures' since 'channels' mode is disabled in UI
  const [selectionMode, setSelectionMode] = useState<TouchSelectionMode>('fixtures');
  // selectedFixtures is now from global store
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]); // Kept local for now
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]); // Kept local for now

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

  // Touch interaction state
  const [panTiltXY, setPanTiltXY] = useState({ x: 50, y: 50 });
  const xyPadRef = useRef<HTMLDivElement>(null);
  const [isTouchingXY, setIsTouchingXY] = useState(false);

  // Color wheel state
  const [colorHue, setColorHue] = useState(0);
  const [colorSaturation, setColorSaturation] = useState(100);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const [isTouchingColor, setIsTouchingColor] = useState(false);
  // UI state
  const [activePanel, setActivePanel] = useState<'selection' | 'control' | 'quick'>('control');
  const [showAllControls, setShowAllControls] = useState(false);
  const [interfaceVisible, setInterfaceVisible] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  // Touch gesture state
  const [multiTouchActive, setMultiTouchActive] = useState(false);
  const [gestureStartDistance, setGestureStartDistance] = useState(0);
  const [initialPinchValues, setInitialPinchValues] = useState({ dimmer: 255, strobe: 0 });

  // Haptic feedback function
  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (enableHapticFeedback && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [50]
      };
      navigator.vibrate(patterns[type]);
    }
  }, [enableHapticFeedback]);

  // Auto-hide interface timer
  useEffect(() => {
    if (!autoHideInterface) return;

    const timer = setTimeout(() => {
      if (Date.now() - lastInteraction > 5000) {
        setInterfaceVisible(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [lastInteraction, autoHideInterface]);

  // Update interaction timestamp
  const updateInteraction = useCallback(() => {
    setLastInteraction(Date.now());
    if (!interfaceVisible) {
      setInterfaceVisible(true);
    }
  }, [interfaceVisible]);

  // Selection change callback
  useEffect(() => {
    const affected = getAffectedFixtures(); // getAffectedFixtures will now use globalSelectedFixtures
    onSelectionChange?.(affected.length);
  }, [globalSelectedFixtures, selectedGroups, selectedCapabilities, selectionMode, onSelectionChange, fixtures]); // Added fixtures to deps for getAffectedFixtures

  const getDmxChannelForControl = useCallback((controlType: string): string => {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [TouchSuperControl.getDmxChannelForControl]`;

    const affectedFixtureObjects = getAffectedFixtures(); // Uses the component's getAffectedFixtures

    // console.log(`${logPrefix} Called for controlType: ${controlType}`);
    // console.log(`${logPrefix} Affected fixture objects count: ${affectedFixtureObjects.length}`, affectedFixtureObjects.map(f => ({ id: f.fixture.id, name: f.fixture.name })));

    if (affectedFixtureObjects.length === 0) {
      return 'No Sel';
    }

    const dmxChannelsFound: number[] = []; affectedFixtureObjects.forEach((fixtObj: any) => {
      const fixture = fixtObj.fixture; // This is the actual fixture object
      // const fixtureDmxChannelMap = fixtObj.channels; // This is the {type: dmxAddress} map from getAffectedFixtures
      // We need to use fixture.channels for find, and fixtureDmxChannelMap for the address if direct type exists.
      // However, SuperControl's getDmxChannelForControl iterates fixture.channels and finds dmxAddress there.
      // TouchSuperControl's getAffectedFixtures already pre-processes this into a map.
      // Let's adapt to use the pre-processed map fixtObj.channels for direct lookups,
      // and fall back to iterating fixture.channels if needed, or stick to SuperControl's logic.

      // Sticking to SuperControl's logic for consistency, which iterates actual fixture.channels
      let targetChannelAddress = -1;
      const controlTypeLower = controlType.toLowerCase();

      // console.log(`${logPrefix} Processing fixture - ID: ${fixture.id}, Name: ${fixture.name}`);
      // console.log(`${logPrefix} Fixture channels for ${fixture.name}:`, fixture.channels.map((ch: any) => ({ type: ch.type, dmxAddress: ch.dmxAddress })));

      // First try to find channel with the control type
      const foundChannel = fixture.channels.find((c: any) => {
        const typeLower = c.type.toLowerCase();
        switch (controlTypeLower) {
          case 'dimmer':
            return typeLower === 'dimmer';
          case 'pan':
            return typeLower === 'pan';
          case 'tilt':
            return typeLower === 'tilt';
          case 'finepan':
            return typeLower === 'finepan' || typeLower === 'fine_pan' || typeLower === 'pan_fine';
          case 'finetilt':
            return typeLower === 'finetilt' || typeLower === 'fine_tilt' || typeLower === 'tilt_fine';
          case 'red':
            return typeLower === 'red';
          case 'green':
            return typeLower === 'green';
          case 'blue':
            return typeLower === 'blue';
          case 'gobo':
            return typeLower === 'gobo';
          case 'shutter':
            return typeLower === 'shutter';
          case 'goborotation':
            return typeLower === 'goborotation' || typeLower === 'gobo_rotation';
          case 'colorwheel':
            return typeLower === 'colorwheel' || typeLower === 'color_wheel';
          case 'focus':
            return typeLower === 'focus';
          case 'zoom':
            return typeLower === 'zoom';
          case 'iris':
            return typeLower === 'iris';
          case 'prism':
            return typeLower === 'prism';
          case 'frost':
            return typeLower === 'frost';
          case 'macro':
            return typeLower === 'macro';
          case 'speed':
            return typeLower === 'speed';
          default:
            return typeLower === controlTypeLower;
        }
      });

      if (foundChannel) {
        // Calculate the DMX address: use dmxAddress if available, otherwise calculate from startAddress
        const channelIndex = fixture.channels.indexOf(foundChannel);
        targetChannelAddress = foundChannel.dmxAddress !== undefined
          ? foundChannel.dmxAddress
          : (fixture.startAddress + channelIndex - 1); // Convert 1-based to 0-based
      }

      if (targetChannelAddress !== -1 && targetChannelAddress !== undefined) {
        dmxChannelsFound.push(targetChannelAddress + 1); // Convert to 1-based for display
      }
    });

    if (dmxChannelsFound.length === 0) {
      return 'No Ch';
    }
    if (dmxChannelsFound.length === 1) {
      return `Ch ${dmxChannelsFound[0]}`;
    }

    const sortedDmxChannels = [...new Set(dmxChannelsFound)].sort((a, b) => a - b);
    if (sortedDmxChannels.length <= 3) {
      return `Ch ${sortedDmxChannels.join(', ')}`;
    } else {
      return `Ch ${sortedDmxChannels[0]}-${sortedDmxChannels[sortedDmxChannels.length - 1]} (${sortedDmxChannels.length})`;
    }  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [globalSelectedFixtures, selectedGroups, selectedCapabilities, selectionMode, onSelectionChange, fixtures]); // Removed getAffectedFixtures to deps since it's defined later

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
      fixtures: fixtureIds,
      count: fixtureIds.length
    })).filter(cap => cap.fixtures.length > 1).sort((a, b) => b.count - a.count);
  };

  // Get all affected fixtures based on selection mode
  const getAffectedFixtures = () => {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [TouchSuperControl.getAffectedFixtures]`;
    console.log(`${logPrefix} Called. selectionMode: ${selectionMode}`);

    let affectedFixtureObjects: Array<{ fixture: any; channels: { [key: string]: number } }> = [];

    switch (selectionMode) {
      case 'channels':
        console.log(`${logPrefix} Mode: channels. Selected channels:`, selectedChannels);
        if (selectedChannels.length === 0) return [];

        fixtures.forEach(fixture => {
          const fixtureChannels: { [key: string]: number } = {};
          let hasSelectedChannel = false; fixture.channels.forEach((channel, index) => {
            // Use dmxAddress if available, otherwise calculate from startAddress (convert 1-based to 0-based)
            const dmxAddress = channel.dmxAddress !== undefined ? channel.dmxAddress : (fixture.startAddress + index - 1);
            if (selectedChannels.includes(dmxAddress)) {
              hasSelectedChannel = true;
              fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
            }
          });
          if (hasSelectedChannel) {
            affectedFixtureObjects.push({ fixture, channels: fixtureChannels });
          }
        });
        break;

      case 'fixtures':
        console.log(`${logPrefix} Mode: fixtures. Global selected fixtures (store):`, globalSelectedFixtures); if (globalSelectedFixtures.length > 0) {
          affectedFixtureObjects = fixtures
            .filter(fixture => globalSelectedFixtures.includes(fixture.id))
            .map(fixture => {
              const fixtureChannels: { [key: string]: number } = {};
              fixture.channels.forEach((channel, index) => {
                // Use dmxAddress if available, otherwise calculate from startAddress (convert 1-based to 0-based)
                const dmxAddress = channel.dmxAddress !== undefined ? channel.dmxAddress : (fixture.startAddress + index - 1);
                fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
              });
              return { fixture, channels: fixtureChannels };
            });
        }
        break; case 'groups':
        console.log(`${logPrefix} Mode: groups. Selected groups (local):`, selectedGroups);
        if (selectedGroups.length > 0) {
          const targetFixtureIds = selectedGroups.flatMap(groupId => {
            const group = groups.find(g => g.id === groupId);
            return group ? group.fixtureIndices.map(idx => fixtures[idx]?.id).filter(Boolean) : [];
          });
          affectedFixtureObjects = fixtures
            .filter(fixture => targetFixtureIds.includes(fixture.id))
            .map(fixture => {
              const fixtureChannels: { [key: string]: number } = {};
              fixture.channels.forEach((channel, index) => {
                // Use dmxAddress if available, otherwise calculate from startAddress (convert 1-based to 0-based)
                const dmxAddress = channel.dmxAddress !== undefined ? channel.dmxAddress : (fixture.startAddress + index - 1);
                fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
              });
              return { fixture, channels: fixtureChannels };
            });
        }
        break; case 'capabilities':
        console.log(`${logPrefix} Mode: capabilities. Selected capabilities (local):`, selectedCapabilities);
        if (selectedCapabilities.length > 0) {
          const capabilitiesData = getFixtureCapabilities(); // This already returns { type, fixtures: string[] }
          const targetFixtureIds = selectedCapabilities.flatMap(capType => {
            const capability = capabilitiesData.find(c => c.type === capType);
            return capability ? capability.fixtures : []; // capability.fixtures are fixture IDs
          });
          affectedFixtureObjects = fixtures
            .filter(fixture => targetFixtureIds.includes(fixture.id))
            .map(fixture => {
              const fixtureChannels: { [key: string]: number } = {};
              fixture.channels.forEach((channel, index) => {
                // Use dmxAddress if available, otherwise calculate from startAddress (convert 1-based to 0-based)
                const dmxAddress = channel.dmxAddress !== undefined ? channel.dmxAddress : (fixture.startAddress + index - 1);
                fixtureChannels[channel.type.toLowerCase()] = dmxAddress;
              });
              return { fixture, channels: fixtureChannels };
            });
        }
        break;
    }
    console.log(`${logPrefix} Affected fixture objects count: ${affectedFixtureObjects.length}`, affectedFixtureObjects.map(fo => fo.fixture.id));
    return affectedFixtureObjects;
  };
  // Apply control value to DMX channels
  const applyControl = (controlType: string, value: number) => {
    console.log(`[TouchSuperControl] applyControl: Entered. controlType=${controlType}, value=${value}`);
    const affectedFixtures = getAffectedFixtures(); // This is Array<{ fixture: any, channels: { [key:string]: number } }>

    console.log(`[TouchSuperControl] applyControl: Affected fixtures:`, affectedFixtures.map(f => ({
      id: f.fixture.id,
      name: f.fixture.name,
      channels: f.channels
    })));

    if (affectedFixtures.length === 0) {
      console.log('[TouchSuperControl] applyControl: No affected fixtures. Will not call setDmxChannelValue.');
      // Optionally, add a warning or user feedback here if appropriate for a touch interface
      return;
    }

    console.log(`[TouchSuperControl] applyControl: Processing ${affectedFixtures.length} affected fixtures.`); affectedFixtures.forEach((fixtObj) => { // fixtObj is { fixture: any, channels: { [key:string]: number } }
      const fixtureChannelsMap = fixtObj.channels;
      const fixtureName = fixtObj.fixture.name || fixtObj.fixture.id;
      let targetChannel: number | undefined;

      switch (controlType) {
        case 'dimmer':
          targetChannel = fixtureChannelsMap['dimmer'] || fixtureChannelsMap['intensity'] || fixtureChannelsMap['master'];
          break;
        case 'pan':
          targetChannel = fixtureChannelsMap['pan'];
          break;
        case 'tilt':
          targetChannel = fixtureChannelsMap['tilt'];
          break;
        case 'red':
          targetChannel = fixtureChannelsMap['red'] || fixtureChannelsMap['r'];
          break;
        case 'green':
          targetChannel = fixtureChannelsMap['green'] || fixtureChannelsMap['g'];
          break;
        case 'blue':
          targetChannel = fixtureChannelsMap['blue'] || fixtureChannelsMap['b'];
          break;
        case 'gobo':
          targetChannel = fixtureChannelsMap['gobo'] || fixtureChannelsMap['gobowheel'] || fixtureChannelsMap['gobo_wheel'];
          break;
        case 'shutter':
          targetChannel = fixtureChannelsMap['shutter'];
          break;
        case 'strobe':
          targetChannel = fixtureChannelsMap['strobe'];
          break;
      }

      console.log(`[TouchSuperControl] applyControl: Fixture ${fixtureName}, looking for ${controlType}, found channel: ${targetChannel}`);
      console.log(`[TouchSuperControl] applyControl: Available channels in fixture:`, Object.keys(fixtureChannelsMap));

      if (targetChannel !== undefined) {
        console.log(`[TouchSuperControl] applyControl: Attempting to setDmxChannelValue for fixture ${fixtureName}, channel ${targetChannel}, value ${value}, type ${controlType}`);
        setDmxChannelValue(targetChannel, value);
      } else {
        console.log(`[TouchSuperControl] applyControl: No target channel found for ${controlType} in fixture ${fixtureName}`);
      }
    });
  };
  // Touch handlers for XY pad with enhanced feedback
  const handleXYTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    updateInteraction();
    setIsTouchingXY(true);
    hapticFeedback('light');
    updateXYFromTouch(e.touches[0]);
  };

  const handleXYTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    updateInteraction();
    if (isTouchingXY && e.touches.length > 0) {
      updateXYFromTouch(e.touches[0]);
    }
  };

  const handleXYTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsTouchingXY(false);
    hapticFeedback('medium');
  };

  const updateXYFromTouch = (touch: React.Touch) => {
    if (!xyPadRef.current) return;

    const rect = xyPadRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));

    setPanTiltXY({ x, y });

    const panVal = Math.round((x / 100) * 255);
    const tiltVal = Math.round(((100 - y) / 100) * 255);

    setPanValue(panVal);
    setTiltValue(tiltVal);
    applyControl('pan', panVal);
    applyControl('tilt', tiltVal);
  };

  // Touch handlers for color wheel with enhanced feedback
  const handleColorTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    updateInteraction();
    setIsTouchingColor(true);
    hapticFeedback('light');
    updateColorFromTouch(e.touches[0]);
  };

  const handleColorTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    updateInteraction();
    if (isTouchingColor && e.touches.length > 0) {
      updateColorFromTouch(e.touches[0]);
    }
  };

  const handleColorTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsTouchingColor(false);
    hapticFeedback('medium');
  };

  const updateColorFromTouch = (touch: React.Touch) => {
    if (!colorWheelRef.current) return;

    const rect = colorWheelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = touch.clientX - rect.left - centerX;
    const y = touch.clientY - rect.top - centerY;

    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const hue = (angle + 360) % 360;
    const distance = Math.min(Math.sqrt(x * x + y * y), centerX);
    const saturation = (distance / centerX) * 100;

    setColorHue(hue);
    setColorSaturation(saturation);

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
  // Enhanced quick actions with more features
  const quickActions: QuickAction[] = [
    {
      name: 'Blackout',
      action: () => {
        setDimmer(0);
        applyControl('dimmer', 0);
        hapticFeedback('heavy');
      },
      icon: 'Power',
      color: '#dc3545',
      description: 'Turn off all fixtures'
    },
    {
      name: 'Full On',
      action: () => {
        setDimmer(255);
        applyControl('dimmer', 255);
        hapticFeedback('medium');
      },
      icon: 'Sun',
      color: '#ffc107',
      description: 'Set fixtures to full intensity'
    },
    {
      name: 'Center P/T',
      action: () => {
        setPanValue(127);
        setTiltValue(127);
        setPanTiltXY({ x: 50, y: 50 });
        applyControl('pan', 127);
        applyControl('tilt', 127);
        hapticFeedback('medium');
      },
      icon: 'Target',
      color: '#17a2b8',
      description: 'Center pan and tilt'
    },
    {
      name: 'White',
      action: () => {
        setRed(255);
        setGreen(255);
        setBlue(255);
        applyControl('red', 255);
        applyControl('green', 255);
        applyControl('blue', 255);
        hapticFeedback('light');
      },
      icon: 'Circle',
      color: '#ffffff',
      description: 'Set color to white'
    },
    {
      name: 'Strobe Fast',
      action: () => {
        setStrobe(200);
        applyControl('strobe', 200);
        hapticFeedback('heavy');
      },
      icon: 'Zap',
      color: '#ff6b35',
      description: 'Start fast strobe'
    },
    {
      name: 'Stop Strobe',
      action: () => {
        setStrobe(0);
        applyControl('strobe', 0);
        hapticFeedback('light');
      },
      icon: 'ZapOff',
      color: '#6c757d',
      description: 'Stop strobing'
    },
    {
      name: 'Random Color',
      action: () => {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        setRed(r);
        setGreen(g);
        setBlue(b);
        applyControl('red', r);
        applyControl('green', g);
        applyControl('blue', b);
        hapticFeedback('medium');
      },
      icon: 'Palette',
      color: '#e91e63',
      description: 'Set random color'
    },
    {
      name: 'Home All',
      action: () => {
        setDimmer(255);
        setPanValue(127);
        setTiltValue(127);
        setPanTiltXY({ x: 50, y: 50 });
        setRed(255);
        setGreen(255);
        setBlue(255);
        setGobo(0);
        setShutter(255);
        setStrobe(0);
        applyControl('dimmer', 255);
        applyControl('pan', 127);
        applyControl('tilt', 127);
        applyControl('red', 255);
        applyControl('green', 255);
        applyControl('blue', 255);
        applyControl('gobo', 0);
        applyControl('shutter', 255);
        applyControl('strobe', 0);
        hapticFeedback('heavy');
      },
      icon: 'Home',
      color: '#28a745',
      description: 'Reset all values to home position'
    },
  ];

  const hasSelection = getAffectedFixtures().length > 0;
  const capabilities = getFixtureCapabilities();

  // Haptic feedback
  const triggerHapticFeedback = useCallback(() => {
    if (enableHapticFeedback && 'ontouchstart' in window) {
      navigator.vibrate ? navigator.vibrate(30) : null;
    }
  }, [enableHapticFeedback]);

  useEffect(() => {
    if (autoHideInterface) {
      // Auto-hide logic here
    }
  }, [activePanel, autoHideInterface]);

  // Auto-select the first fixture if none are selected when in fixtures mode
  useEffect(() => {
    if (selectionMode === 'fixtures' && globalSelectedFixtures.length === 0 && fixtures.length > 0) {
      console.log('[TouchSuperControl] Auto-selecting first fixture since none are selected');
      toggleFixtureSelection(fixtures[0].id);
    }
  }, [selectionMode, globalSelectedFixtures.length, fixtures.length, fixtures, toggleFixtureSelection]);

  // Debug effect to log component state when it changes
  useEffect(() => {
    console.log('[TouchSuperControl] Debug State Check:', {
      selectionMode,
      globalSelectedFixtures,
      selectedGroups,
      selectedCapabilities,
      fixturesCount: fixtures.length,
      groupsCount: groups.length,
      affectedFixturesCount: getAffectedFixtures().length
    });
  }, [selectionMode, globalSelectedFixtures, selectedGroups, selectedCapabilities, fixtures.length, groups.length]);

  return (
    <div
      className={`${styles.touchSuperControl} ${isFullscreen ? styles.fullscreen : ''} ${!interfaceVisible ? styles.interfaceHidden : ''}`}
      onTouchStart={updateInteraction}
      onTouchMove={updateInteraction}
      onClick={updateInteraction}
    >
      {/* Interface visibility toggle */}
      {autoHideInterface && !interfaceVisible && (
        <div className={styles.showInterfaceHint}>
          <LucideIcon name="Eye" />
          <span>Touch anywhere to show interface</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className={`${styles.topNav} ${!interfaceVisible ? styles.hidden : ''}`}>
        <div className={styles.navTabs}>
          <button
            className={activePanel === 'selection' ? styles.active : ''}
            onClick={() => {
              setActivePanel('selection');
              hapticFeedback('light');
            }}
          >
            <LucideIcon name="Target" />
            Selection
          </button>
          <button
            className={activePanel === 'control' ? styles.active : ''}
            onClick={() => {
              setActivePanel('control');
              hapticFeedback('light');
            }}
          >
            <LucideIcon name="Settings" />
            Controls
          </button>
          <button
            className={activePanel === 'quick' ? styles.active : ''}
            onClick={() => {
              setActivePanel('quick');
              hapticFeedback('light');
            }}
          >
            <LucideIcon name="Zap" />
            Quick Actions
          </button>
        </div>
        <div className={styles.statusInfo}>
          <div className={styles.statusDetails}>
            <span className={styles.selectionCount}>
              {hasSelection ? `${getAffectedFixtures().length} fixtures selected` : 'No selection'}
            </span>
            {hasSelection && (
              <div className={styles.activeChannelsSummary}>
                <span className={styles.channelCount}>
                  <LucideIcon name="Radio" size={14} />
                  {getAffectedFixtures().reduce((total, { channels }) => total + Object.keys(channels).length, 0)} channels
                </span>
                <span className={styles.controlMode}>
                  <LucideIcon name={
                    selectionMode === 'fixtures' ? "Lightbulb" :
                      selectionMode === 'groups' ? "Users" :
                        selectionMode === 'capabilities' ? "Zap" : "Radio"
                  } size={14} />
                  {selectionMode}
                </span>
              </div>
            )}
          </div>
          <button
            className={`${styles.expandToggle} ${showAllControls ? styles.expanded : ''}`}
            onClick={() => setShowAllControls(!showAllControls)}
          >
            <LucideIcon name={showAllControls ? "ChevronUp" : "ChevronDown"} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Selection Panel */}
        {activePanel === 'selection' && (
          <div className={styles.selectionPanel}>
            <div className={styles.selectionModes}>
              <button
                className={selectionMode === 'channels' ? styles.active : ''}
                onClick={() => setSelectionMode('channels')}
                disabled
              >
                <LucideIcon name="Radio" />
                <span>Channels</span>
                <small>Use DMX page</small>
              </button>
              <button
                className={selectionMode === 'fixtures' ? styles.active : ''}
                onClick={() => setSelectionMode('fixtures')}
              >
                <LucideIcon name="Lightbulb" />
                <span>Fixtures</span>
                <small>{fixtures.length} available</small>
              </button>
              <button
                className={selectionMode === 'groups' ? styles.active : ''}
                onClick={() => setSelectionMode('groups')}
              >
                <LucideIcon name="Users" />
                <span>Groups</span>
                <small>{groups.length} available</small>
              </button>
              <button
                className={selectionMode === 'capabilities' ? styles.active : ''}
                onClick={() => setSelectionMode('capabilities')}
              >
                <LucideIcon name="Zap" />
                <span>Capabilities</span>
                <small>{capabilities.length} types</small>
              </button>
            </div>

            <div className={styles.selectionList}>
              {selectionMode === 'fixtures' && fixtures.map(fixture => (
                <div
                  key={fixture.id}
                  className={`${styles.selectionItem} ${globalSelectedFixtures.includes(fixture.id) ? styles.selected : ''}`}
                  onClick={() => {
                    toggleFixtureSelection(fixture.id); // Use global store action
                    triggerHapticFeedback();
                  }}
                >
                  <div className={styles.itemIcon}>
                    <LucideIcon name="Lightbulb" />
                  </div>
                  <div className={styles.itemContent}>
                    <span className={styles.itemName}>{fixture.name}</span>
                    <span className={styles.itemDetails}>
                      CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                    </span>
                  </div>
                  {globalSelectedFixtures.includes(fixture.id) && (
                    <div className={styles.selectedIndicator}>
                      <LucideIcon name="Check" />
                    </div>
                  )}
                </div>
              ))}

              {selectionMode === 'groups' && groups.map(group => (
                <div
                  key={group.id}
                  className={`${styles.selectionItem} ${selectedGroups.includes(group.id) ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedGroups(prev =>
                      prev.includes(group.id)
                        ? prev.filter(id => id !== group.id)
                        : [...prev, group.id]
                    );
                    triggerHapticFeedback();
                  }}
                >
                  <div className={styles.itemIcon}>
                    <LucideIcon name="Users" />
                  </div>
                  <div className={styles.itemContent}>
                    <span className={styles.itemName}>{group.name}</span>
                    <span className={styles.itemDetails}>
                      {group.fixtureIndices.length} fixtures
                    </span>
                  </div>
                  {selectedGroups.includes(group.id) && (
                    <div className={styles.selectedIndicator}>
                      <LucideIcon name="Check" />
                    </div>
                  )}
                </div>
              ))}

              {selectionMode === 'capabilities' && capabilities.map(capability => (
                <div
                  key={capability.type}
                  className={`${styles.selectionItem} ${selectedCapabilities.includes(capability.type) ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedCapabilities(prev =>
                      prev.includes(capability.type)
                        ? prev.filter(type => type !== capability.type)
                        : [...prev, capability.type]
                    );
                    triggerHapticFeedback();
                  }}
                >
                  <div className={styles.itemIcon}>
                    <LucideIcon name="Zap" />
                  </div>
                  <div className={styles.itemContent}>
                    <span className={styles.itemName}>{capability.type.toUpperCase()}</span>
                    <span className={styles.itemDetails}>
                      {capability.count} fixtures
                    </span>
                  </div>
                  {selectedCapabilities.includes(capability.type) && (
                    <div className={styles.selectedIndicator}>
                      <LucideIcon name="Check" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls Panel */}
        {activePanel === 'control' && (
          <div className={styles.controlsPanel}>
            <div className={styles.primaryControls}>
              {/* Large Dimmer Slider */}
              <div className={styles.mainDimmer}>
                <label>Master Dimmer <small>({getDmxChannelForControl('dimmer')})</small></label>
                <div className={styles.touchSlider}>
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
                    className={styles.mainSlider}
                  />
                  <span className={styles.sliderValue}>{dimmer}</span>
                </div>
              </div>

              {/* XY Pan/Tilt Control */}
              <div className={styles.xyPadContainer}>
                <label>Pan/Tilt Control</label>
                <div
                  className={`${styles.touchXYPad} ${isTouchingXY ? styles.touching : ''}`}
                  ref={xyPadRef}
                  onTouchStart={handleXYTouchStart}
                  onTouchMove={handleXYTouchMove}
                  onTouchEnd={handleXYTouchEnd}
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
                <div className={styles.xyValues}>
                  <span>Pan: {panValue} <small>({getDmxChannelForControl('pan')})</small></span>
                  <span>Tilt: {tiltValue} <small>({getDmxChannelForControl('tilt')})</small></span>
                </div>
              </div>

              {/* Color Wheel */}
              <div className={styles.colorWheelContainer}>
                <label>Color Control</label>
                <div
                  className={`${styles.touchColorWheel} ${isTouchingColor ? styles.touching : ''}`}
                  ref={colorWheelRef}
                  onTouchStart={handleColorTouchStart}
                  onTouchMove={handleColorTouchMove}
                  onTouchEnd={handleColorTouchEnd}
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
                <div className={styles.colorValues}>
                  <span style={{ color: '#ff0000' }}>R: {red} <small>({getDmxChannelForControl('red')})</small></span>
                  <span style={{ color: '#00ff00' }}>G: {green} <small>({getDmxChannelForControl('green')})</small></span>
                  <span style={{ color: '#0000ff' }}>B: {blue} <small>({getDmxChannelForControl('blue')})</small></span>
                </div>
              </div>
            </div>

            {/* Additional Controls */}
            {(showAllControls || !isFullscreen) && (
              <div className={styles.secondaryControls}>
                <div className={styles.touchSliderGroup}>
                  <div className={styles.touchSlider}>
                    <label>GOBO <small>({getDmxChannelForControl('gobo')})</small></label>
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
                    <span className={styles.sliderValue}>{gobo}</span>
                  </div>

                  <div className={styles.touchSlider}>
                    <label>Shutter <small>({getDmxChannelForControl('shutter')})</small></label>
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
                    <span className={styles.sliderValue}>{shutter}</span>
                  </div>

                  <div className={styles.touchSlider}>
                    <label>Strobe <small>({getDmxChannelForControl('strobe')})</small></label>
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
                    <span className={styles.sliderValue}>{strobe}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions Panel */}
        {activePanel === 'quick' && (
          <div className={styles.quickActionsPanel}>
            <div className={styles.quickGrid}>              {quickActions.map((action, index) => (
              <button
                key={index}
                className={styles.quickButton}
                onClick={() => {
                  action.action();
                  hapticFeedback('medium');
                }}
                disabled={!hasSelection}
                style={{ backgroundColor: action.color }}
                title={action.description}
              >
                <LucideIcon name={action.icon as any} />
                <span>{action.name}</span>
              </button>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Removed the placeholder getDmxChannelForControl from here

export default TouchSuperControl;
