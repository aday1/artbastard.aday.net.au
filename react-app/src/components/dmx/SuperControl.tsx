import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import CustomPathEditor from '../automation/CustomPathEditor';
import { EnvelopeChannelPanel } from '../automation/EnvelopeChannelPanel';
import { EnvelopePlaybackControls } from '../automation/EnvelopePlaybackControls';
import { useSuperControlMidiLearn } from '../../hooks/useSuperControlMidiLearn';
import { useMobile } from '../../hooks/useMobile';
import { useSceneCapture } from '../../hooks/useSceneCapture';
import { useSuperControlPreferences } from '../../context/SuperControlPreferencesContext';
import {
  ArtbastardXYPad,
  DmxFaderRow,
  HorizontalFader,
  RangeWindowControl,
  SteppedGoboSlider,
  DmxLedChannelMeter,
  SkeuoKnobSlider,
} from '../ui/controls';
import { SkeuoButton } from '../ui/SkeuoButton';
import { ChannelMonitorDock } from '../ui/ChannelMonitorDock';
import { SelectedChannelsFaderStrip } from './SelectedChannelsFaderStrip';
import { debugLog } from '../../utils/debugLog';
import { rangesToTickSteps } from '../../utils/fixtureChannelTicks';
import type { FixtureChannelRange } from '../../store/types';
import styles from './SuperControl.module.scss';
// Removed react-grid-layout - using CSS auto-layout instead

interface SuperControlProps {
  isDockable?: boolean;
  /** Force touch-oriented spacing when embedded in the touch panel type. */
  preferTouchLayout?: boolean;
}

type SelectionMode = 'channels' | 'fixtures' | 'groups' | 'capabilities';

interface FixtureCapability {
  type: string;
  fixtures: string[];
}

function hsvToRgb(h: number, s: number, v: number) {
  const hn = h / 360;
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn * 6) % 2) - 1));
  const m = vn - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 1 / 6) {
    r = c;
    g = x;
  } else if (hn < 2 / 6) {
    r = x;
    g = c;
  } else if (hn < 3 / 6) {
    g = c;
    b = x;
  } else if (hn < 4 / 6) {
    g = x;
    b = c;
  } else if (hn < 5 / 6) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (delta / max) * 100;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s };
}

