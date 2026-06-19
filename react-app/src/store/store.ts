import { create, StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import axios from 'axios'
import { Socket } from 'socket.io-client'
import { TimelineSequence, interpolateValue, initialTimelineSequences } from './timeline'
import { AutomationState } from './slices/automationSlice'
import {
  computeEnvelopeProgress,
  computeEnvelopeProgressDetailed,
  envelopeModulationToDmx,
  resetEnvelopeSmoothing,
  resolveEnvelopeProgress,
  sampleWaveformValue,
  smoothEnvelopeDmxValue,
} from '../utils/envelopeEngine'
import { normalizeChannelEnvelope } from '../utils/envelopeDefaults'
import { samplePanTiltPath } from '../utils/panTiltPath'
import {
  applyThemeColorsToDocument,
  applyRackChrome,
  getPresetById,
  DEFAULT_THEME_COLORS,
  getModeAwarePreset,
  applyModeAwarePreset,
  applyThemePreset,
} from '../utils/themeUtils'
import type { ThemeColorsHsl } from '../utils/themeUtils'
import type { ChannelEnvelope } from './types'
import { ensureGroupsSync } from './groupIds'
import type { FixtureDipSwitchAddressing } from '../fixtures/library'
import {
  mergeFixtureTemplatesWithCatalog,
  refreshFixtureCatalogPhotos,
} from './fixtureCatalogSync'
import {
  createTransitionTrackerSlice,
  type TransitionTrackerSlice,
} from './transitionTrackerSlice'
import { sceneNameToOscPath } from '../utils/sceneCapture'
import { debugLog } from '../utils/debugLog'
import {
  dispatchSceneTransitionComplete,
  isClientSceneTransitionActive,
  sceneTimelineStartDelayMs,
} from '../utils/sceneTransitionGuard'
import { shouldUseTouchOptimizedChrome } from '../utils/deviceSurface'
import {
  generateSeededSceneList,
  captureSelectionToApcSlot as buildCaptureSelectionScene,
  type SceneSeedOptions,
  type SceneSeedSummary,
} from '../scenes/sceneSeedGenerator'
import {
  generateSeededActList,
  type ActSeedOptions,
  type ActSeedSummary,
} from '../acts/actSeedGenerator'
import {
  getTemplateById,
  type SuperControlBinding,
} from '../components/midi/midiControllerTemplates'
import {
  enqueueDmxBackendChannel,
  enqueueDmxBackendUpdates,
} from './dmxBackendQueue'
import {
  applyStrobeSafetyToDmxValues,
  strobeSafetyUpdates,
  strobeSafetyValueForChannel,
} from '../utils/strobeSafety'
import {
  dimmerFadeLevel,
  dimmerFadeUpdates,
  type DimmerFadeWaveform,
} from '../utils/dimmerFade'
import {
  APC40_GRID_SLOT_COUNT,
  apc40DeckSceneName,
  channelMatchesRoleAliases,
  fixtureDmxAddress,
  type Apc40Deck,
} from '../midi/apc40WorkflowHelpers'

export interface MidiMapping {
  channel: number
  note?: number
  controller?: number
  pitch?: boolean
}

export type MidiClockInputStatus = 'none' | 'selected' | 'listening' | 'receiving';

export interface Fixture {
  id: string
  name: string
  type: string
  manufacturer?: string
  model?: string
  mode?: string
  /** ID of the library template/entry this fixture was created from. Optional for backwards-compat. */
  templateId?: string
  startAddress: number
  channels: { name: string; type: string; dmxAddress?: number; ranges?: Array<{ min: number; max: number; description: string }>; ticksOnly?: boolean }[]
  notes?: string // Notes section for fixture documentation
  // Flagging system for organizing fixtures
  flags?: FixtureFlag[]
  isFlagged?: boolean
  photoUrl?: string // URL or data URL for fixture photo thumbnail
  isFavorite?: boolean // Favorite status for quick access
  tags?: string[] // Group identifiers: WASH, RGB, LED, LASER, MOVING HEAD, etc.
}

export interface SuperControlExternalUpdate {
  controlName: string
  value: number
  at: number
  slotIndex?: number
}

export interface FixtureFlag {
  id: string
  name: string
  color: string
  priority?: number // Higher numbers = higher priority
  category?: string // Optional grouping
}

export interface FixtureTemplate {
  id: string
  templateName: string
  defaultNamePrefix: string
  channels?: Array<{ name: string; type: string; ticksOnly?: boolean }> // For backward compatibility
  modes?: Array<{
    name: string;
    channels: number;
    channelData: Array<{ name: string; type: string; ranges?: Array<{ min: number; max: number; description: string }>; ticksOnly?: boolean }>;
  }>;
  type?: string; // Fixture type (RGB Wash, Mover, Laser, etc.)
  manufacturer?: string; // Manufacturer name (e.g., "uKing")
  model?: string;
  modelConfidence?: 'confirmed' | 'probable' | 'unknown';
  catalogId?: string;
  category?: string;
  documentationPath?: string;
  notes?: string;
  addressing?: FixtureDipSwitchAddressing;
  isBuiltIn?: boolean // Legacy compatibility flag for protected catalog profiles
  isCustom?: boolean // Custom profiles can be edited/deleted
  isFavorite?: boolean // Favorite profiles for quick access
  createdAt?: number
  updatedAt?: number
  photoUrl?: string // URL or data URL for fixture template photo thumbnail
  tags?: string[] // Group identifiers: WASH, RGB, LED, LASER, MOVING HEAD, etc.
}

export interface Group {
  id: string;
  name: string;
  fixtureIndices: number[];
  // New fields for enhanced functionality
  lastStates: number[]; // Last known DMX values for each fixture in the group
  position?: { x: number; y: number }; // Position on 2D canvas
  isMuted: boolean;
  isSolo: boolean;
  masterValue: number; // Current master value (0-255)
  midiMapping?: MidiMapping;
  oscAddress?: string;
  ignoreSceneChanges?: boolean; // Whether this group ignores scene changes
  ignoreMasterFader?: boolean;
  panOffset?: number;
  tiltOffset?: number;
  zoomValue?: number;
}

export interface Apc40LastChange {
  at: number;
  category: 'fixture' | 'scene' | 'device' | 'effect' | 'selection' | 'transport';
  controlLabel: string;
  summary: string;
  detail?: string;
  fixtureNames?: string[];
  groupNames?: string[];
  sceneName?: string;
  actName?: string;
  roleLabel?: string;
  value?: number;
}

export interface AutopilotConfig {
  enabled: boolean;
  type: 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth';
  speed: number; // BPM multiplier (0.1 to 10)
  range: { min: number; max: number }; // DMX value range
  syncToBPM: boolean;
  phase: number; // Phase offset in degrees (0-360)
  repeatMode?: import('./types').EnvelopeRepeatMode;
  loopDirection?: import('./types').EnvelopeLoopDirection;
}

export interface ColorSliderAutopilotConfig {
  enabled: boolean;
  type: 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth';
  speed: number; // BPM multiplier (0.1 to 1.0)
  range: { min: number; max: number }; // Hue range (0-360)
  syncToBPM: boolean;
  phase: number; // Phase offset in degrees (0-360)
  repeatMode?: import('./types').EnvelopeRepeatMode;
  loopDirection?: import('./types').EnvelopeLoopDirection;
}

export interface PanTiltAutopilotConfig {
  enabled: boolean;
  pathType: 'circle' | 'figure8' | 'square' | 'triangle' | 'linear' | 'custom';
  size: number; // 0-100 percentage
  speed: number; // BPM multiplier
  centerX: number; // 0-255 DMX value
  centerY: number; // 0-255 DMX value
  syncToBPM: boolean;
  phase: number; // Phase offset in radians for internal animation
  customPath?: Array<{ x: number; y: number }>;
  smoothing?: number; // 0 = straight point-to-point, 1 = soft curved path
  repeatMode?: import('./types').EnvelopeRepeatMode;
  loopDirection?: import('./types').EnvelopeLoopDirection;
}

// New Modular Automation System Interfaces
export interface ColorAutomationConfig {
  enabled: boolean;
  type: 'rainbow' | 'pulse' | 'strobe' | 'cycle' | 'breathe' | 'wave' | 'random';
  speed: number; // BPM multiplier (0.1 to 10)
  colors?: Array<{ r: number; g: number; b: number; w?: number }>; // For cycle mode
  intensity: number; // 0-100 percentage
  syncToBPM: boolean;
  hueRange?: { start: number; end: number }; // For rainbow mode (0-360)
  saturation?: number; // 0-100 for rainbow/wave modes
  brightness?: number; // 0-100 base brightness
  phase?: number; // Phase offset in degrees for wave patterns
}

export interface DimmerAutomationConfig {
  enabled: boolean;
  type: 'pulse' | 'breathe' | 'strobe' | 'ramp' | 'random' | 'chase';
  speed: number; // BPM multiplier
  range: { min: number; max: number }; // DMX value range (0-255)
  syncToBPM: boolean;
  pattern?: 'smooth' | 'sharp' | 'exponential'; // Curve type
  phase?: number; // Phase offset for multiple fixtures
}

export interface EffectsAutomationConfig {
  enabled: boolean;
  type: 'gobo_cycle' | 'prism_rotate' | 'iris_breathe' | 'zoom_bounce' | 'focus_sweep';
  speed: number; // BPM multiplier
  range?: { min: number; max: number }; // Value range for applicable effects
  syncToBPM: boolean;
  direction?: 'forward' | 'reverse' | 'ping-pong';
}

export interface ModularAutomationState {
  color: ColorAutomationConfig;
  dimmer: DimmerAutomationConfig;
  panTilt: PanTiltAutopilotConfig;
  effects: EffectsAutomationConfig;
  // Animation control
  animationIds: {
    color: number | null;
    dimmer: number | null;
    panTilt: number | null;
    effects: number | null;
  };
}

// Envelope Automation System
export type {
  WaveformType,
  EnvelopePoint,
  EnvelopeRepeatMode,
  EnvelopeLoopDirection,
  ChannelEnvelope,
} from './types';

export type { EnvelopeAutomationState } from './types';
export type {
  TransitionEasing,
  TransitionPattern,
  TransitionPatternLine,
  TransitionPatternFx,
  TransitionTrackerPlaybackState,
  PendingSceneTransitionOverride,
} from './types';

export interface SceneTimelineKeyframe {
  id: string;
  time: number; // Time in milliseconds from scene start
  channelValues: Record<number, number>; // Channel index -> value mapping
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'smooth' | 'step';
  // Bezier curve control points (normalized 0-1)
  bezierControl1?: { x: number; y: number };
  bezierControl2?: { x: number; y: number };
}

export interface SceneTimeline {
  enabled: boolean;
  duration: number; // Total timeline duration in milliseconds
  loop: boolean; // Whether to loop the timeline
  keyframes: SceneTimelineKeyframe[];
  // DAW-like playback controls
  playbackMode?: 'loop' | 'pingpong' | 'forward' | 'backward' | 'once';
  playbackSpeed?: number; // 0.1 to 4.0 (1.0 = normal speed)
  syncToBpm?: boolean; // Sync timeline to BPM
  bpmMultiplier?: number; // How many beats per timeline duration (e.g., 4 = 4 beats)
  audioTrack?: {
    url: string; // URL or data URL of audio file
    name: string;
    waveform?: number[]; // Pre-computed waveform data for visualization
  };
  // Channel lane controls (mute/solo)
  channelLanes?: Record<number, {
    muted: boolean;
    soloed: boolean;
  }>;
  // Enabled channels (channels that should be shown even if they don't have keyframes)
  enabledChannels?: number[];
  // Timeline markers/cues for navigation
  markers?: TimelineMarker[];
}

export interface TimelineMarker {
  id: string;
  time: number; // Time in milliseconds
  name: string; // Marker label/name
  color?: string; // Optional color for visual distinction
}

export interface Scene {
  name: string
  channelValues: number[]
  oscAddress: string
  midiMapping?: MidiMapping
  autopilots?: { [channelIndex: number]: AutopilotConfig };
  panTiltAutopilot?: PanTiltAutopilotConfig;
  // New: Modular Automation States for Scenes
  modularAutomation?: ModularAutomationState;
  // New: Optional timeline for animated scenes
  timeline?: SceneTimeline;
  seed?: {
    generatedBy: 'artbastard-scene-seeder';
    generatorVersion: number;
    packId: 'compact-starter' | 'smart-starter-40' | 'smart-ab-80';
    templateId: string;
    deck: 'A' | 'B';
    slot: number;
    label: string;
    automated: boolean;
  };
}

export interface ArtNetConfig {
  ip: string
  subnet: number
  universe: number
  net: number
  port: number
  base_refresh_interval: number
}

export interface OscConfig {
  host: string
  port: number
  sendEnabled: boolean
  sendHost: string
  sendPort: number
}

export interface OscActivity {
  value: number // Float value 0.0 to 1.0
  timestamp: number // Timestamp of the last message
}

// Define OscMessage interface
export interface OscMessage {
  address: string;
  args: Array<{ type: string; value: unknown }>;

  // Optional: if source information is available
  source?: string;
  // Optional: for ordering or display
  timestamp?: number;
}

// Define PlacedFixture type for 2D canvas layout
export interface PlacedFixture {
  id: string;
  fixtureId: string;
  fixtureStoreId: string;
  name: string;
  type: string; // Fixture type (spotlight, wash, beam, etc.)
  x: number;
  y: number;
  rotation?: number;
  color: string;
  radius: number;
  scale?: number; // Scale for 2D canvas display
  startAddress: number; // DMX start address for this fixture
  dmxAddress: number; // Alias for startAddress for compatibility
  controls?: PlacedControl[]; // Optional array for controls associated with this fixture
}

// Definition for PlacedControl on the 2D canvas, associated with a PlacedFixture
export interface PlacedControl {
  id: string;                     // Unique ID for this control instance
  channelNameInFixture: string; // Name of the channel within the fixture's definition (e.g., "Dimmer", "Pan")
  type: 'slider' | 'xypad';       // Control type: slider for single channel, xypad for pan/tilt combined
  label: string;                  // Display label for the control (e.g., could be same as channelNameInFixture or custom)
  xOffset: number;                // X position relative to the fixture icon's center
  yOffset: number;                // Y position relative to the fixture icon's center
  currentValue: number;           // Current value of this control (0-255), for sliders only
  orientation?: 'horizontal' | 'vertical'; // Slider orientation (optional)
  // XY Pad specific fields
  panValue?: number;              // Pan value (0-255) for xypad controls
  tiltValue?: number;             // Tilt value (0-255) for xypad controls
  panChannelName?: string;        // Name of the pan channel (e.g., "Pan")
  tiltChannelName?: string;       // Name of the tilt channel (e.g., "Tilt")
}

// Define MasterSlider related types
export interface MasterSliderTarget {
  placedFixtureId: string;        // ID of the PlacedFixture instance on the canvas
  channelIndex: number;           // Index of the channel within that fixture's definition (0-based)
  channelNameInFixture: string;   // Name of the channel (e.g., "Dimmer", "Pan") for display and easier association
  minRange: number;               // Min value for the target channel (e.g., 0)
  maxRange: number;               // Max value for the target channel (e.g., 255)
}

export interface MasterSlider {
  id: string;
  name: string;
  value: number; // Current value (0-255, or 0-1, let's use 0-255 for consistency with DMX)
  targets: MasterSliderTarget[];
  position: { x: number; y: number }; // Position on the 2D canvas
  orientation: 'horizontal' | 'vertical'; // Slider orientation
  midiMapping?: MidiMapping; // Re-use existing MidiMapping type
}

// Notification type definition (used in State and actions)
export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  priority?: 'low' | 'normal' | 'high';
  persistent?: boolean;
  dismissible?: boolean;
  timestamp: number;
}

// Input type for addNotification action
export type AddNotificationInput = Omit<Notification, 'id' | 'timestamp'>;

// Type for batch DMX channel updates
export type DmxChannelBatchUpdate = Record<number, number>;

// ACTS (Automated Scene Transition Sequences) interfaces
export interface ActStep {
  id: string;
  sceneName: string;
  duration: number; // Duration in milliseconds
  /** Absolute start time on the act timeline (ms). Omit to pack after the previous clip. */
  startTime?: number;
  transitionDuration: number; // Transition time in milliseconds
  autopilotSettings?: {
    enabled: boolean;
    groups: Array<{
      groupId: string;
      autopilotType: 'color' | 'dimmer' | 'panTilt' | 'custom';
      intensity: number; // 0-100%
      speed: number; // 0-100%
      pattern?: 'wave' | 'random' | 'chase' | 'pulse';
    }>;
  };
  notes?: string;
  /** Optional transition pattern instead of scene-only step */
  patternId?: string;
}

export interface ActTrigger {
  id: string;
  type: 'osc' | 'midi';
  address?: string; // OSC address
  midiNote?: number; // MIDI note number
  midiChannel?: number; // MIDI channel (1-16)
  action: 'play' | 'pause' | 'stop' | 'next' | 'previous' | 'toggle';
  enabled: boolean;
}

export interface TimelineEvent {
  id: string;
  type: 'midi' | 'osc';
  time: number; // Time in milliseconds from act start
  // MIDI event data
  midiChannel?: number;
  midiNote?: number;
  midiController?: number;
  midiValue?: number;
  midiType?: 'noteon' | 'noteoff' | 'cc';
  // OSC event data
  oscAddress?: string;
  oscArgs?: Array<{ type: string; value: unknown }>;
  // Target for applying the event
  targetType?: 'fixture' | 'scene' | 'dmxChannel' | 'group';
  targetId?: string;
  targetValue?: number; // For DMX channel or fixture control
  notes?: string;
}

export interface Act {
  id: string;
  name: string;
  description?: string;
  steps: ActStep[];
  loopMode: 'none' | 'loop' | 'ping-pong';
  totalDuration: number; // Calculated total duration
  triggers: ActTrigger[];
  timelineEvents: TimelineEvent[]; // MIDI/OSC events on timeline
  createdAt: number;
  updatedAt: number;
  // DAW-like playback controls
  playbackMode?: 'loop' | 'pingpong' | 'forward' | 'backward' | 'once';
  playbackSpeed?: number; // 0.1 to 4.0 (1.0 = normal speed)
  syncToBpm?: boolean; // Sync act to BPM
  bpmMultiplier?: number; // How many beats per act duration
  audioTrack?: {
    url: string; // URL or data URL of audio file
    name: string;
    waveform?: number[]; // Pre-computed waveform data for visualization
  };
  // Channel lane controls for timeline events (mute/solo)
  channelLanes?: Record<number, {
    muted: boolean;
    soloed: boolean;
  }>;
  // Timeline markers/cues for navigation
  markers?: TimelineMarker[];
  seed?: {
    generatedBy: 'artbastard-act-seeder';
    generatorVersion: number;
    packId: 'starter-acts' | 'performance-acts';
    templateId: string;
    slot: number;
    label: string;
  };
}

export interface ActPlaybackState {
  isPlaying: boolean;
  currentActId: string | null;
  currentStepIndex: number;
  stepStartTime: number;
  stepProgress: number; // 0-1
  loopCount: number;
  playbackSpeed: number; // 0.1-2.0 multiplier
}

// Auto-Scene settings interface for localStorage persistence
interface AutoSceneSettings {
  autoSceneEnabled: boolean;
  autoSceneList: string[];
  autoSceneMode: 'forward' | 'ping-pong' | 'random';
  autoSceneBeatDivision: number;
  autoSceneManualBpm: number;
  autoSceneTapTempoBpm: number;
  autoSceneTempoSource: 'internal_clock' | 'manual_bpm' | 'tap_tempo' | 'ableton_link';
}

type DmxVisualEffectsLevel = 'off' | 'low' | 'medium' | 'high';

interface UiSettings {
  dmxVisualEffects: DmxVisualEffectsLevel;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  borderRadius: number;
  spacing: number;
  animationSpeed: number;
  fontFamily: string;
  fontFamilyHeading: string;
  fontWeight: number;
  fontWeightHeading: number;
}

// Helper functions for localStorage persistence
const AUTO_SCENE_STORAGE_KEY = 'artbastard-auto-scene-settings';
const SUPER_CONTROL_MIDI_MAPPINGS_STORAGE_KEY = 'artbastard-supercontrol-midi-mappings-v1';
const STROBE_SAFETY_STORAGE_KEY = 'artbastard-strobe-safety-enabled-v2';

