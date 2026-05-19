// Shared types for all store slices
export interface MidiMapping {
  channel: number;
  note?: number;
  controller?: number;
}

export interface Fixture {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  mode?: string;
  startAddress: number;
  channels: { name: string; type: string; dmxAddress?: number }[];
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
  channels?: Array<{ name: string; type: string }>;
  modes?: Array<{
    name: string;
    channels: number;
    channelData: Array<{ name: string; type: string; ranges?: Array<{ min: number; max: number; description: string }> }>;
  }>;
  type?: string;
  manufacturer?: string; // Manufacturer name (e.g., "uKing")
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
}

export interface ColorSliderAutopilotConfig {
  enabled: boolean;
  type: 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth';
  speed: number;
  range: { min: number; max: number };
  syncToBPM: boolean;
  phase: number;
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
  loop: boolean;
  min: number;
  max: number;
  speed: number;
}

export interface EnvelopeAutomationState {
  envelopes: ChannelEnvelope[];
  globalEnabled: boolean;
  animationId: number | null;
  speed: number;
}