const SuperControl: React.FC<SuperControlProps> = ({ isDockable = false, preferTouchLayout = false }) => {
  const { isMobile, isTablet, isTouch } = useMobile();
  const { settings: superControlPrefs } = useSuperControlPreferences();
  const touchLayout =
    preferTouchLayout || isMobile || isTablet || isTouch || superControlPrefs.compactMode;
  const {
    fixtures,
    groups,
    selectedChannels,
    selectedFixtures,
    setSelectedFixtures,
    selectAllFixtures,
    deselectAllFixtures,
    getDmxChannelValue,
    setDmxChannelValue,
    getChannelInfo,
    getFixtureColor,
    isChannelAssigned,
    midiMessages,
    // BPM for autopilot timing
    bpm,
    // Color Autopilot functions
    colorSliderAutopilot,
    setColorSliderAutopilot,
    toggleColorSliderAutopilot,
    // Pan/Tilt Autopilot functions
    panTiltAutopilot,
    setPanTiltAutopilot,
    togglePanTiltAutopilot,
    // Scene functions from global store
    scenes,
    deleteScene,
    loadScene: storeLoadScene,
  } = useStore();

  const { captureScene } = useSceneCapture();

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

  const defaultGoboSteps = useMemo(
    () => [
      { value: 0, min: 0, max: 15, label: 'Open', image: '/gobos/open.svg' },
      { value: 32, min: 16, max: 47, label: 'Gobo 1', image: '/gobos/gobo1.svg' },
      { value: 64, min: 48, max: 79, label: 'Gobo 2', image: '/gobos/gobo2.svg' },
      { value: 96, min: 80, max: 111, label: 'Gobo 3', image: '/gobos/gobo3.svg' },
      { value: 128, min: 112, max: 143, label: 'Gobo 4', image: '/gobos/gobo4.svg' },
      { value: 160, min: 144, max: 175, label: 'Gobo 5', image: '/gobos/gobo5.svg' },
      { value: 192, min: 176, max: 207, label: 'Gobo 6', image: '/gobos/gobo6.svg' },
      { value: 224, min: 208, max: 255, label: 'Gobo 7', image: '/gobos/gobo7.svg' },
    ],
    []
  );

  const goboSteps = useMemo(() => {
    let bestRanges: FixtureChannelRange[] | null = null;
    for (const fixId of selectedFixtures) {
      const fix = fixtures.find((f) => f.id === fixId);
      if (!fix) continue;
      for (const ch of fix.channels) {
        if (ch.type === 'gobo_wheel' && ch.ranges && ch.ranges.length > 0) {
          if (!bestRanges || ch.ranges.length > bestRanges.length) {
            bestRanges = ch.ranges;
          }
        }
      }
    }
    if (bestRanges) {
      return rangesToTickSteps(bestRanges).map((s) => ({
        value: s.value,
        min: s.min,
        max: s.max,
        label: s.label,
      }));
    }
    return defaultGoboSteps;
  }, [selectedFixtures, fixtures, defaultGoboSteps]);
  const [shutter, setShutter] = useState(255);
  const [strobe, setStrobe] = useState(0);
  const [lamp, setLamp] = useState(255);
  const [reset, setReset] = useState(0);

  // XY Pad state
  const [panTiltXY, setPanTiltXY] = useState({ x: 50, y: 50 });
  const xyPadRef = useRef<HTMLDivElement>(null);
  const [isDraggingXY, setIsDraggingXY] = useState(false);

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

  const midiPropsFor = (controlName: string) => {
    const mapping = superControlMappings[controlName];
    const isCurrentlyLearning = isLearning && currentLearningControlName === controlName;
    let midiMappingLabel: string | undefined;
    if (mapping?.controller !== undefined) {
      midiMappingLabel = `CH${mapping.channel} CC${mapping.controller}`;
    } else if (mapping?.note !== undefined) {
      midiMappingLabel = `CH${mapping.channel} Note ${mapping.note}`;
    }
    return {
      controlName,
      isMidiLearning: isCurrentlyLearning,
      isMidiMapped: !!mapping,
      midiMappingLabel,
      onMidiLearn: () => (isCurrentlyLearning ? cancelLearn() : startLearn(controlName)),
      onMidiForget: mapping ? () => forgetMapping(controlName) : undefined,
    };
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
  const [showPanTiltPathEditor, setShowPanTiltPathEditor] = useState(false);

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
        setDmxChannelValue(targetChannel, value);
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
      debugLog.log('Manual Pan/Tilt control detected - disabling autopilot');
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
      debugLog.log('Manual Pan/Tilt reset detected - disabling autopilot');
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

  const updateColorPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!colorWheelRef.current) return;

      const rect = colorWheelRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const x = clientX - rect.left - centerX;
      const y = clientY - rect.top - centerY;

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
    },
    [applyControl]
  );

  const handleColorWheelPointerDown = (e: React.PointerEvent) => {
    if (!hasSelection) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingColor(true);
    updateColorPosition(e.clientX, e.clientY);
  };

  const handleColorWheelPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingColor) return;
    updateColorPosition(e.clientX, e.clientY);
  };

  const endColorWheelDrag = (e: React.PointerEvent) => {
    if (!isDraggingColor) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setIsDraggingColor(false);
  };

  useEffect(() => {
    if (isDraggingColor) return;
    const { h, s } = rgbToHsv(red, green, blue);
    setColorHue(h);
    setColorSaturation(s);
  }, [red, green, blue, isDraggingColor]);

  // Enhanced MIDI Learn with range support
  const startMidiLearn = (controlType: string, minValue: number = 0, maxValue: number = 255) => {
    setMidiLearnTarget(controlType);
    debugLog.log(`Starting MIDI learn for ${controlType} (range: ${minValue}-${maxValue})`);

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
      debugLog.log(`MIDI learned for ${controlType}:`, mapping);
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

          debugLog.log(`MIDI triggered for ${action}: value=${midiValue}, scaled=${scaledValue}`);

          // Check affected fixtures before applying control
          const affectedFixtures = getAffectedFixtures();
          debugLog.log(`Affected fixtures for ${action}:`, affectedFixtures.length, affectedFixtures);

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
    const result = captureScene({
      name: name || `Scene ${scenes.length + 1}`,
      allowOverwrite: true,
      notify: true,
    });
    if (result) {
      setCurrentSceneIndex(scenes.length);
    }
    return result;
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
          debugLog.log('Default configuration loaded successfully');
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

  const handleSelectAllFixtures = () => {
    selectAllFixtures();
    setSelectionMode('fixtures');
    setSelectedGroups([]);
    setSelectedCapabilities([]);
  };

  const handleDeselectAllFixtures = () => {
    deselectAllFixtures();
    setSelectedGroups([]);
    setSelectedCapabilities([]);
  };

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
        updateColorPosition(e.clientX, e.clientY);
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

  const getQuickTip = () => {
    if (fixtures.length === 0) {
      return 'Add fixtures in Fixture Setup tab to get started';
    }
    if (!hasSelection) {
      if (selectionMode === 'fixtures') return 'Click fixtures below or use Select All';
      if (selectionMode === 'groups' && groups.length > 0) return 'Click a group to select it';
      if (selectionMode === 'channels') {
        return touchLayout
          ? 'Pin channels on DMX Control (pin icon), or use the faders below once pinned'
          : 'Select DMX channels from the DMX Control page';
      }
      return 'Select fixtures, groups, or channels to control';
    }
    return null;
  };

  return (
    <div
      className={[styles.superControl, touchLayout ? styles.touchLayout : ''].filter(Boolean).join(' ')}
    >
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LucideIcon name="Settings" />
              Super Control
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{getSelectionInfo()}</p>
            {getQuickTip() && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', opacity: 0.85, color: 'var(--color-interactive)' }}>
                {getQuickTip()}
              </p>
            )}
          </div>
        </div>
      </div>

      {touchLayout && selectionMode === 'channels' && (
        <SelectedChannelsFaderStrip maxVisible={10} />
      )}

      <div className={styles.autoLayoutContainer}>
        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="ListChecks" /> Selection
          </div>
          <div className={styles.gridItemContent}>
            {/* Selection Mode */}
            <div className={styles.fixtureSelection}>
              <div className={`${styles.selectionTabs} ab-view-tabs`}>
                <SkeuoButton
                  compact
                  active={selectionMode === 'channels'}
                  onClick={() => setSelectionMode('channels')}
                >
                  <LucideIcon name="Radio" />
                  Channels
                </SkeuoButton>
                <SkeuoButton
                  compact
                  active={selectionMode === 'fixtures'}
                  onClick={() => setSelectionMode('fixtures')}
                >
                  <LucideIcon name="Lightbulb" />
                  Fixtures
                </SkeuoButton>
                <SkeuoButton
                  compact
                  active={selectionMode === 'groups'}
                  onClick={() => setSelectionMode('groups')}
                >
                  <LucideIcon name="Users" />
                  Groups
                </SkeuoButton>
                <SkeuoButton
                  compact
                  active={selectionMode === 'capabilities'}
                  onClick={() => setSelectionMode('capabilities')}
                >
                  <LucideIcon name="Zap" />
                  Capabilities
                </SkeuoButton>
              </div>

              {selectionMode === 'fixtures' && fixtures.length > 0 && (
                <div className={styles.quickActions}>
                  <button
                    type="button"
                    onClick={handleSelectAllFixtures}
                    title="Select all fixtures"
                  >
                    <LucideIcon name="CheckSquare" size={14} />
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllFixtures}
                    title="Deselect all fixtures"
                  >
                    <LucideIcon name="Square" size={14} />
                    Deselect All
                  </button>
                </div>
              )}
              {selectionMode === 'fixtures' && fixtures.length === 0 && (
                <div className={styles.emptyState}>
                  <LucideIcon name="Lightbulb" size={32} style={{ opacity: 0.5 }} />
                  <p>No fixtures defined yet.</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>Go to the Fixture Setup tab to add fixtures.</p>
                </div>
              )}
              {selectionMode === 'fixtures' && fixtures.length > 0 && (
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

              {selectionMode === 'groups' && groups.length === 0 && (
                <div className={styles.emptyState}>
                  <LucideIcon name="Users" size={32} style={{ opacity: 0.5 }} />
                  <p>No groups defined.</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>Create groups in Fixture Setup.</p>
                </div>
              )}
              {selectionMode === 'groups' && groups.length > 0 && (
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

              {selectionMode === 'capabilities' && capabilities.length === 0 && (
                <div className={styles.emptyState}>
                  <LucideIcon name="Zap" size={32} style={{ opacity: 0.5 }} />
                  <p>No shared capabilities.</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>Add fixtures with matching channel types.</p>
                </div>
              )}
              {selectionMode === 'capabilities' && capabilities.length > 0 && (
                <div className={styles.fixtureList}>
                  {capabilities.map(capability => (
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

                <ChannelMonitorDock className={styles.channelMonitorDock}>
                  {getAffectedFixtures().map(({ fixture, channels }, index) => (
                    <div key={`${fixture.id}-${index}`} className={styles.fixtureMonitor}>
                      <div className={styles.fixtureHeader}>
                        <LucideIcon name="Lightbulb" />
                        <span className={styles.fixtureName}>{fixture.name}</span>
                        <span className={styles.fixtureRange}>
                          CH {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                        </span>
                      </div>

                      <div className={styles.channelStripRow}>
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
                                return currentValue === shutter;
                              case 'strobe':
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
                            <DmxLedChannelMeter
                              key={`${dmxAddress}-${channelType}`}
                              value={currentValue}
                              label={channelType}
                              sublabel={`CH ${dmxAddress}`}
                              active={isControlled}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </ChannelMonitorDock>

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
                    <SkeuoButton
                      compact
                      className={styles.navBtn}
                      onClick={selectPreviousFixture}
                      disabled={fixtures.length === 0}
                    >
                      <LucideIcon name="ChevronLeft" />
                      Prev
                    </SkeuoButton>
                    <div className={styles.currentSelection}>
                      {fixtures.length > 0 ? fixtures[currentFixtureIndex]?.name || 'Unknown' : 'No fixtures'}
                      <span className={styles.indexInfo}>({currentFixtureIndex + 1}/{fixtures.length})</span>
                    </div>
                    <SkeuoButton
                      compact
                      className={styles.navBtn}
                      onClick={selectNextFixture}
                      disabled={fixtures.length === 0}
                    >
                      Next
                      <LucideIcon name="ChevronRight" />
                    </SkeuoButton>
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
                    <SkeuoButton
                      compact
                      className={styles.navBtn}
                      onClick={selectPreviousGroup}
                      disabled={groups.length === 0}
                    >
                      <LucideIcon name="ChevronLeft" />
                      Prev
                    </SkeuoButton>
                    <div className={styles.currentSelection}>
                      {groups.length > 0 ? groups[currentGroupIndex]?.name || 'Unknown' : 'No groups'}
                      <span className={styles.indexInfo}>({currentGroupIndex + 1}/{groups.length})</span>
                    </div>
                    <SkeuoButton
                      compact
                      className={styles.navBtn}
                      onClick={selectNextGroup}
                      disabled={groups.length === 0}
                    >
                      Next
                      <LucideIcon name="ChevronRight" />
                    </SkeuoButton>
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
                  <SkeuoButton
                    compact
                    accent="purple"
                    className={styles.sceneBtn}
                    onClick={() => captureCurrentScene()}
                  >
                    <LucideIcon name="Camera" />
                    Save Scene
                  </SkeuoButton>
                  <SkeuoButton
                    compact
                    accent="purple"
                    className={styles.sceneBtn}
                    onClick={selectPreviousScene}
                    disabled={scenes.length === 0}
                  >
                    <LucideIcon name="ChevronLeft" />
                    Previous
                  </SkeuoButton>
                  <SkeuoButton
                    compact
                    accent="purple"
                    className={styles.sceneBtn}
                    onClick={selectNextScene}
                    disabled={scenes.length === 0}
                  >
                    Next
                    <LucideIcon name="ChevronRight" />
                  </SkeuoButton>
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

                      <SkeuoButton
                        variant="wide"
                        accent="green"
                        compact
                        className={styles.loadSceneBtn}
                        onClick={() => storeLoadScene(scene.name)}
                      >
                        <LucideIcon name="Play" />
                        Load Scene
                      </SkeuoButton>
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
              <div className={styles.faderStack}>
                <DmxFaderRow
                label="Dimmer"
                value={dimmer}
                disabled={!hasSelection}
                oscAddress="/dimmer"
                onChange={(val) => {
                  setDimmer(val);
                  applyControl('dimmer', val);
                }}
                {...midiPropsFor('dimmer')}
              />
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
                <DmxFaderRow
                  label="Pan"
                  fullWidth
                  value={panValue}
                  disabled={!hasSelection}
                  oscAddress="/pan"
                  onChange={(val) => {
                    if (panTiltAutopilot.enabled) togglePanTiltAutopilot();
                    setPanValue(val);
                    applyControl('pan', val);
                    setPanTiltXY(prev => ({ ...prev, x: (val / 255) * 100 }));
                  }}
                  {...midiPropsFor('pan')}
                />
                <DmxFaderRow
                  label="Tilt"
                  fullWidth
                  value={tiltValue}
                  disabled={!hasSelection}
                  oscAddress="/tilt"
                  onChange={(val) => {
                    if (panTiltAutopilot.enabled) togglePanTiltAutopilot();
                    setTiltValue(val);
                    applyControl('tilt', val);
                    setPanTiltXY(prev => ({ ...prev, y: (val / 255) * 100 }));
                  }}
                  {...midiPropsFor('tilt')}
                />
              </div>

              <h5 className={styles.xyPadHeading}>XY Pad</h5>
              <ArtbastardXYPad
                className={styles.panTiltPad}
                pan={panValue}
                tilt={tiltValue}
                disabled={!hasSelection}
                onPanTiltChange={(p, t) => {
                  if (panTiltAutopilot.enabled) {
                    togglePanTiltAutopilot();
                  }
                  setPanValue(p);
                  setTiltValue(t);
                  setPanTiltXY({ x: (p / 255) * 100, y: (1 - t / 255) * 100 });
                  applyControl('pan', p);
                  applyControl('tilt', t);
                }}
                onPathSaved={(points) => {
                  setPanTiltAutopilot({ customPath: points, pathType: 'custom' });
                }}
                onOpenPathEditor={() => setShowPanTiltPathEditor(true)}
              />
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
              <EnvelopePlaybackControls
                repeatMode={panTiltAutopilot.repeatMode ?? 'loop'}
                loopDirection={panTiltAutopilot.loopDirection ?? 'forward'}
                onRepeatModeChange={(repeatMode) => setPanTiltAutopilot({ repeatMode })}
                onLoopDirectionChange={(loopDirection) => setPanTiltAutopilot({ loopDirection })}
              />
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
            <div className={styles.colorSection}>
              <div className={styles.colorWheelWrap}>
              <div
                className={`${styles.colorWheelHousing} ${!hasSelection ? styles.colorWheelDisabled : ''}`}
                ref={colorWheelRef}
                onPointerDown={handleColorWheelPointerDown}
                onPointerMove={handleColorWheelPointerMove}
                onPointerUp={endColorWheelDrag}
                onPointerCancel={endColorWheelDrag}
              >
                <div className={styles.colorWheel}>
                <div className={styles.colorSaturation}>
                  <div
                    className={styles.colorHandle}
                    style={{
                      left: `${50 + (colorSaturation / 100) * Math.cos((colorHue * Math.PI) / 180) * 50}%`,
                      top: `${50 + (colorSaturation / 100) * Math.sin((colorHue * Math.PI) / 180) * 50}%`
                    }}
                  />
                </div>
              </div>
              </div>
              </div>
              <div className={styles.colorReadout}>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: `rgb(${red}, ${green}, ${blue})` }}
                  title="Current color"
                />
                <span className={styles.colorChannel}>
                  <span className={styles.colorChannelLabel} style={{ color: '#f87171' }}>R</span> {red}
                </span>
                <span className={styles.colorChannel}>
                  <span className={styles.colorChannelLabel} style={{ color: '#4ade80' }}>G</span> {green}
                </span>
                <span className={styles.colorChannel}>
                  <span className={styles.colorChannelLabel} style={{ color: '#60a5fa' }}>B</span> {blue}
                </span>
              </div>
              <div className={styles.rgbSliders}>
                <div className={styles.faderStack}>
                <DmxFaderRow
                  label="Red"
                  fullWidth
                  colorChannel="red"
                  value={red}
                  disabled={!hasSelection}
                  oscAddress="/red"
                  labelColor="#ff4444"
                  accentColor="#ff4444"
                  onChange={(val) => {
                    setRed(val);
                    applyControl('red', val);
                  }}
                  {...midiPropsFor('red')}
                />
                <DmxFaderRow
                  label="Green"
                  fullWidth
                  colorChannel="green"
                  value={green}
                  disabled={!hasSelection}
                  oscAddress="/green"
                  labelColor="#44ff44"
                  accentColor="#44ff44"
                  onChange={(val) => {
                    setGreen(val);
                    applyControl('green', val);
                  }}
                  {...midiPropsFor('green')}
                />
                <DmxFaderRow
                  label="Blue"
                  fullWidth
                  colorChannel="blue"
                  value={blue}
                  disabled={!hasSelection}
                  oscAddress="/blue"
                  labelColor="#4488ff"
                  accentColor="#4488ff"
                  onChange={(val) => {
                    setBlue(val);
                    applyControl('blue', val);
                  }}
                  {...midiPropsFor('blue')}
                />
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
                    <label className={styles.goboSectionLabel}>GOBO Wheel</label>
              <SteppedGoboSlider
                value={gobo}
                disabled={!hasSelection}
                steps={goboSteps}
                onChange={(val) => {
                  setGobo(val);
                  applyControl('gobo', val);
                }}
              />
              <div className={styles.goboVisualSection}>
                <label>GOBO quick pick</label>
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
                <div className={styles.faderStack}>
                {hasControlType('shutter') && (
                  <DmxFaderRow
                    label="Shutter"
                    value={shutter}
                    disabled={!hasSelection}
                    oscAddress="/shutter"
                    onChange={(val) => {
                      setShutter(val);
                      applyControl('shutter', val);
                    }}
                    {...midiPropsFor('shutter')}
                  />
                )}
                {hasControlType('strobe') && (
                  <SkeuoKnobSlider
                    label="Strobe Speed"
                    value={strobe}
                    min={0}
                    max={255}
                    step={1}
                    disabled={!hasSelection}
                    onChange={(val) => {
                      setStrobe(val);
                      applyControl('strobe', val);
                    }}
                  />
                )}
                {hasControlType('lamp') && (
                  <DmxFaderRow
                    label="Lamp Control"
                    value={lamp}
                    disabled={!hasSelection}
                    oscAddress="/lamp"
                    onChange={(val) => {
                      setLamp(val);
                      applyControl('lamp', val);
                    }}
                    {...midiPropsFor('lamp')}
                  />
                )}
                </div>
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
              <LucideIcon name="Activity" /> Channel envelopes
            </div>
            <div className={styles.gridItemContent}>
              <div className={styles.envelopePanelStack}>
                {selectedChannels.slice(0, touchLayout ? 2 : 4).map((ch) => (
                  <EnvelopeChannelPanel key={ch} channel={ch} compact={touchLayout} />
                ))}
                {selectedChannels.length > (touchLayout ? 2 : 4) && (
                  <p className={styles.envelopeMoreHint}>
                    {selectedChannels.length - (touchLayout ? 2 : 4)} more selected — use DMX page for all envelopes.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectionMode === 'channels' && selectedChannels.length > 0 && !touchLayout && (
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

                    const channelLabel = channelInfo
                      ? `${channelInfo.name || channelInfo.type}`
                      : `Channel ${channelAddress}`;
                    const channelSubtitle = channelInfo
                      ? `${channelInfo.fixture} · ${channelInfo.type}`
                      : undefined;

                    return (
                      <div key={channelAddress} className={styles.dmxChannelControl}>
                        <DmxFaderRow
                          compact
                          label={`CH ${channelAddress}`}
                          subtitle={channelSubtitle}
                          meta={channelLabel}
                          controlName={`dmx-ch-${channelAddress}`}
                          value={currentValue}
                          showOsc={false}
                          showMidi={false}
                          onChange={(val) => setDmxChannelValue(channelAddress, val)}
                        />
                      </div>
                    );

                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color Autopilot Panel */}
        <div className={styles.gridItem}>
          <div className={styles.gridItemHeader}>
            <LucideIcon name="Palette" /> Color Autopilot
          </div>
          <div className={styles.gridItemContent}>
            <div style={{ marginBottom: '12px' }}>
              <SkeuoButton
                variant="wide"
                active={colorSliderAutopilot.enabled}
                accent="green"
                onClick={toggleColorSliderAutopilot}
              >
                <LucideIcon name={colorSliderAutopilot.enabled ? 'Palette' : 'PaintBucket'} />
                {colorSliderAutopilot.enabled ? 'Disable Color Auto' : 'Enable Color Auto'}
              </SkeuoButton>
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
              <SkeuoKnobSlider
                label="Color autopilot speed"
                min={0.1}
                max={1}
                step={0.1}
                value={colorSliderAutopilot.speed}
                disabled={!colorSliderAutopilot.enabled}
                onChange={(v) => setColorSliderAutopilot({ speed: v })}
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
              <RangeWindowControl
                min={0}
                max={360}
                minValue={colorSliderAutopilot.range.min}
                maxValue={colorSliderAutopilot.range.max}
                disabled={!colorSliderAutopilot.enabled}
                onChange={(minV, maxV) =>
                  setColorSliderAutopilot({
                    range: { min: minV, max: maxV },
                  })
                }
              />
            </div>

            <EnvelopePlaybackControls
              repeatMode={colorSliderAutopilot.repeatMode ?? 'loop'}
              loopDirection={colorSliderAutopilot.loopDirection ?? 'forward'}
              onRepeatModeChange={(repeatMode) => setColorSliderAutopilot({ repeatMode })}
              onLoopDirectionChange={(loopDirection) => setColorSliderAutopilot({ loopDirection })}
            />

            {colorSliderAutopilot.enabled ? (
              <div style={{
                padding: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#10b981'
              }}>
                Color autopilot active ({colorSliderAutopilot.type}).
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
        isOpen={showPanTiltPathEditor}
        onClose={() => setShowPanTiltPathEditor(false)}
        mode="autopilot"
        initialPoints={panTiltAutopilot.customPath || []}
      />
    </div>
  );
};

export default SuperControl;
