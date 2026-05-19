import React, { useState, useEffect, useRef } from 'react';
import { useChromaticEnergyManipulatorSettings } from '../../context/ChromaticEnergyManipulatorContext';
import { DockableComponent } from '../ui/DockableComponent';
import { useStore, Fixture, FixtureFlag } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ChromaticEnergyManipulatorMini.module.scss';

interface ChromaticEnergyManipulatorMiniProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isDockable?: boolean;
  initialControlMode?: ControlMode['type'];
  showAllControlsInitially?: boolean;
}

// Enhanced color and movement interfaces
interface HSVColor {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

interface MovementPreset {
  name: string;
  pan: number;
  tilt: number;
  icon: keyof typeof import('lucide-react');
}

interface ControlMode {
  type: 'basic' | 'advanced' | 'performance';
  label: string;
}

// Utility functions for color conversion
const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
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
  };
};

const rgbToHsv = (r: number, g: number, b: number): HSVColor => {
  r = r / 255;
  g = g / 255;
  b = b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = max === 0 ? 0 : (diff / max) * 100;
  let v = max * 100;
  
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  
  h = h * 60;
  if (h < 0) h += 360;
  
  return { h, s, v };
};

const kelvinToRgb = (kelvin: number): { r: number; g: number; b: number } => {
  const temp = kelvin / 100;
  let r, g, b;
  
  if (temp <= 66) {
    r = 255;
    g = temp <= 19 ? 0 : 99.4708025861 * Math.log(temp - 10) - 161.1195681661;
    b = temp >= 66 ? 255 : temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }
  
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b)))
  };
};

// Enhanced interfaces for additional control types
interface EnhancedChannels {
  rgbChannels: {
    redChannel?: number;
    greenChannel?: number;
    blueChannel?: number;
    whiteChannel?: number;
    amberChannel?: number;
    uvChannel?: number;
  };
  movementChannels: {
    panChannel?: number;
    panFineChannel?: number;
    tiltChannel?: number;
    tiltFineChannel?: number;
  };
  enhancedChannels: {
    dimmerChannel?: number;
    shutterChannel?: number;
    strobeChannel?: number;
    colorWheelChannel?: number;
    goboWheelChannel?: number;
    goboRotationChannel?: number;
    zoomChannel?: number;
    focusChannel?: number;
    prismChannel?: number;
    irisChannel?: number;
    speedChannel?: number;
    macroChannel?: number;
    effectChannel?: number;
    // NEW: Additional professional channels
    frostChannel?: number;
    animationChannel?: number;
    animationSpeedChannel?: number;
    ctoChannel?: number; // Color Temperature Orange
    ctbChannel?: number; // Color Temperature Blue
    resetChannel?: number;
    lampControlChannel?: number;
    fanControlChannel?: number;
    displayChannel?: number;
    functionChannel?: number;
  };
}

interface AdvancedFixtureControls {
  dimmer: number;
  shutter: number;
  strobe: number;
  colorWheel: number;
  goboWheel: number;
  goboRotation: number;
  zoom: number;
  focus: number;
  prism: number;
  iris: number;
  speed: number;
  macro: number;
  effect: number;
  // NEW: Additional controls
  frost: number;
  animation: number;
  animationSpeed: number;
  cto: number;
  ctb: number;
  reset: number;
  lampControl: number;
  fanControl: number;
  display: number;
  function: number;
}

interface GOBOPreset {
  name: string;
  value: number;
  icon?: string;
}

interface ColorWheelPreset {
  name: string;
  value: number;
  color: string;
}

