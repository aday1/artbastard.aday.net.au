import React from 'react';
import { DmxControlPanel } from '../dmx/DmxControlPanel';
import { MasterFader } from '../dmx/MasterFader';
import { DmxWebglVisualizer } from '../dmx/DmxWebglVisualizer';
// Removed DMXChannelGrid and TouchDmxChannelGrid components
import { MidiMonitor } from '../midi/MidiMonitor';
import { OscMonitor } from '../osc/OscMonitor';
import { SceneQuickLaunch } from '../scenes/SceneQuickLaunch';
import { AutoSceneControlMini } from '../scenes/AutoSceneControlMini';
import DockableSuperControl from '../fixtures/DockableSuperControl';
import TouchSuperControl from '../fixtures/TouchSuperControl';

// Removed TouchDmxChannelGrid, AudioControlPanel, and TouchOSCDemo imports
import { SceneGallery } from '../scenes/SceneGallery';
import { FixtureSetup } from '../fixtures/FixtureSetup';
import { MidiOscSetup } from '../midi/MidiOscSetup';
import { ClipLauncher } from '../clipLauncher/ClipLauncher';
import { Stage3DVisualizer, DmxWaveformViewer, ColorTemperatureVisualizer } from '../visualization';
// Lazy import Dashboard to avoid circular dependency
// Dashboard imports ComponentToolbar which imports ComponentRegistry
// Create a wrapper component that lazy loads Dashboard
const DashboardWrapper: React.FC<any> = (props) => {
  const [Dashboard, setDashboard] = React.useState<React.ComponentType<any> | null>(null);

  React.useEffect(() => {
    // Dynamic import to break circular dependency
    import('../dashboard/Dashboard').then(module => {
      setDashboard(() => module.default || module.Dashboard);
    });
  }, []);

  if (!Dashboard) {
    return <div>Loading...</div>;
  }

  return <Dashboard {...props} />;
};

