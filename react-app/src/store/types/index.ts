// Shared types for all store slices
export interface MidiMapping {
  channel: number;
  note?: number;
  controller?: number;
}

export interface FixtureChannelRange {
  min: number;
  max: number;
  description: string;
}

export interface FixtureChannel {
  name: string;
  type: string;
  dmxAddress?: number;
  ranges?: FixtureChannelRange[];
  /** When true, DMX UI uses discrete fixture ranges (gobo slots, color wheel positions, etc.) */
  ticksOnly?: boolean;
}

export interface Fixture {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  mode?: string;
  startAddress: number;
  channels: FixtureChannel[];
  notes?: string;
  flags?: FixtureFlag[];
  isFlagged?: boolean;
  photoUrl?: string; // URL or data URL for fixture photo thumbnail
  isFavorite?: boolean; // Favorite status for quick access
  tags?: string[]; // Group identifiers: WASH, RGB, LED, LASER, MOVING HEAD, etc.
}

export interface FixtureFlag {
  id: string;
  name: string;
  color: string;
  priority?: number;
  category?: string;
}

export interface FixtureTemplate {
  id: string;
  templateName: string;
  defaultNamePrefix: string;
  channels?: Array<{ name: string; type: string; ticksOnly?: boolean }>;
  modes?: Array<{
    name: string;
    channels: number;
    channelData: Array<{ name: string; type: string; ranges?: Array<{ min: number; max: number; description: string }>; ticksOnly?: boolean }>;
  }>;
  type?: string;
  manufacturer?: string; // Manufacturer name (e.g., "uKing")
  model?: string;
  modelConfidence?: 'confirmed' | 'probable' | 'unknown';
  catalogId?: string;
  category?: string;
  documentationPath?: string;
  notes?: string;
  addressing?: FixtureDipSwitchAddressing;
  isBuiltIn?: boolean;
  isCustom?: boolean;
  isFavorite?: boolean; // Favorite templates for quick access
  createdAt?: number;
  updatedAt?: number;
  photoUrl?: string; // URL or data URL for fixture template photo thumbnail
  tags?: string[]; // Group identifiers: WASH, RGB, LED, LASER, MOVING HEAD, etc.
}

export interface Group {
  id: string;
  name: string;
  fixtureIndices: number[];
  lastStates: number[];
  position?: { x: number; y: number };
  isMuted: boolean;
  isSolo: boolean;
  masterValue: number;
  midiMapping?: MidiMapping;
  oscAddress?: string;
  ignoreSceneChanges?: boolean;
  ignoreMasterFader?: boolean;
  panOffset?: number;
  tiltOffset?: number;
  zoomValue?: number;
}

export interface Scene {
  name: string;
  channelValues: number[];
  oscAddress: string;
  timeline?: SceneTimeline;
}

export interface SceneTimelineKeyframe {
  id: string;
  time: number;
  channelValues: Record<number, number>;
  easing?: 'linear' | 'smooth' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface SceneTimeline {
  enabled: boolean;
  duration: number;
  loop: boolean;
  keyframes: SceneTimelineKeyframe[];
}

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
}

export interface ArtNetConfig {
  ip: string;
  subnet: number;
  universe: number;
  net: number;
  port: number;
  base_refresh_interval: number;
}

export interface OscConfig {
  host: string;
  port: number;
  sendEnabled: boolean;
  sendHost: string;
}

export interface OscActivity {
  lastValue: number;
  lastUpdate: number;
}

export interface OscMessage {
  address: string;
  args: Array<{ type: string; value: unknown }>;
  timestamp: number;
  source?: string;
}

export interface PlacedFixture {
  id: string;
  fixtureId: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  dmxAddress: number;
  startAddress: number;
  type: string;
}