const ChromaticEnergyManipulatorMini: React.FC<ChromaticEnergyManipulatorMiniProps> = ({
  isCollapsed = false,
  onCollapsedChange,
  isDockable = true,
  initialControlMode = 'basic',
  showAllControlsInitially = false,
}) => {
  // ...existing state...
  const [selectedFixtures, setSelectedFixtures] = useState<string[]>([]);
  const [showFixtureSelect, setShowFixtureSelect] = useState(false);
  const [showFlagPanel, setShowFlagPanel] = useState(false);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagColor, setNewFlagColor] = useState('#ff6b6b');
  const [newFlagCategory, setNewFlagCategory] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [lastColorPreset, setLastColorPreset] = useState<{ r: number; g: number; b: number } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedSelection, setShowAdvancedSelection] = useState(false);
    // Enhanced state for advanced controls
  const [controlMode, setControlMode] = useState<ControlMode['type']>(initialControlMode || 'advanced');
  const [showColorWheel, setShowColorWheel] = useState(false);
  const [showRGBSliders, setShowRGBSliders] = useState(false);
  const [showHSVControls, setShowHSVControls] = useState(false);
  const [showMovementPresets, setShowMovementPresets] = useState(false);
  const [showPanTiltSliders, setShowPanTiltSliders] = useState(false);
  const [isColorWheelMode, setIsColorWheelMode] = useState(false);
  const [lockValues, setLockValues] = useState({ color: false, movement: false });
  const [smoothMovement, setSmoothMovement] = useState(false);
  const [movementSpeed, setMovementSpeed] = useState(100); // 1-100%
  const [colorTemperature, setColorTemperature] = useState(5600); // Kelvin
    // Color and movement state with HSV support
  const [color, setColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  const [hsvColor, setHsvColor] = useState<HSVColor>({ h: 0, s: 0, v: 100 });
  const [movement, setMovement] = useState<{ pan: number; tilt: number }>({ pan: 127, tilt: 127 });
  
  // Enhanced controls state for additional channel types
  const [advancedControls, setAdvancedControls] = useState<AdvancedFixtureControls>({
    dimmer: 255,
    shutter: 255,
    strobe: 0,
    colorWheel: 0,
    goboWheel: 0,
    goboRotation: 127,
    zoom: 127,
    focus: 127,
    prism: 0,
    iris: 255,
    speed: 127,
    macro: 0,
    effect: 0,
    // NEW: Additional controls
    frost: 0,
    animation: 0,
    animationSpeed: 127,
    cto: 127,
    ctb: 127,
    reset: 0,
    lampControl: 0,
    fanControl: 0,
    display: 0,
    function: 0
  });
  // State for showing enhanced controls
  const [showDimmerControls, setShowDimmerControls] = useState(showAllControlsInitially);
  const [showEffectControls, setShowEffectControls] = useState(showAllControlsInitially);
  const [showBeamControls, setShowBeamControls] = useState(showAllControlsInitially);
  const [showProfessionalControls, setShowProfessionalControls] = useState(showAllControlsInitially);
  
  // Enhanced canvas references
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const movementCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorWheelRef = useRef<HTMLCanvasElement>(null);
  const hueSliderRef = useRef<HTMLCanvasElement>(null);
  
  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<Array<{ color: any; movement: any }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ color: any; movement: any }>>([]);  // Movement presets
  const movementPresets: MovementPreset[] = [
    { name: 'Home', pan: 127, tilt: 127, icon: 'Home' },
    { name: 'Center', pan: 127, tilt: 127, icon: 'Target' },
    { name: 'Left', pan: 64, tilt: 127, icon: 'ArrowLeft' },
    { name: 'Right', pan: 192, tilt: 127, icon: 'ArrowRight' },
    { name: 'Up', pan: 127, tilt: 192, icon: 'ArrowUp' },
    { name: 'Down', pan: 127, tilt: 64, icon: 'ArrowDown' },
    { name: 'Top Left', pan: 64, tilt: 192, icon: 'MoveUpLeft' },
    { name: 'Top Right', pan: 192, tilt: 192, icon: 'MoveUpRight' },
    { name: 'Bottom Left', pan: 64, tilt: 64, icon: 'MoveDownLeft' },
    { name: 'Bottom Right', pan: 192, tilt: 64, icon: 'MoveDownRight' },
  ];

  // GOBO Presets (common GOBO patterns)
  const goboPresets: GOBOPreset[] = [
    { name: 'Open', value: 0, icon: 'Circle' },
    { name: 'Dots', value: 32, icon: 'MoreHorizontal' },
    { name: 'Lines', value: 64, icon: 'AlignJustify' },
    { name: 'Triangles', value: 96, icon: 'Triangle' },
    { name: 'Stars', value: 128, icon: 'Star' },
    { name: 'Breakup', value: 160, icon: 'Hash' },
    { name: 'Leaves', value: 192, icon: 'Leaf' },
    { name: 'Prism', value: 224, icon: 'Diamond' }
  ];

  // Color Wheel Presets (common color wheel positions)
  const colorWheelPresets: ColorWheelPreset[] = [
    { name: 'Open', value: 0, color: '#ffffff' },
    { name: 'Red', value: 32, color: '#ff0000' },
    { name: 'Orange', value: 64, color: '#ff8000' },
    { name: 'Yellow', value: 96, color: '#ffff00' },
    { name: 'Green', value: 128, color: '#00ff00' },
    { name: 'Cyan', value: 160, color: '#00ffff' },
    { name: 'Blue', value: 192, color: '#0000ff' },
    { name: 'Magenta', value: 224, color: '#ff00ff' }
  ];

  // Control modes
  const controlModes: ControlMode[] = [
    { type: 'basic', label: 'Basic' },
    { type: 'advanced', label: 'Advanced' },
    { type: 'performance', label: 'Performance' },
  ];

  const { 
    fixtures, 
    getDmxChannelValue, 
    setDmxChannelValue,
    addFixtureFlag,
    removeFixtureFlag,
    bulkAddFlag,
    bulkRemoveFlag,
    createQuickFlag,
    getFixturesByFlag,
    getFixturesByFlagCategory
  } = useStore(state => ({
    fixtures: state.fixtures,
    getDmxChannelValue: state.getDmxChannelValue,
    setDmxChannelValue: state.setDmxChannelValue,
    addFixtureFlag: state.addFixtureFlag,
    removeFixtureFlag: state.removeFixtureFlag,
    bulkAddFlag: state.bulkAddFlag,
    bulkRemoveFlag: state.bulkRemoveFlag,
    createQuickFlag: state.createQuickFlag,
    getFixturesByFlag: state.getFixturesByFlag,
    getFixturesByFlagCategory: state.getFixturesByFlagCategory
  }));
  const { settings } = useChromaticEnergyManipulatorSettings();
  // Get fixture channels - Enhanced version
  const getFixtureChannels = (fixtureId: string): EnhancedChannels => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return { 
      rgbChannels: {}, 
      movementChannels: {}, 
      enhancedChannels: {} 
    };
    
    const rgbChannels: EnhancedChannels['rgbChannels'] = {};
    const movementChannels: EnhancedChannels['movementChannels'] = {};
    const enhancedChannels: EnhancedChannels['enhancedChannels'] = {};

    fixture.channels.forEach((channel, index) => {
      const dmxAddress = fixture.startAddress + index;
      switch (channel.type) {
        // RGB/Color channels
        case 'red':
          rgbChannels.redChannel = dmxAddress - 1;
          break;
        case 'green':
          rgbChannels.greenChannel = dmxAddress - 1;
          break;
        case 'blue':
          rgbChannels.blueChannel = dmxAddress - 1;
          break;
        case 'white':
          rgbChannels.whiteChannel = dmxAddress - 1;
          break;
        case 'amber':
          rgbChannels.amberChannel = dmxAddress - 1;
          break;
        case 'uv':
          rgbChannels.uvChannel = dmxAddress - 1;
          break;
        // Movement channels
        case 'pan':
          movementChannels.panChannel = dmxAddress - 1;
          break;
        case 'pan_fine':
          movementChannels.panFineChannel = dmxAddress - 1;
          break;
        case 'tilt':
          movementChannels.tiltChannel = dmxAddress - 1;
          break;
        case 'tilt_fine':
          movementChannels.tiltFineChannel = dmxAddress - 1;
          break;
        // Enhanced channels
        case 'dimmer':
          enhancedChannels.dimmerChannel = dmxAddress - 1;
          break;
        case 'shutter':
          enhancedChannels.shutterChannel = dmxAddress - 1;
          break;
        case 'strobe':
          enhancedChannels.strobeChannel = dmxAddress - 1;
          break;
        case 'color_wheel':
          enhancedChannels.colorWheelChannel = dmxAddress - 1;
          break;
        case 'gobo_wheel':
          enhancedChannels.goboWheelChannel = dmxAddress - 1;
          break;
        case 'gobo_rotation':
          enhancedChannels.goboRotationChannel = dmxAddress - 1;
          break;
        case 'zoom':
          enhancedChannels.zoomChannel = dmxAddress - 1;
          break;
        case 'focus':
          enhancedChannels.focusChannel = dmxAddress - 1;
          break;
        case 'prism':
          enhancedChannels.prismChannel = dmxAddress - 1;
          break;
        case 'iris':
          enhancedChannels.irisChannel = dmxAddress - 1;
          break;
        case 'speed':
          enhancedChannels.speedChannel = dmxAddress - 1;
          break;
        case 'macro':
          enhancedChannels.macroChannel = dmxAddress - 1;
          break;        case 'effect':
          enhancedChannels.effectChannel = dmxAddress - 1;
          break;
        // NEW: Additional professional channel types
        case 'frost':
        case 'diffusion':
          enhancedChannels.frostChannel = dmxAddress - 1;
          break;
        case 'animation':
          enhancedChannels.animationChannel = dmxAddress - 1;
          break;
        case 'animation_speed':
          enhancedChannels.animationSpeedChannel = dmxAddress - 1;
          break;
        case 'cto':
        case 'color_temperature_orange':
          enhancedChannels.ctoChannel = dmxAddress - 1;
          break;
        case 'ctb':
        case 'color_temperature_blue':
          enhancedChannels.ctbChannel = dmxAddress - 1;
          break;
        case 'reset':
          enhancedChannels.resetChannel = dmxAddress - 1;
          break;
        case 'lamp_control':
          enhancedChannels.lampControlChannel = dmxAddress - 1;
          break;
        case 'fan_control':
          enhancedChannels.fanControlChannel = dmxAddress - 1;
          break;
        case 'display':
          enhancedChannels.displayChannel = dmxAddress - 1;
          break;
        case 'function':
          enhancedChannels.functionChannel = dmxAddress - 1;
          break;
      }
    });
    
    return { rgbChannels, movementChannels, enhancedChannels };
  };
  // Helper functions for flagging
  const createAndApplyFlag = () => {
    if (!newFlagName.trim() || selectedFixtures.length === 0) return;
    
    const flag = createQuickFlag(newFlagName.trim(), newFlagColor, newFlagCategory.trim() || undefined);
    bulkAddFlag(selectedFixtures, flag);
    
    // Reset form
    setNewFlagName('');
    setNewFlagColor('#ff6b6b');
    setNewFlagCategory('');
    setShowFlagPanel(false);
  };

  // Color presets
  const colorPresets = [
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'Orange', r: 255, g: 127, b: 0 },
    { name: 'Purple', r: 127, g: 0, b: 255 },
    { name: 'Warm White', r: 255, g: 180, b: 120 },
    { name: 'Cool White', r: 180, g: 200, b: 255 },
    { name: 'Off', r: 0, g: 0, b: 0 }
  ];
  const applyColorPreset = (preset: { r: number; g: number; b: number }) => {
    try {
      setIsUpdating(true);
      setConnectionError(null);
      
      setColor(preset);
      setLastColorPreset(preset);
      
      // Apply to all selected fixtures with validation
      selectedFixtures.forEach(fixtureId => {
        const { rgbChannels } = getFixtureChannels(fixtureId);
        if (rgbChannels.redChannel !== undefined && rgbChannels.redChannel >= 0) {
          setDmxChannelValue(rgbChannels.redChannel, Math.max(0, Math.min(255, preset.r)));
        }
        if (rgbChannels.greenChannel !== undefined && rgbChannels.greenChannel >= 0) {
          setDmxChannelValue(rgbChannels.greenChannel, Math.max(0, Math.min(255, preset.g)));
        }
        if (rgbChannels.blueChannel !== undefined && rgbChannels.blueChannel >= 0) {
          setDmxChannelValue(rgbChannels.blueChannel, Math.max(0, Math.min(255, preset.b)));
        }
      });
    } catch (error) {
      setConnectionError('Failed to apply color preset');
      console.error('Color preset error:', error);
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

  const centerMovement = () => {
    try {
      setIsUpdating(true);
      setConnectionError(null);
      
      const centerValues = { pan: 127, tilt: 127 };
      setMovement(centerValues);
      
      selectedFixtures.forEach(fixtureId => {
        const { movementChannels } = getFixtureChannels(fixtureId);
        if (movementChannels.panChannel !== undefined && movementChannels.panChannel >= 0) {
          setDmxChannelValue(movementChannels.panChannel, centerValues.pan);
        }
        if (movementChannels.tiltChannel !== undefined && movementChannels.tiltChannel >= 0) {
          setDmxChannelValue(movementChannels.tiltChannel, centerValues.tilt);
        }
      });
    } catch (error) {
      setConnectionError('Failed to center movement');
      console.error('Movement center error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Undo/Redo functionality
  const saveToUndoStack = () => {
    const currentState = { color: { ...color }, movement: { ...movement } };
    setUndoStack(prev => {
      const newStack = [...prev, currentState];
      return newStack.slice(-10); // Keep only last 10 states
    });
    setRedoStack([]); // Clear redo stack when new action is performed
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    
    const currentState = { color: { ...color }, movement: { ...movement } };
    setRedoStack(prev => [currentState, ...prev.slice(0, 9)]);
    
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    setColor(previousState.color);
    setMovement(previousState.movement);
    
    // Apply to fixtures
    selectedFixtures.forEach(fixtureId => {
      const { rgbChannels, movementChannels } = getFixtureChannels(fixtureId);
      
      // Apply color
      if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, previousState.color.r);
      if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, previousState.color.g);
      if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, previousState.color.b);
      
      // Apply movement
      if (movementChannels.panChannel !== undefined) setDmxChannelValue(movementChannels.panChannel, previousState.movement.pan);
      if (movementChannels.tiltChannel !== undefined) setDmxChannelValue(movementChannels.tiltChannel, previousState.movement.tilt);
    });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    
    const currentState = { color: { ...color }, movement: { ...movement } };
    setUndoStack(prev => [...prev, currentState].slice(-10));
    
    const nextState = redoStack[0];
    setRedoStack(prev => prev.slice(1));
    
    setColor(nextState.color);
    setMovement(nextState.movement);
    
    // Apply to fixtures
    selectedFixtures.forEach(fixtureId => {
      const { rgbChannels, movementChannels } = getFixtureChannels(fixtureId);
      
      // Apply color
      if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, nextState.color.r);
      if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, nextState.color.g);
      if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, nextState.color.b);
      
      // Apply movement
      if (movementChannels.panChannel !== undefined) setDmxChannelValue(movementChannels.panChannel, nextState.movement.pan);
      if (movementChannels.tiltChannel !== undefined) setDmxChannelValue(movementChannels.tiltChannel, nextState.movement.tilt);
    });
  };
  // Enhanced application functions with undo support
  const applyColorWithUndo = (newColor: { r: number; g: number; b: number }) => {
    saveToUndoStack();
    applyColorPreset(newColor);
  };

  const applyMovementWithUndo = (newMovement: { pan: number; tilt: number }) => {
    saveToUndoStack();
    setMovement(newMovement);
    
    selectedFixtures.forEach(fixtureId => {
      const { movementChannels } = getFixtureChannels(fixtureId);
      if (movementChannels.panChannel !== undefined) setDmxChannelValue(movementChannels.panChannel, newMovement.pan);
      if (movementChannels.tiltChannel !== undefined) setDmxChannelValue(movementChannels.tiltChannel, newMovement.tilt);
    });
  };

  // Enhanced control application functions
  const applyAdvancedControl = (controlType: keyof AdvancedFixtureControls, value: number) => {
    setAdvancedControls(prev => ({ ...prev, [controlType]: value }));
    
    selectedFixtures.forEach(fixtureId => {
      const { enhancedChannels } = getFixtureChannels(fixtureId);
      
      switch (controlType) {
        case 'dimmer':
          if (enhancedChannels.dimmerChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.dimmerChannel, value);
          }
          break;
        case 'shutter':
          if (enhancedChannels.shutterChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.shutterChannel, value);
          }
          break;
        case 'strobe':
          if (enhancedChannels.strobeChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.strobeChannel, value);
          }
          break;
        case 'colorWheel':
          if (enhancedChannels.colorWheelChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.colorWheelChannel, value);
          }
          break;
        case 'goboWheel':
          if (enhancedChannels.goboWheelChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.goboWheelChannel, value);
          }
          break;
        case 'goboRotation':
          if (enhancedChannels.goboRotationChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.goboRotationChannel, value);
          }
          break;
        case 'zoom':
          if (enhancedChannels.zoomChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.zoomChannel, value);
          }
          break;
        case 'focus':
          if (enhancedChannels.focusChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.focusChannel, value);
          }
          break;
        case 'prism':
          if (enhancedChannels.prismChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.prismChannel, value);
          }
          break;
        case 'iris':
          if (enhancedChannels.irisChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.irisChannel, value);
          }
          break;
        case 'speed':
          if (enhancedChannels.speedChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.speedChannel, value);
          }
          break;
        case 'macro':
          if (enhancedChannels.macroChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.macroChannel, value);
          }
          break;
        case 'effect':
          if (enhancedChannels.effectChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.effectChannel, value);
          }
          break;
        // NEW: Additional professional controls
        case 'frost':
          if (enhancedChannels.frostChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.frostChannel, value);
          }
          break;
        case 'animation':
          if (enhancedChannels.animationChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.animationChannel, value);
          }
          break;
        case 'animationSpeed':
          if (enhancedChannels.animationSpeedChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.animationSpeedChannel, value);
          }
          break;
        case 'cto':
          if (enhancedChannels.ctoChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.ctoChannel, value);
          }
          break;
        case 'ctb':
          if (enhancedChannels.ctbChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.ctbChannel, value);
          }
          break;
        case 'reset':
          if (enhancedChannels.resetChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.resetChannel, value);
          }
          break;
        case 'lampControl':
          if (enhancedChannels.lampControlChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.lampControlChannel, value);
          }
          break;
        case 'fanControl':
          if (enhancedChannels.fanControlChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.fanControlChannel, value);
          }
          break;
        case 'display':
          if (enhancedChannels.displayChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.displayChannel, value);
          }
          break;
        case 'function':
          if (enhancedChannels.functionChannel !== undefined) {
            setDmxChannelValue(enhancedChannels.functionChannel, value);
          }
          break;
      }
    });
  };

  // Quick preset functions
  const applyGOBOPreset = (preset: GOBOPreset) => {
    applyAdvancedControl('goboWheel', preset.value);
  };

  const applyColorWheelPreset = (preset: ColorWheelPreset) => {
    applyAdvancedControl('colorWheel', preset.value);
  };

  const strobeStart = () => {
    applyAdvancedControl('strobe', 200); // Fast strobe
  };

  const strobeStop = () => {
    applyAdvancedControl('strobe', 0); // No strobe
  };

  const shutterOpen = () => {
    applyAdvancedControl('shutter', 255); // Fully open
  };

  const shutterClose = () => {
    applyAdvancedControl('shutter', 0); // Closed
  };

  // Enhanced color control functions
  const applyColorTemperature = (kelvin: number) => {
    const rgb = kelvinToRgb(kelvin);
    applyColorWithUndo(rgb);
    setColorTemperature(kelvin);
  };

  const applyHSVColor = (hsv: HSVColor) => {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    setHsvColor(hsv);
    applyColorWithUndo(rgb);
  };

  const selectAllFlagged = () => {
    const flaggedFixtures = fixtures.filter(f => f.isFlagged);
    setSelectedFixtures(flaggedFixtures.map(f => f.id));
  };

  const selectByFlag = (flagId: string) => {
    const flaggedFixtures = getFixturesByFlag(flagId);
    setSelectedFixtures(flaggedFixtures.map(f => f.id));
  };

  const selectByFlagCategory = (category: string) => {
    const flaggedFixtures = getFixturesByFlagCategory(category);
    setSelectedFixtures(flaggedFixtures.map(f => f.id));
  };

  // Enhanced selection functions
  const selectAll = () => {
    setSelectedFixtures(filteredFixtures.map(f => f.id));
  };

  const deselectAll = () => {
    setSelectedFixtures([]);
  };

  const invertSelection = () => {
    const allIds = filteredFixtures.map(f => f.id);
    const newSelection = allIds.filter(id => !selectedFixtures.includes(id));
    setSelectedFixtures(newSelection);
  };
  const selectByType = (fixtureType: 'rgb' | 'movement' | 'dimmer' | 'gobo' | 'colorwheel' | 'strobe' | 'beam') => {
    const typeFixtures = filteredFixtures.filter(fixture => {
      switch (fixtureType) {
        case 'rgb':
          return fixture.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type));
        case 'movement':
          return fixture.channels.some(ch => ['pan', 'tilt'].includes(ch.type));
        case 'dimmer':
          return fixture.channels.some(ch => ch.type === 'dimmer');
        case 'gobo':
          return fixture.channels.some(ch => ['gobo_wheel', 'gobo_rotation'].includes(ch.type));
        case 'colorwheel':
          return fixture.channels.some(ch => ch.type === 'color_wheel');
        case 'strobe':
          return fixture.channels.some(ch => ['strobe', 'shutter'].includes(ch.type));
        case 'beam':
          return fixture.channels.some(ch => ['zoom', 'focus', 'iris'].includes(ch.type));
        default:
          return false;
      }
    });
    setSelectedFixtures(typeFixtures.map(f => f.id));
  };

  const selectSimilar = () => {
    if (selectedFixtures.length === 0) return;
    
    const referenceFixture = fixtures.find(f => f.id === selectedFixtures[0]);
    if (!referenceFixture) return;
    
    const similarFixtures = filteredFixtures.filter(fixture => {
      // Consider fixtures similar if they have the same channel types
      const refChannelTypes = referenceFixture.channels.map(ch => ch.type).sort();
      const fixtureChannelTypes = fixture.channels.map(ch => ch.type).sort();
      return JSON.stringify(refChannelTypes) === JSON.stringify(fixtureChannelTypes);
    });
    
    setSelectedFixtures(similarFixtures.map(f => f.id));
  };

  // Filter fixtures based on search term
  const filteredFixtures = fixtures.filter(fixture =>
    fixture.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAllUniqueFlags = (): FixtureFlag[] => {
    const flagMap = new Map<string, FixtureFlag>();
    fixtures.forEach(fixture => {
      if (fixture.flags) {
        fixture.flags.forEach(flag => {
          flagMap.set(flag.id, flag);
        });
      }
    });
    return Array.from(flagMap.values()).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  };

  const getAllUniqueCategories = (): string[] => {
    const categories = new Set<string>();
    fixtures.forEach(fixture => {
      if (fixture.flags) {
        fixture.flags.forEach(flag => {
          if (flag.category) {
            categories.add(flag.category);
          }
        });
      }
    });
    return Array.from(categories).sort();
  };

  const removeSelectedFixtureFlags = () => {
    selectedFixtures.forEach(fixtureId => {
      const fixture = fixtures.find(f => f.id === fixtureId);
      if (fixture && fixture.flags) {
        fixture.flags.forEach(flag => {
          removeFixtureFlag(fixtureId, flag.id);
        });
      }
    });
  };
  // Auto-select first RGB fixture if none selected
  useEffect(() => {
    if (!settings.autoSelectFirstFixture) return;
    if (selectedFixtures.length === 0 && fixtures.length > 0) {
      // Try RGB fixtures first
      let firstFixture = fixtures.find(f =>
        f.channels.some(c => c.type === 'red') &&
        f.channels.some(c => c.type === 'green') &&
        f.channels.some(c => c.type === 'blue')
      );
      // Fallback to dimmer-only fixtures
      if (!firstFixture) {
        firstFixture = fixtures.find(f =>
          f.channels.some(c => c.type === 'dimmer')
        );
      }
      // Final fallback: first fixture in list
      if (!firstFixture && fixtures.length > 0) {
        firstFixture = fixtures[0];
      }
      if (firstFixture) {
        setSelectedFixtures([firstFixture.id]);
      }
    }
  }, [fixtures, selectedFixtures.length, settings.autoSelectFirstFixture]);

  // Update color when RGB changes to sync HSV
  useEffect(() => {
    const hsv = rgbToHsv(color.r, color.g, color.b);
    setHsvColor(hsv);
  }, [color]);

  // Enhanced canvas drawing functions
  const drawColorWheel = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw color wheel
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      for (let r = 0; r < radius; r += 1) {
        const saturation = r / radius * 100;
        const rgb = hsvToRgb(angle, saturation, 100);
        
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, startAngle, endAngle);
        ctx.stroke();
      }
    }

    // Draw current color indicator
    const currentRadius = (hsvColor.s / 100) * radius;
    const currentAngle = (hsvColor.h - 90) * Math.PI / 180;
    const indicatorX = centerX + currentRadius * Math.cos(currentAngle);
    const indicatorY = centerY + currentRadius * Math.sin(currentAngle);

    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };

  const drawHueSlider = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw hue gradient
    for (let x = 0; x < width; x++) {
      const hue = (x / width) * 360;
      const rgb = hsvToRgb(hue, 100, 100);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fillRect(x, 0, 1, height);
    }

    // Draw current hue indicator
    const indicatorX = (hsvColor.h / 360) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(indicatorX - 2, 0, 4, height);
    ctx.fill();
    ctx.stroke();
  };
  // Canvas drawing effect hooks
  useEffect(() => {
    if (colorWheelRef.current && showColorWheel) {
      drawColorWheel(colorWheelRef.current);
    }
  }, [hsvColor, showColorWheel]);

  useEffect(() => {
    if (hueSliderRef.current && showHSVControls) {
      drawHueSlider(hueSliderRef.current);
    }
  }, [hsvColor, showHSVControls]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (selectedFixtures.length === 0) return;
      
      // Only handle shortcuts when not typing in inputs
      if (event.target instanceof HTMLInputElement) return;
      
      switch (event.key.toLowerCase()) {
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            randomizeColor();
          }
          break;
        case 'c':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            centerMovement();
          }
          break;
        case '1':
          event.preventDefault();
          applyColorPreset({ r: 255, g: 0, b: 0 }); // Red
          break;
        case '2':
          event.preventDefault();
          applyColorPreset({ r: 0, g: 255, b: 0 }); // Green
          break;
        case '3':
          event.preventDefault();
          applyColorPreset({ r: 0, g: 0, b: 255 }); // Blue
          break;        case '0':
          event.preventDefault();
          applyColorPreset({ r: 0, g: 0, b: 0 }); // Off
          break;
        case 'z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              redo(); // Ctrl+Shift+Z for redo
            } else {
              undo(); // Ctrl+Z for undo
            }
          }
          break;
        case 'y':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            redo(); // Ctrl+Y for redo (alternative)
          }
          break;
      }
    };    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedFixtures, applyColorPreset, randomizeColor, centerMovement, undo, redo]);
  // Update color and movement when selection changes
  useEffect(() => {
    if (selectedFixtures.length > 0) {
      const firstFixtureId = selectedFixtures[0];
      const { rgbChannels: firstRgbChannels, movementChannels: firstMovementChannels, enhancedChannels: firstEnhancedChannels } = getFixtureChannels(firstFixtureId);
      
      if (firstRgbChannels.redChannel !== undefined) {
        setColor({
          r: getDmxChannelValue(firstRgbChannels.redChannel),
          g: getDmxChannelValue(firstRgbChannels.greenChannel),
          b: getDmxChannelValue(firstRgbChannels.blueChannel)
        });
      }
      
      if (firstMovementChannels.panChannel !== undefined) {
        setMovement({
          pan: getDmxChannelValue(firstMovementChannels.panChannel),
          tilt: getDmxChannelValue(firstMovementChannels.tiltChannel)
        });
      }

      // Update enhanced controls with current values
      setAdvancedControls(prev => ({
        ...prev,
        dimmer: firstEnhancedChannels.dimmerChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.dimmerChannel) : prev.dimmer,
        shutter: firstEnhancedChannels.shutterChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.shutterChannel) : prev.shutter,
        strobe: firstEnhancedChannels.strobeChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.strobeChannel) : prev.strobe,
        colorWheel: firstEnhancedChannels.colorWheelChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.colorWheelChannel) : prev.colorWheel,
        goboWheel: firstEnhancedChannels.goboWheelChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.goboWheelChannel) : prev.goboWheel,
        goboRotation: firstEnhancedChannels.goboRotationChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.goboRotationChannel) : prev.goboRotation,
        zoom: firstEnhancedChannels.zoomChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.zoomChannel) : prev.zoom,
        focus: firstEnhancedChannels.focusChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.focusChannel) : prev.focus,
        prism: firstEnhancedChannels.prismChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.prismChannel) : prev.prism,
        iris: firstEnhancedChannels.irisChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.irisChannel) : prev.iris,
        speed: firstEnhancedChannels.speedChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.speedChannel) : prev.speed,
        macro: firstEnhancedChannels.macroChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.macroChannel) : prev.macro,
        effect: firstEnhancedChannels.effectChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.effectChannel) : prev.effect,
        frost: firstEnhancedChannels.frostChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.frostChannel) : prev.frost,
        animation: firstEnhancedChannels.animationChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.animationChannel) : prev.animation,
        animationSpeed: firstEnhancedChannels.animationSpeedChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.animationSpeedChannel) : prev.animationSpeed,
        cto: firstEnhancedChannels.ctoChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.ctoChannel) : prev.cto,
        ctb: firstEnhancedChannels.ctbChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.ctbChannel) : prev.ctb,
        reset: firstEnhancedChannels.resetChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.resetChannel) : prev.reset,
        lampControl: firstEnhancedChannels.lampControlChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.lampControlChannel) : prev.lampControl,
        fanControl: firstEnhancedChannels.fanControlChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.fanControlChannel) : prev.fanControl,
        display: firstEnhancedChannels.displayChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.displayChannel) : prev.display,
        function: firstEnhancedChannels.functionChannel !== undefined ? getDmxChannelValue(firstEnhancedChannels.functionChannel) : prev.function
      }));
    }
  }, [selectedFixtures, getDmxChannelValue, fixtures]);

  // Canvas drawing effects
  useEffect(() => {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    
    const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fillStyle = rgb;
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }, [color]);

  useEffect(() => {
    const canvas = movementCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    
    // Draw crosshairs
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Draw position indicator
    const x = (movement.pan / 255) * width;
    const y = height - (movement.tilt / 255) * height;
    
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }, [movement]);

  // Event handlers
  const handleColorClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const hue = (x / canvas.width) * 360;
    
    // Convert HSV to RGB (simplified)
    const c = 1;
    const x_val = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = 0;
    
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x_val; b = 0; }
    else if (hue < 120) { r = x_val; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x_val; }
    else if (hue < 240) { r = 0; g = x_val; b = c; }
    else if (hue < 300) { r = x_val; g = 0; b = c; }
    else { r = c; g = 0; b = x_val; }
    
    const newColor = {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
    
    setColor(newColor);
    
    // Update all selected fixtures
    selectedFixtures.forEach(fixtureId => {
      const { rgbChannels } = getFixtureChannels(fixtureId);
      if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, newColor.r);
      if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, newColor.g);
      if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, newColor.b);
    });
  };

  const handleMovementClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = movementCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const newMovement = {
      pan: Math.round((x / canvas.width) * 255),
      tilt: Math.round(((canvas.height - y) / canvas.height) * 255)
    };
    
    setMovement(newMovement);
    
    // Update all selected fixtures
    selectedFixtures.forEach(fixtureId => {
      const { movementChannels } = getFixtureChannels(fixtureId);
      if (movementChannels.panChannel !== undefined) setDmxChannelValue(movementChannels.panChannel, newMovement.pan);
      if (movementChannels.tiltChannel !== undefined) setDmxChannelValue(movementChannels.tiltChannel, newMovement.tilt);
    });
  };  const selectedFixtureName = () => {
    if (selectedFixtures.length === 0) return settings.enableErrorMessages ? 'No fixtures selected' : 'Select fixtures';
    if (selectedFixtures.length === 1) {
      const fixture = fixtures.find(f => f.id === selectedFixtures[0]);
      return fixture?.name || 'Unknown';
    }
    return `${selectedFixtures.length} fixtures selected`;
  };

  const { rgbChannels: firstSelectedRgbChannels, movementChannels: firstSelectedMovementChannels, enhancedChannels: firstSelectedEnhancedChannels } = 
    selectedFixtures.length > 0 ? getFixtureChannels(selectedFixtures[0]) : { rgbChannels: {}, movementChannels: {}, enhancedChannels: {} };

  const hasRgbChannels = firstSelectedRgbChannels.redChannel !== undefined && firstSelectedRgbChannels.greenChannel !== undefined && firstSelectedRgbChannels.blueChannel !== undefined;
  const hasMovementChannels = firstSelectedMovementChannels.panChannel !== undefined && firstSelectedMovementChannels.tiltChannel !== undefined;
  const hasEnhancedChannels = Object.values(firstSelectedEnhancedChannels).some(channel => channel !== undefined);
  if (!isDockable) {
    return (
      <div className={styles.chromaticEnergyManipulatorMini}>
        <div className={styles.container}>
          {/* Error Display */}
          {connectionError && (
            <div className={styles.errorMessage}>
              <LucideIcon name="AlertTriangle" />
              <span>{connectionError}</span>
              <button 
                onClick={() => setConnectionError(null)}
                className={styles.closeError}
              >
                <LucideIcon name="X" />
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isUpdating && (
            <div className={styles.loadingIndicator}>
              <LucideIcon name="Loader" />
              <span>Updating...</span>
            </div>
          )}

          {/* Simplified content for non-dockable version */}
          <div className={styles.fixtureSection}>
            <button 
              className={styles.fixtureSelector}
              onClick={() => setShowFixtureSelect(!showFixtureSelect)}
              title={`Selected: ${selectedFixtureName()}`}
            >
              <LucideIcon name="Target" />
              <span className={styles.fixtureName}>{selectedFixtureName()}</span>
              <div className={styles.selectorRight}>
                {selectedFixtures.length > 0 && (
                  <span className={styles.selectionBadge}>{selectedFixtures.length}</span>
                )}
                <LucideIcon name={showFixtureSelect ? "ChevronUp" : "ChevronDown"} />
              </div>
            </button>
          </div>
          {/* Note: Simplified version for docked layout */}
        </div>
      </div>
    );
  }

  return (
    <DockableComponent
      id="chromatic-energy-manipulator-mini"
      component="chromatic-energy-manipulator"
      title="Chromatic Energy Manipulator"
      defaultPosition={{ zone: 'floating', offset: { x: 20, y: 300 } }}
      className={styles.chromaticEnergyManipulatorMini}
      isCollapsed={isCollapsed}
      onCollapsedChange={onCollapsedChange}
      width="280px"
      height="auto"
    >      <div className={styles.container}>
        {/* Error Display */}
        {connectionError && (
          <div className={styles.errorMessage}>
            <LucideIcon name="AlertTriangle" />
            <span>{connectionError}</span>
            <button 
              onClick={() => setConnectionError(null)}
              className={styles.closeError}
            >
              <LucideIcon name="X" />
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {isUpdating && (
          <div className={styles.loadingIndicator}>
            <LucideIcon name="Loader" />
            <span>Updating...</span>
          </div>
        )}

        {/* Fixture Selection */}
        <div className={styles.fixtureSection}>          <button 
            className={styles.fixtureSelector}
            onClick={() => setShowFixtureSelect(!showFixtureSelect)}
            title={`Selected: ${selectedFixtureName()}`}
          >
            <LucideIcon name="Target" />
            <span className={styles.fixtureName}>{selectedFixtureName()}</span>
            <div className={styles.selectorRight}>
              {selectedFixtures.length > 0 && (
                <span className={styles.selectionBadge}>{selectedFixtures.length}</span>
              )}
              <LucideIcon name={showFixtureSelect ? "ChevronUp" : "ChevronDown"} />
            </div>
          </button>
            {showFixtureSelect && (
            <div className={styles.fixtureDropdown}>
              {/* Search Bar */}
              <div className={styles.searchSection}>
                <div className={styles.searchContainer}>
                  <LucideIcon name="Search" />
                  <input
                    type="text"
                    placeholder="Search fixtures..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className={styles.clearSearch}
                    >
                      <LucideIcon name="X" />
                    </button>
                  )}
                </div>
              </div>

              {/* Selection Summary */}
              {selectedFixtures.length > 0 && (
                <div className={styles.selectionSummary}>
                  <div className={styles.summaryText}>
                    <span>{selectedFixtures.length} of {filteredFixtures.length} selected</span>
                  </div>
                  <div className={styles.summaryActions}>
                    <button
                      onClick={deselectAll}
                      className={styles.summaryButton}
                      title="Clear selection"
                    >
                      <LucideIcon name="X" />
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Selection Controls */}
              <div className={styles.bulkControls}>
                <button
                  className={styles.bulkButton}
                  onClick={selectAll}
                  title="Select all visible fixtures"
                >
                  <LucideIcon name="CheckSquare" />
                  <span>All</span>
                </button>
                
                <button
                  className={styles.bulkButton}
                  onClick={invertSelection}
                  title="Invert selection"
                >
                  <LucideIcon name="RotateCcw" />
                  <span>Invert</span>
                </button>
                
                <button
                  className={styles.bulkButton}
                  onClick={() => setShowAdvancedSelection(!showAdvancedSelection)}
                  title="Advanced selection"
                >
                  <LucideIcon name="Filter" />
                  <span>Smart</span>
                </button>
                
                <button
                  className={styles.bulkButton}
                  onClick={() => setShowFlagPanel(!showFlagPanel)}
                  title="Flag management"
                >
                  <LucideIcon name="Tag" />
                  <span>Flags</span>
                </button>
              </div>

              {/* Advanced Selection Panel */}
              {showAdvancedSelection && (
                <div className={styles.advancedSelection}>
                  <div className={styles.selectionByType}>
                    <h4>Select by Type:</h4>
                    <div className={styles.typeButtons}>                      <button
                        onClick={() => selectByType('rgb')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Palette" />
                        RGB
                      </button>
                      <button
                        onClick={() => selectByType('movement')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Move" />
                        Movement
                      </button>
                      <button
                        onClick={() => selectByType('dimmer')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Sun" />
                        Dimmer
                      </button>
                      <button
                        onClick={() => selectByType('gobo')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Circle" />
                        GOBO
                      </button>
                      <button
                        onClick={() => selectByType('colorwheel')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Disc" />
                        Color Wheel
                      </button>
                      <button
                        onClick={() => selectByType('strobe')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Zap" />
                        Strobe
                      </button>
                      <button
                        onClick={() => selectByType('beam')}
                        className={styles.typeButton}
                      >
                        <LucideIcon name="Focus" />
                        Beam
                      </button>
                    </div>
                  </div>
                  <div className={styles.smartSelection}>
                    <button
                      onClick={selectSimilar}
                      disabled={selectedFixtures.length === 0}
                      className={styles.smartButton}
                    >
                      <LucideIcon name="Copy" />
                      Select Similar
                    </button>
                    <button
                      onClick={selectAllFlagged}
                      className={styles.smartButton}
                    >
                      <LucideIcon name="Flag" />
                      All Flagged
                    </button>
                  </div>
                </div>
              )}

              {/* Flag Management Panel */}
              {showFlagPanel && (
                <div className={styles.flagPanel}>
                  <div className={styles.flagCreation}>
                    <input
                      type="text"
                      placeholder="Flag name"
                      value={newFlagName}
                      onChange={(e) => setNewFlagName(e.target.value)}
                      className={styles.flagInput}
                    />
                    <input
                      type="color"
                      value={newFlagColor}
                      onChange={(e) => setNewFlagColor(e.target.value)}
                      className={styles.colorInput}
                    />
                    <input
                      type="text"
                      placeholder="Category (optional)"
                      value={newFlagCategory}
                      onChange={(e) => setNewFlagCategory(e.target.value)}
                      className={styles.flagInput}
                    />
                    <button
                      onClick={createAndApplyFlag}
                      disabled={!newFlagName.trim() || selectedFixtures.length === 0}
                      className={styles.createFlagButton}
                    >
                      Create & Apply
                    </button>
                  </div>

                  {/* Quick Selection by Flag */}
                  {getAllUniqueFlags().length > 0 && (
                    <div className={styles.flagSelection}>
                      <h4>Select by Flag:</h4>
                      {getAllUniqueFlags().map(flag => (
                        <button
                          key={flag.id}
                          onClick={() => selectByFlag(flag.id)}
                          className={styles.flagButton}
                          style={{ backgroundColor: flag.color }}
                        >
                          {flag.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Selection by Category */}
                  {getAllUniqueCategories().length > 0 && (
                    <div className={styles.categorySelection}>
                      <h4>Select by Category:</h4>
                      {getAllUniqueCategories().map(category => (
                        <button
                          key={category}
                          onClick={() => selectByFlagCategory(category)}
                          className={styles.categoryButton}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Clear Flags */}
                  {selectedFixtures.length > 0 && (
                    <button
                      onClick={removeSelectedFixtureFlags}
                      className={styles.clearFlagsButton}
                    >
                      Clear Flags from Selected
                    </button>
                  )}
                </div>
              )}              {/* Fixture List with checkboxes */}
              <div className={styles.fixtureList}>
                {filteredFixtures.length === 0 ? (
                  <div className={styles.noResults}>
                    <LucideIcon name="Search" />
                    <span>No fixtures found</span>
                  </div>
                ) : (
                  filteredFixtures.map(fixture => {                    const isSelected = selectedFixtures.includes(fixture.id);
                    const hasRgb = fixture.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type));
                    const hasMovement = fixture.channels.some(ch => ['pan', 'tilt'].includes(ch.type));
                    const hasDimmer = fixture.channels.some(ch => ch.type === 'dimmer');
                    const hasGOBO = fixture.channels.some(ch => ch.type === 'gobo_wheel');
                    const hasColorWheel = fixture.channels.some(ch => ch.type === 'color_wheel');
                    const hasStrobe = fixture.channels.some(ch => ch.type === 'strobe');
                    const hasBeam = fixture.channels.some(ch => ['zoom', 'focus', 'iris'].includes(ch.type));
                    
                    // Generate channel function list for display
                    const channelFunctions = fixture.channels.map(ch => {
                      switch (ch.type) {
                        case 'red': case 'green': case 'blue': case 'white': case 'amber': case 'uv': 
                          return `${ch.type.toUpperCase()}`;
                        case 'pan': case 'tilt':
                          return `${ch.type.toUpperCase()}`;
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
                        case 'iris': return 'IRIS';
                        case 'speed': return 'SPEED';
                        case 'macro': return 'MACRO';
                        case 'effect': return 'FX';
                        // NEW: Additional professional channels
                        case 'frost': return 'FROST';
                        case 'animation': return 'ANIM';
                        case 'animation_speed': return 'ANIM-SPD';
                        case 'cto': return 'CTO';
                        case 'ctb': return 'CTB';
                        case 'reset': return 'RESET';
                        case 'lamp_control': return 'LAMP CTRL';
                        case 'fan_control': return 'FAN CTRL';
                        case 'display': return 'DISPLAY';
                        case 'function': return 'FUNC';
                        default: return ch.type.toUpperCase();
                      }
                    }).join(' | ');
                    
                    return (
                      <div
                        key={fixture.id}
                        className={`${styles.fixtureOption} ${isSelected ? styles.selected : ''}`}
                        onClick={() => {
                          setSelectedFixtures(prevSelected =>
                            prevSelected.includes(fixture.id)
                              ? prevSelected.filter(id => id !== fixture.id)
                              : [...prevSelected, fixture.id]
                          );
                        }}
                      >
                        <div className={styles.fixtureCheckbox}>
                          <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                            {isSelected && <LucideIcon name="Check" />}
                          </div>
                        </div>
                          <div className={styles.fixtureInfo}>
                          <div className={styles.fixtureName}>{fixture.name}</div>
                          <div className={styles.fixtureDetails}>
                            <div className={styles.fixtureCapabilities}>
                              {hasRgb && <span className={styles.capability} title="RGB Color"><LucideIcon name="Palette" /></span>}
                              {hasMovement && <span className={styles.capability} title="Pan/Tilt"><LucideIcon name="Move" /></span>}
                              {hasDimmer && <span className={styles.capability} title="Dimmer"><LucideIcon name="Sun" /></span>}
                              {hasGOBO && <span className={styles.capability} title="GOBO Wheel"><LucideIcon name="Circle" /></span>}
                              {hasColorWheel && <span className={styles.capability} title="Color Wheel"><LucideIcon name="Disc" /></span>}
                              {hasStrobe && <span className={styles.capability} title="Strobe"><LucideIcon name="Zap" /></span>}
                              {hasBeam && <span className={styles.capability} title="Beam Control"><LucideIcon name="Focus" /></span>}
                            </div>
                            <div className={styles.fixtureAddress}>Ch {fixture.startAddress}</div>
                          </div>
                          
                          {/* Channel Functions Display */}
                          <div className={styles.channelFunctions} title="Channel Functions">
                            {channelFunctions}
                          </div>
                          
                          {fixture.flags && fixture.flags.length > 0 && (
                            <div className={styles.flagIndicators}>
                              {fixture.flags.slice(0, 3).map(flag => (
                                <div
                                  key={flag.id}
                                  className={styles.flagIndicator}
                                  style={{ backgroundColor: flag.color }}
                                  title={flag.name}
                                />
                              ))}
                              {fixture.flags.length > 3 && (
                                <span className={styles.moreFlags}>+{fixture.flags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>        {selectedFixtures.length > 0 && (
          <div className={styles.controlsSection}>
            {/* Quick Actions */}
            <div className={styles.quickActions}>
              <button
                className={styles.quickActionButton}
                onClick={() => setShowQuickActions(!showQuickActions)}
                title="Quick Actions"
              >
                <LucideIcon name="Zap" />
                <span>Quick Actions</span>
                <LucideIcon name={showQuickActions ? "ChevronUp" : "ChevronDown"} />
              </button>
              
              {showQuickActions && (
                <div className={styles.quickActionsPanel}>
                  {hasRgbChannels && (
                    <div className={styles.colorPresets}>
                      <div className={styles.presetGrid}>
                        {colorPresets.map((preset, index) => (
                          <button
                            key={index}
                            className={styles.presetButton}
                            style={{
                              backgroundColor: `rgb(${preset.r}, ${preset.g}, ${preset.b})`,
                              border: `2px solid ${preset.r + preset.g + preset.b < 100 ? '#666' : 'transparent'}`
                            }}
                            onClick={() => applyColorPreset(preset)}
                            title={preset.name}
                          />
                        ))}
                      </div>
                      <div className={styles.colorQuickActions}>
                        <button
                          className={styles.actionButton}
                          onClick={randomizeColor}
                          title="Random Color"
                        >
                          <LucideIcon name="Shuffle" />
                          Random
                        </button>
                        {lastColorPreset && (
                          <button
                            className={styles.actionButton}
                            onClick={() => applyColorPreset(lastColorPreset)}
                            title="Restore Last Color"
                          >
                            <LucideIcon name="RotateCcw" />
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {hasMovementChannels && (
                    <div className={styles.movementQuickActions}>
                      <button
                        className={styles.actionButton}
                        onClick={centerMovement}
                        title="Center Position"
                      >
                        <LucideIcon name="Target" />
                        Center
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Color Control */}
            {hasRgbChannels && (
              <div className={styles.colorControl}>
                <div className={styles.controlLabel}>
                  <LucideIcon name="Palette" />
                  <span>Color</span>
                </div>
                <canvas
                  ref={colorCanvasRef}
                  width={200}
                  height={20}
                  className={styles.colorCanvas}
                  onClick={handleColorClick}
                />
              </div>
            )}

            {/* Movement Control */}
            {hasMovementChannels && (
              <div className={styles.movementControl}>
                <div className={styles.controlLabel}>
                  <LucideIcon name="Move" />
                  <span>Movement</span>
                </div>
                <canvas
                  ref={movementCanvasRef}
                  width={80}
                  height={80}
                  className={styles.movementCanvas}
                  onClick={handleMovementClick}
                />
              </div>
            )}            {/* Enhanced Controls - Color Wheel, Sliders, Movement Presets */}
            <div className={styles.enhancedControls}>
              {/* Control Mode Selector */}
              <div className={styles.controlMode}>
                {controlModes.map(mode => (
                  <button
                    key={mode.type}
                    onClick={() => setControlMode(mode.type)}
                    className={`${styles.modeButton} ${controlMode === mode.type ? styles.active : ''}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

                {/* Undo/Redo Controls */}
                <div className={styles.undoRedoControls}>
                  <button
                    className={styles.undoButton}
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    title="Undo (Ctrl+Z)"
                  >
                    <LucideIcon name="Undo2" />
                    Undo
                  </button>
                  <button
                    className={styles.redoButton}
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    title="Redo (Ctrl+Y)"
                  >
                    <LucideIcon name="Redo2" />
                    Redo
                  </button>
                </div>                {/* Toggle Controls for Advanced Features */}
                {controlMode === 'advanced' && (
                  <div className={styles.toggleControls}>
                    <button
                      className={`${styles.toggleButton} ${showColorWheel ? styles.active : ''}`}
                      onClick={() => setShowColorWheel(!showColorWheel)}
                      title="Toggle Color Wheel"
                    >
                      Color Wheel
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showRGBSliders ? styles.active : ''}`}
                      onClick={() => setShowRGBSliders(!showRGBSliders)}
                      title="Toggle RGB Sliders"
                    >
                      RGB Sliders
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showHSVControls ? styles.active : ''}`}
                      onClick={() => setShowHSVControls(!showHSVControls)}
                      title="Toggle HSV Controls"
                    >
                      HSV Controls
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showMovementPresets ? styles.active : ''}`}
                      onClick={() => setShowMovementPresets(!showMovementPresets)}
                      title="Toggle Movement Presets"
                    >
                      Movement Presets
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showPanTiltSliders ? styles.active : ''}`}
                      onClick={() => setShowPanTiltSliders(!showPanTiltSliders)}
                      title="Toggle Pan/Tilt Sliders"
                    >
                      Pan/Tilt Sliders
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showDimmerControls ? styles.active : ''}`}
                      onClick={() => setShowDimmerControls(!showDimmerControls)}
                      title="Toggle Dimmer & Strobe Controls"
                    >
                      Dimmer/Strobe
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showEffectControls ? styles.active : ''}`}
                      onClick={() => setShowEffectControls(!showEffectControls)}
                      title="Toggle Effect Controls"
                    >
                      GOBO/Color Wheel
                    </button>                    <button
                      className={`${styles.toggleButton} ${showBeamControls ? styles.active : ''}`}
                      onClick={() => setShowBeamControls(!showBeamControls)}
                      title="Toggle Beam Controls"
                    >
                      Beam/Focus
                    </button>
                    <button
                      className={`${styles.toggleButton} ${showProfessionalControls ? styles.active : ''}`}
                      onClick={() => setShowProfessionalControls(!showProfessionalControls)}
                      title="Toggle Professional Controls"
                    >
                      Pro/Special
                    </button>
                  </div>
                ) }

                {/* Color Wheel Control */}
                {controlMode === 'advanced' && showColorWheel && (
                  <div className={styles.colorWheelControl}>
                    <canvas
                      ref={colorWheelRef}
                      width={200}
                      height={200}
                      className={styles.colorWheel}
                      onClick={(e) => {
                        const rect = colorWheelRef.current?.getBoundingClientRect();
                        const x = e.clientX - (rect?.left || 0);
                        const y = e.clientY - (rect?.top || 0);
                        const radius = colorWheelRef.current?.width / 2;
                        const centerX = radius;
                        const centerY = radius;
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= radius) {
                          const hue = Math.atan2(dy, dx) * (180 / Math.PI) + 180;
                          const saturation = Math.min(100, (distance / radius) * 100);
                          
                          setHsvColor(prev => ({ ...prev, h: hue, s: saturation }));
                          
                          const rgb = hsvToRgb(hue, saturation, 100);
                          setColor(rgb);
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, rgb.r);
                            if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, rgb.g);
                            if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, rgb.b);
                          });
                        }
                      }}
                    />
                  </div>
                )}

                {/* RGB Sliders Control */}
                {controlMode === 'advanced' && showRGBSliders && (
                  <div className={styles.rgbSlidersControl}>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Red</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={color.r}
                        onChange={(e) => {
                          const newValue = Math.min(255, Math.max(0, parseInt(e.target.value)));
                          setColor(prev => ({ ...prev, r: newValue }));
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, newValue);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Green</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={color.g}
                        onChange={(e) => {
                          const newValue = Math.min(255, Math.max(0, parseInt(e.target.value)));
                          setColor(prev => ({ ...prev, g: newValue }));
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, newValue);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Blue</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={color.b}
                        onChange={(e) => {
                          const newValue = Math.min(255, Math.max(0, parseInt(e.target.value)));
                          setColor(prev => ({ ...prev, b: newValue }));
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, newValue);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                  </div>
                )}

                {/* HSV Controls */}
                {controlMode === 'advanced' && showHSVControls && (
                  <div className={styles.hsvControls}>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Hue</label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hsvColor.h}
                        onChange={(e) => {
                          const newValue = Math.min(360, Math.max(0, parseInt(e.target.value)));
                          setHsvColor(prev => ({ ...prev, h: newValue }));
                          
                          const rgb = hsvToRgb(newValue, hsvColor.s, hsvColor.v);
                          setColor(rgb);
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, rgb.r);
                            if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, rgb.g);
                            if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, rgb.b);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Saturation</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvColor.s}
                        onChange={(e) => {
                          const newValue = Math.min(100, Math.max(0, parseInt(e.target.value)));
                          setHsvColor(prev => ({ ...prev, s: newValue }));
                          
                          const rgb = hsvToRgb(hsvColor.h, newValue, hsvColor.v);
                          setColor(rgb);
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, rgb.r);
                            if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, rgb.g);
                            if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, rgb.b);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Value</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvColor.v}
                        onChange={(e) => {
                          const newValue = Math.min(100, Math.max(0, parseInt(e.target.value)));
                          setHsvColor(prev => ({ ...prev, v: newValue }));
                          
                          const rgb = hsvToRgb(hsvColor.h, hsvColor.s, newValue);
                          setColor(rgb);
                          
                          // Update all selected fixtures
                          selectedFixtures.forEach(fixtureId => {
                            const { rgbChannels } = getFixtureChannels(fixtureId);
                            if (rgbChannels.redChannel !== undefined) setDmxChannelValue(rgbChannels.redChannel, rgb.r);
                            if (rgbChannels.greenChannel !== undefined) setDmxChannelValue(rgbChannels.greenChannel, rgb.g);
                            if (rgbChannels.blueChannel !== undefined) setDmxChannelValue(rgbChannels.blueChannel, rgb.b);
                          });
                        }}
                        className={styles.slider}
                      />
                    </div>
                  </div>
                )}

                {/* Color Temperature Control */}
                {controlMode === 'advanced' && (
                  <div className={styles.colorTemperatureControl}>
                    <h4>Color Temperature</h4>
                    <div className={styles.temperatureSlider}>
                      <input
                        type="range"
                        min="2700"
                        max="8000"
                        value={colorTemperature}
                        onChange={(e) => {
                          const kelvin = parseInt(e.target.value);
                          applyColorTemperature(kelvin);
                        }}
                        className={styles.slider}
                      />
                    </div>
                    <div className={styles.temperatureValue}>
                      {colorTemperature}K
                    </div>
                  </div>
                )}

                {/* Lock Controls */}
                {controlMode === 'advanced' && (
                  <div className={styles.lockControls}>                    <label className={styles.lockToggle}>
                      <input
                        type="checkbox"
                        checked={lockValues.color}
                        onChange={(e) => setLockValues(prev => ({ ...prev, color: e.target.checked }))}
                      />
                      Lock Color
                    </label>                    <label className={styles.lockToggle}>
                      <input
                        type="checkbox"
                        checked={lockValues.movement}
                        onChange={(e) => setLockValues(prev => ({ ...prev, movement: e.target.checked }))}
                      />
                      Lock Movement
                    </label>
                    <label className={styles.lockToggle}>
                      <input
                        type="checkbox"
                        checked={smoothMovement}
                        onChange={(e) => setSmoothMovement(e.target.checked)}
                      />
                      Smooth Movement
                    </label>
                  </div>
                )}

                {/* Movement Presets */}
                {controlMode === 'advanced' && showMovementPresets && (
                  <div className={styles.movementPresets}>
                    <h4>Movement Presets</h4>
                    <div className={styles.presetButtons}>
                      {movementPresets.map(preset => (
                        <button
                          key={preset.name}
                          onClick={() => {
                            setMovement({ pan: preset.pan, tilt: preset.tilt });
                            
                            // Update all selected fixtures
                            selectedFixtures.forEach(fixtureId => {
                              const { movementChannels } = getFixtureChannels(fixtureId);
                              if (movementChannels.panChannel !== undefined) setDmxChannelValue(movementChannels.panChannel, preset.pan);
                              if (movementChannels.tiltChannel !== undefined) setDmxChannelValue(movementChannels.tiltChannel, preset.tilt);
                            });
                          }}
                          className={styles.presetButton}
                          title={preset.name}
                        >
                          <LucideIcon name={preset.icon} />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pan/Tilt Sliders */}
                {controlMode === 'advanced' && showPanTiltSliders && (
                  <div className={styles.movementSliders}>
                    <h4>Pan/Tilt Control</h4>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Pan</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={movement.pan}
                        onChange={(e) => {
                          const newPan = parseInt(e.target.value);
                          if (!lockValues.movement) {
                            setMovement(prev => ({ ...prev, pan: newPan }));
                            
                            selectedFixtures.forEach(fixtureId => {
                              const { movementChannels } = getFixtureChannels(fixtureId);
                              if (movementChannels.panChannel !== undefined) {
                                setDmxChannelValue(movementChannels.panChannel, newPan);
                              }
                            });
                          }
                        }}
                        className={styles.slider}
                      />
                      <span className={styles.value}>{movement.pan}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Tilt</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={movement.tilt}
                        onChange={(e) => {
                          const newTilt = parseInt(e.target.value);
                          if (!lockValues.movement) {
                            setMovement(prev => ({ ...prev, tilt: newTilt }));
                            
                            selectedFixtures.forEach(fixtureId => {
                              const { movementChannels } = getFixtureChannels(fixtureId);
                              if (movementChannels.tiltChannel !== undefined) {
                                setDmxChannelValue(movementChannels.tiltChannel, newTilt);
                              }
                            });
                          }
                        }}
                        className={styles.slider}
                      />
                      <span className={styles.value}>{movement.tilt}</span>
                    </div>
                    {smoothMovement && (
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Speed</label>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={movementSpeed}
                          onChange={(e) => setMovementSpeed(parseInt(e.target.value))}
                          className={styles.slider}
                        />
                        <span className={styles.value}>{movementSpeed}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dimmer and Strobe Controls */}
                {controlMode === 'advanced' && showDimmerControls && (
                  <div className={styles.dimmerControls}>
                    <h4>Dimmer & Strobe</h4>                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Master Dimmer</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.dimmer}
                        onChange={(e) => applyAdvancedControl('dimmer', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.dimmer}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Shutter</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.shutter}
                        onChange={(e) => applyAdvancedControl('shutter', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.shutter}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Strobe Rate</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.strobe}
                        onChange={(e) => applyAdvancedControl('strobe', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.strobe}</span>
                    </div>
                    <div className={styles.quickStrobeActions}>
                      <button className={styles.actionButton} onClick={shutterOpen} disabled={selectedFixtures.length === 0}>Open</button>
                      <button className={styles.actionButton} onClick={shutterClose} disabled={selectedFixtures.length === 0}>Close</button>
                      <button className={styles.actionButton} onClick={strobeStart} disabled={selectedFixtures.length === 0}>Strobe</button>
                      <button className={styles.actionButton} onClick={strobeStop} disabled={selectedFixtures.length === 0}>Stop</button>
                    </div>
                  </div>
                )}

                {/* GOBO and Color Wheel Controls */}
                {controlMode === 'advanced' && showEffectControls && (
                  <div className={styles.effectControls}>
                    <h4>GOBO & Color Wheel</h4>
                    <div className={styles.goboSection}>
                      <label className={styles.sectionLabel}>GOBO Wheel</label>                      <div className={styles.presetButtons}>
                        {goboPresets.map(preset => (
                          <button
                            key={preset.name}
                            onClick={() => applyGOBOPreset(preset)}
                            className={styles.presetButton}
                            title={preset.name}
                            disabled={selectedFixtures.length === 0}
                          >
                            <LucideIcon name={preset.icon as keyof typeof import('lucide-react')} />
                            {preset.name}
                          </button>
                        ))}
                      </div><div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>GOBO Position</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.goboWheel}
                          onChange={(e) => applyAdvancedControl('goboWheel', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.goboWheel}</span>
                      </div>
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>GOBO Rotation</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.goboRotation}
                          onChange={(e) => applyAdvancedControl('goboRotation', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.goboRotation}</span>
                      </div>
                    </div>
                    
                    <div className={styles.colorWheelSection}>
                      <label className={styles.sectionLabel}>Color Wheel</label>                      <div className={styles.presetButtons}>
                        {colorWheelPresets.map(preset => (
                          <button
                            key={preset.name}
                            onClick={() => applyColorWheelPreset(preset)}
                            className={styles.presetButton}
                            style={{ backgroundColor: preset.color }}
                            title={preset.name}
                            disabled={selectedFixtures.length === 0}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div><div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Color Position</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.colorWheel}
                          onChange={(e) => applyAdvancedControl('colorWheel', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.colorWheel}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Beam Controls (Zoom, Focus, Iris, Prism) */}
                {controlMode === 'advanced' && showBeamControls && (
                  <div className={styles.beamControls}>
                    <h4>Beam Controls</h4>                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Zoom</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.zoom}
                        onChange={(e) => applyAdvancedControl('zoom', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.zoom}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Focus</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.focus}
                        onChange={(e) => applyAdvancedControl('focus', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.focus}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Iris</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.iris}
                        onChange={(e) => applyAdvancedControl('iris', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.iris}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Prism</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.prism}
                        onChange={(e) => applyAdvancedControl('prism', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.prism}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Speed</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.speed}
                        onChange={(e) => applyAdvancedControl('speed', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.speed}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Macro</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.macro}
                        onChange={(e) => applyAdvancedControl('macro', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.macro}</span>
                    </div>
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Effect</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.effect}
                        onChange={(e) => applyAdvancedControl('effect', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.effect}</span>
                    </div>
                  </div>                )}                {/* Professional Controls (Frost, Animation, CTO/CTB, etc.) */}
                {controlMode === 'advanced' && showProfessionalControls && (
                  <div className={styles.professionalControls}>
                    <h4>Professional Controls</h4>
                    <p className={styles.controlsNote}>
                      {selectedFixtures.length === 0 
                        ? 'Select fixtures to control professional features'
                        : `Controlling ${selectedFixtures.length} fixture(s)`
                      }
                    </p>
                      {/* Frost/Diffusion */}
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Frost/Diffusion</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.frost}
                        onChange={(e) => applyAdvancedControl('frost', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.frost}</span>
                    </div>

                    {/* Animation Controls */}
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Animation</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.animation}
                        onChange={(e) => applyAdvancedControl('animation', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.animation}</span>
                    </div>

                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>Animation Speed</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.animationSpeed}
                        onChange={(e) => applyAdvancedControl('animationSpeed', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.animationSpeed}</span>
                    </div>

                    {/* Color Temperature Controls */}
                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>CTO (Color Temp Orange)</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.cto}
                        onChange={(e) => applyAdvancedControl('cto', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.cto}</span>
                    </div>

                    <div className={styles.sliderGroup}>
                      <label className={styles.sliderLabel}>CTB (Color Temp Blue)</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={advancedControls.ctb}
                        onChange={(e) => applyAdvancedControl('ctb', parseInt(e.target.value))}
                        className={styles.slider}
                        disabled={selectedFixtures.length === 0}
                      />
                      <span className={styles.value}>{advancedControls.ctb}</span>
                    </div>

                    {/* Fixture Control Functions */}
                    <div className={styles.functionControls}>
                      <h5>Fixture Functions</h5>                      <div className={styles.functionButtons}>
                        <button
                          className={styles.functionButton}
                          onClick={() => applyAdvancedControl('reset', 255)}
                          onMouseUp={() => setTimeout(() => applyAdvancedControl('reset', 0), 100)}
                          title="Send Reset Command to Fixture"
                          disabled={selectedFixtures.length === 0}
                        >
                          <LucideIcon name="RotateCcw" />
                          Reset
                        </button>
                        <button
                          className={`${styles.functionButton} ${advancedControls.lampControl > 127 ? styles.active : ''}`}
                          onClick={() => applyAdvancedControl('lampControl', advancedControls.lampControl > 127 ? 0 : 255)}
                          title="Toggle Lamp On/Off"
                          disabled={selectedFixtures.length === 0}
                        >
                          <LucideIcon name="Lightbulb" />
                          Lamp {advancedControls.lampControl > 127 ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      
                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Fan Control</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.fanControl}
                          onChange={(e) => applyAdvancedControl('fanControl', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.fanControl}</span>
                      </div>

                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Display Brightness</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.display}
                          onChange={(e) => applyAdvancedControl('display', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.display}</span>
                      </div>

                      <div className={styles.sliderGroup}>
                        <label className={styles.sliderLabel}>Function Channel</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={advancedControls.function}
                          onChange={(e) => applyAdvancedControl('function', parseInt(e.target.value))}
                          className={styles.slider}
                          disabled={selectedFixtures.length === 0}
                        />
                        <span className={styles.value}>{advancedControls.function}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Mode Controls */}
                {controlMode === 'performance' && (
                  <div className={styles.performanceControls}>
                    <h4>Performance Mode</h4>
                    <div className={styles.quickActions}>
                      <button
                        className={styles.actionButton}
                        onClick={randomizeColor}
                        title="Random Color (Ctrl+R)"
                      >
                        <LucideIcon name="Shuffle" />
                        Random Color
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={centerMovement}
                        title="Center Position (Ctrl+C)"
                      >
                        <LucideIcon name="Target" />
                        Center
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => applyColorPreset({ r: 0, g: 0, b: 0 })}
                        title="Blackout (0)"
                      >
                        <LucideIcon name="Power" />
                        Blackout
                      </button>
                    </div>                  </div>
                )}
              </div>
          </div>
        )}
      </div>
    </DockableComponent>
  );
};

export default ChromaticEnergyManipulatorMini;