export interface ComponentDefinition {
  type: string;
  title: string;
  description: string;
  category: 'dmx' | 'midi' | 'osc' | 'scenes' | 'fixtures' | 'audio' | 'setup';
  icon: string;
  component: React.ComponentType<any>;
  defaultProps?: Record<string, any>;
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
}

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // Core DMX Controls - Most Important
  'master-fader': {
    type: 'master-fader',
    title: 'Master Slider',
    description: 'Global brightness control',
    category: 'dmx',
    icon: 'fas fa-sun',
    component: MasterFader,
    defaultProps: { isDockable: false },
    minSize: { width: 200, height: 100 },
  }, 'dmx-control-panel': {
    type: 'dmx-control-panel',
    title: 'DMX Control Panel',
    description: 'Main DMX channel controls and faders',
    category: 'dmx',
    icon: 'fas fa-sliders-h',
    component: DmxControlPanel,
    minSize: { width: 400, height: 300 },
  },
  // Removed 'dmx-channels' component - use DMX Control Panel instead
  'dmx-visualizer': {
    type: 'dmx-visualizer',
    title: 'DMX Visual Display',
    description: 'Real-time DMX data visualization',
    category: 'dmx',
    icon: 'fas fa-eye',
    component: DmxWebglVisualizer,
    minSize: { width: 400, height: 300 },
  },
  'stage-3d-visualizer': {
    type: 'stage-3d-visualizer',
    title: '3D Stage Visualizer',
    description: 'Interactive 3D visualization of all fixtures on stage',
    category: 'dmx',
    icon: 'fas fa-cube',
    component: Stage3DVisualizer,
    minSize: { width: 600, height: 400 },
  },
  'dmx-waveform-viewer': {
    type: 'dmx-waveform-viewer',
    title: 'DMX Waveform Viewer',
    description: 'Real-time waveform visualization of DMX channel values',
    category: 'dmx',
    icon: 'fas fa-wave-square',
    component: DmxWaveformViewer,
    minSize: { width: 600, height: 300 },
  },
  'color-temperature-visualizer': {
    type: 'color-temperature-visualizer',
    title: 'Color Temperature Analyzer',
    description: 'Analyze and visualize color temperature of RGB fixtures',
    category: 'dmx',
    icon: 'fas fa-thermometer-half',
    component: ColorTemperatureVisualizer,
    minSize: { width: 500, height: 400 },
  },

  // Scene Controls
  'scene-quick-launch': {
    type: 'scene-quick-launch',
    title: 'Scene Control',
    description: 'Quick access to saved scenes',
    category: 'scenes',
    icon: 'fas fa-play',
    component: SceneQuickLaunch,
    defaultProps: { isDockable: false },
    minSize: { width: 200, height: 150 },
  },
  'auto-scene-control': {
    type: 'auto-scene-control',
    title: 'Auto Scene Control',
    description: 'Automatic scene transitions',
    category: 'scenes',
    icon: 'fas fa-magic',
    component: AutoSceneControlMini,
    defaultProps: { isDockable: false },
    minSize: { width: 250, height: 200 },
  },
  'scene-gallery': {
    type: 'scene-gallery',
    title: 'Scene Gallery',
    description: 'Browse and manage scenes',
    category: 'scenes',
    icon: 'fas fa-images',
    component: SceneGallery,
    minSize: { width: 400, height: 300 },
  },
  'clip-launcher': {
    type: 'clip-launcher',
    title: 'Clip Launcher',
    description: 'DAW-style scene launcher for live performance',
    category: 'scenes',
    icon: 'fas fa-th',
    component: ClipLauncher,
    minSize: { width: 600, height: 400 },
  },  // Fixture Controls
  'professional-fixture-controller': {
    type: 'professional-fixture-controller',
    title: 'Super Control',
    description: 'Advanced fixture control with channel monitoring, color wheels, XY controls, and real-time DMX feedback',
    category: 'fixtures',
    icon: 'fas fa-palette',
    component: DockableSuperControl,
    defaultProps: { isDockable: true },
    minSize: { width: 800, height: 600 },
  },
  'touch-fixture-controller': {
    type: 'touch-fixture-controller',
    title: 'Touch Super Control',
    description: 'Touch-optimized fixture control with haptic feedback and large controls for touch screens',
    category: 'fixtures',
    icon: 'fas fa-hand-pointer',
    component: TouchSuperControl,
    defaultProps: { isFullscreen: false, enableHapticFeedback: true },
    minSize: { width: 600, height: 800 },
  },
  'fixture-setup': {
    type: 'fixture-setup',
    title: 'Fixture Setup',
    description: 'Configure lighting fixtures',
    category: 'fixtures',
    icon: 'fas fa-lightbulb',
    component: FixtureSetup,
    minSize: { width: 500, height: 400 },
  },

  // Monitoring & Audio
  'midi-monitor': {
    type: 'midi-monitor',
    title: 'MIDI Monitor',
    description: 'Monitor incoming MIDI messages',
    category: 'midi',
    icon: 'fas fa-music',
    component: MidiMonitor,
    minSize: { width: 300, height: 200 },
  },
  'osc-monitor': {
    type: 'osc-monitor',
    title: 'OSC Monitor',
    description: 'Monitor OSC messages',
    category: 'osc',
    icon: 'fas fa-broadcast-tower',
    component: OscMonitor,
    minSize: { width: 300, height: 200 },
  },
  // Setup
  'midi-osc-setup': {
    type: 'midi-osc-setup',
    title: 'MIDI/OSC Setup',
    description: 'Configure MIDI and OSC connections',
    category: 'setup',
    icon: 'fas fa-cog',
    component: MidiOscSetup,
    minSize: { width: 400, height: 350 },
  },

  // External Console - External Window Component
  'dashboard': {
    type: 'dashboard',
    title: 'External Console',
    description: 'Component workspace and layout manager - Opens in new window (perfect for tablets and 2nd monitors)',
    category: 'setup',
    icon: 'fas fa-external-link-alt',
    component: DashboardWrapper, // Wrapper that lazy loads Dashboard to break circular dependency
    minSize: { width: 800, height: 600 },
    defaultProps: {},
  },
};

export const getComponentsByCategory = (category: ComponentDefinition['category']): ComponentDefinition[] => {
  return Object.values(COMPONENT_REGISTRY).filter(comp => comp.category === category);
};

export const getAllCategories = (): ComponentDefinition['category'][] => {
  return ['dmx', 'midi', 'osc', 'scenes', 'fixtures', 'audio', 'setup'];
};

export const renderComponent = (type: string, props: Record<string, any> = {}): React.ReactElement | null => {
  const definition = COMPONENT_REGISTRY[type];
  if (!definition) {
    console.warn(`Unknown component type: ${type}`);
    return null;
  }

  let Component = definition.component;

  const finalProps = { ...definition.defaultProps, ...props };

  return <Component {...finalProps} />;
};