export interface PlacedControl {
  id: string;
  fixtureId: string;
  controlId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasterSliderTarget {
  type: 'channel' | 'group' | 'fixture';
  id: string | number;
}

export interface MasterSlider {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  targets: MasterSliderTarget[];
  midiMapping?: MidiMapping;
  oscAddress?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  duration?: number;
}

export type AddNotificationInput = Omit<Notification, 'id' | 'timestamp'>;

export type DmxChannelBatchUpdate = Record<number, number>;

export interface ActStep {
  id: string;
  sceneName: string;
  duration: number;
  transitionDuration?: number;
  transitionEasing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  autopilot?: any;
}

export interface ActTrigger {
  id: string;
  actId: string;
  type: 'osc' | 'midi';
  address?: string;
  midiMapping?: MidiMapping;
  enabled: boolean;
}

export interface TimelineEvent {
  id: string;
  time: number;
  type: 'midi' | 'osc';
  data: any;
  target?: {
    type: string;
    id: string;
    action: string;
  };
}

export interface Act {
  id: string;
  name: string;
  description?: string;
  steps: ActStep[];
  triggers: ActTrigger[];
  events: TimelineEvent[];
  markers: TimelineMarker[];
  totalDuration?: number;
  audioTrack?: {
    url?: string;
    waveform?: number[];
  };
  isPlaying?: boolean;
  playbackProgress?: number;
  createdAt: number;
  updatedAt: number;
  channelLanes?: Record<number, { muted: boolean; soloed: boolean }>;
}

export interface ActPlaybackState {
  isPlaying: boolean;
  currentActId: string | null;
  currentStepIndex: number;
  stepStartTime: number;
  stepProgress: number;
  loopCount: number;
  playbackSpeed: number;
}

export interface ChannelRange {
  min: number;
  max: number;
}

// Automation Types
export interface AutopilotConfig {
  enabled: boolean;
  type: 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth';
  speed: number;
  range: { min: number; max: number };
  syncToBPM: boolean;
  phase: number;
  repeatMode?: EnvelopeRepeatMode;
  loopDirection?: EnvelopeLoopDirection;
}

export interface ColorSliderAutopilotConfig {
  enabled: boolean;
  type: 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth';
  speed: number;
  range: { min: number; max: number };
  syncToBPM: boolean;
  phase: number;
  repeatMode?: EnvelopeRepeatMode;
  loopDirection?: EnvelopeLoopDirection;
}

export interface PanTiltAutopilotConfig {
  enabled: boolean;
  pathType: 'circle' | 'figure8' | 'square' | 'triangle' | 'linear' | 'custom';
  size: number;
  speed: number;
  centerX: number;
  centerY: number;
  syncToBPM: boolean;
  customPoints?: Array<{ x: number; y: number }>;
  customPath?: Array<{ x: number; y: number }>;
  phase: number;
  repeatMode?: EnvelopeRepeatMode;
  loopDirection?: EnvelopeLoopDirection;
}

export interface ColorAutomationConfig {
  enabled: boolean;
  type: 'rainbow' | 'pulse' | 'strobe' | 'cycle' | 'breathe' | 'wave' | 'random';
  speed: number;
  intensity: number;
  syncToBPM: boolean;
  colors?: Array<{ r: number; g: number; b: number }>;
  hueRange?: { start: number; end: number };
  saturation?: number;
  brightness?: number;
  phase?: number;
}

export interface DimmerAutomationConfig {
  enabled: boolean;
  type: 'pulse' | 'breathe' | 'strobe' | 'ramp' | 'random' | 'chase';
  speed: number;
  range: { min: number; max: number };
  syncToBPM: boolean;
  pattern?: 'smooth' | 'sharp';
  phase?: number;
}

export interface EffectsAutomationConfig {
  enabled: boolean;
  type: 'gobo_cycle' | 'prism_rotate' | 'iris_breathe' | 'zoom_bounce' | 'focus_sweep';
  speed: number;
  syncToBPM: boolean;
  range?: { min: number; max: number };
  direction?: 'forward' | 'reverse' | 'ping-pong';
}

export interface ModularAutomationState {
  color: ColorAutomationConfig;
  dimmer: DimmerAutomationConfig;
  panTilt: PanTiltAutopilotConfig;
  effects: EffectsAutomationConfig;
  animationIds: {
    color: number | null;
    dimmer: number | null;
    panTilt: number | null;
    effects: number | null;
  };
}

export type WaveformType = 'sine' | 'saw' | 'square' | 'triangle' | 'custom';

export type EnvelopeRepeatMode = 'once' | 'loop';

export type EnvelopeLoopDirection = 'forward' | 'reverse' | 'pingpong';

export interface EnvelopePoint {
  x: number;
  y: number;
}

export interface ChannelEnvelope {
  id: string;
  channel: number;
  enabled: boolean;
  waveform: WaveformType;
  customPoints: EnvelopePoint[];
  amplitude: number;
  offset: number;
  phase: number;
  tempoSync: boolean;
  tempoMultiplier: number;
  /** Play the curve once, or repeat while automation runs */
  repeatMode: EnvelopeRepeatMode;
  /** How each cycle traverses the curve (loop + once end positions) */
  loopDirection: EnvelopeLoopDirection;
  min: number;
  max: number;
  speed: number;
  /** Optional link to a tracker track for sync actions */
  trackerSync?: { patternId: string; trackId: string } | null;
}

export interface EnvelopeAutomationState {
  envelopes: ChannelEnvelope[];
  globalEnabled: boolean;
  animationId: number | null;
  speed: number;
}

export type TransitionEasing =
  | 'linear'
  | 'easeInOut'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOutCubic'
  | 'easeInOutQuart'
  | 'easeInOutSine';

export interface TransitionPatternFx {
  transitionMs: number;
  easing: TransitionEasing;
  snap?: boolean;
}

export interface TransitionPatternLine {
  index: number;
  channelValues: Record<number, number | null>;
  sceneName?: string;
  fx: TransitionPatternFx;
}

/** Column page: which DMX channels appear in the grid (Renoise-style pages). */
export interface TransitionPatternPage {
  id: string;
  name: string;
  channelIndices: number[];
}

/** One instrument track = one DMX channel column, optional linked envelope. */
export interface TransitionPatternTrack {
  id: string;
  channelIndex: number;
  name?: string;
  envelopeId?: string | null;
}

export interface TransitionPattern {
  id: string;
  name: string;
  length: number;
  linesPerBeat: number;
  lines: TransitionPatternLine[];
  /** @deprecated Use pages + tracks; kept for import compatibility */
  visibleChannels: number[];
  followSelection: boolean;
  /** When true, grid columns come from active page tracks, not DMX selection */
  channelsLocked: boolean;
  pages: TransitionPatternPage[];
  activePageId: string | null;
  tracks: TransitionPatternTrack[];
  createdAt: number;
  modifiedAt: number;
}

export interface TransitionTrackerPlaybackState {
  active: boolean;
  patternId: string | null;
  currentLine: number;
  lineStartTime: number | null;
  loop: boolean;
  speed: number;
  syncToBpm: boolean;
  /** Push hex edits to live DMX while editing */
  livePreview: boolean;
}

export interface PendingSceneTransitionOverride {
  transitionMs: number;
  easing: TransitionEasing;
}

import type { FixtureDipSwitchAddressing } from '../../fixtures/library';