const saveAutoSceneSettings = (settings: AutoSceneSettings) => {
  try {
    localStorage.setItem(AUTO_SCENE_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save auto-scene settings to localStorage:', error);
  }
};

const loadAutoSceneSettings = (): Partial<AutoSceneSettings> => {
  try {
    const stored = localStorage.getItem(AUTO_SCENE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load auto-scene settings from localStorage:', error);
    return {};
  }
};

const loadSuperControlMidiMappings = (): SuperControlBinding[] => {
  try {
    const stored = localStorage.getItem(SUPER_CONTROL_MIDI_MAPPINGS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SuperControlBinding => {
      if (!entry || typeof entry !== 'object') return false;
      const binding = entry as Partial<SuperControlBinding>;
      return typeof binding.controlName === 'string' && typeof binding.channel === 'number';
    });
  } catch (error) {
    console.warn('Failed to load SuperControl MIDI mappings from localStorage:', error);
    return [];
  }
};

const saveSuperControlMidiMappings = (mappings: SuperControlBinding[]) => {
  try {
    localStorage.setItem(SUPER_CONTROL_MIDI_MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.warn('Failed to save SuperControl MIDI mappings to localStorage:', error);
  }
};

const loadStrobeSafetyEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(STROBE_SAFETY_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
};

const saveStrobeSafetyEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(STROBE_SAFETY_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.warn('Failed to save strobe safety setting to localStorage:', error);
  }
};

// Helper to save current auto-scene settings from store state
const saveCurrentAutoSceneSettings = (state: {
  autoSceneEnabled: boolean;
  autoSceneList: string[];
  autoSceneMode: 'forward' | 'ping-pong' | 'random';
  autoSceneBeatDivision: number;
  autoSceneManualBpm: number;
  autoSceneTapTempoBpm: number;
  autoSceneTempoSource: 'internal_clock' | 'manual_bpm' | 'tap_tempo' | 'ableton_link';
}) => {
  const settings: AutoSceneSettings = {
    autoSceneEnabled: state.autoSceneEnabled,
    autoSceneList: state.autoSceneList,
    autoSceneMode: state.autoSceneMode,
    autoSceneBeatDivision: state.autoSceneBeatDivision,
    autoSceneManualBpm: state.autoSceneManualBpm,
    autoSceneTapTempoBpm: state.autoSceneTapTempoBpm,
    autoSceneTempoSource: state.autoSceneTempoSource,
  };
  saveAutoSceneSettings(settings);
};

export interface ChannelRange {
  min: number
  max: number
}

// Main application state - now reusing the automation slice's AutomationState
// so that all autopilot/modular/envelope state + actions are defined in one place.
interface State extends AutomationState, TransitionTrackerSlice {
  // DMX State
  dmxChannels: number[]
  // When true, store DMX state continues to update locally (so the GUI keeps
  // reflecting new values) but backend / serial output is suppressed. Used by
  // the APC40 Master Select / Detail View freeze controls. Press again to unfreeze.
  dmxFrozen: boolean
  setDmxFrozen: (frozen: boolean) => void
  strobeSafetyEnabled: boolean
  applyStrobeSafetyLock: () => void
  setStrobeSafetyEnabled: (enabled: boolean) => void
  dimmerFadeEnabled: boolean
  dimmerFadeWaveform: DimmerFadeWaveform
  dimmerFadePeriodSeconds: number
  dimmerFadeAnimationId: ReturnType<typeof setInterval> | null
  dimmerFadeStartedAt: number
  setDimmerFadeEnabled: (enabled: boolean) => void
  setDimmerFadeWaveform: (waveform: DimmerFadeWaveform) => void
  setDimmerFadePeriodSeconds: (seconds: number) => void
  startDimmerFadeAutomation: () => void
  stopDimmerFadeAutomation: () => void
  oscAssignments: string[]
  superControlOscAddresses: Record<string, string> // OSC addresses for SuperControl controls
  channelNames: string[]
  channelRanges: ChannelRange[] // Min/max range for each channel (0-511)
  channelColors: string[] // Color for each channel (0-511) - for visual identification
  selectedChannels: number[]
  pinnedChannels: number[] // Channels pinned to the left sidebar for quick access
  channelJumpTarget: number | null // Channel index to jump to in the DMX grid
  activeSceneName: string | null // Track the currently loaded/active scene
  tuningSceneName: string | null // Track the scene currently being fine-tuned

  // Navigation State
  navVisibility: {
    main: boolean
    midiOsc: boolean
    fixture: boolean
    scenes: boolean
    misc: boolean
  }

  // Debug State
  debugTools: {
    debugButton: boolean
    midiMonitor: boolean
    oscMonitor: boolean
    dmxMonitor?: boolean
  }

  // MIDI State
  midiInterfaces: string[]
  activeInterfaces: string[]
  midiMappings: Record<number, MidiMapping | undefined>;
  // APC40-style SuperControl routing: MIDI input → SuperControl parameter
  // applied against the current fixture selection. Keyed by binding (not by
  // DMX channel) so a single MIDI control can update many DMX addresses.
  superControlMidiMappings: SuperControlBinding[];
  // When set, the next incoming MIDI message rewrites the matching SuperControl
  // binding's signature (channel + cc/note/pitch). Lets the Apc40Manual act as
  // a live re-learn surface for the SuperControl routing layer.
  superControlLearnTarget:
    | { controlName: string; slotIndex?: number }
    | null;
  envelopeSpeedMidiMapping: MidiMapping | null; // MIDI mapping for envelope automation speed
  midiLearnTarget:
  | { type: 'masterSlider'; id: string }
  | { type: 'dmxChannel'; channelIndex: number }
  | { type: 'placedControl'; fixtureId: string; controlId: string }
  | { type: 'group'; groupId: string }
  | { type: 'superControl'; controlName: string }
  | { type: 'envelopeSpeed' }
  | { type: 'tempoPlayPause' }
  | { type: 'tapTempo' }
  | null;
  midiLearnScene: string | null
  midiMessages: Array<{
    channel: number;
    note?: number;
    controller?: number;
    velocity?: number;
    value?: number;
    type?: string;
    _type?: string;
    source?: string;
    sourceTransport?: string;
    timestamp?: number;
  }>
  oscMessages: OscMessage[]; // Added for OSC Monitor
  midiActivity: number // Activity level for MIDI signal flash indicator

  // APC40 crossfader + shift latch (session-only — both APC40 hooks read this)
  apc40CrossfaderState: {
    sceneAName: string | null;
    sceneBName: string | null;
    shiftLatched: boolean;
    mode: 'save' | null;
    activeDeck: 'A' | 'B';
    armedColumns: number[];
    soloedGroups: number[];
    fullOn: boolean;
    blackout: boolean;
    autoGroups: number[];
    deviceRoleLabels: string[];
    deviceBankIndex: number;
    deviceBankCount: number;
    deviceBankAtStart: boolean;
    deviceBankAtEnd: boolean;
    deviceBankFlashDirection: 'prev' | 'next' | null;
    deviceBankFlashUntil: number;
    activeTrackIndex: number | null;
    activeGroupId: string | null;
    activeFixtureIds: string[];
    activeTargetLabel: string | null;
    lastChange: Apc40LastChange | null;
  };
  setApc40SceneA: (name: string | null) => void;
  setApc40SceneB: (name: string | null) => void;
  setApc40Shift: (latched: boolean) => void;
  setApc40Mode: (mode: 'save' | null) => void;
  setApc40StatePatch: (patch: Partial<{
    sceneAName: string | null;
    sceneBName: string | null;
    shiftLatched: boolean;
    mode: 'save' | null;
    activeDeck: 'A' | 'B';
    armedColumns: number[];
    soloedGroups: number[];
    fullOn: boolean;
    blackout: boolean;
    autoGroups: number[];
    deviceRoleLabels: string[];
    deviceBankIndex: number;
    deviceBankCount: number;
    deviceBankAtStart: boolean;
    deviceBankAtEnd: boolean;
    deviceBankFlashDirection: 'prev' | 'next' | null;
    deviceBankFlashUntil: number;
    activeTrackIndex: number | null;
    activeGroupId: string | null;
    activeFixtureIds: string[];
    activeTargetLabel: string | null;
    lastChange: Apc40LastChange | null;
  }>) => void;
  superControlExternalUpdate: SuperControlExternalUpdate | null;

  // Audio/BPM State
  bpm: number // Current BPM value
  isPlaying: boolean // Whether audio/MIDI is currently playing

  // Debug State
  debugModules: {
    midi: boolean;
    osc: boolean;
    artnet: boolean;
    button: boolean;
  };

  // Fixtures and Groups
  fixtures: Fixture[]
  groups: Group[]
  selectedFixtures: string[] // Array of fixture IDs for selection
  fixtureTemplates: FixtureTemplate[] // Canonical catalog profiles plus custom profile copies
  addFixture: (fixture: Fixture) => void;
  deleteFixture: (fixtureId: string) => void;
  setFixtures: (fixtures: Fixture[]) => void;
  setGroups: (groups: Group[]) => void;
  renameGroup: (groupId: string, newName: string) => void;
  // Template management
  addFixtureTemplate: (template: Omit<FixtureTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFixtureTemplate: (id: string, template: Partial<FixtureTemplate>) => void;
  deleteFixtureTemplate: (id: string) => void;
  getFixtureTemplate: (id: string) => FixtureTemplate | undefined;

  // Scenes
  scenes: Scene[]

  // ACTS (Automated Scene Transition Sequences)
  acts: Act[]
  actTriggers: ActTrigger[] // Global trigger registry for OSC/MIDI processing
  actPlaybackState: ActPlaybackState

  // ArtNet
  artNetConfig: ArtNetConfig
  oscConfig: OscConfig
  artNetStatus: 'connected' | 'disconnected' | 'error' | 'timeout'  // UI State
  theme: 'artsnob' | 'standard' | 'minimal';
  darkMode: boolean;
  // statusMessage: { text: string; type: 'success' | 'error' | 'info' | 'warning' } | null; // Deprecated
  notifications: Notification[]; // Use the new Notification interface

  // UI Settings
  uiSettings: UiSettings;
  themeColors: {
    primaryHue: number; // 0-360
    primarySaturation: number; // 0-100
    primaryBrightness: number; // 0-100
    secondaryHue: number; // 0-360
    secondarySaturation: number; // 0-100
    secondaryBrightness: number; // 0-100
    accentHue: number; // 0-360
    accentSaturation: number; // 0-100
    accentBrightness: number; // 0-100
    backgroundBrightness: number; // 0-100 - Controls overall darkness
    backgroundHue: number; // 0-360 - Background color hue
    backgroundSaturation: number; // 0-100 - Background color saturation
    hueRotation: number; // -180 to 180 - Rotates all hues together
    // Semantic colors
    successHue: number; // 0-360
    successSaturation: number; // 0-100
    successBrightness: number; // 0-100
    warningHue: number; // 0-360
    warningSaturation: number; // 0-100
    warningBrightness: number; // 0-100
    errorHue: number; // 0-360
    errorSaturation: number; // 0-100
    errorBrightness: number; // 0-100
    infoHue: number; // 0-360
    infoSaturation: number; // 0-100
    infoBrightness: number; // 0-100
    // Text colors
    textPrimaryBrightness: number; // 0-100
    textSecondaryBrightness: number; // 0-100
    textTertiaryBrightness: number; // 0-100
    // Border colors
    borderBrightness: number; // 0-100
    borderSaturation: number; // 0-100
    // Card/Surface colors
    cardBrightness: number; // 0-100 - Relative to background
    cardSaturation: number; // 0-100
    // Status colors
    statusConnectedHue: number; // 0-360
    statusDisconnectedHue: number; // 0-360
    statusActiveHue: number; // 0-360
    statusInactiveBrightness: number; // 0-100
  };

  oscActivity: Record<number, OscActivity>
  exampleSliderValue: number;
  fixtureLayout: PlacedFixture[];
  placedFixtures: PlacedFixture[];
  masterSliders: MasterSlider[];
  canvasBackgroundImage: HTMLImageElement | null;

  // Scene Transition State
  isTransitioning: boolean;
  transitionStartTime: number | null;
  transitionDuration: number; // in ms
  transitionEasing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' | 'easeInOutCubic' | 'easeInOutQuart' | 'easeInOutSine';
  fromDmxValues: number[] | null;
  toDmxValues: number[] | null;
  currentTransitionFrame: number | null; // requestAnimationFrame ID
  lastDmxTransitionUpdate: number | null; // For throttling DMX updates during transitions
  lastTransitionDmxValues: number[] | null; // Track last sent DMX values to only send changes

  // Socket state
  socket: Socket | null
  setSocket: (socket: Socket | null) => void

  // MIDI Clock Sync State
  availableMidiClockHosts: Array<{ id: string; name: string }>;
  selectedMidiClockHostId: string | null;
  midiClockInputs: string[];
  selectedMidiClockInputName: string | null;
  lastMidiClockInputName: string | null;
  lastMidiClockInputAt: number | null;
  midiClockInputStatus: MidiClockInputStatus;
  midiClockBpm: number;
  abletonLinkPeers: number;
  abletonLinkAvailable: boolean;
  dmxFaderOrientation: 'horizontal' | 'vertical';
  setDmxFaderOrientation: (orientation: 'horizontal' | 'vertical') => void;
  dmxChannelsPerRow: number;
  setDmxChannelsPerRow: (count: number) => void;
  channelTicksOnlyOverrides: Record<number, boolean>;
  setChannelTicksOnly: (dmxAddress: number, ticksOnly: boolean) => void;
  getChannelTicksOnly: (dmxAddress: number) => boolean;
  /** When ticks mode is on: show a third vertical fader for full 0-255 (alt+click TICKS). */
  channelAuxFullFaderOverrides: Record<number, boolean>;
  getChannelAuxFullFader: (dmxAddress: number) => boolean;
  setChannelAuxFullFader: (dmxAddress: number, enabled: boolean) => void;
  toggleChannelAuxFullFader: (dmxAddress: number) => void;
  activeSessionId: string;
  sessionsList: Array<{
    id: string;
    name: string;
    clientCount: number;
    bridgeConnected: boolean;
    bridgeId?: string;
  }>;
  setActiveSessionId: (sessionId: string) => void;
  setSessionsList: (sessions: Array<{
    id: string;
    name: string;
    clientCount: number;
    bridgeConnected: boolean;
    bridgeId?: string;
  }>, defaultSessionId?: string) => void;
  bridgeConnected: boolean;
  connectedClientCount: number;
  bridgeInfo: {
    bridgeId: string;
    version?: string;
    artnetStatus?: string;
    linkPeers?: number;
    latencyMs?: number;
  } | null;
  midiClockIsPlaying: boolean;
  midiClockCurrentBeat: number;
  midiClockCurrentBar: number;
  // Auto-Scene Feature State
  autoSceneEnabled: boolean;
  autoSceneList: string[]; // Names of scenes selected for auto-sequencing
  autoSceneMode: 'forward' | 'ping-pong' | 'random';
  autoSceneCurrentIndex: number;
  autoScenePingPongDirection: 'forward' | 'backward';
  // Global automation direction toggle (driven by APC40 Cue Level encoder).
  // Inverts the sign of advancement in AutoScene and pan/tilt autopilot tracks.
  automationDirection: 'forward' | 'reverse';
  autoSceneBeatDivision: number; // e.g., 4 for every 4 beats (1 bar in 4/4)
  autoSceneManualBpm: number;
  autoSceneTapTempoBpm: number;
  autoSceneLastTapTime: number; // For tap tempo calculation
  autoSceneTapTimes: number[]; // Stores recent tap intervals
  autoSceneTempoSource: 'internal_clock' | 'manual_bpm' | 'tap_tempo' | 'ableton_link';
  autoSceneIsFlashing: boolean; // Shared flashing state for downbeat border flash

  // Quick Scene State
  quickSceneSaveMidiMapping: MidiMapping | null; // MIDI mapping for quick scene save A
  quickSceneMidiMapping: MidiMapping | null; // MIDI mapping for quick scene load A
  quickSceneSaveBMidiMapping: MidiMapping | null; // MIDI mapping for quick scene save B
  quickSceneLoadBMidiMapping: MidiMapping | null; // MIDI mapping for quick scene load B

  // Tempo Play/Pause State
  tempoPlayPauseMidiMapping: MidiMapping | null; // MIDI mapping for tempo play/pause
  tempoPlayPauseOscAddress: string; // OSC address for tempo play/pause

  // Tap Tempo State
  tapTempoMidiMapping: MidiMapping | null; // MIDI mapping for tap tempo
  tapTempoOscAddress: string; // OSC address for tap tempo

  // Autopilot Track System State (Legacy - kept for compatibility)
  autopilotTrackEnabled: boolean;
  autopilotTrackType: 'circle' | 'figure8' | 'square' | 'triangle' | 'linear' | 'random' | 'custom';
  autopilotTrackPosition: number; // 0-100, position along the track
  autopilotTrackSize: number; // 0-100, size/scale of the track
  autopilotTrackSpeed: number; // 0-100, speed of automatic movement (when auto-playing)
  autopilotTrackCenterX: number; // 0-255, center point X for the track
  autopilotTrackCenterY: number; // 0-255, center point Y for the track
  autopilotTrackAutoPlay: boolean; // Auto-advance along track
  autopilotTrackCustomPoints: Array<{ x: number; y: number }>; // Custom track points
  autopilotTrackAnimationId: number | null; // Animation frame ID for centralized control

  // Recording and Automation System State
  recordingActive: boolean;
  recordingStartTime: number | null;
  recordingData: Array<{
    timestamp: number;
    type: 'dmx' | 'midi' | 'osc';
    channel?: number;
    value?: number;
    data?: Record<string, unknown>;
  }>;
  automationPlayback: {
    active: boolean;
    startTime: number | null;
    duration: number; // Total duration in milliseconds
    position: number; // Current position 0-1
  };
  // Smooth DMX Output System
  smoothDmxEnabled: boolean;
  smoothDmxUpdateRate: number; // Updates per second (default: 30fps)
  smoothDmxThreshold: number; // Minimum change to trigger update (default: 1)
  pendingSmoothUpdates: { [channel: number]: number }; // Pending smooth updates
  lastSmoothUpdateTime: number;

  // Timeline Playback State
  timelineSequences: TimelineSequence[];
  activeTimelineSequence: string | null;
  timelinePlayback: {
    active: boolean;
    sequenceId: string | null;
    startTime: number | null;
    position: number; // 0-1
    speed: number; // 0.1-2.0 multiplier
    loop: boolean;
  };

  // Timeline Actions
  playTimelineSequence: (sequenceId: string, options?: { loop?: boolean; speed?: number }) => void
  stopTimelinePlayback: () => void
  setTimelineSpeed: (speed: number) => void
  loadTimelineSequence: (sequenceId: string) => void
  updateTimelineSequence: (sequenceId: string, updates: Partial<TimelineSequence>) => void
  deleteTimelineSequence: (sequenceId: string) => void

  // Actions
  fetchInitialState: () => Promise<void>
  getDmxChannelValue: (channel: number) => number
  setDmxChannel: (channel: number, value: number, sendToBackend?: boolean) => void
  setMultipleDmxChannels: (updates: DmxChannelBatchUpdate, sendToBackend?: boolean) => void; // New action for batch updates
  blackoutAllDmxChannels: (sendToBackend?: boolean) => void;
  setDmxChannelValue: (channel: number, value: number) => void
  setDmxChannelsForTransition: (values: number[]) => void;
  setCurrentTransitionFrameId: (frameId: number | null) => void;
  clearTransitionState: () => void;
  setTransitionDuration: (duration: number) => void;
  setTransitionEasing: (easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' | 'easeInOutCubic' | 'easeInOutQuart' | 'easeInOutSine') => void;
  selectChannel: (channel: number) => void
  deselectChannel: (channel: number) => void
  toggleChannelSelection: (channel: number) => void
  selectAllChannels: () => void
  deselectAllChannels: () => void
  invertChannelSelection: () => void
  setChannelName: (channel: number, name: string) => void
  setChannelRange: (channel: number, min: number, max: number) => void
  getChannelRange: (channel: number) => ChannelRange
  setChannelColor: (channel: number, color: string) => void
  setRandomChannelColor: (channel: number) => void
  pinChannel: (channel: number) => void
  unpinChannel: (channel: number) => void
  togglePinChannel: (channel: number) => void

  // Fixture Selection Actions
  selectNextFixture: () => void
  selectPreviousFixture: () => void
  selectAllFixtures: () => void
  selectFixturesByType: (channelType: string) => void
  selectFixtureGroup: (groupId: string) => void
  setSelectedFixtures: (fixtureIds: string[]) => void
  toggleFixtureSelection: (fixtureId: string) => void
  deselectAllFixtures: () => void

  // Placed Fixture Actions
  addPlacedFixture: (fixture: Omit<PlacedFixture, 'id'>) => void
  updatePlacedFixture: (id: string, updates: Partial<PlacedFixture>) => void
  removePlacedFixture: (id: string) => void

  setOscAssignment: (channelIndex: number, address: string) => void
  setSuperControlOscAddress: (controlName: string, address: string) => void
  reportOscActivity: (channelIndex: number, value: number) => void
  addOscMessage: (message: OscMessage) => void; // Added for OSC Monitor
  // MIDI Actions
  startMidiLearn: (target: { type: 'masterSlider', id: string } | { type: 'dmxChannel', channelIndex: number } | { type: 'group', id: string } | { type: 'placedControl'; fixtureId: string; controlId: string } | { type: 'superControl'; controlName: string } | { type: 'envelopeSpeed' } | { type: 'tempoPlayPause' } | { type: 'tapTempo' }) => void;
  cancelMidiLearn: () => void
  addMidiMessage: (message: {
    channel: number;
    note?: number;
    controller?: number;
    pitch?: number;
    velocity?: number;
    value?: number;
    type?: string;
    _type?: string;
    source?: string;
    sourceTransport?: string;
    timestamp?: number;
  }) => void
  addMidiMapping: (dmxChannel: number, mapping: MidiMapping) => void
  removeMidiMapping: (dmxChannel: number) => void
  clearAllMidiMappings: () => void
  applyMidiControllerTemplate: (templateId: 'x_touch_mackie' | 'apc40_mk1', deviceName?: string) => Promise<boolean>
  // Apply a MIDI value (0-255) to a SuperControl parameter, optionally
  // scoped to the Nth selected fixture via slotIndex.
  applySuperControlMidi: (controlName: string, value: number, slotIndex?: number) => void
  // Re-learn the MIDI signature for a SuperControl binding (used by the APC40
  // tactile-codex panel). Pass null to cancel.
  startSuperControlLearn: (target: { controlName: string; slotIndex?: number } | null) => void
  rebindSuperControl: (
    controlName: string,
    slotIndex: number | undefined,
    signature: { channel: number; controller?: number; note?: number; pitch?: boolean }
  ) => void
  setEnvelopeSpeedMidiMapping: (mapping: MidiMapping | null) => void
  removeEnvelopeSpeedMidiMapping: () => void
  setMidiInterfaces: (interfaces: string[]) => void
  setActiveInterfaces: (interfaces: string[]) => void

  // Scene Actions
  saveScene: (name: string, oscAddress: string) => void
  loadScene: (nameOrIndex: string | number, options?: { silent?: boolean; force?: boolean }) => void
  loadNextScene: () => void
  loadPreviousScene: () => void
  deleteScene: (name: string) => void
  updateScene: (originalName: string, updates: Partial<Scene>) => void; // New action for updating scenes
  setTuningScene: (name: string | null) => void;
  updateActiveScene: () => void; // Save current DMX values to the active scene
  seedScenesFromFixtures: (options?: Partial<SceneSeedOptions>) => Promise<SceneSeedSummary>;
  captureSelectionToApcSlot: (options: { deck: Apc40Deck; slot: number; fixtureIds?: string[] }) => Promise<SceneSeedSummary>;

  // ACTS Actions
  createAct: (name: string, description?: string) => void
  updateAct: (actId: string, updates: Partial<Act>) => void
  deleteAct: (actId: string) => void
  seedActsFromScenes: (options?: Partial<ActSeedOptions>) => Promise<ActSeedSummary>;
  addActStep: (actId: string, step: Omit<ActStep, 'id'>) => void
  updateActStep: (actId: string, stepId: string, updates: Partial<ActStep>) => void
  removeActStep: (actId: string, stepId: string) => void
  reorderActSteps: (actId: string, stepIds: string[]) => void

  // ACTS Trigger Actions
  addActTrigger: (actId: string, trigger: Omit<ActTrigger, 'id'>) => void
  updateActTrigger: (actId: string, triggerId: string, updates: Partial<ActTrigger>) => void
  removeActTrigger: (actId: string, triggerId: string) => void
  processActTrigger: (trigger: ActTrigger) => void
  saveActsToBackend: () => void

  // ACTS Playback Actions
  playAct: (actId: string) => void
  pauseAct: () => void
  stopAct: () => void
  nextActStep: () => void
  previousActStep: () => void
  setActPlaybackSpeed: (speed: number) => void
  setActStepProgress: (progress: number) => void
  applyActStepAutopilot: (step: ActStep) => void
  
  // ACTS Timeline Event Actions
  addTimelineEvent: (actId: string, eventData: Omit<TimelineEvent, 'id'>) => void
  updateTimelineEvent: (actId: string, eventId: string, updates: Partial<TimelineEvent>) => void
  removeTimelineEvent: (actId: string, eventId: string) => void

  // Config Actions
  updateArtNetConfig: (config: Partial<ArtNetConfig>) => void
  updateDebugModules: (debugSettings: { midi?: boolean; osc?: boolean; artnet?: boolean; button?: boolean }) => void
  testArtNetConnection: () => void    // UI Actions
  setTheme: (theme: 'artsnob' | 'standard' | 'minimal') => void;
  toggleDarkMode: () => void;

  // UI Settings Actions
  updateUiSettings: (settings: Partial<UiSettings>) => void;
  setDmxVisualEffects: (level: DmxVisualEffectsLevel) => void;
  updateThemeColors: (colors: Partial<{
    primaryHue: number; primarySaturation: number; primaryBrightness: number;
    secondaryHue: number; secondarySaturation: number; secondaryBrightness: number;
    accentHue: number; accentSaturation: number; accentBrightness: number;
    backgroundBrightness: number; backgroundHue: number; backgroundSaturation: number;
    hueRotation: number;
    successHue: number; successSaturation: number; successBrightness: number;
    warningHue: number; warningSaturation: number; warningBrightness: number;
    errorHue: number; errorSaturation: number; errorBrightness: number;
    infoHue: number; infoSaturation: number; infoBrightness: number;
    textPrimaryBrightness: number; textSecondaryBrightness: number; textTertiaryBrightness: number;
    borderBrightness: number; borderSaturation: number;
    cardBrightness: number; cardSaturation: number;
    statusConnectedHue: number; statusDisconnectedHue: number; statusActiveHue: number; statusInactiveBrightness: number;
  }>) => void;
  applyThemePresetId: (presetId: string, preferDark?: boolean) => void;
  saveAppearanceToServer: (appearance: {
    theme?: 'artsnob' | 'standard' | 'minimal';
    darkMode?: boolean;
    themePresetId?: string;
    themeColors?: Record<string, number>;
  }) => Promise<void>;
  loadAppearanceFromServer: () => Promise<void>;

  // showStatusMessage: (text: string, type: 'success' | 'error' | 'info' | 'warning') => void; // Deprecated
  // clearStatusMessage: () => void; // Deprecated
  addNotification: (notification: AddNotificationInput) => void; // Use AddNotificationInput
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Fixture Helper Functions for System-Wide Channel Info Display
  getChannelInfo: (dmxAddress: number) => {
    fixtureName: string;
    fixtureType: string;
    fixtureId: string;
    channelName: string;
    channelType: string;
    channelIndex: number;
    startAddress: number;
    ranges?: import('./types').FixtureChannelRange[];
    ticksOnly?: boolean;
  } | null;
  getFixtureColor: (fixtureId: string) => string;
  isChannelAssigned: (dmxAddress: number) => boolean;

  setExampleSliderValue: (value: number) => void;
  setBpm: (bpm: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setMidiActivity: (activity: number) => void;
  setFixtureLayout: (layout: PlacedFixture[]) => void
  setCanvasBackgroundImage: (image: HTMLImageElement | null) => void
  addMasterSlider: (slider: MasterSlider) => void;
  updateMasterSliderValue: (sliderId: string, value: number) => void;
  updateMasterSlider: (sliderId: string, updatedSlider: Partial<MasterSlider>) => void;
  removeMasterSlider: (sliderId: string) => void;
  setMasterSliders: (sliders: MasterSlider[]) => void;
  setSelectedMidiClockHostId: (hostId: string | null) => void; // Will be called by WS handler too
  setAvailableMidiClockHosts: (hosts: Array<{ id: string; name: string }>) => void; // Called by WS handler
  setMidiClockInputs: (inputs: string[], currentInput?: string | null) => void;
  setMidiClockInputTelemetry: (telemetry: {
    selectedInputName?: string | null;
    lastInputName?: string | null;
    lastInputAt?: number | null;
    status?: MidiClockInputStatus;
  }) => void;
  setBridgeRegistry: (payload: {
    connected: boolean;
    bridge: {
      bridgeId: string;
      version?: string;
      artnetStatus?: string;
      linkPeers?: number;
      latencyMs?: number;
    } | null;
    connectedClients?: number;
  }) => void;
  setMidiClockBpm: (bpm: number, emitToServer?: boolean) => void; // Called by WS handler, and also repurposed for user requests
  setMidiClockIsPlaying: (isPlaying: boolean) => void; // Called by WS handler
  setMidiClockBeatBar: (beat: number, bar: number) => void; // Called by WS handler
  requestToggleMasterClockPlayPause: () => void; // Renamed action
  requestMasterClockSourceChange: (sourceId: string) => void;
  requestMidiClockInputList: () => void;
  requestSetMidiClockInput: (inputName: string) => void;
  // Auto-Scene Actions
  setAutoSceneEnabled: (enabled: boolean) => void;
  setAutoSceneList: (sceneNames: string[]) => void;
  setAutoSceneMode: (mode: 'forward' | 'ping-pong' | 'random') => void; setAutoSceneBeatDivision: (division: number) => void;
  setAutomationDirection: (direction: 'forward' | 'reverse') => void;
  setAutoSceneTempoSource: (source: 'internal_clock' | 'manual_bpm' | 'tap_tempo' | 'ableton_link') => void;
  setNextAutoSceneIndex: () => void; // Calculates and updates autoSceneCurrentIndex
  resetAutoSceneIndex: () => void;
  setManualBpm: (bpm: number) => void; // For auto-scene manual tempo
  recordTapTempo: () => void;         // For auto-scene tap tempo
  triggerAutoSceneFlash: () => void;  // Triggers the shared flashing state

  // Quick Scene Functions
  quickSceneSave: () => void;
  quickSceneLoad: () => void;
  quickSceneSaveA: () => void;
  quickSceneLoadA: () => void;
  quickSceneSaveB: () => void;
  quickSceneLoadB: () => void;
  quickSceneSaveDeck: (deck: Apc40Deck) => void;
  quickSceneLoadDeck: (deck: Apc40Deck) => void;
  setQuickSceneSaveMidiMapping: (mapping: MidiMapping | null) => void;
  setQuickSceneMidiMapping: (mapping: MidiMapping | null) => void;
  setQuickSceneSaveBMidiMapping: (mapping: MidiMapping | null) => void;
  setQuickSceneLoadBMidiMapping: (mapping: MidiMapping | null) => void;

  // Tempo Play/Pause Functions
  setTempoPlayPauseMidiMapping: (mapping: MidiMapping | null) => void;
  setTempoPlayPauseOscAddress: (address: string) => void;

  // Tap Tempo Functions
  setTapTempoMidiMapping: (mapping: MidiMapping | null) => void;
  setTapTempoOscAddress: (address: string) => void;

  // Group Actions
  updateGroup: (groupId: string, groupData: Partial<Group>) => void;
  saveGroupLastStates: (groupId: string) => void;
  setGroupMasterValue: (groupId: string, value: number) => void;
  setGroupMute: (groupId: string, muted: boolean) => void;
  setGroupSolo: (groupId: string, solo: boolean) => void;
  setGroupPanOffset: (groupId: string, offset: number) => void;
  setGroupTiltOffset: (groupId: string, offset: number) => void;
  setGroupZoomValue: (groupId: string, value: number) => void;
  startGroupMidiLearn: (groupId: string) => void;
  setGroupMidiMapping: (groupId: string, mapping?: MidiMapping) => void;

  // Fixture Flagging Actions
  addFixtureFlag: (fixtureId: string, flag: FixtureFlag) => void;
  removeFixtureFlag: (fixtureId: string, flagId: string) => void;
  toggleFixtureFlag: (fixtureId: string, flagId: string) => void;
  updateFixtureFlag: (fixtureId: string, flagId: string, updates: Partial<FixtureFlag>) => void;
  clearFixtureFlags: (fixtureId: string) => void;
  getFixturesByFlag: (flagId: string) => Fixture[];
  getFixturesByFlagCategory: (category: string) => Fixture[];
  createQuickFlag: (name: string, color: string, category: string) => FixtureFlag;
  bulkAddFlag: (fixtureIds: string[], flag: FixtureFlag) => void;
  bulkRemoveFlag: (fixtureIds: string[], flagId: string) => void;

  // Legacy Autopilot Track Actions (kept for compatibility)
  setAutopilotTrackEnabled: (enabled: boolean) => void;
  setAutopilotTrackType: (type: 'circle' | 'figure8' | 'square' | 'triangle' | 'linear' | 'random' | 'custom') => void;
  setAutopilotTrackPosition: (position: number) => void;
  setAutopilotTrackSize: (size: number) => void;
  setAutopilotTrackSpeed: (speed: number) => void;
  setAutopilotTrackCenter: (centerX: number, centerY: number) => void;
  setAutopilotTrackAutoPlay: (autoPlay: boolean) => void;
  setAutopilotTrackCustomPoints: (points: Array<{ x: number; y: number }>) => void;
  calculateTrackPosition: (trackType: string, position: number, size: number, centerX: number, centerY: number) => { pan: number; tilt: number };
  updatePanTiltFromTrack: (position?: number) => void;
  startAutopilotTrackAnimation: () => void;
  stopAutopilotTrackAnimation: () => void;

  // Debug function
  debugAutopilotState: () => void;

  // Recording and Automation Actions
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addRecordingEvent: (event: { type: 'dmx' | 'midi' | 'osc'; channel?: number; value?: number; data?: Record<string, unknown> }) => void;
  createAutomationTrack: (name: string, channel: number) => string; // Returns track ID
  updateAutomationTrack: (trackId: string, updates: Partial<{ name: string; enabled: boolean; loop: boolean }>) => void;
  deleteAutomationTrack: (trackId: string) => void; addKeyframe: (trackId: string, time: number, value: number, curve?: 'linear' | 'smooth' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out') => void;
  updateKeyframe: (trackId: string, keyframeIndex: number, updates: Partial<{ time: number; value: number; curve: string }>) => void;
  deleteKeyframe: (trackId: string, keyframeIndex: number) => void;
  startAutomationPlayback: () => void;
  stopAutomationPlayback: () => void;
  setAutomationPosition: (position: number) => void; // 0-1
  applyAutomationPreset: (trackId: string, preset: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'random') => void;

  // Smooth DMX Actions
  setSmoothDmxEnabled: (enabled: boolean) => void;
  jumpToChannel: (channelIndex: number) => void;
}

// Helper function to initialize darkMode from localStorage with fallback to true
const initializeDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem('darkMode');
    const darkMode = stored !== null ? stored === 'true' : true; // Default to true if not found

    // Apply theme immediately on initialization
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');

    return darkMode;
  } catch (error) {
    console.warn('Failed to read darkMode from localStorage, using default (true):', error);
    document.documentElement.setAttribute('data-theme', 'dark');
    return true;
  }
};

// Helper function to initialize UI settings from localStorage
const initializeUiSettings = (): UiSettings => {
  try {
    const stored = localStorage.getItem('uiSettings');
    const defaultSettings: UiSettings = {
      dmxVisualEffects: 'medium' as const,
      fontSize: 1.0,
      lineHeight: 1.5,
      letterSpacing: 0,
      borderRadius: 8,
      spacing: 1.0,
      animationSpeed: 1.0,
      fontFamily: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontFamilyHeading: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 400,
      fontWeightHeading: 600,
    };

    if (stored) {
      const parsedSettings = JSON.parse(stored) as Partial<UiSettings> & Record<string, unknown>;
      delete parsedSettings[['sparkles', 'Enabled'].join('')];
      const merged: UiSettings = { ...defaultSettings, ...parsedSettings };
      // Apply CSS custom properties on initialization
      const root = document.documentElement;
      root.style.setProperty('--ui-font-size', `${merged.fontSize}`);
      root.style.setProperty('--ui-line-height', `${merged.lineHeight}`);
      root.style.setProperty('--ui-letter-spacing', `${merged.letterSpacing}px`);
      root.style.setProperty('--ui-border-radius', `${merged.borderRadius}px`);
      root.style.setProperty('--ui-spacing', `${merged.spacing}`);
      root.style.setProperty('--ui-animation-speed', `${merged.animationSpeed}`);
      root.style.setProperty('--ui-font-family', merged.fontFamily || defaultSettings.fontFamily);
      root.style.setProperty('--ui-font-family-heading', merged.fontFamilyHeading || defaultSettings.fontFamilyHeading);
      root.style.setProperty('--ui-font-weight', `${merged.fontWeight ?? defaultSettings.fontWeight}`);
      root.style.setProperty('--ui-font-weight-heading', `${merged.fontWeightHeading ?? defaultSettings.fontWeightHeading}`);
      // Apply font family globally
      document.body.style.fontFamily = merged.fontFamily || defaultSettings.fontFamily;
      return merged;
    }

    // Apply defaults
    const root = document.documentElement;
    root.style.setProperty('--ui-font-size', `${defaultSettings.fontSize}`);
    root.style.setProperty('--ui-line-height', `${defaultSettings.lineHeight}`);
    root.style.setProperty('--ui-letter-spacing', `${defaultSettings.letterSpacing}px`);
    root.style.setProperty('--ui-border-radius', `${defaultSettings.borderRadius}px`);
    root.style.setProperty('--ui-spacing', `${defaultSettings.spacing}`);
    root.style.setProperty('--ui-animation-speed', `${defaultSettings.animationSpeed}`);
    root.style.setProperty('--ui-font-family', defaultSettings.fontFamily);
    root.style.setProperty('--ui-font-family-heading', defaultSettings.fontFamilyHeading);
    root.style.setProperty('--ui-font-weight', `${defaultSettings.fontWeight}`);
    root.style.setProperty('--ui-font-weight-heading', `${defaultSettings.fontWeightHeading}`);
    document.body.style.fontFamily = defaultSettings.fontFamily;
    return defaultSettings;
  } catch (error) {
    console.warn('Failed to read uiSettings from localStorage, using defaults:', error);
    const defaultSettings: UiSettings = {
      dmxVisualEffects: 'medium' as const,
      fontSize: 1.0,
      lineHeight: 1.5,
      letterSpacing: 0,
      borderRadius: 8,
      spacing: 1.0,
      animationSpeed: 1.0,
      fontFamily: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontFamilyHeading: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 400,
      fontWeightHeading: 600,
    };
    // Apply defaults
    const root = document.documentElement;
    root.style.setProperty('--ui-font-size', `${defaultSettings.fontSize}`);
    root.style.setProperty('--ui-line-height', `${defaultSettings.lineHeight}`);
    root.style.setProperty('--ui-letter-spacing', `${defaultSettings.letterSpacing}px`);
    root.style.setProperty('--ui-border-radius', `${defaultSettings.borderRadius}px`);
    root.style.setProperty('--ui-spacing', `${defaultSettings.spacing}`);
    root.style.setProperty('--ui-animation-speed', `${defaultSettings.animationSpeed}`);
    root.style.setProperty('--ui-font-family', defaultSettings.fontFamily);
    root.style.setProperty('--ui-font-family-heading', defaultSettings.fontFamilyHeading);
    root.style.setProperty('--ui-font-weight', `${defaultSettings.fontWeight}`);
    root.style.setProperty('--ui-font-weight-heading', `${defaultSettings.fontWeightHeading}`);
    document.body.style.fontFamily = defaultSettings.fontFamily;
    return defaultSettings;
  }
};

const initializeThemeColors = (): {
  primaryHue: number; primarySaturation: number; primaryBrightness: number;
  secondaryHue: number; secondarySaturation: number; secondaryBrightness: number;
  accentHue: number; accentSaturation: number; accentBrightness: number;
  backgroundBrightness: number; backgroundHue: number; backgroundSaturation: number;
  hueRotation: number;
  successHue: number; successSaturation: number; successBrightness: number;
  warningHue: number; warningSaturation: number; warningBrightness: number;
  errorHue: number; errorSaturation: number; errorBrightness: number;
  infoHue: number; infoSaturation: number; infoBrightness: number;
  textPrimaryBrightness: number; textSecondaryBrightness: number; textTertiaryBrightness: number;
  borderBrightness: number; borderSaturation: number;
  cardBrightness: number; cardSaturation: number;
  statusConnectedHue: number; statusDisconnectedHue: number; statusActiveHue: number; statusInactiveBrightness: number;
} => {
  try {
    const stored = localStorage.getItem('themeColors');
    const defaultColors = {
      primaryHue: 220, // Blue
      primarySaturation: 70,
      primaryBrightness: 50,
      secondaryHue: 280, // Purple
      secondarySaturation: 60,
      secondaryBrightness: 45,
      accentHue: 340, // Pink
      accentSaturation: 80,
      accentBrightness: 60,
      backgroundBrightness: 25, // Brighter default (was too dark)
      backgroundHue: 220,
      backgroundSaturation: 20,
      hueRotation: 0,
      // Semantic colors
      successHue: 142, // Green
      successSaturation: 71,
      successBrightness: 47,
      warningHue: 38, // Orange
      warningSaturation: 92,
      warningBrightness: 51,
      errorHue: 0, // Red
      errorSaturation: 84,
      errorBrightness: 60,
      infoHue: 217, // Blue
      infoSaturation: 91,
      infoBrightness: 59,
      // Text colors (brightness only, hue follows background)
      textPrimaryBrightness: 90,
      textSecondaryBrightness: 65,
      textTertiaryBrightness: 50,
      // Border colors
      borderBrightness: 30,
      borderSaturation: 15,
      // Card/Surface colors
      cardBrightness: 33, // Relative to background
      cardSaturation: 20,
      // Status colors
      statusConnectedHue: 142, // Green
      statusDisconnectedHue: 0, // Red
      statusActiveHue: 142, // Green
      statusInactiveBrightness: 50
    };

    if (stored) {
      const parsedColors = JSON.parse(stored);
      return { ...defaultColors, ...parsedColors };
    }

    return defaultColors;
  } catch (error) {
    console.warn('Failed to read themeColors from localStorage, using defaults:', error);
    return {
      primaryHue: 220,
      primarySaturation: 70,
      primaryBrightness: 50,
      secondaryHue: 280,
      secondarySaturation: 60,
      secondaryBrightness: 45,
      accentHue: 340,
      accentSaturation: 80,
      accentBrightness: 60,
      backgroundBrightness: 25,
      backgroundHue: 220,
      backgroundSaturation: 20,
      hueRotation: 0,
      successHue: 142,
      successSaturation: 71,
      successBrightness: 47,
      warningHue: 38,
      warningSaturation: 92,
      warningBrightness: 51,
      errorHue: 0,
      errorSaturation: 84,
      errorBrightness: 60,
      infoHue: 217,
      infoSaturation: 91,
      infoBrightness: 59,
      textPrimaryBrightness: 90,
      textSecondaryBrightness: 65,
      textTertiaryBrightness: 50,
      borderBrightness: 30,
      borderSaturation: 15,
      cardBrightness: 8,
      cardSaturation: 20,
      statusConnectedHue: 142,
      statusDisconnectedHue: 0,
      statusActiveHue: 142,
      statusInactiveBrightness: 50
    };
  }
};

// Helper function to initialize fixture profiles
const initializeFixtureTemplates = (): FixtureTemplate[] => {
  // Canonical fixture profile catalog. Generic starter profiles live in
  // src/fixtures/library/coreFixtureLibrary.ts, and uploaded hardware profiles
  // live in src/fixtures/library so every protected profile has one source.
  // Custom editable profiles provided by default.
  const defaultCustomProfiles: FixtureTemplate[] = [
    {
      id: 'custom-blank',
      templateName: 'Blank Template',
      defaultNamePrefix: 'Custom Fixture',
      channels: [{ name: 'Channel 1', type: 'other' }],
      isBuiltIn: false,
      isCustom: true,
      isFavorite: false,
      tags: []
    }
  ];

  // Load custom profile copies from localStorage. Server copies sync via SocketContext.
  try {
    const stored = localStorage.getItem('fixtureTemplates');
    const customTemplates: FixtureTemplate[] = stored ? JSON.parse(stored) : [];
    return mergeFixtureTemplatesWithCatalog(customTemplates, defaultCustomProfiles);
  } catch (error) {
    console.warn('Failed to load fixture templates from localStorage:', error);
    return mergeFixtureTemplatesWithCatalog([], defaultCustomProfiles);
  }
};

export const useStore = create<State>()(
  devtools(
    ((set, get) => ({
      // Initial state
      dmxChannels: new Array(512).fill(0),
      dmxFrozen: false,
      setDmxFrozen: (frozen) => {
        const wasFrozen = get().dmxFrozen;
        set({ dmxFrozen: frozen });
        if (wasFrozen && !frozen) {
          // Unfreezing: flush the current store state out to the backend so
          // the rig snaps to whatever the operator dialed in while frozen.
          const channels = get().strobeSafetyEnabled
            ? applyStrobeSafetyToDmxValues(get().fixtures || [], get().dmxChannels)
            : get().dmxChannels;
          const updates: Record<number, number> = {};
          for (let i = 0; i < channels.length; i += 1) updates[i] = channels[i];
          enqueueDmxBackendUpdates(updates, () => {
            get().addNotification({ message: 'Failed to flush DMX after unfreeze', type: 'error', priority: 'high' });
          });
        }
      },
      strobeSafetyEnabled: loadStrobeSafetyEnabled(),
      applyStrobeSafetyLock: () => {
        const updates = strobeSafetyUpdates(get().fixtures || []);
        if (Object.keys(updates).length > 0) {
          get().setMultipleDmxChannels(updates, true);
        }
      },
      setStrobeSafetyEnabled: (enabled) => {
        set({ strobeSafetyEnabled: enabled });
        saveStrobeSafetyEnabled(enabled);

        if (enabled) {
          get().applyStrobeSafetyLock();
          get().addNotification({
            message: 'Strobe safety lock enabled',
            type: 'success',
            priority: 'normal',
          });
        } else {
          get().addNotification({
            message: 'Strobe control enabled',
            type: 'info',
            priority: 'normal',
          });
        }
      },
      dimmerFadeEnabled: false,
      dimmerFadeWaveform: 'breath',
      dimmerFadePeriodSeconds: 8,
      dimmerFadeAnimationId: null,
      dimmerFadeStartedAt: Date.now(),
      setDimmerFadeEnabled: (enabled) => {
        if (enabled) {
          get().startDimmerFadeAutomation();
        } else {
          get().stopDimmerFadeAutomation();
        }
      },
      setDimmerFadeWaveform: (waveform) => {
        set({
          dimmerFadeWaveform: waveform,
          dimmerFadeStartedAt: Date.now(),
        });
      },
      setDimmerFadePeriodSeconds: (seconds) => {
        const nextSeconds = Number.isFinite(seconds)
          ? Math.max(2, Math.min(60, Math.round(seconds)))
          : 8;
        set({
          dimmerFadePeriodSeconds: nextSeconds,
          dimmerFadeStartedAt: Date.now(),
        });
      },
      startDimmerFadeAutomation: () => {
        if (get().dimmerFadeAnimationId) {
          set({ dimmerFadeEnabled: true });
          return;
        }

        const tick = () => {
          const state = get();
          if (!state.dimmerFadeEnabled || isClientSceneTransitionActive(state)) return;

          const periodMs = Math.max(2, state.dimmerFadePeriodSeconds) * 1000;
          const elapsedMs = Date.now() - state.dimmerFadeStartedAt;
          const progress = (elapsedMs % periodMs) / periodMs;
          const level = dimmerFadeLevel(state.dimmerFadeWaveform, progress);
          const targetUpdates = dimmerFadeUpdates(state.fixtures || [], Math.round(level * 255));
          const updates: Record<number, number> = {};

          Object.entries(targetUpdates).forEach(([channelKey, value]) => {
            const channel = Number(channelKey);
            if (state.dmxChannels[channel] !== value) {
              updates[channel] = value;
            }
          });

          if (Object.keys(updates).length > 0) {
            state.setMultipleDmxChannels(updates, true);
          }
        };

        set({
          dimmerFadeEnabled: true,
          dimmerFadeStartedAt: Date.now(),
        });
        tick();

        const intervalId = setInterval(tick, 75);
        set({ dimmerFadeAnimationId: intervalId });
      },
      stopDimmerFadeAutomation: () => {
        const intervalId = get().dimmerFadeAnimationId;
        if (intervalId) {
          clearInterval(intervalId);
        }
        set({
          dimmerFadeEnabled: false,
          dimmerFadeAnimationId: null,
        });
      },
      oscAssignments: new Array(512).fill('').map((_, i) => `/1/fader${i + 1}`),
      superControlOscAddresses: (() => {
        // Load from localStorage or use defaults
        const defaults: Record<string, string> = {
          dimmer: '/supercontrol/dimmer',
          pan: '/supercontrol/pan',
          tilt: '/supercontrol/tilt',
          red: '/supercontrol/red',
          green: '/supercontrol/green',
          blue: '/supercontrol/blue',
          gobo: '/supercontrol/gobo',
          shutter: '/supercontrol/shutter',
          strobe: '/supercontrol/strobe',
          lamp: '/supercontrol/lamp',
          reset: '/supercontrol/reset',
          focus: '/supercontrol/focus',
          zoom: '/supercontrol/zoom',
          iris: '/supercontrol/iris',
          prism: '/supercontrol/prism',
          colorWheel: '/supercontrol/colorwheel',
          goboRotation: '/supercontrol/gobo/rotation',
          finePan: '/supercontrol/pan/fine',
          fineTilt: '/supercontrol/tilt/fine',
          gobo2: '/supercontrol/gobo2',
          frost: '/supercontrol/frost',
          macro: '/supercontrol/macro',
          speed: '/supercontrol/speed',
          panTiltXY: '/supercontrol/pantilt/xy',
          autopilotEnable: '/supercontrol/autopilot/enable',
          autopilotSpeed: '/supercontrol/autopilot/speed',
          autopilotTrackEnabled: '/supercontrol/autopilot/enabled',
          autopilotTrackType: '/supercontrol/autopilot/type',
          autopilotTrackPosition: '/supercontrol/autopilot/position',
          autopilotTrackSize: '/supercontrol/autopilot/size',
          autopilotTrackSpeed: '/supercontrol/autopilot/speed',
          autopilotTrackCenterX: '/supercontrol/autopilot/center/x',
          autopilotTrackCenterY: '/supercontrol/autopilot/center/y',
          autopilotTrackAutoPlay: '/supercontrol/autopilot/autoplay',
          handleFlash: '/supercontrol/action/flash',
          handleStrobe: '/supercontrol/action/strobe/toggle',
          handleResetAll: '/supercontrol/action/reset/all',
          flashSpeed: '/supercontrol/action/flash/speed',
          strobeSpeed: '/supercontrol/action/strobe/speed',
          resetPanTiltToCenter: '/supercontrol/action/pantilt/center',
          resetFinePanTilt: '/supercontrol/action/pantilt/fine/reset',
          sceneNext: '/supercontrol/scene/next',
          scenePrev: '/supercontrol/scene/prev',
          sceneSave: '/supercontrol/scene/save',
          fixtureNext: '/supercontrol/fixture/next',
          fixturePrev: '/supercontrol/fixture/prev',
          fixtureSelectAll: '/supercontrol/fixture/selectall',
          fixtureDeselectAll: '/supercontrol/fixture/deselectall',
          fixtureByTypeMoving: '/supercontrol/fixture/type/moving',
          fixtureByTypeRGB: '/supercontrol/fixture/type/rgb',
          fixtureByTypeDimmer: '/supercontrol/fixture/type/dimmer',
          fixtureByTypeGobo: '/supercontrol/fixture/type/gobo',
        };
        
        try {
          const saved = localStorage.getItem('superControlOscAddresses');
          if (saved) {
            const parsed = JSON.parse(saved);
            return { ...defaults, ...parsed };
          }
        } catch (e) {
          console.error('Failed to load SuperControl OSC addresses from localStorage:', e);
        }
        return defaults;
      })(),
      channelNames: (() => {
        // Load from localStorage or default
        try {
          const saved = localStorage.getItem('dmxChannelNames');
          if (saved) {
            const parsed = JSON.parse(saved);
            const names = new Array(512);
            for (let i = 0; i < 512; i++) {
              names[i] = parsed[i] || `CH ${i + 1}`;
            }
            return names;
          }
        } catch (e) {
          console.error('Failed to load channel names from localStorage:', e);
        }
        return new Array(512).fill('').map((_, i) => `CH ${i + 1}`);
      })(),
      channelRanges: (() => {
        // Load from localStorage or default to full range (0-255) for all channels
        try {
          const saved = localStorage.getItem('dmxChannelRanges');
          if (saved) {
            const parsed = JSON.parse(saved);
            const ranges = new Array(512);
            for (let i = 0; i < 512; i++) {
              ranges[i] = parsed[i] || { min: 0, max: 255 };
            }
            return ranges;
          }
        } catch (e) {
          console.error('Failed to load channel ranges from localStorage:', e);
        }
        return new Array(512).fill(null).map(() => ({ min: 0, max: 255 }));
      })(),
      channelColors: (() => {
        // Load from localStorage or default to empty array
        try {
          const saved = localStorage.getItem('dmxChannelColors');
          if (saved) {
            const parsed = JSON.parse(saved);
            const colors = new Array(512);
            for (let i = 0; i < 512; i++) {
              colors[i] = parsed[i] || '';
            }
            return colors;
          }
        } catch (e) {
          console.error('Failed to load channel colors from localStorage:', e);
        }
        return new Array(512).fill('');
      })(),
      selectedChannels: [],
      pinnedChannels: (() => {
        // Load from localStorage
        try {
          const saved = localStorage.getItem('pinnedChannels');
          if (saved) {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          console.error('Failed to load pinned channels from localStorage:', e);
        }
        return [];
      })(),
      channelJumpTarget: null,
      activeSceneName: null,
      tuningSceneName: null,

      // Navigation State
      navVisibility: {
        main: true,
        midiOsc: true,
        fixture: true,
        scenes: true,
        misc: true
      },

      // Debug Tools
      debugTools: {
        debugButton: true,
        midiMonitor: true,
        oscMonitor: true,
        dmxMonitor: true
      },
      midiInterfaces: [],
      activeInterfaces: [],
      midiMappings: {},
      superControlMidiMappings: loadSuperControlMidiMappings(),
      superControlLearnTarget: null,
      envelopeSpeedMidiMapping: (() => {
        // Load from localStorage
        try {
          const saved = localStorage.getItem('envelopeSpeedMidiMapping');
          if (saved) {
            return JSON.parse(saved);
          }
        } catch (e) {
          console.error('Failed to load envelope speed MIDI mapping from localStorage:', e);
        }
        return null;
      })(),
      midiLearnTarget: null,
      midiLearnScene: null,
      midiMessages: [],
      oscMessages: [], // Initialized oscMessages
      midiActivity: 0, // Default MIDI activity level

      apc40CrossfaderState: {
        sceneAName: null,
        sceneBName: null,
        shiftLatched: false,
        mode: null,
        activeDeck: 'A',
        armedColumns: [],
        soloedGroups: [],
        fullOn: false,
        blackout: false,
        autoGroups: [],
        deviceRoleLabels: [],
        deviceBankIndex: 0,
        deviceBankCount: 0,
        deviceBankAtStart: true,
        deviceBankAtEnd: true,
        deviceBankFlashDirection: null,
        deviceBankFlashUntil: 0,
        activeTrackIndex: null,
        activeGroupId: null,
        activeFixtureIds: [],
        activeTargetLabel: null,
        lastChange: null,
      },
      setApc40SceneA: (name) => set((state) => ({
        apc40CrossfaderState: { ...state.apc40CrossfaderState, sceneAName: name },
      })),
      setApc40SceneB: (name) => set((state) => ({
        apc40CrossfaderState: { ...state.apc40CrossfaderState, sceneBName: name },
      })),
      setApc40Shift: (latched) => set((state) => ({
        apc40CrossfaderState: { ...state.apc40CrossfaderState, shiftLatched: latched },
      })),
      setApc40Mode: (mode) => set((state) => ({
        apc40CrossfaderState: { ...state.apc40CrossfaderState, mode },
      })),
      setApc40StatePatch: (patch) => set((state) => ({
        apc40CrossfaderState: { ...state.apc40CrossfaderState, ...patch },
      })),
      superControlExternalUpdate: null,

      // Audio/BPM State defaults
      bpm: 120, // Default BPM
      isPlaying: false, // Default not playing

      fixtures: (() => {
        // Load from localStorage or default to empty array
        try {
          const saved = localStorage.getItem('artbastard-fixtures');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              debugLog.log('[Store] Loaded fixtures from localStorage:', parsed.length);
              return refreshFixtureCatalogPhotos(parsed);
            }
          }
        } catch (e) {
          console.error('Failed to load fixtures from localStorage:', e);
        }
        return [];
      })(),
      groups: [],
      selectedFixtures: [], // Array of fixture IDs for selection
      fixtureTemplates: (() => {
        const templates = initializeFixtureTemplates();
        // Ensure it's always an array
        return Array.isArray(templates) ? templates : [];
      })(), // Fixture profiles initialized from the canonical fixture catalog

      scenes: [],

      // ACTS (Automated Scene Transition Sequences)
      acts: [],
      actTriggers: [], // Global trigger registry for OSC/MIDI processing
      actPlaybackState: {
        isPlaying: false,
        currentActId: null,
        currentStepIndex: 0,
        stepStartTime: 0,
        stepProgress: 0,
        loopCount: 0,
        playbackSpeed: 1.0
      },

      artNetConfig: {
        ip: "192.168.1.199",
        subnet: 0,
        universe: 0,
        net: 0,
        port: 6454,
        base_refresh_interval: 1000
      },
      artNetStatus: 'disconnected', theme: 'artsnob',
      darkMode: initializeDarkMode(),

      setTheme: (theme) => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
        set({ theme });
      },
      toggleDarkMode: () => {
        set(state => {
          const newDarkMode = !state.darkMode;
          localStorage.setItem('darkMode', String(newDarkMode));
          document.documentElement.setAttribute('data-theme', newDarkMode ? 'dark' : 'light');
          const colors = applyModeAwarePreset(
            newDarkMode,
            localStorage.getItem('themePresetId')
          );

          return { darkMode: newDarkMode, themeColors: colors };
        });
      },

      // UI Settings Actions
      updateUiSettings: (settings) => {
        set(state => {
          const newSettings = { ...state.uiSettings, ...settings };
          try {
            localStorage.setItem('uiSettings', JSON.stringify(newSettings));
            // Apply CSS custom properties when saving
            const root = document.documentElement;
            if (newSettings.fontSize !== undefined) {
              root.style.setProperty('--ui-font-size', `${newSettings.fontSize}`);
            }
            if (newSettings.lineHeight !== undefined) {
              root.style.setProperty('--ui-line-height', `${newSettings.lineHeight}`);
            }
            if (newSettings.letterSpacing !== undefined) {
              root.style.setProperty('--ui-letter-spacing', `${newSettings.letterSpacing}px`);
            }
            if (newSettings.borderRadius !== undefined) {
              root.style.setProperty('--ui-border-radius', `${newSettings.borderRadius}px`);
            }
            if (newSettings.spacing !== undefined) {
              root.style.setProperty('--ui-spacing', `${newSettings.spacing}`);
            }
            if (newSettings.animationSpeed !== undefined) {
              root.style.setProperty('--ui-animation-speed', `${newSettings.animationSpeed}`);
            }
            if (newSettings.fontFamily !== undefined) {
              root.style.setProperty('--ui-font-family', newSettings.fontFamily);
              document.body.style.fontFamily = newSettings.fontFamily;
            }
            if (newSettings.fontFamilyHeading !== undefined) {
              root.style.setProperty('--ui-font-family-heading', newSettings.fontFamilyHeading);
            }
            if (newSettings.fontWeight !== undefined) {
              root.style.setProperty('--ui-font-weight', `${newSettings.fontWeight}`);
            }
            if (newSettings.fontWeightHeading !== undefined) {
              root.style.setProperty('--ui-font-weight-heading', `${newSettings.fontWeightHeading}`);
            }
          } catch (error) {
            console.warn('Failed to save uiSettings to localStorage:', error);
          }
          return { uiSettings: newSettings };
        });
      },
      setDmxVisualEffects: (level) => {
        set(state => {
          const newSettings: UiSettings = { ...state.uiSettings, dmxVisualEffects: level };
          try {
            localStorage.setItem('uiSettings', JSON.stringify(newSettings));
          } catch (error) {
            console.warn('Failed to save uiSettings to localStorage:', error);
          }
          return { uiSettings: newSettings };
        });
      },
      updateThemeColors: (colors) => {
        set(state => {
          const newColors = { ...state.themeColors, ...colors };
          try {
            localStorage.setItem('themeColors', JSON.stringify(newColors));
            applyThemeColorsToDocument(newColors);
            const presetId = localStorage.getItem('themePresetId');
            const preset = presetId ? getPresetById(presetId) : undefined;
            if (preset) applyRackChrome(preset.rack);
          } catch (error) {
            console.warn('Failed to save themeColors to localStorage:', error);
          }
          return { themeColors: newColors };
        });
      },
      applyThemePresetId: (presetId, preferDark) => {
        const preset = getPresetById(presetId);
        if (!preset) return;

        const nextDarkMode = preferDark ?? preset.preferDark ?? get().darkMode;
        document.documentElement.setAttribute('data-theme', nextDarkMode ? 'dark' : 'light');
        const colors: ThemeColorsHsl = applyThemePreset(preset);

        try {
          localStorage.setItem('darkMode', String(nextDarkMode));
          localStorage.setItem('themePresetId', preset.id);
          localStorage.setItem('themeColors', JSON.stringify(colors));
        } catch (error) {
          console.warn('Failed to save theme preset to localStorage:', error);
        }

        set({ darkMode: nextDarkMode, themeColors: colors });
      },

      saveAppearanceToServer: async (appearance: import('../utils/themeUtils').AppearanceSettings) => {
        try {
          const { saveAppearance } = await import('../utils/themeApi');
          await saveAppearance(appearance);
        } catch (error) {
          console.warn('Failed to save appearance to server:', error);
        }
      },

      loadAppearanceFromServer: async () => {
        try {
          const { fetchAppearance } = await import('../utils/themeApi');
          const appearance = await fetchAppearance();
          if (!appearance) return;
          if (typeof appearance.darkMode === 'boolean') {
            const current = document.documentElement.getAttribute('data-theme') === 'dark';
            if (appearance.darkMode !== current) get().toggleDarkMode();
          }
          if (appearance.themePresetId) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const preset = getModeAwarePreset(appearance.themePresetId, isDark);
            localStorage.setItem('themePresetId', preset.id);
            if (preset) applyRackChrome(preset.rack);
          }
          if (appearance.themeColors) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const requestedPresetId = appearance.themePresetId ?? localStorage.getItem('themePresetId');
            const requestedPreset = requestedPresetId ? getPresetById(requestedPresetId) : undefined;
            const preset = getModeAwarePreset(requestedPresetId, isDark);
            const canUseServerColors = isDark || requestedPreset?.preferDark === false;
            const merged = canUseServerColors ? { ...get().themeColors, ...appearance.themeColors } : preset.colors;
            applyThemeColorsToDocument(merged);
            applyRackChrome(preset.rack);
            localStorage.setItem('themeColors', JSON.stringify(merged));
            set({ themeColors: merged });
          }
          if (appearance.theme) {
            get().setTheme(appearance.theme as 'artsnob' | 'standard' | 'minimal');
          }
        } catch (error) {
          console.warn('Failed to load appearance from server:', error);
        }
      },

      // statusMessage: null, // Deprecated
      notifications: [],
      // UI Settings
      uiSettings: initializeUiSettings(),
      themeColors: (() => {
        const storedPresetId = localStorage.getItem('themePresetId');
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const modePreset = getModeAwarePreset(storedPresetId, isDark);
        const storedPreset = storedPresetId ? getPresetById(storedPresetId) : undefined;
        const useStoredColors = Boolean(storedPreset && storedPreset.id === modePreset.id);
        const colors = useStoredColors ? initializeThemeColors() : modePreset.colors;

        applyThemeColorsToDocument(colors);
        applyRackChrome(modePreset.rack);

        try {
          localStorage.setItem('themePresetId', modePreset.id);
          if (!useStoredColors) localStorage.setItem('themeColors', JSON.stringify(colors));
        } catch {
          // Local storage may be unavailable in tests.
        }

        return colors;
      })(),

      oscActivity: {},
      debugModules: {
        midi: false,
        osc: false,
        artnet: false,
        button: true
      },
      exampleSliderValue: 0,
      fixtureLayout: [],
      placedFixtures: [],
      masterSliders: [],
      canvasBackgroundImage: null,

      // Scene Transition State Init
      isTransitioning: false,
      transitionStartTime: null,
      transitionDuration: 1000, // Default 1 second
      transitionEasing: 'easeInOut', // Default to smooth easing
      fromDmxValues: null,
      toDmxValues: null,
      currentTransitionFrame: null,
      lastDmxTransitionUpdate: null,
      lastTransitionDmxValues: null,
      socket: null,
      setSocket: (socket) => set({ socket }),

      // MIDI Clock Sync State Init
      availableMidiClockHosts: [
        { id: 'internal', name: 'Internal Clock' },
        // Other hosts would be populated dynamically
      ],
      selectedMidiClockHostId: 'internal',
      midiClockInputs: [],
      selectedMidiClockInputName: null,
      lastMidiClockInputName: null,
      lastMidiClockInputAt: null,
      midiClockInputStatus: 'none',
      midiClockBpm: 120.0,
      abletonLinkPeers: 0,
      abletonLinkAvailable: false,
      dmxFaderOrientation: (() => {
        try {
          const saved = localStorage.getItem('dmxFaderOrientation');
          if (saved === 'vertical' || saved === 'horizontal') return saved;
          return shouldUseTouchOptimizedChrome() ? 'vertical' : 'horizontal';
        } catch {
          return 'horizontal';
        }
      })(),
      dmxChannelsPerRow: (() => {
        try {
          const raw = localStorage.getItem('dmxChannelsPerRow');
          const n = raw ? parseInt(raw, 10) : 0;
          return Number.isFinite(n) && n >= 0 && n <= 128 ? n : 0;
        } catch {
          return 0;
        }
      })(),
      channelTicksOnlyOverrides: (() => {
        try {
          const raw = localStorage.getItem('dmxChannelTicksOnlyOverrides');
          if (!raw) return {};
          const parsed = JSON.parse(raw) as Record<string, boolean>;
          const out: Record<number, boolean> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            const idx = parseInt(k, 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx < 512) out[idx] = Boolean(v);
          });
          return out;
        } catch {
          return {};
        }
      })(),
      channelAuxFullFaderOverrides: (() => {
        try {
          const raw = localStorage.getItem('dmxChannelAuxFullFaderOverrides');
          if (!raw) return {};
          const parsed = JSON.parse(raw) as Record<string, boolean>;
          const out: Record<number, boolean> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            const idx = parseInt(k, 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx < 512) out[idx] = Boolean(v);
          });
          return out;
        } catch {
          return {};
        }
      })(),
      activeSessionId: (() => {
        try {
          const v = localStorage.getItem('artbastard-session-id');
          return v && v.trim() ? v.trim().slice(0, 64) : 'default';
        } catch {
          return 'default';
        }
      })(),
      sessionsList: [],
      bridgeConnected: false,
      bridgeInfo: null,
      connectedClientCount: 0,
      midiClockIsPlaying: false,
      midiClockCurrentBeat: 1,
      midiClockCurrentBar: 1,

      // Auto-Scene Feature State Init - Load from localStorage if available
      ...(() => {
        const savedSettings = loadAutoSceneSettings();
        return {
          autoSceneEnabled: savedSettings.autoSceneEnabled ?? false,
          autoSceneList: savedSettings.autoSceneList ?? [],
          autoSceneMode: savedSettings.autoSceneMode ?? 'forward',
          automationDirection: 'forward' as const,
          autoSceneCurrentIndex: -1, // Always start fresh, don't persist current index
          autoScenePingPongDirection: 'forward', // Always start fresh
          autoSceneBeatDivision: savedSettings.autoSceneBeatDivision ?? 4,
          autoSceneManualBpm: savedSettings.autoSceneManualBpm ?? 120,
          autoSceneTapTempoBpm: savedSettings.autoSceneTapTempoBpm ?? 120,
          autoSceneLastTapTime: 0, // Don't persist timing state
          autoSceneTapTimes: [], // Don't persist timing state
          autoSceneTempoSource: savedSettings.autoSceneTempoSource ?? 'tap_tempo', autoSceneIsFlashing: false, // Initial flashing state
        };
      })(),

      // Quick Scene State Init
      quickSceneSaveMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('quickSceneSaveMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load quick scene save MIDI mapping:', e);
          return null;
        }
      })(),
      quickSceneMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('quickSceneMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load quick scene load MIDI mapping:', e);
          return null;
        }
      })(),
      quickSceneSaveBMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('quickSceneSaveBMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load quick scene save B MIDI mapping:', e);
          return null;
        }
      })(),
      quickSceneLoadBMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('quickSceneLoadBMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load quick scene load B MIDI mapping:', e);
          return null;
        }
      })(),

      // Tempo Play/Pause State Init
      tempoPlayPauseMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('tempoPlayPauseMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load tempo play/pause MIDI mapping:', e);
          return null;
        }
      })(),
      tempoPlayPauseOscAddress: (() => {
        try {
          const saved = localStorage.getItem('tempoPlayPauseOscAddress');
          return saved || '/tempo/playpause';
        } catch (e) {
          console.error('Failed to load tempo play/pause OSC address:', e);
          return '/tempo/playpause';
        }
      })(),

      // Tap Tempo State Init
      tapTempoMidiMapping: (() => {
        try {
          const saved = localStorage.getItem('tapTempoMidiMapping');
          return saved ? JSON.parse(saved) : null;
        } catch (e) {
          console.error('Failed to load tap tempo MIDI mapping:', e);
          return null;
        }
      })(),
      tapTempoOscAddress: (() => {
        try {
          const saved = localStorage.getItem('tapTempoOscAddress');
          return saved || '/tempo/tap';
        } catch (e) {
          console.error('Failed to load tap tempo OSC address:', e);
          return '/tempo/tap';
        }
      })(),

      // Autopilot Track System Initial State (Legacy - kept for compatibility)
      autopilotTrackEnabled: false,
      autopilotTrackType: 'circle',
      autopilotTrackPosition: 0,
      autopilotTrackSize: 50,
      autopilotTrackSpeed: 50,
      autopilotTrackCenterX: 127,
      autopilotTrackCenterY: 127, autopilotTrackAutoPlay: false,
      autopilotTrackCustomPoints: [],
      autopilotTrackAnimationId: null,

      // Envelope Automation System Initial State
      envelopeAutomation: (() => {
        // Load from localStorage or default
        try {
          const saved = localStorage.getItem('envelopeAutomation');
          if (saved) {
            const parsed = JSON.parse(saved);
            const envelopes = (parsed.envelopes || []).map((e: ChannelEnvelope) =>
              normalizeChannelEnvelope(e)
            );
            return {
              envelopes,
              globalEnabled: false,
              animationId: null,
              speed: parsed.speed || 1.0,
            };
          }
        } catch (e) {
          console.error('Failed to load envelope automation from localStorage:', e);
        }
        return {
          envelopes: [],
          globalEnabled: false,
          animationId: null,
          speed: 1.0
        };
      })(),

      // New Modular Automation System Initial State
      modularAutomation: {
        color: {
          enabled: false,
          type: 'rainbow',
          speed: 1.0,
          colors: [
            { r: 255, g: 0, b: 0 },
            { r: 0, g: 255, b: 0 },
            { r: 0, g: 0, b: 255 },
            { r: 255, g: 255, b: 0 },
            { r: 255, g: 0, b: 255 },
            { r: 0, g: 255, b: 255 }
          ],
          intensity: 100,
          syncToBPM: true,
          hueRange: { start: 0, end: 360 },
          saturation: 100,
          brightness: 100,
          phase: 0
        },
        dimmer: {
          enabled: false,
          type: 'breathe',
          speed: 0.5,
          range: { min: 0, max: 255 },
          syncToBPM: true,
          pattern: 'smooth',
          phase: 0
        },
        panTilt: {
          enabled: false,
          pathType: 'circle',
          size: 50,
          speed: 1.0,
          centerX: 127,
          centerY: 127,
          syncToBPM: true
        },
        effects: {
          enabled: false,
          type: 'gobo_cycle',
          speed: 0.8,
          range: { min: 0, max: 255 },
          syncToBPM: true,
          direction: 'forward'
        },
        animationIds: {
          color: null,
          dimmer: null,
          panTilt: null,
          effects: null
        }
      },

      // Recording and Automation System Initial State
      recordingActive: false,
      recordingStartTime: null,
      recordingData: [],
      automationPlayback: {
        active: false,
        startTime: null,
        duration: 10000, // Default 10 seconds
        position: 0
      },

      // Smooth DMX Output System Initial State  
      smoothDmxEnabled: true, // Enable by default for better performance
      smoothDmxUpdateRate: 30, // 30fps default
      smoothDmxThreshold: 1,
      pendingSmoothUpdates: {},
      lastSmoothUpdateTime: Date.now(),

      // Autopilot System State
      channelAutopilots: {},
      panTiltAutopilot: {
        enabled: false,
        pathType: 'circle',
        speed: 0.5,
        size: 50, // 50% of maximum range
        centerX: 128,
        centerY: 128,
        syncToBPM: false,
        smoothing: 0.6,
        phase: 0
      },
      colorSliderAutopilot: {
        enabled: false,
        type: 'sine',
        speed: 0.2,
        range: { min: 0, max: 360 },
        syncToBPM: false,
        phase: 0
      },
      autopilotUpdateInterval: null,
      lastAutopilotUpdate: Date.now(),

      // Timeline Playback State
      timelineSequences: initialTimelineSequences,
      activeTimelineSequence: null,
      timelinePlayback: {
        active: false,
        sequenceId: null,
        startTime: null,
        position: 0,
        speed: 1.0,
        loop: false
      },

      // Timeline Actions
      playTimelineSequence: (sequenceId, options: { loop?: boolean; speed?: number } = {}) => {
        const sequence = get().timelineSequences.find(s => s.id === sequenceId);
        if (!sequence) {
          console.error(`Timeline sequence ${sequenceId} not found`);
          return;
        }

        const { loop = false, speed = 1.0 } = options;
        const startTime = Date.now();

        set({
          timelinePlayback: {
            active: true,
            sequenceId,
            startTime,
            position: 0,
            speed: Math.max(0.1, Math.min(2.0, speed)),
            loop
          },
          activeTimelineSequence: sequenceId
        });
      },

      stopTimelinePlayback: () => {
        set({
          timelinePlayback: {
            ...get().timelinePlayback,
            active: false,
            startTime: null,
            position: 0
          }
        });
      },

      setTimelineSpeed: (speed) => {
        const clampedSpeed = Math.max(0.1, Math.min(2.0, speed));
        const state = get();
        const playback = state.timelinePlayback;

        // If playback is active, adjust startTime to maintain current position
        if (playback.active && playback.startTime) {
          const sequence = state.timelineSequences.find(s => s.id === playback.sequenceId);
          if (sequence) {
            const now = Date.now();
            const oldElapsed = (now - playback.startTime) * playback.speed;
            const currentPosition = (oldElapsed % sequence.duration) / sequence.duration;
            // Calculate new startTime to maintain position with new speed
            const newElapsed = currentPosition * sequence.duration;
            const newStartTime = now - (newElapsed / clampedSpeed);

            set({
              timelinePlayback: {
                ...playback,
                speed: clampedSpeed,
                startTime: newStartTime
              }
            });
            return;
          }
        }

        set(state => ({
          timelinePlayback: {
            ...state.timelinePlayback,
            speed: clampedSpeed
          }
        }));
      },

      loadTimelineSequence: (sequenceId) => {
        set({ activeTimelineSequence: sequenceId });
      },

      updateTimelineSequence: (sequenceId, updates) => {
        set(state => ({
          timelineSequences: state.timelineSequences.map(seq =>
            seq.id === sequenceId ? { ...seq, ...updates, modifiedAt: Date.now() } : seq
          )
        }));
      },

      deleteTimelineSequence: (sequenceId) => {
        set(state => ({
          timelineSequences: state.timelineSequences.filter(seq => seq.id !== sequenceId),
          activeTimelineSequence: state.activeTimelineSequence === sequenceId ? null : state.activeTimelineSequence
        }));
      },

      _recalculateDmxOutput: () => {
        const { dmxChannels, groups, fixtures, setMultipleDmxChannels } = get();
        const newDmxValuesArray = [...dmxChannels]; // Base DMX state for this calculation run
        const newDmxValuesBatch: DmxChannelBatchUpdate = {};

        const activeSoloGroups = groups.filter(g => g.isSolo);

        fixtures.forEach((fixture, fixtureIdx) => {
          const fixtureGroups = groups.filter(g => g.fixtureIndices.includes(fixtureIdx));

          let isFixtureSoloActive = true;
          if (activeSoloGroups.length > 0) {
            isFixtureSoloActive = fixtureGroups.some(fg => activeSoloGroups.some(asg => asg.id === fg.id));
          }

          fixture.channels.forEach((channel, channelIdx) => {
            const dmxAddress = fixture.startAddress + channelIdx - 1; // 0-indexed
            if (dmxAddress < 0 || dmxAddress >= 512) return;

            let baseValueForGroupEffects = newDmxValuesArray[dmxAddress];
            let currentChannelValue = baseValueForGroupEffects; // Initialize with base

            if (fixtureGroups.length > 0) {
              const firstGroup = fixtureGroups[0]; // Prioritize the first group for P/T/Z, Master, Mute logic

              // Determine base value for intensity effects if lastStates is available
              const channelTypeUpper = channel.type.toUpperCase();
              if (channelTypeUpper === 'DIMMER' || channelTypeUpper === 'INTENSITY') {
                if (firstGroup.masterValue > 0 && firstGroup.lastStates && firstGroup.lastStates.length === 512) {
                  baseValueForGroupEffects = firstGroup.lastStates[dmxAddress];
                }
                // If masterValue is 0, or lastStates isn't valid, baseValueForGroupEffects remains newDmxValuesArray[dmxAddress]
                // which will correctly become 0 if muted or master is 0.
                currentChannelValue = baseValueForGroupEffects; // Re-initialize for intensity channel based on lastStates logic
              }

              // Apply Group P/T/Z (operates on currentChannelValue, which is from newDmxValuesArray unless it's an intensity channel using lastStates)
              // For PAN/TILT/ZOOM, they typically operate on whatever the current DMX value is (e.g. from a scene or manual override).
              // If P/T/Z channels are also intensity, the baseValueForGroupEffects logic for intensity above would apply.
              // However, typically P/T/Z are separate or combined with intensity where master/mute applies to intensity part.
              // Let's assume P/T/Z apply to the initial `newDmxValuesArray[dmxAddress]` value.
              let ptzModifiedValue = newDmxValuesArray[dmxAddress]; // Use initial DMX for P/T/Z base

              if (firstGroup.panOffset !== undefined && channel.type.toUpperCase() === 'PAN') {
                ptzModifiedValue = Math.max(0, Math.min(255, ptzModifiedValue + firstGroup.panOffset));
              }
              if (firstGroup.tiltOffset !== undefined && channel.type.toUpperCase() === 'TILT') {
                ptzModifiedValue = Math.max(0, Math.min(255, ptzModifiedValue + firstGroup.tiltOffset));
              }
              if (firstGroup.zoomValue !== undefined && channel.type.toUpperCase() === 'ZOOM') {
                ptzModifiedValue = Math.max(0, Math.min(255, firstGroup.zoomValue)); // Zoom is absolute
              }

              // If the channel is NOT intensity/dimmer, P/T/Z applies directly.
              // If it IS intensity/dimmer, P/T/Z effect is on the non-intensity aspect (which we assume is separate here).
              // The `currentChannelValue` for intensity is based on `baseValueForGroupEffects`.
              // This logic assumes P/T/Z are not the *same* channels as master/mute sensitive intensity.
              // If they are (e.g. a moving head's dimmer channel), this logic needs refinement.
              // For now, if it's PAN/TILT/ZOOM, we take that value. If it's DIMMER/INTENSITY, we proceed with its own base.
              if (channelTypeUpper === 'PAN' || channelTypeUpper === 'TILT' || channelTypeUpper === 'ZOOM') {
                currentChannelValue = ptzModifiedValue;
              }


              // Apply Group Master/Mute for intensity/dimmer channels
              if (channelTypeUpper === 'DIMMER' || channelTypeUpper === 'INTENSITY') {
                if (firstGroup.isMuted) {
                  currentChannelValue = 0;
                } else {
                  // Master value scales the chosen base (either from lastStates or current DMX)
                  currentChannelValue = Math.round(baseValueForGroupEffects * (firstGroup.masterValue / 255));
                }
              }
            }

            // Apply Solo Logic for intensity/dimmer channels
            const channelTypeUpper = channel.type.toUpperCase(); // Re-check for safety, though already have it
            if (channelTypeUpper === 'DIMMER' || channelTypeUpper === 'INTENSITY') {
              if (!isFixtureSoloActive) {
                currentChannelValue = 0;
              }
            }

            const finalValue = Math.max(0, Math.min(255, Math.round(currentChannelValue)));
            if (newDmxValuesArray[dmxAddress] !== finalValue || !(dmxAddress in newDmxValuesBatch)) {
              // Update batch if value changed OR if it wasn't set by a prior fixture but needs to be included
              newDmxValuesBatch[dmxAddress] = finalValue;
            }
            // We don't write to newDmxValuesArray here because each fixture's calculation should start from the original dmxChannels snapshot
            // or its group's lastStates, not be influenced by other groups' calculations in the same pass, to avoid order dependency issues.
            // The batch update will apply all final values at the end.
          });
        });

        // Create a full batch if any calculation path could have missed setting a value
        // For safety, ensure all 512 channels are in the batch if any processing happened.
        // A more optimized way would be to only send changed values, but _recalculateDmxOutput implies a full refresh.
        // The current logic for newDmxValuesBatch only includes changed values.
        // Let's ensure that if we started with dmxChannels, and applied group logic, the result is what we send.
        // The `setMultipleDmxChannels` expects a DmxChannelBatchUpdate (Record<number, number>).
        // We need to convert the `newDmxValuesArray` (which has been implicitly modified if we were writing to it)
        // or build up the `newDmxValuesBatch` correctly.

        // Correct approach: newDmxValuesArray is the "scratchpad" that gets modified to final values.
        // Then compare newDmxValuesArray to original dmxChannels to build the minimal batch.
        const finalBatch: DmxChannelBatchUpdate = {};
        let hasChanges = false;
        for (let i = 0; i < 512; i++) {
          // The loop above calculates final values and puts them into newDmxValuesBatch if they changed from original newDmxValuesArray[i]
          // However, the newDmxValuesArray itself was NOT updated inside the loop.
          // This means the `baseValueForGroupEffects` was always from the original dmxChannels or lastStates.
          // This is correct to avoid inter-group calculation order dependencies.
          // The `newDmxValuesBatch` should correctly contain all intended changes.
        }
        // The current newDmxValuesBatch logic seems correct: it only adds if finalValue is different from the original state of newDmxValuesArray[dmxAddress]

        if (Object.keys(newDmxValuesBatch).length > 0) {
          // Before setting, update the local dmxChannels state completely with the results of this calculation pass
          // This ensures that `get().dmxChannels` is the new calculated state *before* `setMultipleDmxChannels` (which might be async for backend)
          const fullyCalculatedDmxState = [...get().dmxChannels];
          for (const addr in newDmxValuesBatch) {
            fullyCalculatedDmxState[parseInt(addr)] = newDmxValuesBatch[addr];
          }
          set({ dmxChannels: fullyCalculatedDmxState });

          enqueueDmxBackendUpdates(newDmxValuesBatch, () => {
            get().addNotification({ message: 'Failed to apply group DMX calculations', type: 'error', priority: 'high' });
          });
        }
      },

      // Actions
      fetchInitialState: async () => {
        try {
          debugLog.log('🔄 Fetching initial state from server...');
          const response = await axios.get('/api/state', {
            timeout: 5000,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })

          if (response.status === 200 && response.data) {
            const state = response.data
            debugLog.log('📥 Received initial state from server:', {
              dmxChannels: state.dmxChannels?.filter((val: number) => val > 0).length || 0,
              scenes: state.scenes?.length || 0,
              fixtures: state.fixtures?.length || 0,
              groups: state.groups?.length || 0
            });

            // Load channel ranges from backend or use defaults
            const backendRanges = state.channelRanges;
            let loadedRanges: ChannelRange[];
            if (backendRanges && Array.isArray(backendRanges)) {
              loadedRanges = backendRanges;
              // Ensure array is 512 elements
              while (loadedRanges.length < 512) {
                loadedRanges.push({ min: 0, max: 255 });
              }
              // Save to localStorage for consistency
              try {
                localStorage.setItem('dmxChannelRanges', JSON.stringify(loadedRanges));
              } catch (e) {
                console.error('Failed to save channel ranges to localStorage:', e);
              }
            } else {
              // Fallback to localStorage or defaults
              try {
                const saved = localStorage.getItem('dmxChannelRanges');
                if (saved) {
                  const parsed = JSON.parse(saved);
                  loadedRanges = parsed;
                  while (loadedRanges.length < 512) {
                    loadedRanges.push({ min: 0, max: 255 });
                  }
                } else {
                  loadedRanges = new Array(512).fill(null).map(() => ({ min: 0, max: 255 }));
                }
              } catch (e) {
                console.error('Failed to load channel ranges from localStorage:', e);
                loadedRanges = new Array(512).fill(null).map(() => ({ min: 0, max: 255 }));
              }
            }

            // Ensure fixtures have required fields (id, type)
            const normalizedFixtures = (state.fixtures || []).map((fixture: Fixture, index: number) => {
              // If fixture doesn't have an id, generate one
              if (!fixture.id) {
                fixture.id = fixture.id || `fixture-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
              }
              // Ensure type field exists
              if (!fixture.type) {
                fixture.type = fixture.type || 'generic';
              }
              return fixture;
            });

            set({
              dmxChannels: state.dmxChannels || new Array(512).fill(0),
              oscAssignments: state.oscAssignments || new Array(512).fill('').map((_, i) => `/fixture/DMX${i + 1}`),
              channelNames: state.channelNames || new Array(512).fill('').map((_, i) => `CH ${i + 1}`),
              channelRanges: loadedRanges,
              fixtures: normalizedFixtures,
              groups: state.groups || [],
              midiMappings: state.midiMappings || {},
              artNetConfig: state.artNetConfig || get().artNetConfig,
              scenes: state.scenes || [],
              acts: state.acts || [],
              fixtureLayout: state.fixtureLayout || [],
              masterSliders: state.masterSliders || []
            })

            if (state.settings && typeof state.settings.transitionDuration === 'number') {
              set({ transitionDuration: state.settings.transitionDuration });
            }

            debugLog.log('✅ Initial state applied successfully');
            void get().loadAppearanceFromServer();
            return
          }
          throw new Error('Invalid response from server')
        } catch (error: unknown) {
          console.error('❌ Failed to fetch initial state:', error)
          get().addNotification({
            message:
              (error as any)?.code === 'ECONNABORTED'
                ? 'Connection timeout - please check server status'
                : 'Failed to fetch initial state - using default values',
            type: 'error',
            priority: 'high',
            persistent: true
          })

          // Only set default values if we don't have existing data
          // This prevents clearing fixtures during navigation when server is unavailable
          const currentState = get()
          const hasExistingFixtures = currentState.fixtures && currentState.fixtures.length > 0

          if (!hasExistingFixtures) {
            set({
              dmxChannels: new Array(512).fill(0),
              oscAssignments: new Array(512).fill('').map((_, i) => `/1/fader${i + 1}`),
              channelNames: new Array(512).fill('').map((_, i) => `CH ${i + 1}`),
              fixtures: [],
              groups: [],
              midiMappings: {},
              scenes: [],
              fixtureLayout: [],
              masterSliders: [],
              transitionDuration: 1000,
            })
          } else {
            // If we have existing fixtures, only set essential defaults for missing data
            set({
              dmxChannels: currentState.dmxChannels || new Array(512).fill(0),
              oscAssignments: currentState.oscAssignments || new Array(512).fill('').map((_, i) => `/fixture/DMX${i + 1}`),
              channelNames: currentState.channelNames || new Array(512).fill('').map((_, i) => `CH ${i + 1}`),
              // Keep existing fixtures, groups, etc.
              midiMappings: currentState.midiMappings || {},
              scenes: currentState.scenes || [],
              masterSliders: currentState.masterSliders || [],
              transitionDuration: currentState.transitionDuration || 1000,
            })
          }
        }
      },

      getDmxChannelValue: (channel) => {
        const dmxChannels = get().dmxChannels;
        if (channel >= 0 && channel < dmxChannels.length) {
          return dmxChannels[channel] || 0;
        }
        return 0;
      },

      setDmxChannel: (channel, value, sendToBackend = true) => {
        debugLog.log(`[STORE] setDmxChannel called: channel=${channel}, value=${value}, sendToBackend=${sendToBackend}`);

        const guardedValue = get().strobeSafetyEnabled
          ? strobeSafetyValueForChannel(get().fixtures || [], channel) ?? value
          : value;

        // Get channel range and clamp value
        const channelRange = get().getChannelRange(channel);
        const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, guardedValue));

        const dmxChannels = [...get().dmxChannels]
        dmxChannels[channel] = clampedValue
        set({ dmxChannels })

        if (sendToBackend && !get().dmxFrozen) {
          debugLog.log(`[STORE] Queueing DMX backend update: channel=${channel}, value=${clampedValue}`);
          enqueueDmxBackendChannel(channel, clampedValue, () => {
            get().addNotification({ message: 'Failed to update DMX channel', type: 'error', priority: 'high' })
          })
        } else if (sendToBackend && get().dmxFrozen) {
          debugLog.log(`[STORE] DMX backend send suppressed (FROZEN): channel=${channel}, value=${clampedValue}`);
        } else {
          debugLog.log(`[STORE] DMX channel updated locally (no backend request): channel=${channel}, value=${clampedValue}`);
        }
      },

      setMultipleDmxChannels: (updates, sendToBackend = true) => {
        debugLog.log('[STORE] setMultipleDmxChannels: Called with updates batch:', updates, 'sendToBackend:', sendToBackend);
        const currentDmxChannels = get().dmxChannels;
        const newDmxChannels = [...currentDmxChannels];
        const guardedUpdates: Record<number, number> = {};
        let changesApplied = false;
        for (const channelStr in updates) {
          const channel = parseInt(channelStr, 10);
          if (channel >= 0 && channel < newDmxChannels.length) {
            const requestedValue = updates[channel];
            const safeValue = get().strobeSafetyEnabled
              ? strobeSafetyValueForChannel(get().fixtures || [], channel)
              : undefined;
            const nextValue = safeValue ?? requestedValue;
            guardedUpdates[channel] = nextValue;
            if (newDmxChannels[channel] !== nextValue) { // Check if value actually changes
              newDmxChannels[channel] = nextValue;
              changesApplied = true;
            }
          }
        }

        if (changesApplied) {
          set({ dmxChannels: newDmxChannels });
          debugLog.log('[STORE] setMultipleDmxChannels: Applied changes to local DMX state.');
        } else {
          debugLog.log('[STORE] setMultipleDmxChannels: No actual changes to local DMX state after processing batch.');
        }

        if (sendToBackend && !get().dmxFrozen) {
          debugLog.log('[STORE] setMultipleDmxChannels: Queueing backend DMX batch:', guardedUpdates);
          enqueueDmxBackendUpdates(guardedUpdates, () => {
            get().addNotification({ message: 'Failed to send DMX batch update to server', type: 'error', priority: 'high' });
          });
        } else if (sendToBackend && get().dmxFrozen) {
          debugLog.log('[STORE] setMultipleDmxChannels: backend send suppressed (FROZEN)');
        } else {
          debugLog.log('[STORE] setMultipleDmxChannels: Skipping backend request (sendToBackend=false)');
        }
      },

      blackoutAllDmxChannels: (sendToBackend = true) => {
        const zeroChannels = new Array(512).fill(0);
        const zeroUpdates: Record<number, number> = {};
        for (let channel = 0; channel < 512; channel += 1) {
          zeroUpdates[channel] = 0;
        }

        const dimmerFadeIntervalId = get().dimmerFadeAnimationId;
        if (dimmerFadeIntervalId) {
          clearInterval(dimmerFadeIntervalId);
        }

        set({
          dmxChannels: zeroChannels,
          dmxFrozen: false,
          dimmerFadeEnabled: false,
          dimmerFadeAnimationId: null,
          dimmerFadeStartedAt: Date.now(),
        });

        if (sendToBackend) {
          debugLog.log('[STORE] blackoutAllDmxChannels: Queueing full-universe blackout batch');
          enqueueDmxBackendUpdates(zeroUpdates, () => {
            get().addNotification({ message: 'Failed to send factory reset blackout', type: 'error', priority: 'high' });
          });
        }
      },

      setDmxChannelValue: (channel, value) => {
        get().setDmxChannel(channel, value);

        // Record the change if recording is active
        const { recordingActive } = get();
        if (recordingActive) {
          get().addRecordingEvent({
            type: 'dmx',
            channel,
            value: get().getDmxChannelValue(channel)
          });
        }
      },

      setDmxChannelsForTransition: (values) => {
        const nextValues = get().strobeSafetyEnabled
          ? applyStrobeSafetyToDmxValues(get().fixtures || [], values)
          : values;

        // Update local state
        set({ dmxChannels: nextValues });

        // Balanced approach - responsive but not spammy
        const now = Date.now();
        const { lastDmxTransitionUpdate, lastTransitionDmxValues, transitionStartTime, transitionDuration } = get();
        const updateInterval = 100; // Send DMX updates every 100ms (10fps) - more responsive

        // Always send final update when transition is complete
        const isTransitionComplete = transitionStartTime && (now - transitionStartTime) >= transitionDuration;

        if (isTransitionComplete || !lastDmxTransitionUpdate || (now - lastDmxTransitionUpdate) >= updateInterval) {
          // Only send channels that actually changed
          const updates: Record<number, number> = {};
          let hasChanges = false;

          if (lastTransitionDmxValues) {
            // Compare with last sent values - send meaningful changes
            for (let i = 0; i < nextValues.length && i < 512; i++) {
              const currentValue = nextValues[i] || 0;
              const lastValue = lastTransitionDmxValues[i] || 0;

              // Only include channels that changed by more than 3 DMX values (more responsive)
              if (Math.abs(currentValue - lastValue) > 3) {
                updates[i] = currentValue;
                hasChanges = true;
              }
            }
          } else {
            // First update - send all non-zero values
            for (let i = 0; i < nextValues.length && i < 512; i++) {
              const currentValue = nextValues[i] || 0;
              if (currentValue > 0) {
                updates[i] = currentValue;
                hasChanges = true;
              }
            }
          }

          // Send if there are changes OR if transition is complete (to ensure final values are set)
          if (hasChanges || isTransitionComplete) {
            if (isTransitionComplete) {
              const finalUpdates: Record<number, number> = {};
              const baseline = lastTransitionDmxValues || [];
              for (let i = 0; i < nextValues.length && i < 512; i++) {
                const currentValue = nextValues[i] || 0;
                const lastSent = baseline[i] || 0;
                if (currentValue !== lastSent) {
                  finalUpdates[i] = currentValue;
                }
              }
              enqueueDmxBackendUpdates(finalUpdates);
            } else {
              // Regular update - only changed channels
              enqueueDmxBackendUpdates(updates);
            }
          }

          // Update tracking values
          set({
            lastDmxTransitionUpdate: now,
            lastTransitionDmxValues: [...nextValues]
          });
        }
      },

      setCurrentTransitionFrameId: (frameId) => set({ currentTransitionFrame: frameId }),

      clearTransitionState: () => {
        set({
          isTransitioning: false,
          transitionStartTime: null,
          fromDmxValues: null,
          toDmxValues: null,
          currentTransitionFrame: null,
          lastDmxTransitionUpdate: null,
          lastTransitionDmxValues: null,
        });
        dispatchSceneTransitionComplete();
      },

      setTransitionDuration: (duration) => {
        if (duration >= 0) {
          set({ transitionDuration: duration });
        }
      },

      setTransitionEasing: (easing) => {
        set({ transitionEasing: easing });
      },

      selectChannel: (channel) => {
        const selectedChannels = [...get().selectedChannels]
        if (!selectedChannels.includes(channel)) {
          selectedChannels.push(channel)
          set({ selectedChannels })
        }
      },

      deselectChannel: (channel) => {
        const selectedChannels = get().selectedChannels.filter(ch => ch !== channel)
        set({ selectedChannels })
      },

      toggleChannelSelection: (channel) => {
        const selectedChannels = [...get().selectedChannels]
        const index = selectedChannels.indexOf(channel)

        if (index === -1) {
          selectedChannels.push(channel)
        } else {
          selectedChannels.splice(index, 1)
        }

        set({ selectedChannels })
      },

      selectAllChannels: () => {
        const selectedChannels = Array.from({ length: 512 }, (_, i) => i)
        set({ selectedChannels })
      },

      deselectAllChannels: () => {
        set({ selectedChannels: [] })
      },

      invertChannelSelection: () => {
        const currentSelection = get().selectedChannels
        const allChannels = Array.from({ length: 512 }, (_, i) => i)
        const newSelection = allChannels.filter(ch => !currentSelection.includes(ch))
        set({ selectedChannels: newSelection })
      },

      // Fixture Selection Functions
      selectNextFixture: () => {
        const { fixtures, selectedFixtures } = get();
        if (fixtures.length === 0) return;

        let nextIndex = 0;
        if (selectedFixtures.length > 0) {
          const currentIndex = fixtures.findIndex(f => f.id === selectedFixtures[0]);
          nextIndex = (currentIndex + 1) % fixtures.length;
        }

        const nextFixture = fixtures[nextIndex];
        if (nextFixture) {
          set({ selectedFixtures: [nextFixture.id] });
          get().addNotification({
            message: `Selected fixture: ${nextFixture.name}`,
            type: 'info',
            priority: 'low'
          });
        }
      },

      selectPreviousFixture: () => {
        const { fixtures, selectedFixtures } = get();
        if (fixtures.length === 0) return;

        let prevIndex = fixtures.length - 1;
        if (selectedFixtures.length > 0) {
          const currentIndex = fixtures.findIndex(f => f.id === selectedFixtures[0]);
          prevIndex = currentIndex === 0 ? fixtures.length - 1 : currentIndex - 1;
        }

        const prevFixture = fixtures[prevIndex];
        if (prevFixture) {
          set({ selectedFixtures: [prevFixture.id] });
          get().addNotification({
            message: `Selected fixture: ${prevFixture.name}`,
            type: 'info',
            priority: 'low'
          });
        }
      },

      selectAllFixtures: () => {
        const { fixtures } = get();
        set({ selectedFixtures: fixtures.map(f => f.id) });
        get().addNotification({
          message: `Selected all ${fixtures.length} fixtures`,
          type: 'info',
          priority: 'low'
        });
      },

      selectFixturesByType: (channelType: string) => {
        const { fixtures } = get();
        const filteredFixtures = fixtures.filter(fixture =>
          fixture.channels.some(ch => ch.type.toLowerCase() === channelType.toLowerCase())
        );

        set({ selectedFixtures: filteredFixtures.map(f => f.id) });
        get().addNotification({
          message: `Selected ${filteredFixtures.length} fixtures with ${channelType} channels`,
          type: 'info',
          priority: 'low'
        });
      },

      selectFixtureGroup: (groupId: string) => {
        const { fixtures, groups } = get();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        const groupFixtures = group.fixtureIndices
          .map(index => fixtures[index])
          .filter(Boolean)
          .map(f => f.id);

        set({ selectedFixtures: groupFixtures });
        get().addNotification({
          message: `Selected group: ${group.name} (${groupFixtures.length} fixtures)`,
          type: 'info',
          priority: 'low'
        });
      },

      deselectAllFixtures: () => {
        set({ selectedFixtures: [] });
        get().addNotification({
          message: 'Deselected all fixtures',
          type: 'info',
          priority: 'low'
        });
      },

      setSelectedFixtures: (fixtureIds: string[]) => {
        set({ selectedFixtures: fixtureIds });
      },

      toggleFixtureSelection: (fixtureId: string) => {
        const { selectedFixtures } = get();
        const newSelection = selectedFixtures.includes(fixtureId)
          ? selectedFixtures.filter(id => id !== fixtureId)
          : [...selectedFixtures, fixtureId];
        set({ selectedFixtures: newSelection });
      },

      // Placed Fixture Actions
      addPlacedFixture: (fixture: Omit<PlacedFixture, 'id'>) => {
        const { placedFixtures } = get();
        const newFixture: PlacedFixture = {
          ...fixture,
          id: `placed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          // Ensure dmxAddress is set from startAddress if not provided
          dmxAddress: fixture.dmxAddress || fixture.startAddress || 1,
          // Ensure type is set
          type: fixture.type || 'generic'
        };
        set({ placedFixtures: [...placedFixtures, newFixture] });
      },

      updatePlacedFixture: (id: string, updates: Partial<PlacedFixture>) => {
        const { placedFixtures } = get();
        const updatedFixtures = placedFixtures.map(fixture =>
          fixture.id === id ? { ...fixture, ...updates } : fixture
        );
        set({ placedFixtures: updatedFixtures });
      },

      removePlacedFixture: (id: string) => {
        const { placedFixtures } = get();
        const filteredFixtures = placedFixtures.filter(fixture => fixture.id !== id);
        set({ placedFixtures: filteredFixtures });
      },

      setChannelName: (channel, name) => {
        const channelNames = [...get().channelNames];
        // Ensure array is long enough
        while (channelNames.length <= channel) {
          channelNames.push('');
        }
        channelNames[channel] = name;
        set({ channelNames });

        // Save to localStorage
        try {
          localStorage.setItem('dmxChannelNames', JSON.stringify(channelNames));
        } catch (e) {
          console.error('Failed to save channel names to localStorage:', e);
        }

        // Save to backend if needed
        try {
          axios.post('/api/dmx/channel-name', { channelIndex: channel, name })
            .catch(error => {
              console.error('Failed to save channel name:', error);
            });
        } catch (error) {
          // Silently fail if backend endpoint doesn't exist yet
        }
      },

      setChannelRange: (channel, min, max) => {
        const channelRanges = [...get().channelRanges];
        // Ensure array is long enough
        while (channelRanges.length <= channel) {
          channelRanges.push({ min: 0, max: 255 });
        }
        // Ensure min <= max and values are valid
        const validMin = Math.max(0, Math.min(255, min));
        const validMax = Math.max(0, Math.min(255, max));
        channelRanges[channel] = { min: validMin, max: Math.max(validMin, validMax) };
        set({ channelRanges });

        // Save to localStorage
        try {
          localStorage.setItem('dmxChannelRanges', JSON.stringify(channelRanges));
        } catch (e) {
          console.error('Failed to save channel ranges to localStorage:', e);
        }

        // Save to backend
        try {
          axios.post('/api/dmx/channel-range', { channelIndex: channel, min: validMin, max: channelRanges[channel].max })
            .catch(error => {
              console.error('Failed to save channel range to backend:', error);
            });
        } catch (error) {
          // Silently fail if backend endpoint doesn't exist yet
        }

        // Clamp current DMX value if it's outside the new range
        const currentValue = get().dmxChannels[channel] || 0;
        if (currentValue < validMin || currentValue > channelRanges[channel].max) {
          get().setDmxChannel(channel, currentValue, true);
        }
      },

      getChannelRange: (channel) => {
        const channelRanges = get().channelRanges;
        if (channelRanges[channel]) {
          return channelRanges[channel];
        }
        return { min: 0, max: 255 }; // Default range
      },

      setChannelColor: (channel, color) => {
        const channelColors = [...get().channelColors];
        // Ensure array is long enough
        while (channelColors.length <= channel) {
          channelColors.push('');
        }
        channelColors[channel] = color;
        set({ channelColors });

        // Save to localStorage
        try {
          localStorage.setItem('dmxChannelColors', JSON.stringify(channelColors));
        } catch (e) {
          console.error('Failed to save channel colors to localStorage:', e);
        }
      },

      setRandomChannelColor: (channel) => {
        // Generate a random bright color
        const hue = Math.floor(Math.random() * 360);
        const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
        const lightness = 50 + Math.floor(Math.random() * 20); // 50-70%
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        get().setChannelColor(channel, color);
      },

      pinChannel: (channel) => {
        const currentPinned = get().pinnedChannels || [];
        const pinnedChannels = [...currentPinned];
        if (!pinnedChannels.includes(channel)) {
          pinnedChannels.push(channel);
          set({ pinnedChannels });
          // Save to localStorage
          try {
            localStorage.setItem('pinnedChannels', JSON.stringify(pinnedChannels));
          } catch (e) {
            console.error('Failed to save pinned channels to localStorage:', e);
          }
        }
      },

      unpinChannel: (channel) => {
        const currentPinned = get().pinnedChannels || [];
        const pinnedChannels = currentPinned.filter(ch => ch !== channel);
        set({ pinnedChannels });
        // Save to localStorage
        try {
          localStorage.setItem('pinnedChannels', JSON.stringify(pinnedChannels));
        } catch (e) {
          console.error('Failed to save pinned channels to localStorage:', e);
        }
      },

      togglePinChannel: (channel) => {
        const pinnedChannels = get().pinnedChannels || [];
        if (pinnedChannels.includes(channel)) {
          get().unpinChannel(channel);
        } else {
          get().pinChannel(channel);
        }
      },

      setOscAssignment: (channelIndex, address) => {
        const oldAddress = get().oscAssignments[channelIndex];
        const oscAssignments = [...get().oscAssignments];
        oscAssignments[channelIndex] = address;
        set({ oscAssignments });
        
        debugLog.log('[Store] OSC assignment changed:', {
          channel: channelIndex + 1,
          from: oldAddress || '(none)',
          to: address
        });
        
        axios.post('/api/osc/assign', { channelIndex, address })
          .catch(error => {
            console.error('Failed to set OSC assignment:', error);
            get().addNotification({ message: 'Failed to set OSC assignment', type: 'error' });
          });
      },

      setSuperControlOscAddress: (controlName, address) => {
        const oldAddress = get().superControlOscAddresses[controlName];
        const superControlOscAddresses = {
          ...get().superControlOscAddresses,
          [controlName]: address
        };
        set({ superControlOscAddresses });
        
        debugLog.log('[Store] SuperControl OSC address changed:', {
          control: controlName,
          from: oldAddress || '(none)',
          to: address
        });
        
        // Save to localStorage
        try {
          localStorage.setItem('superControlOscAddresses', JSON.stringify(superControlOscAddresses));
        } catch (e) {
          console.error('Failed to save SuperControl OSC addresses to localStorage:', e);
        }
      },

      reportOscActivity: (channelIndex, value) => {
        // Store OSC activity
        set(state => ({
          oscActivity: {
            ...state.oscActivity,
            [channelIndex]: { value, timestamp: Date.now() }
          }
        }));

        // Convert normalized value (0.0-1.0) to DMX value (0-255) and update DMX channel
        const dmxValue = Math.round(value * 255);
        get().setDmxChannel(channelIndex, dmxValue);
      },

      addOscMessage: (message) => { // Implemented addOscMessage
        // Keep last 1000 messages in store (UI will limit display based on scrollback setting)
        const messages = [...get().oscMessages, message].slice(-1000);
        set({ oscMessages: messages });
        // Don't log OSC messages to reduce console spam (they can be frequent)
        if (get().recordingActive) {
          get().addRecordingEvent({ type: 'osc', data: message });
        }
      },      // MIDI Actions
      startMidiLearn: (target) => {
        set({ midiLearnTarget: target });

        let message = 'MIDI Learn started for ';
        switch (target.type) {
          case 'dmxChannel':
            message += `DMX Ch: ${target.channelIndex + 1}`;
            break;
          case 'masterSlider':
            message += `Master Slider: ${target.id}`;
            break;
          case 'group':
            message += `Group: ${target.id}`;
            break;
          case 'placedControl':
            message += `Control: ${target.controlId} on Fixture: ${target.fixtureId}`;
            break;
          case 'superControl':
            message += `SuperControl: ${target.controlName}`;
            break;
          case 'envelopeSpeed':
            message += 'Envelope Speed';
            break;
          case 'tempoPlayPause':
            message += 'Tempo Play/Pause';
            break;
          case 'tapTempo':
            message += 'Tap Tempo';
            break;
          default:
            message += 'Unknown target';
        }

        get().addNotification({
          message,
          type: 'info',
          priority: 'low'
        });

        if (target.type === 'dmxChannel') {
          axios.post('/api/midi/learn', { channel: target.channelIndex })
            .catch(error => {
              console.error('Failed to start MIDI learn for DMX channel:', error);
              get().addNotification({ message: 'Failed to start MIDI learn for DMX channel', type: 'error' });
            });
        }
      },

      cancelMidiLearn: () => {
        const currentTarget = get().midiLearnTarget;
        set({ midiLearnTarget: null });
        get().addNotification({ message: 'MIDI Learn cancelled', type: 'info', priority: 'low' });

        if (currentTarget && currentTarget.type === 'dmxChannel') {
          axios.post('/api/midi/cancel-learn', { channel: currentTarget.channelIndex })
            .catch(error => {
              console.error('Failed to cancel MIDI learn for DMX channel:', error);
            });
        }
      },

      setMidiActivity: (activity) => {
        set({ midiActivity: activity });
      },

      addMidiMessage: (message) => {
        const normalizedMessage = {
          ...message,
          type: message.type || message._type,
          _type: message._type || message.type,
          timestamp: message.timestamp ?? Date.now(),
        };
        const messages = [...get().midiMessages, normalizedMessage].slice(-1000)
        set({ midiMessages: messages, midiActivity: Date.now() })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('midiMessage', { detail: normalizedMessage }));
        }
        // Only log non-CC messages to reduce spam (CC messages are very frequent)
        if (normalizedMessage._type !== 'cc' && normalizedMessage.type !== 'cc') {
          debugLog.log('MIDI message received:', normalizedMessage)
        }
        if (get().recordingActive) {
          get().addRecordingEvent({ type: 'midi', data: normalizedMessage });
        }

        const messageType = (normalizedMessage as any).type || (normalizedMessage as any)._type;

        // Handle MIDI Learn for envelope speed
        const { midiLearnTarget } = get();
        if (midiLearnTarget && midiLearnTarget.type === 'envelopeSpeed') {
          let mapping: MidiMapping | null = null;
          if (messageType === 'cc' && normalizedMessage.controller !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              controller: normalizedMessage.controller
            };
          } else if (messageType === 'noteon' && normalizedMessage.note !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              note: normalizedMessage.note
            };
          }

          if (mapping) {
            get().setEnvelopeSpeedMidiMapping(mapping);
            set({ midiLearnTarget: null });
            return; // Don't process as control message yet
          }
        }

        // Handle MIDI Learn for tempo play/pause
        if (midiLearnTarget && midiLearnTarget.type === 'tempoPlayPause') {
          let mapping: MidiMapping | null = null;
          if (messageType === 'cc' && normalizedMessage.controller !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              controller: normalizedMessage.controller
            };
          } else if (messageType === 'noteon' && normalizedMessage.note !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              note: normalizedMessage.note
            };
          }

          if (mapping) {
            get().setTempoPlayPauseMidiMapping(mapping);
            set({ midiLearnTarget: null });
            get().addNotification({
              message: `MIDI learned for tempo play/pause: ${mapping.controller !== undefined ? `CC${mapping.controller}` : `Note${mapping.note}`} on channel ${mapping.channel + 1}`,
              type: 'success',
              priority: 'normal'
            });
            return; // Don't process as control message yet
          }
        }

        // Handle MIDI Learn for tap tempo
        if (midiLearnTarget && midiLearnTarget.type === 'tapTempo') {
          let mapping: MidiMapping | null = null;
          if (messageType === 'cc' && normalizedMessage.controller !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              controller: normalizedMessage.controller
            };
          } else if (messageType === 'noteon' && normalizedMessage.note !== undefined) {
            mapping = {
              channel: normalizedMessage.channel,
              note: normalizedMessage.note
            };
          }

          if (mapping) {
            get().setTapTempoMidiMapping(mapping);
            set({ midiLearnTarget: null });
            get().addNotification({
              message: `MIDI learned for tap tempo: ${mapping.controller !== undefined ? `CC${mapping.controller}` : `Note${mapping.note}`} on channel ${mapping.channel + 1}`,
              type: 'success',
              priority: 'normal'
            });
            return; // Don't process as control message yet
          }
        }

        // Check if this MIDI message should control tempo play/pause
        const { tempoPlayPauseMidiMapping } = get();
        if (tempoPlayPauseMidiMapping) {
          let matches = false;
          if (messageType === 'cc' && tempoPlayPauseMidiMapping.controller !== undefined) {
            matches = tempoPlayPauseMidiMapping.channel === normalizedMessage.channel &&
              tempoPlayPauseMidiMapping.controller === normalizedMessage.controller;
          } else if (messageType === 'noteon' && tempoPlayPauseMidiMapping.note !== undefined) {
            matches = tempoPlayPauseMidiMapping.channel === normalizedMessage.channel &&
              tempoPlayPauseMidiMapping.note === normalizedMessage.note;
          }

          if (matches) {
            // Toggle tempo play/pause
            if (get().requestToggleMasterClockPlayPause) {
              get().requestToggleMasterClockPlayPause();
            } else {
              set({ midiClockIsPlaying: !get().midiClockIsPlaying });
            }
            debugLog.log('[Store] Tempo play/pause toggled via MIDI');
          }
        }

        // Check if this MIDI message should trigger tap tempo
        const { tapTempoMidiMapping } = get();
        if (tapTempoMidiMapping) {
          let matches = false;
          if (messageType === 'cc' && tapTempoMidiMapping.controller !== undefined) {
            matches = tapTempoMidiMapping.channel === normalizedMessage.channel &&
              tapTempoMidiMapping.controller === normalizedMessage.controller;
          } else if (messageType === 'noteon' && tapTempoMidiMapping.note !== undefined) {
            matches = tapTempoMidiMapping.channel === normalizedMessage.channel &&
              tapTempoMidiMapping.note === normalizedMessage.note;
          }

          if (matches) {
            // Trigger tap tempo
            get().recordTapTempo();
            get().setAutoSceneTempoSource('tap_tempo');
            debugLog.log('[Store] Tap tempo triggered via MIDI');
          }
        }

        // Check if this MIDI message should control envelope speed
        const { envelopeSpeedMidiMapping } = get();
        if (envelopeSpeedMidiMapping) {
          let matches = false;
          if (messageType === 'cc' && envelopeSpeedMidiMapping.controller !== undefined) {
            matches = envelopeSpeedMidiMapping.channel === normalizedMessage.channel &&
              envelopeSpeedMidiMapping.controller === normalizedMessage.controller;
          } else if (messageType === 'noteon' && envelopeSpeedMidiMapping.note !== undefined) {
            matches = envelopeSpeedMidiMapping.channel === normalizedMessage.channel &&
              envelopeSpeedMidiMapping.note === normalizedMessage.note;
          }

          if (matches && normalizedMessage.value !== undefined) {
            // Scale MIDI value (0-127) to envelope speed (0.1-2.0)
            const normalizedValue = normalizedMessage.value / 127; // 0.0 to 1.0
            const speed = 0.1 + (normalizedValue * 1.9); // Map to 0.1-2.0 range
            get().setEnvelopeSpeed(speed);
          }
        }
      },

      addMidiMapping: (dmxChannel, mapping) => {
        const midiMappings = { ...get().midiMappings }
        midiMappings[dmxChannel] = mapping
        set({ midiMappings, midiLearnTarget: null })
        
        const mappingType = mapping.pitch
          ? 'Pitch'
          : mapping.controller !== undefined
            ? 'CC'
            : 'Note';
        const mappingValue = mapping.pitch
          ? 'Pitch Bend'
          : mapping.controller !== undefined
            ? mapping.controller
            : mapping.note;
        debugLog.log('[Store] MIDI mapping added:', {
          dmxChannel: dmxChannel + 1,
          type: mappingType,
          value: mappingValue,
          midiChannel: mapping.channel + 1
        });

        axios.post('/api/midi/mapping', { dmxChannel, mapping })
          .then(() => {
            get().addNotification({ message: `MIDI mapped to DMX Ch: ${dmxChannel + 1}`, type: 'success' });
          })
          .catch(error => {
            console.error('Failed to add MIDI mapping:', error)
            get().addNotification({ message: 'Failed to add MIDI mapping', type: 'error', priority: 'high' })
          })
      },

      removeMidiMapping: (dmxChannel) => {
        const midiMappings = { ...get().midiMappings }
        delete midiMappings[dmxChannel]
        set({ midiMappings })

        axios.delete(`/api/midi/mapping/${dmxChannel}`)
          .then(() => {
            get().addNotification({ message: `MIDI mapping removed for DMX Ch: ${dmxChannel + 1}`, type: 'success' });
          })
          .catch(error => {
            console.error('Failed to remove MIDI mapping:', error)
            get().addNotification({ message: 'Failed to remove MIDI mapping', type: 'error' })
          })
      },

      clearAllMidiMappings: () => {
        set({ midiMappings: {} })

        axios.delete('/api/midi/mappings')
          .then(() => {
            get().addNotification({ message: 'All MIDI mappings cleared', type: 'success' });
          })
          .catch(error => {
            console.error('Failed to clear all MIDI mappings:', error)
            get().addNotification({ message: 'Failed to clear all MIDI mappings', type: 'error' })
          })
      },

      applyMidiControllerTemplate: async (templateId, deviceName) => {
        try {
          const response = await axios.post('/api/midi/controller-template', {
            templateId,
            deviceName
          });

          const localTemplate = getTemplateById(templateId);
          const superControlMappings = localTemplate?.superControlMappings ?? [];
          const localHasRawMappings = Object.keys(localTemplate?.mappings ?? {}).length > 0;

          const mappingsFromServer = response.data?.midiMappings;
          if (mappingsFromServer && typeof mappingsFromServer === 'object') {
            // If the local template owns no raw-DMX bindings (e.g. APC40 routes
            // through SuperControl), trust the local intent and ignore any raw
            // mappings the server may have generated — otherwise the operator
            // ends up with double-routed faders.
            set({ midiMappings: localHasRawMappings ? mappingsFromServer : {} });
          } else if (!localHasRawMappings) {
            set({ midiMappings: {} });
          }

          set({ superControlMidiMappings: superControlMappings });
          saveSuperControlMidiMappings(superControlMappings);

          const templateLabel = templateId === 'x_touch_mackie'
            ? 'X-Touch Mackie template'
            : 'APC40 MK1 template';
          get().addNotification({
            message: `${templateLabel} applied`,
            type: 'success',
            priority: 'normal'
          });
          return true;
        } catch (error) {
          console.error('Failed to apply MIDI controller template:', error);
          get().addNotification({
            message: 'Failed to apply MIDI controller template',
            type: 'error',
            priority: 'high'
          });
          return false;
        }
      },

      applySuperControlMidi: (controlName, value, slotIndex) => {
        const state = get();
        const { fixtures, selectedFixtures } = state;
        if (!selectedFixtures || selectedFixtures.length === 0) return;

        const targets = slotIndex !== undefined
          ? (selectedFixtures[slotIndex] ? [selectedFixtures[slotIndex]] : [])
          : selectedFixtures;
        if (targets.length === 0) return;

        // Map control names to the channel-type aliases SuperControl recognises.
        const channelTypeMap: Record<string, string[]> = {
          masterDimmer: ['dimmer', 'intensity', 'master'],
          dimmer: ['dimmer', 'intensity', 'master'],
          pan: ['pan', 'pan_coarse'],
          tilt: ['tilt', 'tilt_coarse'],
          fine_pan: ['pan_fine', 'finepan', 'pan_lsb'],
          fine_tilt: ['tilt_fine', 'finetilt', 'tilt_lsb'],
          red: ['red', 'r'],
          green: ['green', 'g'],
          blue: ['blue', 'b'],
          gobo: ['gobo', 'gobowheel', 'gobo_wheel'],
          gobo_rotation: ['gobo_rotation', 'goborotation', 'gobo_rotate', 'gobo_spin'],
          color_wheel: ['color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel'],
          prism: ['prism', 'prism_rotate', 'prism_rotation'],
          iris: ['iris'],
          focus: ['focus'],
          zoom: ['zoom'],
          macro: ['macro', 'program', 'pattern', 'effect', 'effects'],
          speed: ['speed', 'rate', 'movement_speed', 'effect_speed'],
          white: ['white', 'w'],
          amber: ['amber', 'a'],
          uv: ['uv', 'ultraviolet'],
          shutter: ['shutter'],
          strobe: ['strobe', 'shutter'],
          lamp: ['lamp', 'lamp_on', 'lamp_control'],
          reset: ['reset', 'reset_control', 'function'],
        };
        const aliases = channelTypeMap[controlName] ?? [controlName.toLowerCase()];
        let changedAny = false;

        targets.forEach((fixtureId) => {
          const fixture = fixtures.find(f => f.id === fixtureId);
          if (!fixture) return;
          for (let i = 0; i < fixture.channels.length; i++) {
            const ch = fixture.channels[i];
            if (channelMatchesRoleAliases(ch, aliases)) {
              const dmxAddress = fixtureDmxAddress(fixture, i);
              if (dmxAddress < 0 || dmxAddress >= 512) continue;
              get().setDmxChannelValue(dmxAddress, value);
              changedAny = true;
              break;
            }
          }
        });

        if (changedAny) {
          set({
            superControlExternalUpdate: {
              controlName,
              value,
              at: Date.now(),
              slotIndex,
            },
          });
        }
      },

      startSuperControlLearn: (target) => {
        set({ superControlLearnTarget: target });
      },

      rebindSuperControl: (controlName, slotIndex, signature) => {
        const current = get().superControlMidiMappings;
        const idx = current.findIndex((b) =>
          b.controlName === controlName && b.slotIndex === slotIndex
        );
        const baseLabel = idx >= 0 ? current[idx].label : `${controlName}${slotIndex !== undefined ? ` slot ${slotIndex + 1}` : ''}`;
        const updated: SuperControlBinding = {
          controlName: (controlName as SuperControlBinding['controlName']),
          slotIndex,
          channel: signature.channel,
          controller: signature.controller,
          note: signature.note,
          pitch: signature.pitch,
          label: baseLabel,
        };
        const next = idx >= 0
          ? current.map((b, i) => (i === idx ? updated : b))
          : [...current, updated];
        set({ superControlMidiMappings: next, superControlLearnTarget: null });
        saveSuperControlMidiMappings(next);
        get().addNotification({
          message: `Rebound ${baseLabel}`,
          type: 'success',
          priority: 'normal',
        });
      },

      setEnvelopeSpeedMidiMapping: (mapping) => {
        set({ envelopeSpeedMidiMapping: mapping, midiLearnTarget: null });
        // Save to localStorage
        try {
          if (mapping) {
            localStorage.setItem('envelopeSpeedMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('envelopeSpeedMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save envelope speed MIDI mapping:', e);
        }
        if (mapping) {
          get().addNotification({ message: 'MIDI mapped to Envelope Speed', type: 'success' });
        }
      },

      removeEnvelopeSpeedMidiMapping: () => {
        set({ envelopeSpeedMidiMapping: null });
        try {
          localStorage.removeItem('envelopeSpeedMidiMapping');
        } catch (e) {
          console.error('Failed to remove envelope speed MIDI mapping:', e);
        }
        get().addNotification({ message: 'Envelope Speed MIDI mapping removed', type: 'success' });
      },

      setMidiInterfaces: (interfaces) => {
        set({ midiInterfaces: interfaces });
      },

      setActiveInterfaces: (interfaces) => {
        set({ activeInterfaces: interfaces });
      },

      // Fixture Actions
      addFixture: (fixture) => {
        const updatedFixtures = refreshFixtureCatalogPhotos([...get().fixtures, fixture]);
        set({ fixtures: updatedFixtures });
        if (get().strobeSafetyEnabled) {
          get().applyStrobeSafetyLock();
        }
        
        // Save to localStorage immediately
        try {
          localStorage.setItem('artbastard-fixtures', JSON.stringify(updatedFixtures));
          debugLog.log('[Store] Saved fixtures to localStorage after add:', updatedFixtures.length);
        } catch (e) {
          console.error('Failed to save fixtures to localStorage:', e);
        }
        
        debugLog.log('[Store] Fixture added:', {
          name: fixture.name,
          address: fixture.startAddress,
          channels: fixture.channels?.length || 0,
          type: fixture.type || 'generic',
          totalFixtures: updatedFixtures.length
        });

        // Save individual fixture to backend (more efficient than saving all fixtures)
        axios.post(`/api/fixtures/${fixture.id}`, fixture)
          .then(() => {
            debugLog.log('[Store] Fixture saved to server:', fixture.id);
          })
          .catch(error => {
            console.error('Failed to save new fixture to backend:', error);
            get().addNotification({ message: 'Failed to save new fixture to server', type: 'error' });
          });
      },

      deleteFixture: (fixtureId) => {
        const updatedFixtures = get().fixtures.filter(f => f.id !== fixtureId);
        set({ fixtures: updatedFixtures });
        if (get().strobeSafetyEnabled) {
          get().applyStrobeSafetyLock();
        }
        
        // Save to localStorage
        try {
          localStorage.setItem('artbastard-fixtures', JSON.stringify(updatedFixtures));
          debugLog.log('[Store] Saved fixtures to localStorage after delete:', updatedFixtures.length);
        } catch (e) {
          console.error('Failed to save fixtures to localStorage:', e);
        }
        
        // Delete from server
        axios.delete(`/api/fixtures/${fixtureId}`)
          .then(() => {
            get().addNotification({
              message: 'Fixture deleted successfully',
              type: 'success',
              priority: 'normal'
            });
          })
          .catch(error => {
            console.error('Failed to delete fixture on backend:', error);
            get().addNotification({
              message: 'Failed to delete fixture on server',
              type: 'error',
              priority: 'high'
            });
          });
      },

      setFixtures: (fixtures) => {
        const refreshedFixtures = refreshFixtureCatalogPhotos(fixtures);
        set({ fixtures: refreshedFixtures });
        if (get().strobeSafetyEnabled) {
          get().applyStrobeSafetyLock();
        }
        // Save to localStorage for persistence across server restarts
        try {
          localStorage.setItem('artbastard-fixtures', JSON.stringify(refreshedFixtures));
          debugLog.log('[Store] Saved fixtures to localStorage:', refreshedFixtures.length);
        } catch (e) {
          console.error('Failed to save fixtures to localStorage:', e);
        }
      },

      setGroups: (groups) => {
        const state = get();
        set({ groups: ensureGroupsSync(groups, state.fixtures) });
      },

      renameGroup: (groupId: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        const state = get();
        const target = state.groups.find((g) => g.id === groupId);
        if (!target || target.name === trimmed) return;
        const nextGroups = ensureGroupsSync(
          state.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
          state.fixtures,
        );
        set({ groups: nextGroups });
        axios.post('/api/groups', { groups: nextGroups }).catch((error) => {
          console.error('Failed to persist group rename:', error);
          get().addNotification?.({
            message: 'Group renamed locally but failed to sync to server',
            type: 'warning',
            priority: 'normal',
          });
        });
      },

      setFixtureLayout: (layout) => {
        set({ fixtureLayout: layout });
      },

      // Template Management Actions
      addFixtureTemplate: (template) => {
        // Ensure channels array exists and is valid
        const validatedChannels = template.channels && Array.isArray(template.channels) && template.channels.length > 0
          ? template.channels
          : [{ name: 'Channel 1', type: 'other' }];
        
        const newTemplate: FixtureTemplate = {
          ...template,
          channels: validatedChannels,
          id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          isCustom: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        set(state => {
          const updatedTemplates = [...state.fixtureTemplates, newTemplate];
          // Persist to localStorage
          try {
            // Only save custom templates to localStorage
            const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
            localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
          } catch (error) {
            console.warn('Failed to save templates to localStorage:', error);
          }
          
          // Save to server file (for Git persistence)
          axios.post('/api/fixture-templates', { templates: updatedTemplates })
            .catch(error => {
              console.error('Failed to save templates to server:', error);
              get().addNotification({ 
                message: 'Template saved locally but failed to save to server', 
                type: 'warning',
                priority: 'normal'
              });
            });
          
          return { fixtureTemplates: updatedTemplates };
        });
        get().addNotification({
          message: `Template "${template.templateName}" saved`,
          type: 'success',
          priority: 'normal'
        });
      },

      updateFixtureTemplate: (id, updates) => {
        set(state => {
          const updatedTemplates = state.fixtureTemplates.map(template =>
            template.id === id
              ? { ...template, ...updates, updatedAt: Date.now() }
              : template
          );
          // Persist to localStorage
          try {
            // Only save custom templates to localStorage
            const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
            localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
          } catch (error) {
            console.warn('Failed to save templates to localStorage:', error);
          }
          
          // Save to server file (for Git persistence)
          axios.post('/api/fixture-templates', { templates: updatedTemplates })
            .catch(error => {
              console.error('Failed to save templates to server:', error);
            });
          
          return { fixtureTemplates: updatedTemplates };
        });
        get().addNotification({
          message: 'Template updated',
          type: 'success',
          priority: 'normal'
        });
      },

      deleteFixtureTemplate: (id) => {
        set(state => {
          const updatedTemplates = state.fixtureTemplates.filter(template => {
            // Fixture-library templates are protected; custom copies can be deleted.
            if (template.isBuiltIn) return true;
            return template.id !== id;
          });
          // Persist to localStorage
          try {
            // Only save custom templates to localStorage
            const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
            localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
          } catch (error) {
            console.warn('Failed to save templates to localStorage:', error);
          }
          
          // Save to server file (for Git persistence)
          axios.post('/api/fixture-templates', { templates: updatedTemplates })
            .catch(error => {
              console.error('Failed to save templates to server:', error);
            });
          
          return { fixtureTemplates: updatedTemplates };
        });
        get().addNotification({
          message: 'Template deleted',
          type: 'success',
          priority: 'normal'
        });
      },

      getFixtureTemplate: (id) => {
        return get().fixtureTemplates.find(template => template.id === id);
      },

      // Scene Actions
      saveScene: (name, oscAddress) => {
        const { dmxChannels, channelAutopilots, panTiltAutopilot, modularAutomation } = get();
        const newScene: Scene = {
          name,
          channelValues: [...dmxChannels],
          oscAddress,
          autopilots: { ...channelAutopilots },
          panTiltAutopilot: { ...panTiltAutopilot },
          // Save modular automation states (exclude animation IDs as they're runtime state)
          modularAutomation: {
            color: { ...modularAutomation.color },
            dimmer: { ...modularAutomation.dimmer },
            panTilt: { ...modularAutomation.panTilt },
            effects: { ...modularAutomation.effects },
            animationIds: {
              color: null,
              dimmer: null,
              panTilt: null,
              effects: null
            }
          }
        };

        const scenes = [...get().scenes];
        const existingIndex = scenes.findIndex(s => s.name === name);

        if (existingIndex !== -1) {
          scenes[existingIndex] = newScene;
          debugLog.log(`[SCENES] Updated scene "${name}" with modular automation states`);
        } else {
          scenes.push(newScene);
          debugLog.log(`[SCENES] Created new scene "${name}" with modular automation states`);
        }

        set({ scenes })

        axios.post('/api/scenes', {
          name,
          oscAddress,
          channelValues: [...dmxChannels]
        })
          .then(() => {
            get().addNotification({ message: `Scene '${name}' saved`, type: 'success' });
          })
          .catch(error => {
            console.error('Failed to save scene:', error)
            get().addNotification({ message: `Failed to save scene '${name}'`, type: 'error', priority: 'high' })
          })
      },
      setTuningScene: (name) => set({ tuningSceneName: name }),
      updateActiveScene: () => {
        const { activeSceneName, scenes, dmxChannels } = get();
        if (!activeSceneName) {
          get().addNotification({ message: 'No active scene to update', type: 'warning' });
          return;
        }

        const scene = scenes.find(s => s.name === activeSceneName);
        if (!scene) return;

        // Create update with current DMX values
        const updates = { channelValues: [...dmxChannels] };

        get().updateScene(activeSceneName, updates);

        get().addNotification({
          message: `Scene "${activeSceneName}" fine-tuned with current sliders`,
          type: 'success'
        });
      },
      loadScene: (nameOrIndex, options: { silent?: boolean; force?: boolean } = {}) => {
        const override = get().pendingSceneTransitionOverride;
        if (override) {
          set({
            transitionDuration: override.transitionMs,
            transitionEasing: override.easing,
            pendingSceneTransitionOverride: null,
          });
        }
        const { scenes, isTransitioning, currentTransitionFrame, dmxChannels: currentDmxState, transitionDuration, groups, fixtures } = get();
        let scene;

        // Handle both name and index
        if (typeof nameOrIndex === 'string') {
          scene = scenes.find(s => s.name === nameOrIndex);
        } else if (typeof nameOrIndex === 'number') {
          scene = scenes[nameOrIndex];
        }

        if (scene) {
          const sceneName = scene.name;

          if (
            !options.force &&
            sceneName === get().activeSceneName &&
            !get().isTransitioning
          ) {
            debugLog.log(`[STORE] Scene "${sceneName}" already active, skipping reload`);
            if (!options.silent) {
              get().addNotification({
                message: `Scene "${sceneName}" is already loaded`,
                type: 'info',
                priority: 'low',
              });
            }
            return;
          }

          debugLog.log(`[STORE] Loading scene "${sceneName}" with transition`);

          // Cancel any ongoing transition
          if (isTransitioning && currentTransitionFrame) {
            cancelAnimationFrame(currentTransitionFrame);
            set({ currentTransitionFrame: null });
          }

          // Create a copy of scene values that we can modify
          const targetDmxValues = [...scene.channelValues];

          // For each group that ignores scene changes, restore their current DMX values
          groups.forEach(group => {
            if (group.ignoreSceneChanges) {
              group.fixtureIndices.forEach(fixtureIndex => {
                const fixture = fixtures[fixtureIndex];
                if (fixture) {
                  // Calculate the DMX range for this fixture
                  const startAddr = fixture.startAddress - 1; // Convert to 0-based
                  const endAddr = startAddr + fixture.channels.length;

                  // Copy current values for these channels
                  for (let i = startAddr; i < endAddr; i++) {
                    targetDmxValues[i] = currentDmxState[i];
                  }
                }
              });
            }
          });

          // Check if scene has timeline enabled
          if (scene.timeline && scene.timeline.enabled) {
            // Stop any currently playing timeline
            window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
            
            // For timeline scenes, apply initial keyframe immediately (no transition)
            const firstKeyframe = scene.timeline.keyframes[0];
            if (firstKeyframe) {
              Object.entries(firstKeyframe.channelValues).forEach(([channelIndex, value]) => {
                if (Number(channelIndex) < targetDmxValues.length) {
                  targetDmxValues[Number(channelIndex)] = value;
                }
              });
            }

            set({
              isTransitioning: true,
              fromDmxValues: [...currentDmxState],
              toDmxValues: targetDmxValues,
              transitionStartTime: Date.now(),
              activeSceneName: sceneName,
            });

            const timelineStartDelayMs = sceneTimelineStartDelayMs(transitionDuration);

            // Trigger timeline playback after the initial scene look has settled,
            // so gobo wheels do not race through intermediate slots on load.
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('startSceneTimeline', { 
                detail: { sceneName } 
              }));
            }, timelineStartDelayMs);
            
            if (!options.silent) {
              get().addNotification({ 
                message: `Loading animated scene '${sceneName}' (${timelineStartDelayMs}ms settle)`,
                type: 'info' 
              });
            }
          } else {
            // Set up transition state for smooth slider movement
            set({
              isTransitioning: true,
              fromDmxValues: [...currentDmxState],
              toDmxValues: targetDmxValues,
              transitionStartTime: Date.now(),
              activeSceneName: sceneName,
            });

            // Static scene - stop any currently playing timeline and use normal transition
            window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
            
            if (!options.silent) {
              get().addNotification({ 
                message: `Loading scene '${sceneName}' (${transitionDuration}ms transition)`, 
                type: 'info' 
              });
            }
          }

          // Also send to backend for consistency
          axios.post('/api/scenes/load', { name: sceneName, clientTransition: true })
            .then(() => {
              debugLog.log(`[STORE] Scene "${sceneName}" loaded successfully via backend`);
            })
            .catch(error => {
              console.error('Failed to load scene:', error)
              get().addNotification({ message: `Failed to load scene '${sceneName}'`, type: 'error', priority: 'high' })
            })
        } else {
          get().addNotification({ message: `Scene "${nameOrIndex}" not found`, type: 'error', priority: 'high' })
        }
      },

      updateScene: (originalName, updates) => {
        const scenes = [...get().scenes]
        const sceneIndex = scenes.findIndex(s => s.name === originalName)

        if (sceneIndex !== -1) {
          scenes[sceneIndex] = { ...scenes[sceneIndex], ...updates }
          set({ scenes })

          axios.put(`/api/scenes/${encodeURIComponent(originalName)}`, updates)
            .then(() => {
              get().addNotification({ message: `Scene '${originalName}' updated`, type: 'success' });
            })
            .catch(error => {
              console.error('Failed to update scene:', error)
              get().addNotification({ message: `Failed to update scene '${originalName}'`, type: 'error' })
            })
        } else {
          get().addNotification({ message: `Scene "${originalName}" not found`, type: 'error' })
        }
      },

      loadNextScene: () => {
        const { scenes, activeSceneName } = get();
        if (!scenes || scenes.length === 0) return;
        const idx = activeSceneName
          ? scenes.findIndex((s: Scene) => s.name === activeSceneName)
          : -1;
        const next = scenes[(idx + 1 + scenes.length) % scenes.length];
        if (next) get().loadScene(next.name);
      },

      loadPreviousScene: () => {
        const { scenes, activeSceneName } = get();
        if (!scenes || scenes.length === 0) return;
        const idx = activeSceneName
          ? scenes.findIndex((s: Scene) => s.name === activeSceneName)
          : 0;
        const prev = scenes[(idx - 1 + scenes.length) % scenes.length];
        if (prev) get().loadScene(prev.name);
      },

      deleteScene: (name) => {
        const scenes = get().scenes.filter(s => s.name !== name)
        set({ scenes })

        axios.delete(`/api/scenes/${encodeURIComponent(name)}`)
          .then(() => {
            get().addNotification({ message: `Scene '${name}' deleted`, type: 'success' });
          })
          .catch(error => {
            console.error('Failed to delete scene:', error)
            get().addNotification({ message: `Failed to delete scene '${name}'`, type: 'error' })
          })
      },

      seedScenesFromFixtures: async (options = {}) => {
        const { fixtures, scenes } = get();
        const result = generateSeededSceneList(fixtures, scenes, options);

        if (result.disabledReason) {
          get().addNotification({
            message: result.disabledReason,
            type: 'info',
            priority: 'normal',
          });
          return result;
        }

        set({ scenes: result.scenes });

        try {
          await axios.post('/api/scenes', result.scenes);
          const capabilityText = result.capabilities.length
            ? ` using ${result.capabilities.join(', ')}`
            : '';
          get().addNotification({
            message: `Seeded ${result.generatedScenes.length} scene slots${capabilityText}`,
            type: 'success',
            priority: 'normal',
          });
        } catch (error) {
          console.error('Failed to save seeded scenes:', error);
          get().addNotification({
            message: 'Seeded scenes locally, but server save failed',
            type: 'warning',
            priority: 'high',
          });
        }

        if (result.skipped > 0) {
          get().addNotification({
            message: `${result.skipped} APC40 slot${result.skipped === 1 ? '' : 's'} kept because handmade scenes already use them`,
            type: 'warning',
            priority: 'normal',
          });
        }

        return result;
      },

      captureSelectionToApcSlot: async (options) => {
        const { fixtures, scenes, dmxChannels, selectedFixtures } = get();
        const fixtureIds = options.fixtureIds?.length
          ? options.fixtureIds
          : selectedFixtures.length > 0
            ? selectedFixtures
            : fixtures.map((fixture) => fixture.id);
        const result = buildCaptureSelectionScene(fixtures, dmxChannels, scenes, {
          deck: options.deck,
          slot: options.slot,
          selectedFixtureIds: fixtureIds,
        });

        if (result.disabledReason) {
          get().addNotification({
            message: result.disabledReason,
            type: 'info',
            priority: 'normal',
          });
          return result;
        }

        set({ scenes: result.scenes });

        try {
          await axios.post('/api/scenes', result.scenes);
          get().addNotification({
            message: `Captured ${fixtureIds.length} fixture${fixtureIds.length === 1 ? '' : 's'} to APC40 Deck ${options.deck} slot ${options.slot}`,
            type: 'success',
            priority: 'normal',
          });
        } catch (error) {
          console.error('Failed to save captured scene slot:', error);
          get().addNotification({
            message: 'Captured scene locally, but server save failed',
            type: 'warning',
            priority: 'high',
          });
        }

        if (result.skipped > 0) {
          get().addNotification({
            message: `Slot kept because a handmade scene already uses APC40 Deck ${options.deck} ${String(options.slot).padStart(2, '0')}`,
            type: 'warning',
            priority: 'normal',
          });
        }

        if (options.deck === 'A') get().setApc40SceneA(apc40DeckSceneName(options.deck, options.slot - 1));
        else get().setApc40SceneB(apc40DeckSceneName(options.deck, options.slot - 1));

        return result;
      },

      // ACTS Actions
      seedActsFromScenes: async (options = {}) => {
        const { scenes, acts } = get();
        const result = generateSeededActList(scenes, acts, options);

        if (result.disabledReason) {
          get().addNotification({
            message: result.disabledReason,
            type: 'info',
            priority: 'normal',
          });
          return result;
        }

        set({ acts: result.acts });
        get().saveActsToBackend();

        get().addNotification({
          message: `Seeded ${result.generatedActs.length} optional ACT${result.generatedActs.length === 1 ? '' : 'S'} from ${result.sceneCount} scene${result.sceneCount === 1 ? '' : 's'}`,
          type: 'success',
          priority: 'normal',
        });

        if (result.skipped > 0) {
          get().addNotification({
            message: `${result.skipped} ACT seed${result.skipped === 1 ? '' : 's'} skipped because handmade ACTS already use those names`,
            type: 'warning',
            priority: 'normal',
          });
        }

        return result;
      },

      createAct: (name, description) => {
        const newAct: Act = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          description: description || '',
          steps: [],
          loopMode: 'none',
          totalDuration: 0,
          triggers: [],
          timelineEvents: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        set(state => ({
          acts: [...state.acts, newAct]
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `Act '${name}' created`,
          type: 'success'
        });
      },

      updateAct: (actId, updates) => {
        set(state => ({
          acts: state.acts.map(act =>
            act.id === actId
              ? { ...act, ...updates, updatedAt: Date.now() }
              : act
          )
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `Act updated`,
          type: 'success'
        });
      },

      deleteAct: (actId) => {
        set(state => ({
          acts: state.acts.filter(act => act.id !== actId)
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `Act deleted`,
          type: 'success'
        });
      },

      addActStep: (actId, stepData) => {
        const newStep: ActStep = {
          id: Math.random().toString(36).substr(2, 9),
          ...stepData
        };

        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              const updatedSteps = [...act.steps, newStep];
              const totalDuration = updatedSteps.reduce((sum, step) => sum + step.duration, 0);
              return {
                ...act,
                steps: updatedSteps,
                totalDuration,
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `Step added to act`,
          type: 'success'
        });
      },

      updateActStep: (actId, stepId, updates) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              const updatedSteps = act.steps.map(step =>
                step.id === stepId ? { ...step, ...updates } : step
              );
              const totalDuration = updatedSteps.reduce((sum, step) => sum + step.duration, 0);
              return {
                ...act,
                steps: updatedSteps,
                totalDuration,
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      removeActStep: (actId, stepId) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              const updatedSteps = act.steps.filter(step => step.id !== stepId);
              const totalDuration = updatedSteps.reduce((sum, step) => sum + step.duration, 0);
              return {
                ...act,
                steps: updatedSteps,
                totalDuration,
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      reorderActSteps: (actId, stepIds) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              const reorderedSteps = stepIds.map(id =>
                act.steps.find(step => step.id === id)
              ).filter(Boolean) as ActStep[];

              return {
                ...act,
                steps: reorderedSteps,
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      // ACTS Trigger Actions
      addActTrigger: (actId, triggerData) => {
        const newTrigger: ActTrigger = {
          id: Math.random().toString(36).substr(2, 9),
          ...triggerData
        };

        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              return {
                ...act,
                triggers: [...act.triggers, newTrigger],
                updatedAt: Date.now()
              };
            }
            return act;
          }),
          actTriggers: [...state.actTriggers, newTrigger]
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `Trigger added to act`,
          type: 'success'
        });
      },

      updateActTrigger: (actId, triggerId, updates) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              return {
                ...act,
                triggers: act.triggers.map(trigger =>
                  trigger.id === triggerId ? { ...trigger, ...updates } : trigger
                ),
                updatedAt: Date.now()
              };
            }
            return act;
          }),
          actTriggers: state.actTriggers.map(trigger =>
            trigger.id === triggerId ? { ...trigger, ...updates } : trigger
          )
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      removeActTrigger: (actId, triggerId) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              return {
                ...act,
                triggers: act.triggers.filter(trigger => trigger.id !== triggerId),
                updatedAt: Date.now()
              };
            }
            return act;
          }),
          actTriggers: state.actTriggers.filter(trigger => trigger.id !== triggerId)
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      // Timeline Event Actions
      addTimelineEvent: (actId, eventData) => {
        const newEvent: TimelineEvent = {
          id: Math.random().toString(36).substr(2, 9),
          ...eventData
        };

        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              return {
                ...act,
                timelineEvents: [...(act.timelineEvents || []), newEvent].sort((a, b) => a.time - b.time),
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();

        get().addNotification({
          message: `${eventData.type.toUpperCase()} event added to timeline`,
          type: 'success'
        });
      },

      updateTimelineEvent: (actId, eventId, updates) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              const updatedEvents = (act.timelineEvents || []).map(event =>
                event.id === eventId ? { ...event, ...updates } : event
              ).sort((a, b) => a.time - b.time);
              return {
                ...act,
                timelineEvents: updatedEvents,
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      removeTimelineEvent: (actId, eventId) => {
        set(state => ({
          acts: state.acts.map(act => {
            if (act.id === actId) {
              return {
                ...act,
                timelineEvents: (act.timelineEvents || []).filter(event => event.id !== eventId),
                updatedAt: Date.now()
              };
            }
            return act;
          })
        }));

        // Save ACTS to backend
        get().saveActsToBackend();
      },

      processActTrigger: (trigger) => {
        if (!trigger.enabled) return;

        const { actPlaybackState, acts } = get();
        const act = acts.find(a => a.id === trigger.id.split('_')[0]); // Extract act ID from trigger ID

        if (!act) return;

        switch (trigger.action) {
          case 'play':
            if (actPlaybackState.currentActId === act.id && actPlaybackState.isPlaying) {
              get().pauseAct();
            } else {
              get().playAct(act.id);
            }
            break;

          case 'pause':
            if (actPlaybackState.currentActId === act.id) {
              get().pauseAct();
            }
            break;

          case 'stop':
            if (actPlaybackState.currentActId === act.id) {
              get().stopAct();
            }
            break;

          case 'next':
            if (actPlaybackState.currentActId === act.id) {
              get().nextActStep();
            }
            break;

          case 'previous':
            if (actPlaybackState.currentActId === act.id) {
              get().previousActStep();
            }
            break;

          case 'toggle':
            if (actPlaybackState.currentActId === act.id && actPlaybackState.isPlaying) {
              get().pauseAct();
            } else {
              get().playAct(act.id);
            }
            break;
        }

        get().addNotification({
          message: `Act trigger executed: ${trigger.action} for ${act.name}`,
          type: 'info',
          priority: 'low'
        });
      },

      saveActsToBackend: () => {
        const { acts } = get();
        try {
          // Send ACTS data to backend via Socket.IO
          // We'll use a custom event to trigger the save
          const event = new CustomEvent('saveActsToBackend', { detail: acts });
          window.dispatchEvent(event);
        } catch (error) {
          console.error('Failed to save ACTS to backend:', error);
          get().addNotification({
            message: 'Failed to save ACTS to backend',
            type: 'error'
          });
        }
      },

      // ACTS Playback Actions
      playAct: (actId) => {
        const act = get().acts.find(a => a.id === actId);
        if (!act || act.steps.length === 0) {
          get().addNotification({
            message: 'Act not found or has no steps',
            type: 'error'
          });
          return;
        }

        set({
          actPlaybackState: {
            isPlaying: true,
            currentActId: actId,
            currentStepIndex: 0,
            stepStartTime: Date.now(),
            stepProgress: 0,
            loopCount: 0,
            playbackSpeed: get().actPlaybackState.playbackSpeed
          }
        });

        // Load the first scene and apply autopilot settings
        const firstStep = act.steps[0];
        get().applyActStepPlayback(firstStep);

        get().addNotification({
          message: `Playing act '${act.name}'`,
          type: 'info'
        });
      },

      pauseAct: () => {
        set(state => ({
          actPlaybackState: {
            ...state.actPlaybackState,
            isPlaying: false
          }
        }));
      },

      stopAct: () => {
        set({
          actPlaybackState: {
            isPlaying: false,
            currentActId: null,
            currentStepIndex: 0,
            stepStartTime: 0,
            stepProgress: 0,
            loopCount: 0,
            playbackSpeed: 1.0
          }
        });
      },

      nextActStep: () => {
        const { actPlaybackState, acts } = get();
        if (!actPlaybackState.currentActId) return;

        const act = acts.find(a => a.id === actPlaybackState.currentActId);
        if (!act) return;

        const nextIndex = actPlaybackState.currentStepIndex + 1;

        if (nextIndex >= act.steps.length) {
          // Handle loop modes
          if (act.loopMode === 'loop') {
            set(state => ({
              actPlaybackState: {
                ...state.actPlaybackState,
                currentStepIndex: 0,
                stepStartTime: Date.now(),
                stepProgress: 0,
                loopCount: state.actPlaybackState.loopCount + 1
              }
            }));
            const firstStep = act.steps[0];
            get().applyActStepPlayback(firstStep);
          } else {
            get().stopAct();
          }
        } else {
          set(state => ({
            actPlaybackState: {
              ...state.actPlaybackState,
              currentStepIndex: nextIndex,
              stepStartTime: Date.now(),
              stepProgress: 0
            }
          }));
          const nextStep = act.steps[nextIndex];
          get().applyActStepPlayback(nextStep);
        }
      },

      previousActStep: () => {
        const { actPlaybackState, acts } = get();
        if (!actPlaybackState.currentActId) return;

        const act = acts.find(a => a.id === actPlaybackState.currentActId);
        if (!act) return;

        const prevIndex = actPlaybackState.currentStepIndex - 1;

        if (prevIndex >= 0) {
          set(state => ({
            actPlaybackState: {
              ...state.actPlaybackState,
              currentStepIndex: prevIndex,
              stepStartTime: Date.now(),
              stepProgress: 0
            }
          }));
          const prevStep = act.steps[prevIndex];
          get().applyActStepPlayback(prevStep);
        }
      },

      // Apply autopilot settings for an act step
      applyActStepAutopilot: (step) => {
        if (!step.autopilotSettings?.enabled) return;

        const { groups } = get();

        step.autopilotSettings.groups.forEach(groupConfig => {
          const group = groups.find(g => g.id === groupConfig.groupId);
          if (!group) return;

          // Apply autopilot settings to the group
          switch (groupConfig.autopilotType) {
            case 'color':
              // Enable color autopilot for the group
              group.fixtureIndices.forEach(fixtureIndex => {
                const fixture = get().fixtures[fixtureIndex];
                if (fixture) {
                  // Find color channels and enable autopilot
                  fixture.channels.forEach((channel, channelIndex) => {
                    if (channel.type.toLowerCase().includes('color') ||
                      channel.type.toLowerCase().includes('red') ||
                      channel.type.toLowerCase().includes('green') ||
                      channel.type.toLowerCase().includes('blue')) {
                      const dmxChannel = fixture.startAddress - 1 + channelIndex;
                      get().setChannelAutopilot(dmxChannel, {
                        enabled: true,
                        intensity: groupConfig.intensity / 100,
                        speed: groupConfig.speed / 100,
                        pattern: groupConfig.pattern || 'wave'
                      });
                    }
                  });
                }
              });
              break;

            case 'dimmer':
              // Enable dimmer autopilot for the group
              group.fixtureIndices.forEach(fixtureIndex => {
                const fixture = get().fixtures[fixtureIndex];
                if (fixture) {
                  // Find dimmer channel and enable autopilot
                  fixture.channels.forEach((channel, channelIndex) => {
                    if (channel.type.toLowerCase().includes('dimmer') ||
                      channel.type.toLowerCase().includes('intensity')) {
                      const dmxChannel = fixture.startAddress - 1 + channelIndex;
                      get().setChannelAutopilot(dmxChannel, {
                        enabled: true,
                        intensity: groupConfig.intensity / 100,
                        speed: groupConfig.speed / 100,
                        pattern: groupConfig.pattern || 'wave'
                      });
                    }
                  });
                }
              });
              break;

            case 'panTilt':
              // Enable pan/tilt autopilot for the group
              group.fixtureIndices.forEach(fixtureIndex => {
                const fixture = get().fixtures[fixtureIndex];
                if (fixture) {
                  // Find pan/tilt channels and enable autopilot
                  fixture.channels.forEach((channel, channelIndex) => {
                    if (channel.type.toLowerCase().includes('pan') ||
                      channel.type.toLowerCase().includes('tilt')) {
                      const dmxChannel = fixture.startAddress - 1 + channelIndex;
                      get().setChannelAutopilot(dmxChannel, {
                        enabled: true,
                        intensity: groupConfig.intensity / 100,
                        speed: groupConfig.speed / 100,
                        pattern: groupConfig.pattern || 'wave'
                      });
                    }
                  });
                }
              });
              break;
          }
        });

        get().addNotification({
          message: `Applied autopilot settings for step: ${step.sceneName}`,
          type: 'info',
          priority: 'low'
        });
      },

      setActPlaybackSpeed: (speed) => {
        set(state => ({
          actPlaybackState: {
            ...state.actPlaybackState,
            playbackSpeed: Math.max(0.1, Math.min(2.0, speed))
          }
        }));
      },

      setActStepProgress: (progress) => {
        set(state => ({
          actPlaybackState: {
            ...state.actPlaybackState,
            stepProgress: Math.max(0, Math.min(1, progress))
          }
        }));
      },

      // Quick Scene Functions
      quickSceneSave: () => get().quickSceneSaveA(),

      quickSceneLoad: () => get().quickSceneLoadA(),

      quickSceneSaveA: () => {
        get().quickSceneSaveDeck('A' as Apc40Deck);
      },

      quickSceneLoadA: () => {
        get().quickSceneLoadDeck('A' as Apc40Deck);
      },

      quickSceneSaveB: () => {
        get().quickSceneSaveDeck('B' as Apc40Deck);
      },

      quickSceneLoadB: () => {
        get().quickSceneLoadDeck('B' as Apc40Deck);
      },

      quickSceneSaveDeck: (deck: Apc40Deck) => {
        const slotIndex = APC40_GRID_SLOT_COUNT - 1;
        const quickName = apc40DeckSceneName(deck, slotIndex);
        const oscAddress = sceneNameToOscPath(quickName);

        get().saveScene(quickName, oscAddress);
        if (deck === 'A') get().setApc40SceneA(quickName);
        else get().setApc40SceneB(quickName);
        get().setApc40StatePatch({ activeDeck: deck });
        get().addNotification({
          message: `Quick Scene ${deck} saved to Deck ${deck} clip 40`,
          type: 'success',
          priority: 'normal'
        });
      },

      quickSceneLoadDeck: (deck: Apc40Deck) => {
        const slotIndex = APC40_GRID_SLOT_COUNT - 1;
        const quickName = apc40DeckSceneName(deck, slotIndex);
        const { scenes } = get();
        const quickScene = scenes.find((scene) => scene.name === quickName);
        if (!quickScene) {
          get().addNotification({
            message: `Quick Scene ${deck} is empty. Save Deck ${deck} clip 40 first.`,
            type: 'warning',
            priority: 'normal'
          });
          return;
        }

        if (deck === 'A') get().setApc40SceneA(quickName);
        else get().setApc40SceneB(quickName);
        get().setApc40StatePatch({ activeDeck: deck });
        get().loadScene(quickScene.name);
        get().addNotification({
          message: `Quick loaded Deck ${deck} clip 40`,
          type: 'success',
          priority: 'normal'
        });
      },

      setQuickSceneSaveMidiMapping: (mapping) => {
        set({ quickSceneSaveMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('quickSceneSaveMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('quickSceneSaveMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save quick scene save MIDI mapping:', e);
        }
      },

      setQuickSceneMidiMapping: (mapping) => {
        set({ quickSceneMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('quickSceneMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('quickSceneMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save quick scene load MIDI mapping:', e);
        }
      },

      setQuickSceneSaveBMidiMapping: (mapping) => {
        set({ quickSceneSaveBMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('quickSceneSaveBMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('quickSceneSaveBMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save quick scene save B MIDI mapping:', e);
        }
      },

      setQuickSceneLoadBMidiMapping: (mapping) => {
        set({ quickSceneLoadBMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('quickSceneLoadBMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('quickSceneLoadBMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save quick scene load B MIDI mapping:', e);
        }
      },

      setTempoPlayPauseMidiMapping: (mapping) => {
        set({ tempoPlayPauseMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('tempoPlayPauseMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('tempoPlayPauseMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save tempo play/pause MIDI mapping:', e);
        }
      },

      setTempoPlayPauseOscAddress: (address) => {
        set({ tempoPlayPauseOscAddress: address });
        try {
          localStorage.setItem('tempoPlayPauseOscAddress', address);
        } catch (e) {
          console.error('Failed to save tempo play/pause OSC address:', e);
        }
      },

      setTapTempoMidiMapping: (mapping) => {
        set({ tapTempoMidiMapping: mapping });
        try {
          if (mapping) {
            localStorage.setItem('tapTempoMidiMapping', JSON.stringify(mapping));
          } else {
            localStorage.removeItem('tapTempoMidiMapping');
          }
        } catch (e) {
          console.error('Failed to save tap tempo MIDI mapping:', e);
        }
      },

      setTapTempoOscAddress: (address) => {
        set({ tapTempoOscAddress: address });
        try {
          localStorage.setItem('tapTempoOscAddress', address);
        } catch (e) {
          console.error('Failed to save tap tempo OSC address:', e);
        }
      },

      // Autopilot Actions
      setChannelAutopilot: (channelIndex, config) => {
        set(state => ({
          channelAutopilots: {
            ...state.channelAutopilots,
            [channelIndex]: config
          }
        }));
        if (config.enabled && !get().autopilotUpdateInterval) {
          get().startAutopilotSystem();
        }
      },
      removeChannelAutopilot: (channelIndex) => {
        set(state => {
          const newAutopilots = { ...state.channelAutopilots };
          delete newAutopilots[channelIndex];
          return { channelAutopilots: newAutopilots };
        });
      },
      setPanTiltAutopilot: (config) => {
        const currentConfig = get().panTiltAutopilot;
        const newConfig = { ...currentConfig, ...config };
        if (newConfig.speed !== undefined) {
          newConfig.speed = Math.max(0.03, Math.min(2.0, newConfig.speed));
        }
        if (newConfig.smoothing !== undefined) {
          newConfig.smoothing = Math.max(0, Math.min(1, newConfig.smoothing));
        }
        set({ panTiltAutopilot: newConfig });
        if (newConfig.enabled && !get().autopilotUpdateInterval) {
          get().startAutopilotSystem();
        }
      },
      togglePanTiltAutopilot: () => {
        const enabled = !get().panTiltAutopilot.enabled;
        get().setPanTiltAutopilot({ enabled });
      },
      setColorSliderAutopilot: (config) => {
        const currentConfig = get().colorSliderAutopilot;
        const newConfig = { ...currentConfig, ...config };
        // Clamp speed to 0.1-1.0 range
        if (newConfig.speed !== undefined) {
          newConfig.speed = Math.max(0.1, Math.min(1.0, newConfig.speed));
        }
        set({ colorSliderAutopilot: newConfig });
        if (newConfig.enabled && !get().autopilotUpdateInterval) {
          get().startAutopilotSystem();
        }
      },
      toggleColorSliderAutopilot: () => {
        const enabled = !get().colorSliderAutopilot.enabled;
        get().setColorSliderAutopilot({ enabled });
      },
      updateAutopilotValues: () => {
        if (isClientSceneTransitionActive(get())) return;

        const { channelAutopilots, panTiltAutopilot, colorSliderAutopilot, setDmxChannel, bpm, lastAutopilotUpdate, setExampleSliderValue, midiClockIsPlaying, isPlaying } = get();
        const now = Date.now();
        const timeElapsed = (now - lastAutopilotUpdate) / 1000; // in seconds
        
        // Check if tempo is playing (MIDI clock or manual BPM)
        const isTempoPlaying = (midiClockIsPlaying && get().midiClockBpm > 0) || (bpm > 0 && isPlaying);
        
        const updates: { [key: number]: number } = {};
        let hasUpdates = false;

        // Channel Autopilots
        Object.entries(channelAutopilots).forEach(([channelStr, configUnknown]) => {
          const config = configUnknown as AutopilotConfig;
          if (!config.enabled) return;
          
          // If synced to BPM, only advance when tempo is playing
          if (config.syncToBPM && !isTempoPlaying) {
            return; // Skip update when tempo is stopped
          }
          
          const channel = parseInt(channelStr);
          const speed = config.syncToBPM ? (bpm / 60) * config.speed : config.speed;
          const phaseOffset = (config.phase / 360) * 2 * Math.PI;
          let value = 0;
          const progress = (now / 1000 * speed) % 1;

          switch (config.type) {
            case 'sine':
              value = (Math.sin(progress * 2 * Math.PI + phaseOffset) + 1) / 2;
              break;
            case 'triangle':
              value = Math.abs((progress * 2) - 1);
              break;
            case 'sawtooth':
              value = progress;
              break;
            case 'ping-pong':
              value = Math.abs(((progress * 2) % 2) - 1);
              break;
            case 'random':
              // This should be handled differently, maybe on beats
              return; // avoid setting dmx value
          }
          const dmxValue = Math.round(config.range.min + value * (config.range.max - config.range.min));
          updates[channel] = dmxValue;
          hasUpdates = true;
        });

        // Pan/Tilt Autopilot
        if (panTiltAutopilot.enabled) {
          // If synced to BPM, only advance when tempo is playing
          if (panTiltAutopilot.syncToBPM && !isTempoPlaying) {
            // Skip update when tempo is stopped - keep current position
          } else {
            const fixtures = get().fixtures.filter(f =>
              f.channels.some(c => c.type === 'pan' || c.type === 'tilt')
            );

            // Calculate phase increment once for all fixtures
            let phaseIncrement = panTiltAutopilot.speed * timeElapsed;
            if (panTiltAutopilot.syncToBPM && bpm > 0) {
              phaseIncrement = (bpm / 60) * timeElapsed * panTiltAutopilot.speed;
            }

          const cycleMs =
            panTiltAutopilot.syncToBPM && bpm > 0
              ? (60000 / Math.max(1, bpm)) / Math.max(0.01, panTiltAutopilot.speed)
              : 1000 / Math.max(0.01, panTiltAutopilot.speed);
          const pathEnvelope = {
            repeatMode: panTiltAutopilot.repeatMode ?? 'loop',
            loopDirection: panTiltAutopilot.loopDirection ?? 'forward',
          } as ChannelEnvelope;
          const { linearProgress: progress } = resolveEnvelopeProgress(pathEnvelope, Date.now(), cycleMs);

          fixtures.forEach(fixture => {
            const panChannel = fixture.channels.find(c => c.type === 'pan');
            const tiltChannel = fixture.channels.find(c => c.type === 'tilt');

            if (panChannel && tiltChannel) {
              let panValue = panTiltAutopilot.centerX;
              let tiltValue = panTiltAutopilot.centerY;

              const radius = (panTiltAutopilot.size / 100) * 127; // Convert percentage to DMX range
              const angle = progress * 2 * Math.PI;

              // Calculate position based on pattern
              switch (panTiltAutopilot.pathType) {
                case 'circle':
                  panValue += Math.sin(angle) * radius;
                  tiltValue += Math.cos(angle) * radius;
                  break;
                case 'figure8':
                  panValue += Math.sin(angle * 2) * radius;
                  tiltValue += Math.sin(angle) * radius;
                  break;
                case 'square':
                  const t = progress;
                  if (t < 0.25) {
                    panValue += radius;
                    tiltValue += radius;
                  } else if (t < 0.5) {
                    panValue -= radius;
                    tiltValue += radius;
                  } else if (t < 0.75) {
                    panValue -= radius;
                    tiltValue -= radius;
                  } else {
                    panValue += radius;
                    tiltValue -= radius;
                  }
                  break;
                case 'triangle':
                  const triT = progress;
                  if (triT < 1 / 3) {
                    panValue += radius;
                    tiltValue += (triT * 3) * radius;
                  } else if (triT < 2 / 3) {
                    const subT = (triT - 1 / 3) * 3;
                    panValue += (1 - subT * 2) * radius;
                    tiltValue += radius;
                  } else {
                    const subT = (triT - 2 / 3) * 3;
                    panValue -= radius;
                    tiltValue += (1 - subT) * radius;
                  }
                  break;
                case 'linear':
                  panValue += (progress * 2 - 1) * radius; // -1 to 1 range
                  break;
                case 'custom':
                  if (panTiltAutopilot.customPath && panTiltAutopilot.customPath.length > 0) {
                    const repeatMode = panTiltAutopilot.repeatMode ?? 'loop';
                    const loopDirection = panTiltAutopilot.loopDirection ?? 'forward';
                    const point = samplePanTiltPath(panTiltAutopilot.customPath, progress, {
                      smoothing: panTiltAutopilot.smoothing ?? 0.6,
                      closed: repeatMode === 'loop' && loopDirection !== 'pingpong',
                    });
                    if (point) {
                      panValue = point.x;
                      tiltValue = point.y;
                    }
                  }
                  break;
              }

              // Clamp values to DMX range
              const panDmx = Math.round(Math.min(255, Math.max(0, panValue)));
              const tiltDmx = Math.round(Math.min(255, Math.max(0, tiltValue)));

              // Calculate DMX addresses properly
              const panChannelIndex = fixture.channels.indexOf(panChannel);
              const tiltChannelIndex = fixture.channels.indexOf(tiltChannel);

              let panDmxAddress: number;
              let tiltDmxAddress: number;

              if (typeof panChannel.dmxAddress === 'number' && panChannel.dmxAddress >= 1) {
                panDmxAddress = panChannel.dmxAddress - 1; // Convert to 0-based
              } else {
                panDmxAddress = (fixture.startAddress || 1) + panChannelIndex - 1; // Convert to 0-based
              }

              if (typeof tiltChannel.dmxAddress === 'number' && tiltChannel.dmxAddress >= 1) {
                tiltDmxAddress = tiltChannel.dmxAddress - 1; // Convert to 0-based
              } else {
                tiltDmxAddress = (fixture.startAddress || 1) + tiltChannelIndex - 1; // Convert to 0-based
              }

              updates[panDmxAddress] = panDmx;
              updates[tiltDmxAddress] = tiltDmx;
              hasUpdates = true;
            }
          });
          }
        }

        // Color Slider Autopilot
        if (colorSliderAutopilot.enabled) {
          // If synced to BPM, only advance when tempo is playing
          if (colorSliderAutopilot.syncToBPM && !isTempoPlaying) {
            // Skip update when tempo is stopped - keep current color
          } else {
            const fixtures = get().fixtures.filter(f =>
              f.channels.some(c => ['red', 'green', 'blue'].includes(c.type))
            );

            // Only log debug info every 2 seconds to avoid spam
            const shouldDebug = Math.floor(now / 2000) !== Math.floor((now - 50) / 2000);
            if (shouldDebug) {
              debugLog.log('🎨 Color Autopilot Debug:');
              debugLog.log('  Total fixtures:', get().fixtures.length);
              debugLog.log('  RGB fixtures found:', fixtures.length);
              debugLog.log('  RGB fixtures:', fixtures.map(f => f.name));
            }

            if (fixtures.length > 0) {
              const speed = colorSliderAutopilot.syncToBPM ? (bpm / 60) * colorSliderAutopilot.speed : colorSliderAutopilot.speed;
              const phaseOffset = (colorSliderAutopilot.phase / 360) * 2 * Math.PI;
              const colorCycleMs =
                colorSliderAutopilot.syncToBPM && bpm > 0
                  ? (60000 / Math.max(1, bpm)) / Math.max(0.01, colorSliderAutopilot.speed)
                  : 1000 / Math.max(0.01, colorSliderAutopilot.speed);
              const { linearProgress: colorProgress } = resolveEnvelopeProgress(
                {
                  repeatMode: colorSliderAutopilot.repeatMode ?? 'loop',
                  loopDirection:
                    colorSliderAutopilot.loopDirection ??
                    (colorSliderAutopilot.type === 'ping-pong' ? 'pingpong' : 'forward'),
                } as ChannelEnvelope,
                now,
                colorCycleMs
              );
              const progress = colorProgress;

            let hue = 0;
            let saturation = 1; // Full saturation by default
            let value = 1; // Full brightness by default

            switch (colorSliderAutopilot.type) {
              case 'sine':
                hue = (Math.sin(progress * 2 * Math.PI + phaseOffset) + 1) / 2 * 360;
                break;
              case 'triangle':
                hue = Math.abs((progress * 2) - 1) * 360;
                break;
              case 'sawtooth':
                hue = progress * 360;
                break;
              case 'ping-pong':
                hue = Math.abs(((progress * 2) % 2) - 1) * 360;
                break;
              case 'cycle':
                hue = progress * 360;
                break;
              case 'random':
                // Generate a stable random hue based on time intervals
                const timeSegment = Math.floor(now / 2000); // Change every 2 seconds
                hue = (Math.sin(timeSegment * 12.9898) * 43758.5453123 % 1) * 360;
                break;
            }

            // Apply hue range constraint
            const hueRange = colorSliderAutopilot.range.max - colorSliderAutopilot.range.min;
            hue = colorSliderAutopilot.range.min + (hue / 360) * hueRange;
            hue = hue % 360;

            // Convert HSV to RGB
            const hsvToRgb = (h: number, s: number, v: number): { r: number, g: number, b: number } => {
              h = h / 60;
              const c = v * s;
              const x = c * (1 - Math.abs((h % 2) - 1));
              const m = v - c;

              let r = 0, g = 0, b = 0;

              if (h >= 0 && h < 1) {
                r = c; g = x; b = 0;
              } else if (h >= 1 && h < 2) {
                r = x; g = c; b = 0;
              } else if (h >= 2 && h < 3) {
                r = 0; g = c; b = x;
              } else if (h >= 3 && h < 4) {
                r = 0; g = x; b = c;
              } else if (h >= 4 && h < 5) {
                r = x; g = 0; b = c;
              } else if (h >= 5 && h < 6) {
                r = c; g = 0; b = x;
              }

              return {
                r: Math.round((r + m) * 255),
                g: Math.round((g + m) * 255),
                b: Math.round((b + m) * 255)
              };
            };

            const rgb = hsvToRgb(hue, saturation, value);

            if (shouldDebug) {
              debugLog.log('  Calculated HSV:', { h: hue.toFixed(1), s: saturation, v: value });
              debugLog.log('  Calculated RGB:', rgb);
            }

            // Apply to all RGB fixtures
            fixtures.forEach(fixture => {
              const redChannel = fixture.channels.find(c => c.type === 'red');
              const greenChannel = fixture.channels.find(c => c.type === 'green');
              const blueChannel = fixture.channels.find(c => c.type === 'blue');

              if (redChannel && greenChannel && blueChannel) {
                const redChannelIndex = fixture.channels.indexOf(redChannel);
                const greenChannelIndex = fixture.channels.indexOf(greenChannel);
                const blueChannelIndex = fixture.channels.indexOf(blueChannel);

                let redDmxAddress: number;
                let greenDmxAddress: number;
                let blueDmxAddress: number;

                if (typeof redChannel.dmxAddress === 'number' && redChannel.dmxAddress >= 1) {
                  redDmxAddress = redChannel.dmxAddress - 1; // Convert to 0-based
                } else {
                  redDmxAddress = (fixture.startAddress || 1) + redChannelIndex - 1; // Convert to 0-based
                }

                if (typeof greenChannel.dmxAddress === 'number' && greenChannel.dmxAddress >= 1) {
                  greenDmxAddress = greenChannel.dmxAddress - 1; // Convert to 0-based
                } else {
                  greenDmxAddress = (fixture.startAddress || 1) + greenChannelIndex - 1; // Convert to 0-based
                }

                if (typeof blueChannel.dmxAddress === 'number' && blueChannel.dmxAddress >= 1) {
                  blueDmxAddress = blueChannel.dmxAddress - 1; // Convert to 0-based
                } else {
                  blueDmxAddress = (fixture.startAddress || 1) + blueChannelIndex - 1; // Convert to 0-based
                }

                if (shouldDebug) {
                  debugLog.log(`  Fixture "${fixture.name}":`, {
                    redAddr: redDmxAddress,
                    greenAddr: greenDmxAddress,
                    blueAddr: blueDmxAddress,
                    rgbValues: rgb
                  });
                }

                updates[redDmxAddress] = rgb.r;
                updates[greenDmxAddress] = rgb.g;
                updates[blueDmxAddress] = rgb.b;
                hasUpdates = true;
              } else if (shouldDebug) {
                debugLog.log(`  Fixture "${fixture.name}": Missing RGB channels`);
              }
            });
            } else if (shouldDebug) {
              debugLog.log('  No RGB fixtures found!');
            }
          }
        }

        // Apply all updates at once
        if (hasUpdates) {
          get().setMultipleDmxChannels(updates);
        }

        // Update timestamp
        set({ lastAutopilotUpdate: now });
      },

      startAutopilotSystem: () => {
        const { autopilotUpdateInterval } = get();

        // Don't start if already running
        if (autopilotUpdateInterval) return;

        const interval = setInterval(() => {
          get().updateAutopilotValues();
        }, 50); // 20 FPS update rate

        set({ autopilotUpdateInterval: interval });

        get().addNotification({
          message: 'Autopilot system started',
          type: 'success'
        });
      },

      stopAutopilotSystem: () => {
        const { autopilotUpdateInterval } = get();

        if (autopilotUpdateInterval) {
          clearInterval(autopilotUpdateInterval);
          set({ autopilotUpdateInterval: null });

          get().addNotification({
            message: 'Autopilot system stopped',
            type: 'info'
          });
        }
      },

      // Enhanced Autopilot Track Animation System
      startAutopilotTrackAnimation: () => {
        const { autopilotTrackAnimationId, autopilotTrackEnabled } = get();

        // Don't start if already running
        if (autopilotTrackAnimationId !== null) {
          debugLog.log('[STORE] Autopilot animation already running, skipping start');
          return;
        }

        // Don't start if autopilot is not enabled
        if (!autopilotTrackEnabled) {
          debugLog.log('[STORE] Autopilot not enabled, cannot start animation');
          return;
        }

        debugLog.log('[STORE] Starting autopilot track animation system');

        let lastTime = performance.now();

        const animate = (currentTime: number) => {
          const state = get();

          // Exit if autopilot is disabled or animation was stopped
          if (!state.autopilotTrackEnabled) {
            debugLog.log('[STORE] Animation loop stopping - autopilot disabled');
            set({ autopilotTrackAnimationId: null });
            return;
          }

          // Check if animation was cancelled externally
          if (state.autopilotTrackAnimationId === null) {
            debugLog.log('[STORE] Animation loop stopping - animation ID is null (cancelled)');
            return;
          }

          const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
          lastTime = currentTime;

          // Advance position if auto-play is enabled OR if tempo is playing (MIDI clock or manual BPM)
          const isTempoPlaying = (state.midiClockIsPlaying && state.midiClockBpm > 0) || (state.bpm > 0 && state.isPlaying);
          const shouldAdvance = state.autopilotTrackAutoPlay || isTempoPlaying;

          if (shouldAdvance) {
            // Calculate position advancement based on speed and BPM
            // Prefer MIDI clock BPM if available and playing, otherwise use manual BPM
            const bpm = (state.midiClockIsPlaying && state.midiClockBpm > 0) 
              ? state.midiClockBpm 
              : (state.bpm || 120); // Default to 120 BPM
            const speedMultiplier = state.autopilotTrackSpeed / 50; // Normalize speed (50 = 1x speed)

            // Calculate advancement per second
            // At 120 BPM and 1x speed, complete one full cycle every 2 seconds (30 cycles per minute)
            const cyclesPerMinute = (bpm / 120) * 30 * speedMultiplier;
            const cyclesPerSecond = cyclesPerMinute / 60;
            const advancementPerSecond = cyclesPerSecond * 100; // Convert to percentage

            // Update position. Global automationDirection inverts the step
            // when set to 'reverse' (driven by APC40 Cue Level encoder).
            const currentPosition = state.autopilotTrackPosition;
            const directionSign = state.automationDirection === 'reverse' ? -1 : 1;
            const rawNext = currentPosition + (directionSign * advancementPerSecond * deltaTime);
            const newPosition = ((rawNext % 100) + 100) % 100;

            if (deltaTime > 0 && deltaTime < 1) { // Only log if reasonable delta time
              const tempoSource = (state.midiClockIsPlaying && state.midiClockBpm > 0) ? 'MIDI Clock' : 'Manual BPM';
              const advanceSource = state.autopilotTrackAutoPlay ? 'Auto-Play' : 'Tempo';
              debugLog.log(`[STORE] Autopilot advancing: ${currentPosition.toFixed(2)}% -> ${newPosition.toFixed(2)}% (BPM: ${bpm.toFixed(1)} from ${tempoSource}, speed: ${speedMultiplier}x, source: ${advanceSource}, delta: ${(deltaTime * 1000).toFixed(1)}ms)`);
            }

            // Update position in store
            set({ autopilotTrackPosition: newPosition });
            // Update fixtures with new position immediately
            get().updatePanTiltFromTrack(newPosition);
          } else {
            // Always update fixtures with current position (whether auto-play is on or off)
            // Update every frame even if not auto-playing to ensure position is maintained
            get().updatePanTiltFromTrack();
          }

          // Continue animation - schedule next frame
          const newAnimationId = requestAnimationFrame(animate);
          set({ autopilotTrackAnimationId: newAnimationId });
        };

        // Start the animation loop
        const initialAnimationId = requestAnimationFrame(animate);
        set({ autopilotTrackAnimationId: initialAnimationId });

        debugLog.log('[STORE] Autopilot track animation system started with ID:', initialAnimationId);
      },

      stopAutopilotTrackAnimation: () => {
        const { autopilotTrackAnimationId } = get();

        if (autopilotTrackAnimationId !== null) {
          debugLog.log('[STORE] Stopping autopilot track animation system, ID:', autopilotTrackAnimationId);
          cancelAnimationFrame(autopilotTrackAnimationId);
          set({ autopilotTrackAnimationId: null });
        }
      },

      // New Modular Automation Actions Implementation
      setColorAutomation: (config) => {
        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            color: { ...state.modularAutomation.color, ...config }
          }
        }));
      },

      setDimmerAutomation: (config) => {
        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            dimmer: { ...state.modularAutomation.dimmer, ...config }
          }
        }));
      },

      setPanTiltAutomation: (config) => {
        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            panTilt: { ...state.modularAutomation.panTilt, ...config }
          }
        }));
      },

      setEffectsAutomation: (config) => {
        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            effects: { ...state.modularAutomation.effects, ...config }
          }
        }));
      },

      toggleColorAutomation: () => {
        const { modularAutomation } = get();
        const newEnabled = !modularAutomation.color.enabled;

        get().setColorAutomation({ enabled: newEnabled });

        if (newEnabled) {
          get().startModularAnimation('color');
        } else {
          get().stopModularAnimation('color');
        }
      },

      toggleDimmerAutomation: () => {
        const { modularAutomation } = get();
        const newEnabled = !modularAutomation.dimmer.enabled;

        get().setDimmerAutomation({ enabled: newEnabled });

        if (newEnabled) {
          get().startModularAnimation('dimmer');
        } else {
          get().stopModularAnimation('dimmer');
        }
      },

      togglePanTiltAutomation: () => {
        const { modularAutomation } = get();
        const newEnabled = !modularAutomation.panTilt.enabled;

        get().setPanTiltAutomation({ enabled: newEnabled });

        if (newEnabled) {
          get().startModularAnimation('panTilt');
        } else {
          get().stopModularAnimation('panTilt');
        }
      },

      toggleEffectsAutomation: () => {
        const { modularAutomation } = get();
        const newEnabled = !modularAutomation.effects.enabled;

        get().setEffectsAutomation({ enabled: newEnabled });

        if (newEnabled) {
          get().startModularAnimation('effects');
        } else {
          get().stopModularAnimation('effects');
        }
      },

      startModularAnimation: (type) => {
        const { modularAutomation, selectedFixtures, bpm } = get();
        const config = modularAutomation[type];

        if (!config.enabled) return;

        debugLog.log(`[MODULAR AUTOMATION] Starting ${type} animation`);

        // Stop existing animation if running
        if (modularAutomation.animationIds[type]) {
          cancelAnimationFrame(modularAutomation.animationIds[type]!);
        }

        let startTime = performance.now();
        let lastUpdate = startTime;

        const animate = (currentTime: number) => {
          const elapsed = currentTime - lastUpdate;

          // Throttle to reasonable frame rate
          if (elapsed < 16.67) { // ~60fps limit
            const frameId = requestAnimationFrame(animate);
            set((state) => ({
              modularAutomation: {
                ...state.modularAutomation,
                animationIds: { ...state.modularAutomation.animationIds, [type]: frameId }
              }
            }));
            return;
          }

          const timeFromStart = currentTime - startTime;
          const effectiveSpeed = config.syncToBPM ? (bpm / 60) * config.speed : config.speed;
          const progress = (timeFromStart / 1000 * effectiveSpeed) % 1;

          // Apply automation based on type
          selectedFixtures.forEach(fixtureId => {
            get().applyModularAutomation(type, fixtureId, progress);
          });

          lastUpdate = currentTime;

          // Continue animation if still enabled
          const currentState = get().modularAutomation[type];
          if (currentState.enabled) {
            const frameId = requestAnimationFrame(animate);
            set((state) => ({
              modularAutomation: {
                ...state.modularAutomation,
                animationIds: { ...state.modularAutomation.animationIds, [type]: frameId }
              }
            }));
          }
        };

        const initialFrameId = requestAnimationFrame(animate);
        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            animationIds: { ...state.modularAutomation.animationIds, [type]: initialFrameId }
          }
        }));
      },

      stopModularAnimation: (type) => {
        const { modularAutomation } = get();
        const animationId = modularAutomation.animationIds[type];

        if (animationId) {
          debugLog.log(`[MODULAR AUTOMATION] Stopping ${type} animation`);
          cancelAnimationFrame(animationId);
          set((state) => ({
            modularAutomation: {
              ...state.modularAutomation,
              animationIds: { ...state.modularAutomation.animationIds, [type]: null }
            }
          }));
        }
      },

      stopAllModularAnimations: () => {
        const { modularAutomation } = get();

        Object.entries(modularAutomation.animationIds).forEach(([type, animationId]) => {
          if (animationId && typeof animationId === 'number') {
            cancelAnimationFrame(animationId);
          }
        });

        set((state) => ({
          modularAutomation: {
            ...state.modularAutomation,
            animationIds: {
              color: null,
              dimmer: null,
              panTilt: null,
              effects: null
            }
          }
        }));

        debugLog.log('[MODULAR AUTOMATION] All animations stopped');
      },

      // Envelope Automation Actions
      addEnvelope: (envelope: Omit<ChannelEnvelope, 'id'>) => {
        const newEnvelope = normalizeChannelEnvelope({
          ...envelope,
          id: `envelope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });
        set(state => {
          const updated = {
            envelopeAutomation: {
              ...state.envelopeAutomation,
              envelopes: [...state.envelopeAutomation.envelopes, newEnvelope]
            }
          };
          // Save to localStorage
          try {
            localStorage.setItem('envelopeAutomation', JSON.stringify({
              envelopes: updated.envelopeAutomation.envelopes,
              speed: updated.envelopeAutomation.speed
            }));
          } catch (e) {
            console.error('Failed to save envelope automation to localStorage:', e);
          }
          return updated;
        });
        // Start animation if global is enabled
        if (get().envelopeAutomation.globalEnabled) {
          get().startEnvelopeAnimation();
        }
      },

      updateEnvelope: (id: string, updates: Partial<ChannelEnvelope>) => {
        set(state => {
          const updated = {
            envelopeAutomation: {
              ...state.envelopeAutomation,
              envelopes: state.envelopeAutomation.envelopes.map(env =>
                env.id === id ? normalizeChannelEnvelope({ ...env, ...updates, id: env.id }) : env
              )
            }
          };
          // Save to localStorage
          try {
            localStorage.setItem('envelopeAutomation', JSON.stringify({
              envelopes: updated.envelopeAutomation.envelopes,
              speed: updated.envelopeAutomation.speed
            }));
          } catch (e) {
            console.error('Failed to save envelope automation to localStorage:', e);
          }
          return updated;
        });
      },

      removeEnvelope: (id: string) => {
        set(state => {
          const updated = {
            envelopeAutomation: {
              ...state.envelopeAutomation,
              envelopes: state.envelopeAutomation.envelopes.filter(env => env.id !== id)
            }
          };
          // Save to localStorage
          try {
            localStorage.setItem('envelopeAutomation', JSON.stringify({
              envelopes: updated.envelopeAutomation.envelopes,
              speed: updated.envelopeAutomation.speed
            }));
          } catch (e) {
            console.error('Failed to save envelope automation to localStorage:', e);
          }
          return updated;
        });
      },

      toggleEnvelope: (id: string) => {
        set(state => ({
          envelopeAutomation: {
            ...state.envelopeAutomation,
            envelopes: state.envelopeAutomation.envelopes.map(env =>
              env.id === id ? { ...env, enabled: !env.enabled } : env
            )
          }
        }));
      },

      toggleGlobalEnvelope: () => {
        const { envelopeAutomation } = get();
        const newEnabled = !envelopeAutomation.globalEnabled;

        set({
          envelopeAutomation: {
            ...envelopeAutomation,
            globalEnabled: newEnabled
          }
        });

        if (newEnabled) {
          get().startEnvelopeAnimation();
        } else {
          get().stopEnvelopeAnimation();
        }
      },

      startEnvelopeAnimation: () => {
        const { envelopeAutomation } = get();

        if (get().transitionTrackerPlayback?.active) {
          get().stopTransitionTrackerPlayback();
        }

        // Stop existing animation
        if (envelopeAutomation.animationId) {
          cancelAnimationFrame(envelopeAutomation.animationId);
        }

        let startTime = Date.now();
        let lastDmxUpdateTime = 0;
        const dmxUpdateThrottle = 16; // Update DMX at most every 16ms (~60fps)
        let pendingDmxUpdates: Record<number, number> = {};

        debugLog.log('[ENVELOPE] Starting envelope animation', {
          globalEnabled: envelopeAutomation.globalEnabled,
          envelopeCount: envelopeAutomation.envelopes.length,
          speed: envelopeAutomation.speed,
        });

        const animate = () => {
          const { envelopeAutomation, bpm, setDmxChannel, setMultipleDmxChannels } = get();

          // Always schedule next frame to keep animation loop alive
          const frameId = requestAnimationFrame(animate);
          set(state => ({
            envelopeAutomation: {
              ...state.envelopeAutomation,
              animationId: frameId
            }
          }));

          // Only process envelopes if globally enabled
          if (!envelopeAutomation.globalEnabled) {
            return;
          }

          const now = Date.now();
          const activeEnvelopes = envelopeAutomation.envelopes.filter(e => e.enabled);

          // If no active envelopes, just continue the loop
          if (activeEnvelopes.length === 0) {
            return;
          }

          const speedMultiplier = envelopeAutomation.speed || 1.0;

          activeEnvelopes.forEach(envelope => {
            const { linearProgress } = computeEnvelopeProgressDetailed({
              envelope,
              bpm,
              globalSpeed: speedMultiplier,
              startTimeMs: startTime,
              nowMs: now,
            });
            const waveformValue = sampleWaveformValue(envelope, linearProgress);
            const currentDmxValue = get().getDmxChannelValue(envelope.channel);
            const targetValue = envelopeModulationToDmx(envelope, waveformValue, currentDmxValue);
            pendingDmxUpdates[envelope.channel] = smoothEnvelopeDmxValue(envelope.channel, targetValue);
          });

          // Throttle DMX updates - send batch every 16ms
          if (now - lastDmxUpdateTime >= dmxUpdateThrottle && Object.keys(pendingDmxUpdates).length > 0) {
            // Send batch update to backend
            setMultipleDmxChannels(pendingDmxUpdates, true);
            pendingDmxUpdates = {};
            lastDmxUpdateTime = now;
          }
        };

        const frameId = requestAnimationFrame(animate);
        set(state => ({
          envelopeAutomation: {
            ...state.envelopeAutomation,
            animationId: frameId
          }
        }));
      },

      stopEnvelopeAnimation: () => {
        const { envelopeAutomation } = get();
        if (envelopeAutomation.animationId) {
          cancelAnimationFrame(envelopeAutomation.animationId);
        }
        resetEnvelopeSmoothing();
        set(state => ({
          envelopeAutomation: {
            ...state.envelopeAutomation,
            animationId: null
          }
        }));
      },

      setEnvelopeSpeed: (speed) => {
        const clampedSpeed = Math.max(0.1, Math.min(2.0, speed));
        set(state => {
          const updated = {
            envelopeAutomation: {
              ...state.envelopeAutomation,
              speed: clampedSpeed
            }
          };
          // Save to localStorage
          try {
            localStorage.setItem('envelopeAutomation', JSON.stringify({
              envelopes: updated.envelopeAutomation.envelopes,
              speed: updated.envelopeAutomation.speed
            }));
          } catch (e) {
            console.error('Failed to save envelope automation to localStorage:', e);
          }
          return updated;
        });
      },

      // Helper function to apply specific automation effects
      applyModularAutomation: (type: 'color' | 'dimmer' | 'panTilt' | 'effects', fixtureId: string, progress: number) => {
        const { modularAutomation, fixtures, getDmxChannelValue, setDmxChannelValue } = get();
        const fixture = fixtures.find(f => f.id === fixtureId);
        if (!fixture) return;

        const config = modularAutomation[type];

        switch (type) {
          case 'color': {
            const colorConfig = config as ColorAutomationConfig;
            let r = 0, g = 0, b = 0;

            switch (colorConfig.type) {
              case 'rainbow':
                const hue = (progress * 360 + (colorConfig.phase || 0)) % 360;
                const rgb = hsvToRgb(hue, colorConfig.saturation || 100, colorConfig.brightness || 100);
                r = rgb.r; g = rgb.g; b = rgb.b;
                break;

              case 'cycle':
                if (colorConfig.colors) {
                  const colorIndex = Math.floor(progress * colorConfig.colors.length);
                  const color = colorConfig.colors[colorIndex] || colorConfig.colors[0];
                  r = color.r; g = color.g; b = color.b;
                }
                break;

              case 'wave':
                const wave = Math.sin(progress * Math.PI * 2);
                const intensity = (wave + 1) / 2; // Normalize to 0-1
                r = intensity * 255;
                g = intensity * 127;
                b = intensity * 63;
                break;
            }

            // Apply RGB values to fixture channels
            fixture.channels.forEach(channel => {
              if (channel.dmxAddress) {
                switch (channel.type) {
                  case 'red':
                    setDmxChannelValue(channel.dmxAddress - 1, Math.round(r * (colorConfig.intensity / 100)));
                    break;
                  case 'green':
                    setDmxChannelValue(channel.dmxAddress - 1, Math.round(g * (colorConfig.intensity / 100)));
                    break;
                  case 'blue':
                    setDmxChannelValue(channel.dmxAddress - 1, Math.round(b * (colorConfig.intensity / 100)));
                    break;
                }
              }
            });
            break;
          }

          case 'dimmer': {
            const dimmerConfig = config as DimmerAutomationConfig;
            let value = 0;

            switch (dimmerConfig.type) {
              case 'breathe':
                value = Math.sin(progress * Math.PI * 2);
                value = (value + 1) / 2; // Normalize to 0-1
                break;

              case 'pulse':
                value = progress < 0.5 ? 1 : 0;
                break;

              case 'ramp':
                value = progress;
                break;

              case 'random':
                value = Math.random();
                break;
            }

            const dmxValue = dimmerConfig.range.min + (value * (dimmerConfig.range.max - dimmerConfig.range.min));

            fixture.channels.forEach(channel => {
              if (channel.dmxAddress && channel.type === 'dimmer') {
                setDmxChannelValue(channel.dmxAddress - 1, Math.round(dmxValue));
              }
            });
            break;
          }

          case 'panTilt': {
            const panTiltConfig = config as PanTiltAutopilotConfig;
            const position = get().calculateTrackPosition(
              panTiltConfig.pathType,
              progress * 100,
              panTiltConfig.size,
              panTiltConfig.centerX,
              panTiltConfig.centerY
            );

            fixture.channels.forEach(channel => {
              if (channel.dmxAddress) {
                if (channel.type === 'pan') {
                  setDmxChannelValue(channel.dmxAddress - 1, position.pan);
                } else if (channel.type === 'tilt') {
                  setDmxChannelValue(channel.dmxAddress - 1, position.tilt);
                }
              }
            });
            break;
          }

          case 'effects': {
            const effectsConfig = config as EffectsAutomationConfig;
            let value = 0;

            switch (effectsConfig.type) {
              case 'gobo_cycle':
                value = progress * (effectsConfig.range?.max || 255);
                break;

              case 'prism_rotate':
                value = progress * 255;
                break;
            }

            fixture.channels.forEach(channel => {
              if (channel.dmxAddress) {
                switch (effectsConfig.type) {
                  case 'gobo_cycle':
                    if (channel.type === 'gobo' || channel.type === 'gobo_wheel') {
                      setDmxChannelValue(channel.dmxAddress - 1, Math.round(value));
                    }
                    break;
                  case 'prism_rotate':
                    if (channel.type === 'prism') {
                      setDmxChannelValue(channel.dmxAddress - 1, Math.round(value));
                    }
                    break;
                }
              }
            });
            break;
          }
        }
      },

      // MIDI Clock and BPM Control Actions
      setSelectedMidiClockHostId: (hostId) => {
        set({ selectedMidiClockHostId: hostId });

        // Emit to server if socket is available
        const { socket } = get();
        if (socket) {
          socket.emit('setMasterClockSource', hostId);
          debugLog.log('Store: Sending setMasterClockSource to server:', hostId);
        }
      },

      setAvailableMidiClockHosts: (hosts) => set({ availableMidiClockHosts: hosts }),
      setMidiClockInputs: (inputs, currentInput) => set({
        midiClockInputs: Array.isArray(inputs) ? inputs : [],
        selectedMidiClockInputName:
          currentInput !== undefined ? currentInput : get().selectedMidiClockInputName,
        midiClockInputStatus:
          (currentInput !== undefined ? currentInput : get().selectedMidiClockInputName)
            ? get().midiClockInputStatus === 'none' ? 'selected' : get().midiClockInputStatus
            : 'none',
      }),
      setMidiClockInputTelemetry: (telemetry) => set((state) => {
        const selectedInputName =
          telemetry.selectedInputName !== undefined
            ? telemetry.selectedInputName
            : state.selectedMidiClockInputName;
        const lastInputName =
          telemetry.lastInputName !== undefined
            ? telemetry.lastInputName
            : state.lastMidiClockInputName;
        const lastInputAt =
          telemetry.lastInputAt !== undefined
            ? telemetry.lastInputAt
            : state.lastMidiClockInputAt;
        const status =
          telemetry.status ??
          (selectedInputName ? state.midiClockInputStatus : 'none');
        return {
          selectedMidiClockInputName: selectedInputName,
          lastMidiClockInputName: lastInputName,
          lastMidiClockInputAt: lastInputAt,
          midiClockInputStatus: status,
        };
      }),
      setDmxFaderOrientation: (orientation) => {
        const next = orientation === 'vertical' ? 'vertical' : 'horizontal';
        try {
          localStorage.setItem('dmxFaderOrientation', next);
        } catch {
          /* ignore */
        }
        set({ dmxFaderOrientation: next });
      },
      setDmxChannelsPerRow: (count) => {
        const n = Math.max(0, Math.min(128, Math.round(count)));
        try {
          localStorage.setItem('dmxChannelsPerRow', String(n));
        } catch {
          /* ignore */
        }
        set({ dmxChannelsPerRow: n });
      },
      getChannelTicksOnly: (dmxAddress: number) => {
        const state = get();
        if (state.channelTicksOnlyOverrides[dmxAddress] !== undefined) {
          return state.channelTicksOnlyOverrides[dmxAddress];
        }
        const info = state.getChannelInfo(dmxAddress);
        return info?.ticksOnly ?? false;
      },
      setChannelTicksOnly: (dmxAddress: number, ticksOnly: boolean) => {
        const state = get();
        const overrides = { ...state.channelTicksOnlyOverrides, [dmxAddress]: ticksOnly };
        try {
          localStorage.setItem('dmxChannelTicksOnlyOverrides', JSON.stringify(overrides));
        } catch {
          /* ignore */
        }

        let fixtures = state.fixtures;
        let updatedFixtureId: string | null = null;

        for (const fixture of state.fixtures) {
          const fixtureStart = fixture.startAddress - 1;
          const fixtureEnd = fixtureStart + (fixture.channels?.length || 0) - 1;
          if (dmxAddress < fixtureStart || dmxAddress > fixtureEnd) continue;

          const channelOffset = dmxAddress - fixtureStart;
          fixtures = fixtures.map((f) => {
            if (f.id !== fixture.id) return f;
            const channels = [...(f.channels || [])];
            const ch = channels[channelOffset];
            if (!ch) return f;
            channels[channelOffset] = { ...ch, ticksOnly };
            return { ...f, channels };
          });
          updatedFixtureId = fixture.id;
          break;
        }

        if (updatedFixtureId) {
          try {
            localStorage.setItem('artbastard-fixtures', JSON.stringify(fixtures));
          } catch {
            /* ignore */
          }
          const updated = fixtures.find((f) => f.id === updatedFixtureId);
          if (updated) {
            axios.post(`/api/fixtures/${updated.id}`, updated).catch((error) => {
              console.error('Failed to save fixture ticksOnly to backend:', error);
              get().addNotification({
                message: 'Ticks mode saved locally; server sync failed',
                type: 'warning',
                priority: 'normal',
              });
            });
          }
        }

        const auxOverrides = { ...state.channelAuxFullFaderOverrides };
        if (!ticksOnly) {
          delete auxOverrides[dmxAddress];
          try {
            localStorage.setItem('dmxChannelAuxFullFaderOverrides', JSON.stringify(auxOverrides));
          } catch {
            /* ignore */
          }
        }
        set({ channelTicksOnlyOverrides: overrides, channelAuxFullFaderOverrides: auxOverrides, fixtures });
      },
      getChannelAuxFullFader: (dmxAddress: number) => {
        const overrides = get().channelAuxFullFaderOverrides;
        if (Object.prototype.hasOwnProperty.call(overrides, dmxAddress)) {
          return Boolean(overrides[dmxAddress]);
        }
        return true;
      },
      setChannelAuxFullFader: (dmxAddress: number, enabled: boolean) => {
        const overrides = { ...get().channelAuxFullFaderOverrides, [dmxAddress]: enabled };
        try {
          localStorage.setItem('dmxChannelAuxFullFaderOverrides', JSON.stringify(overrides));
        } catch {
          /* ignore */
        }
        set({ channelAuxFullFaderOverrides: overrides });
      },
      toggleChannelAuxFullFader: (dmxAddress: number) => {
        const state = get();
        state.setChannelAuxFullFader(dmxAddress, !state.getChannelAuxFullFader(dmxAddress));
      },
      setActiveSessionId: (sessionId) => {
        const sid = sessionId.trim().slice(0, 64) || 'default';
        try {
          localStorage.setItem('artbastard-session-id', sid);
        } catch {
          /* ignore */
        }
        set({ activeSessionId: sid });
      },
      setSessionsList: (sessions, defaultSessionId) =>
        set({
          sessionsList: sessions,
          activeSessionId: get().activeSessionId || defaultSessionId || 'default',
        }),
      setBridgeRegistry: (payload) =>
        set({
          bridgeConnected: !!payload.connected,
          bridgeInfo: payload.bridge || null,
          connectedClientCount:
            typeof payload.connectedClients === 'number'
              ? payload.connectedClients
              : get().connectedClientCount,
          abletonLinkAvailable:
            !!payload.connected || get().abletonLinkAvailable,
          abletonLinkPeers:
            payload.bridge?.linkPeers ?? get().abletonLinkPeers,
        }),

      setMidiClockBpm: (bpm, emitToServer = true) => {
        set({ midiClockBpm: bpm });

        // Also emit to server if socket is available for BPM changes
        const { socket } = get();
        if (socket && emitToServer) {
          socket.emit('setInternalClockBPM', bpm);
          debugLog.log('Store: Sending setInternalClockBPM to server:', bpm);
        }
      },

      setMidiClockIsPlaying: (isPlaying) => set({ midiClockIsPlaying: isPlaying }),

      setMidiClockBeatBar: (beat, bar) => set({
        midiClockCurrentBeat: beat,
        midiClockCurrentBar: bar
      }),

      requestToggleMasterClockPlayPause: () => {
        const { socket } = get();
        const socketIsConnected = Boolean((socket as unknown as { connected?: boolean } | null)?.connected);
        if (socketIsConnected) {
          debugLog.log('Store: Requesting master clock play/pause toggle via socket');
          socket.emit('toggleMasterClockPlayPause');
        } else {
          console.warn('Store: No socket connection available for master clock toggle');
          // Fallback - directly toggle the local state
          const { midiClockIsPlaying } = get();
          set({ midiClockIsPlaying: !midiClockIsPlaying });
        }
      },
      requestMasterClockSourceChange: (sourceId: string) => {
        get().socket?.emit('setMasterClockSource', sourceId);
      },
      requestMidiClockInputList: () => {
        get().socket?.emit('getMidiClockInputs');
      },
      requestSetMidiClockInput: (inputName: string) => {
        get().socket?.emit('setMidiClockInput', inputName);
      },

      // Auto-Scene Actions
      setAutoSceneEnabled: (enabled) => {
        set({ autoSceneEnabled: enabled });
        saveAutoSceneSettings(get());
      },

      setAutoSceneList: (sceneNames) => {
        set({ autoSceneList: sceneNames });
        saveAutoSceneSettings(get());
      },

      setAutoSceneMode: (mode) => {
        set({ autoSceneMode: mode, autoScenePingPongDirection: 'forward' }); // Reset direction when changing mode
        saveAutoSceneSettings(get());
      },

      setAutoSceneBeatDivision: (division) => {
        set({ autoSceneBeatDivision: Math.max(1, division) }); // Ensure at least 1
        saveAutoSceneSettings(get());
      },

      setAutomationDirection: (direction) => {
        if (get().automationDirection === direction) return;
        set({ automationDirection: direction });
      },

      setAutoSceneTempoSource: (source) => {
        debugLog.log('Store: Setting auto scene tempo source to:', source);
        set({ autoSceneTempoSource: source });
        saveAutoSceneSettings(get());

        const { socket } = get();
        if (!socket) return;
        if (source === 'tap_tempo' || source === 'internal_clock') {
          socket.emit('setMasterClockSource', 'internal');
        } else if (source === 'ableton_link') {
          socket.emit('setMasterClockSource', 'ableton-link');
        }
      },

      setNextAutoSceneIndex: () => {
        const { autoSceneList, autoSceneCurrentIndex, autoSceneMode, autoScenePingPongDirection, automationDirection } = get();

        if (autoSceneList.length === 0) return;

        let nextIndex = autoSceneCurrentIndex;
        // Global direction flips the step sign in 'forward' mode and seeds
        // ping-pong's internal direction. 'random' ignores direction by design.
        const step = automationDirection === 'reverse' ? -1 : 1;

        switch (autoSceneMode) {
          case 'forward':
            nextIndex = (autoSceneCurrentIndex + step + autoSceneList.length) % autoSceneList.length;
            break;

          case 'ping-pong':
            if (autoScenePingPongDirection === 'forward') {
              nextIndex = autoSceneCurrentIndex + step;
              if (nextIndex >= autoSceneList.length - 1) {
                nextIndex = autoSceneList.length - 1;
                set({ autoScenePingPongDirection: 'backward' });
              } else if (nextIndex < 0) {
                nextIndex = 0;
                set({ autoScenePingPongDirection: 'backward' });
              }
            } else {
              nextIndex = autoSceneCurrentIndex - step;
              if (nextIndex <= 0) {
                nextIndex = 0;
                set({ autoScenePingPongDirection: 'forward' });
              } else if (nextIndex >= autoSceneList.length - 1) {
                nextIndex = autoSceneList.length - 1;
                set({ autoScenePingPongDirection: 'forward' });
              }
            }
            break;

          case 'random':
            nextIndex = Math.floor(Math.random() * autoSceneList.length);
            break;
        }

        set({ autoSceneCurrentIndex: nextIndex });
      },

      resetAutoSceneIndex: () => set({ autoSceneCurrentIndex: -1 }),

      setManualBpm: (bpm) => {
        const clampedBpm = Math.max(60, Math.min(200, bpm)); // Clamp between 60-200
        debugLog.log('Store: Setting manual BPM to:', clampedBpm);
        set({ autoSceneManualBpm: clampedBpm });
        saveAutoSceneSettings(get());
      },

      recordTapTempo: () => {
        const now = Date.now();
        const { autoSceneTapTimes, autoSceneLastTapTime } = get();

        // Reset if more than 3 seconds since last tap
        const newTapTimes = (now - autoSceneLastTapTime > 3000) ? [now] : [...autoSceneTapTimes, now];

        set({
          autoSceneTapTimes: newTapTimes.slice(-8), // Keep last 8 taps
          autoSceneLastTapTime: now
        });

        // Calculate BPM if we have at least 2 taps
        if (newTapTimes.length >= 2) {
          const intervals = [];
          for (let i = 1; i < newTapTimes.length; i++) {
            intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
          }

          const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
          const calculatedBpm = Math.round((60 * 1000) / avgInterval);

          // Only accept reasonable BPM values
          if (calculatedBpm >= 60 && calculatedBpm <= 200) {
            set({ autoSceneTapTempoBpm: calculatedBpm });
            debugLog.log('Store: Calculated tap tempo BPM:', calculatedBpm);
            saveAutoSceneSettings(get());
          }
        }
      },

      triggerAutoSceneFlash: () => {
        set({ autoSceneIsFlashing: true });
        setTimeout(() => {
          set({ autoSceneIsFlashing: false });
        }, 200); // Flash for 200ms
      },

      // Legacy Autopilot Track Actions Implementation
      setAutopilotTrackEnabled: (enabled: boolean) => {
        debugLog.log('[STORE] Setting autopilot track enabled to:', enabled);
        set({ autopilotTrackEnabled: enabled });

        if (enabled) {
          // Start animation when enabled
          get().startAutopilotTrackAnimation();
          // Immediately update position when enabled
          get().updatePanTiltFromTrack();
        } else {
          // Stop animation when disabled
          get().stopAutopilotTrackAnimation();
        }
      },

      setAutopilotTrackType: (type: 'circle' | 'figure8' | 'square' | 'triangle' | 'linear' | 'random' | 'custom') => {
        debugLog.log('[STORE] Setting autopilot track type to:', type);
        set({ autopilotTrackType: type });

        // Trigger immediate update if enabled
        if (get().autopilotTrackEnabled) {
          get().updatePanTiltFromTrack();
        }
      },

      setAutopilotTrackPosition: (position: number) => {
        debugLog.log('[STORE] Setting autopilot track position to:', position);
        set({ autopilotTrackPosition: position });

        // Trigger immediate update if enabled
        if (get().autopilotTrackEnabled) {
          get().updatePanTiltFromTrack();
        }
      },

      setAutopilotTrackSize: (size: number) => {
        debugLog.log('[STORE] Setting autopilot track size to:', size);
        set({ autopilotTrackSize: size });

        // Trigger immediate update if enabled
        if (get().autopilotTrackEnabled) {
          get().updatePanTiltFromTrack();
        }
      },

      setAutopilotTrackSpeed: (speed: number) => {
        debugLog.log('[STORE] Setting autopilot track speed to:', speed);
        set({ autopilotTrackSpeed: speed });

        // Speed change doesn't require immediate position update
        // Animation loop will pick up the new speed automatically
      },

      setAutopilotTrackCenter: (centerX: number, centerY: number) => {
        debugLog.log('[STORE] Setting autopilot track center to:', centerX, centerY);
        set({ autopilotTrackCenterX: centerX, autopilotTrackCenterY: centerY });

        // Trigger immediate update if enabled
        if (get().autopilotTrackEnabled) {
          get().updatePanTiltFromTrack();
        }
      },

      setAutopilotTrackAutoPlay: (autoPlay: boolean) => {
        debugLog.log('[STORE] Setting autopilot track auto-play to:', autoPlay);
        set({ autopilotTrackAutoPlay: autoPlay });

        // Auto-play state affects animation loop behavior
        // No immediate update needed
      },

      setAutopilotTrackCustomPoints: (points: Array<{ x: number; y: number }>) => {
        debugLog.log('[STORE] Setting autopilot track custom points:', points);
        set({ autopilotTrackCustomPoints: points });

        // Trigger immediate update if enabled and using custom track
        if (get().autopilotTrackEnabled && get().autopilotTrackType === 'custom') {
          get().updatePanTiltFromTrack();
        }
      },

      calculateTrackPosition: (trackType: string, position: number, size: number, centerX: number, centerY: number) => {
        // Convert position (0-100%) to progress (0-1)
        const progress = position / 100;

        // Calculate radius based on size (0-100%) scaled to DMX range
        const radius = (size / 100) * 127; // Max radius is half of 255

        let pan = centerX;
        let tilt = centerY;

        switch (trackType) {
          case 'circle':
            // Full circle path
            pan = centerX + Math.cos(progress * 2 * Math.PI - Math.PI / 2) * radius;
            tilt = centerY + Math.sin(progress * 2 * Math.PI - Math.PI / 2) * radius;
            break;

          case 'figure8':
            // Figure-8 pattern
            pan = centerX + Math.sin(progress * 4 * Math.PI) * radius;
            tilt = centerY + Math.sin(progress * 2 * Math.PI) * radius * 0.5;
            break;

          case 'square':
            // Square path
            const t = progress * 4; // 0-4 for four sides
            if (t < 1) {
              // Top side (left to right)
              pan = centerX - radius + (t * 2 * radius);
              tilt = centerY - radius;
            } else if (t < 2) {
              // Right side (top to bottom)
              pan = centerX + radius;
              tilt = centerY - radius + ((t - 1) * 2 * radius);
            } else if (t < 3) {
              // Bottom side (right to left)
              pan = centerX + radius - ((t - 2) * 2 * radius);
              tilt = centerY + radius;
            } else {
              // Left side (bottom to top)
              pan = centerX - radius;
              tilt = centerY + radius - ((t - 3) * 2 * radius);
            }
            break;

          case 'triangle':
            // Triangle path
            const triT = progress * 3; // 0-3 for three sides
            if (triT < 1) {
              // First side
              pan = centerX - radius + (triT * radius);
              tilt = centerY + radius;
            } else if (triT < 2) {
              // Second side
              pan = centerX + ((triT - 1) * radius);
              tilt = centerY + radius - ((triT - 1) * 2 * radius);
            } else {
              // Third side
              pan = centerX + radius - ((triT - 2) * 2 * radius);
              tilt = centerY - radius + ((triT - 2) * 2 * radius);
            }
            break;

          case 'linear':
            // Linear back and forth
            const linearT = progress * 2; // 0-2 for back and forth
            if (linearT < 1) {
              pan = centerX - radius + (linearT * 2 * radius);
            } else {
              pan = centerX + radius - ((linearT - 1) * 2 * radius);
            }
            tilt = centerY;
            break;

          case 'random':
            // Random position (based on position as seed for consistency)
            const seed = Math.sin(progress * 1000) * 10000;
            pan = centerX + (Math.sin(seed) * radius);
            tilt = centerY + (Math.cos(seed) * radius);
            break;

          case 'custom':
            // Custom path from points
            const points = get().autopilotTrackCustomPoints || [];
            if (points.length > 0) {
              const pointIndex = progress * (points.length - 1);
              const lowerIndex = Math.floor(pointIndex);
              const upperIndex = Math.min(lowerIndex + 1, points.length - 1);
              const t = pointIndex - lowerIndex;

              const lowerPoint = points[lowerIndex];
              const upperPoint = points[upperIndex];

              pan = lowerPoint.x + (upperPoint.x - lowerPoint.x) * t;
              tilt = lowerPoint.y + (upperPoint.y - lowerPoint.y) * t;
            }
            break;

          default:
            // Default to center position
            break;
        }

        // Clamp to DMX range
        pan = Math.max(0, Math.min(255, Math.round(pan)));
        tilt = Math.max(0, Math.min(255, Math.round(tilt)));

        return { pan, tilt };
      },

      updatePanTiltFromTrack: (position?: number) => {
        const {
          autopilotTrackEnabled,
          autopilotTrackType,
          autopilotTrackPosition,
          autopilotTrackSize,
          autopilotTrackCenterX,
          autopilotTrackCenterY,
          selectedFixtures,
          fixtures
        } = get();

        if (!autopilotTrackEnabled) {
          debugLog.log('[STORE] updatePanTiltFromTrack: Autopilot not enabled, skipping update');
          return;
        }

        const currentPosition = position !== undefined ? position : autopilotTrackPosition;

        debugLog.log(`[STORE] updatePanTiltFromTrack: Calculating position for ${selectedFixtures.length} fixtures at position ${currentPosition}%`);

        // Calculate current track position
        let pan: number, tilt: number;
        try {
          const result = get().calculateTrackPosition(
            autopilotTrackType,
            currentPosition,
            autopilotTrackSize,
            autopilotTrackCenterX,
            autopilotTrackCenterY
          );
          pan = result.pan;
          tilt = result.tilt;
        } catch (error) {
          console.error('[STORE] updatePanTiltFromTrack: Error calculating track position:', error);
          return;
        }

        debugLog.log('[STORE] updatePanTiltFromTrack: Calculated pan =', pan, ', tilt =', tilt);

        // Apply to selected fixtures
        const targetFixtures = selectedFixtures.length > 0
          ? fixtures.filter(f => selectedFixtures.includes(f.id))
          : fixtures; // If no selection, apply to all fixtures

        if (targetFixtures.length === 0) {
          console.warn('[STORE] updatePanTiltFromTrack: No target fixtures found');
          return;
        }

        const updates: Record<number, number> = {};
        let fixturesWithPanTilt = 0;

        targetFixtures.forEach(fixture => {
          const panChannel = fixture.channels.find(ch => ch.type.toLowerCase() === 'pan');
          const tiltChannel = fixture.channels.find(ch => ch.type.toLowerCase() === 'tilt');

          if (panChannel && tiltChannel) {
            fixturesWithPanTilt++;
            
            // Use dmxAddress if available, otherwise calculate from startAddress
            const panChannelIndex = fixture.channels.indexOf(panChannel);
            const tiltChannelIndex = fixture.channels.indexOf(tiltChannel);

            const panDmxAddress = panChannel.dmxAddress !== undefined && panChannel.dmxAddress >= 1
              ? panChannel.dmxAddress - 1 // Convert 1-based to 0-based
              : (fixture.startAddress || 1) + panChannelIndex - 1; // Convert to 0-based
            
            const tiltDmxAddress = tiltChannel.dmxAddress !== undefined && tiltChannel.dmxAddress >= 1
              ? tiltChannel.dmxAddress - 1 // Convert 1-based to 0-based
              : (fixture.startAddress || 1) + tiltChannelIndex - 1; // Convert to 0-based

            // Ensure values are within valid DMX range
            const clampedPan = Math.max(0, Math.min(255, Math.round(pan)));
            const clampedTilt = Math.max(0, Math.min(255, Math.round(tilt)));

            // Add to batch update
            updates[panDmxAddress] = clampedPan;
            updates[tiltDmxAddress] = clampedTilt;

            debugLog.log(`[STORE] updatePanTiltFromTrack: Fixture ${fixture.name}: Pan CH${panDmxAddress + 1}=${clampedPan}, Tilt CH${tiltDmxAddress + 1}=${clampedTilt}`);
          } else {
            console.warn(`[STORE] updatePanTiltFromTrack: Fixture ${fixture.name} missing pan or tilt channel`);
          }
        });

        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          debugLog.log(`[STORE] updatePanTiltFromTrack: Applying ${Object.keys(updates).length} channel updates to ${fixturesWithPanTilt} fixtures`);
          get().setMultipleDmxChannels(updates, true); // Send to backend
        } else {
          console.warn('[STORE] updatePanTiltFromTrack: No pan/tilt channels found in target fixtures');
        }
      },

      // Debug function to check autopilot state
      debugAutopilotState: () => {
        const state = get();
        console.group('🔍 AUTOPILOT DEBUG STATE');

        debugLog.log('=== Main Autopilot System ===');
        debugLog.log('Update Interval:', state.autopilotUpdateInterval ? 'Running' : 'Stopped');
        debugLog.log('Last Update:', new Date(state.lastAutopilotUpdate).toLocaleTimeString());

        debugLog.log('=== Pan/Tilt Autopilot ===');
        debugLog.log('Enabled:', state.panTiltAutopilot.enabled);
        debugLog.log('Path Type:', state.panTiltAutopilot.pathType);
        debugLog.log('Speed:', state.panTiltAutopilot.speed);
        debugLog.log('Center X/Y:', state.panTiltAutopilot.centerX, state.panTiltAutopilot.centerY);
        debugLog.log('Size:', state.panTiltAutopilot.size);
        debugLog.log('Sync to BPM:', state.panTiltAutopilot.syncToBPM);
        debugLog.log('Phase:', state.panTiltAutopilot.phase);

        debugLog.log('=== Color Autopilot ===');
        debugLog.log('Enabled:', state.colorSliderAutopilot.enabled);
        debugLog.log('Type:', state.colorSliderAutopilot.type);
        debugLog.log('Speed:', state.colorSliderAutopilot.speed);
        debugLog.log('Range:', state.colorSliderAutopilot.range);
        debugLog.log('Sync to BPM:', state.colorSliderAutopilot.syncToBPM);

        debugLog.log('=== Track Autopilot ===');
        debugLog.log('Enabled:', state.autopilotTrackEnabled);
        debugLog.log('Auto Play:', state.autopilotTrackAutoPlay);
        debugLog.log('Type:', state.autopilotTrackType);
        debugLog.log('Position:', state.autopilotTrackPosition + '%');
        debugLog.log('Size:', state.autopilotTrackSize + '%');
        debugLog.log('Center X/Y:', state.autopilotTrackCenterX, state.autopilotTrackCenterY);
        debugLog.log('Speed:', state.autopilotTrackSpeed);
        debugLog.log('Animation ID:', state.autopilotTrackAnimationId);

        debugLog.log('=== Channel Autopilots ===');
        debugLog.log('Count:', Object.keys(state.channelAutopilots).length);
        Object.entries(state.channelAutopilots).forEach(([channel, config]) => {
          debugLog.log(`Channel ${parseInt(channel) + 1}:`, config);
        });

        debugLog.log('=== System State ===');
        debugLog.log('BPM:', state.bpm);
        debugLog.log('Selected Fixtures:', state.selectedFixtures.length);
        debugLog.log('Total Fixtures:', state.fixtures.length);

        console.groupEnd();
      },

      // Notification Actions
      addNotification: (notification) => {
        const newNotification: Notification = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          ...notification
        };

        set(state => ({
          notifications: [...state.notifications, newNotification]
        }));
      },

      removeNotification: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },

      clearAllNotifications: () => {
        set({ notifications: [] });
      },

      jumpToChannel: (channelIndex: number) => {
        // Set the jump target
        set({ channelJumpTarget: channelIndex });

        // Reset the target shortly after to allow re-triggering the same jump
        // and to clear the "active" jump state
        setTimeout(() => {
          set({ channelJumpTarget: null });
        }, 500);
      },

      // Fixture Helper Functions for System-Wide Channel Info Display
      getChannelInfo: (dmxAddress: number) => {
        const state = get();
        for (const fixture of state.fixtures) {
          const fixtureStartAddress = fixture.startAddress - 1; // Convert to 0-based
          const fixtureEndAddress = fixtureStartAddress + (fixture.channels?.length || 0) - 1;

          if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
            const channelOffset = dmxAddress - fixtureStartAddress;
            const channel = fixture.channels?.[channelOffset];

            if (channel) {
              return {
                fixtureName: fixture.name,
                fixtureType: fixture.type,
                fixtureId: fixture.id,
                channelName: channel.name || `${channel.type} Channel`,
                channelType: channel.type,
                channelIndex: channelOffset,
                startAddress: fixture.startAddress,
                ranges: channel.ranges,
                ticksOnly:
                  state.channelTicksOnlyOverrides[dmxAddress] !== undefined
                    ? state.channelTicksOnlyOverrides[dmxAddress]
                    : (channel.ticksOnly ?? false),
              };
            }
          }
        }
        return null;
      },

      getFixtureColor: (fixtureId: string) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);

        if (fixtureIndex === -1) {
          return '#64748b'; // Default gray for unknown fixtures
        }

        // Generate consistent color based on fixture index
        const colors = [
          '#ef4444', // red
          '#f59e0b', // orange
          '#eab308', // yellow
          '#84cc16', // lime
          '#22c55e', // green
          '#14b8a6', // teal
          '#06b6d4', // cyan
          '#3b82f6', // blue
          '#6366f1', // indigo
          '#8b5cf6', // violet
          '#a855f7', // purple
          '#ec4899', // pink
          '#f43f5e', // rose
          '#10b981', // emerald
          '#0ea5e9', // sky
          '#d946ef', // fuchsia
        ];

        return colors[fixtureIndex % colors.length];
      },

      isChannelAssigned: (dmxAddress: number) => {
        const state = get();
        return state.getChannelInfo(dmxAddress) !== null;
      },

      ...createTransitionTrackerSlice(set, get),
    })) as unknown as StateCreator<State>
  )
);

// Helper function for HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = (v / 100) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = (v / 100) - c;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}
