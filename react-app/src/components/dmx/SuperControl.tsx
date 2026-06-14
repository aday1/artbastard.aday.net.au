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
import { PATH_SLOT_IDS, PathSlotId, PathSlotSummary, ArtbastardXYPadHandle } from '../ui/controls/ArtbastardXYPad';
import { useRoliLightpad } from '../../hooks/useRoliLightpad';
import { RoliColourWheel, ROLI_RGB_STRIP_CHANGE_EVENT } from './RoliColourWheel';
import { colourFromTouch } from '../../engines/roliColourWheel';
import { ROLI_GRID_COLS, ROLI_GRID_ROWS } from '../../engines/roliLightpad';
import { paintApc40Crosshair } from '../../engines/apc40XyCrosshair';
import { SkeuoButton } from '../ui/SkeuoButton';
import { SelectedChannelsFaderStrip } from './SelectedChannelsFaderStrip';
import { StageMapDashboard } from '../fixtures/StageMapDashboard';
import { debugLog } from '../../utils/debugLog';
import { rangesToTickSteps } from '../../utils/fixtureChannelTicks';
import type { FixtureChannelRange } from '../../store/types';
import { getFirstFixtureColorWheelSlots } from '../../fixtures/colorWheelSlots';
import styles from './SuperControl.module.scss';
// Removed react-grid-layout - using CSS auto-layout instead

interface SuperControlProps {
  isDockable?: boolean;
  /** Force touch-oriented spacing when embedded in the touch panel type. */
  preferTouchLayout?: boolean;
  /** Tighten chrome and spacing when embedded inside another workflow panel. */
  embeddedWorkbench?: boolean;
}

type SelectionMode = 'channels' | 'fixtures' | 'groups' | 'capabilities';
type SuperControlPanelId =
  | 'selection'
  | 'midiOsc'
  | 'basic'
  | 'panTilt'
  | 'rgb'
  | 'effects'
  | 'envelopes'
  | 'directDmx';

interface SuperControlPanelLayoutState {
  order: SuperControlPanelId[];
  collapsed: Partial<Record<SuperControlPanelId, boolean>>;
  hidden: Partial<Record<SuperControlPanelId, boolean>>;
  // 0 = auto-fit (default). 1-4 = explicit grid column count.
  columns: number;
  // Per-panel column span (1..columns). Defaults to 1.
  spans: Partial<Record<SuperControlPanelId, number>>;
  // Per-panel persisted pixel height of the content area (from user resize).
  heights: Partial<Record<SuperControlPanelId, number>>;
  // When set, that panel renders as a full-viewport overlay.
  fullscreen: SuperControlPanelId | null;
}

const SUPER_CONTROL_MAX_COLUMNS = 4;

const SUPER_CONTROL_LAYOUT_KEY = 'artbastard.superControl.panelLayout.v8';
const SUPER_CONTROL_LOCAL_MIDI_MAPPINGS_KEY = 'artbastard.superControl.localMidiMappings.v1';
const SUPER_CONTROL_PATH_SLOTS_KEY = 'artbastard.superControl.pathSlots.v1';
const SCENE_AUTO_SAVE_TOOLTIP = 'Reserved: automatic scene capture is not wired to a live trigger yet. Use Save Scene or MIDI Save to capture the current DMX look manually.';

interface PathSlotData {
  id: PathSlotId;
  label: string;
  path: { x: number; y: number }[];
  savedAt: number;
}

interface PathSlotsState {
  slots: PathSlotData[];
  activeSlotId: PathSlotId | null;
}

function defaultPathSlots(): PathSlotsState {
  return {
    slots: PATH_SLOT_IDS.map((id) => ({ id, label: id, path: [], savedAt: 0 })),
    activeSlotId: null,
  };
}

function normalizePathSlots(raw: unknown): PathSlotsState {
  const base = defaultPathSlots();
  if (!raw || typeof raw !== 'object') return base;
  const parsed = raw as Partial<PathSlotsState>;
  const incoming = Array.isArray(parsed.slots) ? parsed.slots : [];
  const byId = new Map<PathSlotId, PathSlotData>();
  for (const s of incoming) {
    if (!s || typeof s !== 'object') continue;
    const id = (s as any).id as PathSlotId;
    if (!PATH_SLOT_IDS.includes(id)) continue;
    const rawPath = Array.isArray((s as any).path) ? (s as any).path : [];
    const path: { x: number; y: number }[] = [];
    for (const p of rawPath) {
      if (!p || typeof p !== 'object') continue;
      const x = (p as any).x;
      const y = (p as any).y;
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      path.push({
        x: Math.max(0, Math.min(255, Math.round(x))),
        y: Math.max(0, Math.min(255, Math.round(y))),
      });
    }
    const label = typeof (s as any).label === 'string' && (s as any).label.trim()
      ? String((s as any).label).slice(0, 24)
      : id;
    const savedAt = typeof (s as any).savedAt === 'number' ? (s as any).savedAt : 0;
    byId.set(id, { id, label, path, savedAt });
  }
  const slots = PATH_SLOT_IDS.map((id) => byId.get(id) ?? { id, label: id, path: [], savedAt: 0 });
  const activeSlotId =
    parsed.activeSlotId && PATH_SLOT_IDS.includes(parsed.activeSlotId as PathSlotId)
      ? (parsed.activeSlotId as PathSlotId)
      : null;
  return { slots, activeSlotId };
}

function clampDmxValue(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function loadPathSlots(): PathSlotsState {
  if (typeof window === 'undefined') return defaultPathSlots();
  try {
    const raw = localStorage.getItem(SUPER_CONTROL_PATH_SLOTS_KEY);
    return normalizePathSlots(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultPathSlots();
  }
}
const DEFAULT_SUPER_CONTROL_PANEL_ORDER: SuperControlPanelId[] = [
  'selection',
  'basic',
  'panTilt',
  'rgb',
  'effects',
  'midiOsc',
  'envelopes',
  'directDmx',
];
const SUPER_CONTROL_PANEL_LABELS: Record<SuperControlPanelId, string> = {
  selection: 'Selection',
  midiOsc: 'MIDI/OSC',
  basic: 'Basic',
  panTilt: 'Pan/Tilt',
  rgb: 'RGB',
  effects: 'Effects',
  envelopes: 'Envelopes',
  directDmx: 'Direct DMX',
};
interface LocalMidiMapping {
  channel?: number;
  note?: number;
  cc?: number;
  pitch?: boolean;
  minValue: number;
  maxValue: number;
  oscAddress?: string;
}

const normalizeMidiMessage = (message: any) => {
  const type = message?.type || message?._type;
  const channel = typeof message?.channel === 'number' ? message.channel : undefined;
  if (channel === undefined) return null;

  if (type === 'cc' && typeof message.controller === 'number') {
    return {
      type: 'cc' as const,
      channel,
      cc: message.controller,
      value: typeof message.value === 'number' ? message.value : 0,
    };
  }

  if ((type === 'noteon' || type === 'noteoff') && typeof message.note === 'number') {
    return {
      type: type as 'noteon' | 'noteoff',
      channel,
      note: message.note,
      value: type === 'noteoff' ? 0 : typeof message.velocity === 'number' ? message.velocity : 127,
    };
  }

  if (type === 'pitch' && typeof message.value === 'number') {
    const bounded = message.value > 127
      ? Math.max(0, Math.min(1, message.value / 16383))
      : Math.max(0, Math.min(1, message.value / 127));
    return {
      type: 'pitch' as const,
      channel,
      value: Math.round(bounded * 127),
    };
  }

  return null;
};

const midiMappingLabel = (mapping?: LocalMidiMapping) => {
  if (!mapping) return null;
  const displayChannel = (mapping.channel ?? 0) + 1;
  if (mapping.cc !== undefined) return `CH${displayChannel} CC${mapping.cc}`;
  if (mapping.note !== undefined) return `CH${displayChannel} Note ${mapping.note}`;
  if (mapping.pitch) return `CH${displayChannel} Pitch`;
  return `CH${displayChannel}`;
};

const CONTROL_AVAILABILITY = [
  { key: 'dimmer', label: 'Dimmer', types: ['dimmer'] },
  { key: 'panTilt', label: 'Pan/Tilt', types: ['pan', 'tilt'] },
  { key: 'rgb', label: 'RGB', types: ['red', 'green', 'blue'] },
  { key: 'colorWheel', label: 'Color Wheel', types: ['color_wheel'] },
  { key: 'gobo', label: 'Gobo', types: ['gobo'] },
  { key: 'shutter', label: 'Shutter', types: ['shutter'] },
  { key: 'strobe', label: 'Strobe', types: ['strobe'] },
  { key: 'lamp', label: 'Lamp', types: ['lamp'] },
  { key: 'reset', label: 'Reset', types: ['reset'] },
];

const CONTROL_CHANNEL_ALIASES: Record<string, string[]> = {
  pan: ['pan', 'pan_coarse', 'pan_fine'],
  tilt: ['tilt', 'tilt_coarse', 'tilt_fine'],
  dimmer: ['dimmer', 'intensity', 'master'],
  red: ['red', 'r'],
  green: ['green', 'g'],
  blue: ['blue', 'b'],
  color_wheel: ['color_wheel', 'colour_wheel', 'colorwheel', 'colourwheel', 'color', 'colour'],
  gobo: ['gobo', 'gobowheel', 'gobo_wheel'],
  shutter: ['shutter'],
  strobe: ['strobe'],
  lamp: ['lamp', 'lamp_on', 'lamp_control'],
  reset: ['reset', 'reset_control', 'function'],
};

const normalizeChannelKey = (value?: string) =>
  (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const normalizeControlKey = (value: string) => {
  const key = normalizeChannelKey(value);
  if (key === 'colorwheel' || key === 'colourwheel') return 'color_wheel';
  return key;
};

const addChannelAlias = (channels: Record<string, number>, alias: string, dmxAddress: number) => {
  const key = normalizeChannelKey(alias);
  if (!key || channels[key] !== undefined) return;
  channels[key] = dmxAddress;
};

const addFixtureChannelAliases = (
  channels: Record<string, number>,
  channel: { name?: string; type?: string },
  dmxAddress: number
) => {
  const type = normalizeChannelKey(channel.type);
  const name = normalizeChannelKey(channel.name);

  addChannelAlias(channels, type, dmxAddress);
  addChannelAlias(channels, name, dmxAddress);

  if (name.includes('pan_fine') || name === 'fine_pan') addChannelAlias(channels, 'pan_fine', dmxAddress);
  else if (name === 'pan' || name.includes('pan_coarse')) addChannelAlias(channels, 'pan', dmxAddress);

  if (name.includes('tilt_fine') || name === 'fine_tilt') addChannelAlias(channels, 'tilt_fine', dmxAddress);
  else if (name === 'tilt' || name.includes('tilt_coarse')) addChannelAlias(channels, 'tilt', dmxAddress);

  if (name.includes('colour_wheel') || name.includes('color_wheel') || name === 'colour' || name === 'color') {
    addChannelAlias(channels, 'color_wheel', dmxAddress);
  }

  if (name.includes('lamp')) addChannelAlias(channels, 'lamp', dmxAddress);
  if (name.includes('shutter')) addChannelAlias(channels, 'shutter', dmxAddress);
  if (name.includes('strobe')) addChannelAlias(channels, 'strobe', dmxAddress);
};

const resolveControlChannel = (controlType: string, channels: Record<string, number>) => {
  const key = normalizeControlKey(controlType);
  const aliases = CONTROL_CHANNEL_ALIASES[key] || [key];
  for (const alias of aliases) {
    const channel = channels[normalizeChannelKey(alias)];
    if (channel !== undefined) return channel;
  }
  return undefined;
};

const loadLocalMidiMappings = (): Record<string, LocalMidiMapping> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SUPER_CONTROL_LOCAL_MIDI_MAPPINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

function normalizeSuperControlPanelLayout(raw: unknown): SuperControlPanelLayoutState {
  const parsed = raw && typeof raw === 'object' ? raw as Partial<SuperControlPanelLayoutState> : {};
  const incomingOrder = Array.isArray(parsed.order) ? parsed.order : [];
  const validIds = new Set(DEFAULT_SUPER_CONTROL_PANEL_ORDER);
  const order = [
    ...incomingOrder.filter((id): id is SuperControlPanelId => validIds.has(id as SuperControlPanelId)),
    ...DEFAULT_SUPER_CONTROL_PANEL_ORDER.filter((id) => !incomingOrder.includes(id)),
  ];
  const rawCols = typeof parsed.columns === 'number' ? parsed.columns : 0;
  const columns = Math.max(0, Math.min(SUPER_CONTROL_MAX_COLUMNS, Math.floor(rawCols)));
  const cleanSpans: Partial<Record<SuperControlPanelId, number>> = {};
  if (parsed.spans && typeof parsed.spans === 'object') {
    for (const id of DEFAULT_SUPER_CONTROL_PANEL_ORDER) {
      const v = (parsed.spans as any)[id];
      if (typeof v === 'number' && v >= 1 && v <= SUPER_CONTROL_MAX_COLUMNS) {
        cleanSpans[id] = Math.floor(v);
      }
    }
  }
  const cleanHeights: Partial<Record<SuperControlPanelId, number>> = {};
  if (parsed.heights && typeof parsed.heights === 'object') {
    for (const id of DEFAULT_SUPER_CONTROL_PANEL_ORDER) {
      const v = (parsed.heights as any)[id];
      if (typeof v === 'number' && v >= 120 && v <= 4000) {
        cleanHeights[id] = Math.round(v);
      }
    }
  }
  const fullscreen =
    parsed.fullscreen && validIds.has(parsed.fullscreen as SuperControlPanelId)
      ? (parsed.fullscreen as SuperControlPanelId)
      : null;
  const cleanCollapsed: Partial<Record<SuperControlPanelId, boolean>> = {};
  if (parsed.collapsed && typeof parsed.collapsed === 'object') {
    for (const id of DEFAULT_SUPER_CONTROL_PANEL_ORDER) {
      if (id !== 'selection' && Boolean((parsed.collapsed as any)[id])) cleanCollapsed[id] = true;
    }
  }
  const cleanHidden: Partial<Record<SuperControlPanelId, boolean>> = {};
  if (parsed.hidden && typeof parsed.hidden === 'object') {
    for (const id of DEFAULT_SUPER_CONTROL_PANEL_ORDER) {
      if (id !== 'selection' && Boolean((parsed.hidden as any)[id])) cleanHidden[id] = true;
    }
  }
  return {
    order,
    collapsed: cleanCollapsed,
    hidden: cleanHidden,
    columns,
    spans: cleanSpans,
    heights: cleanHeights,
    fullscreen,
  };
}

function loadSuperControlPanelLayout(): SuperControlPanelLayoutState {
  if (typeof window === 'undefined') {
    return normalizeSuperControlPanelLayout(null);
  }
  try {
    const raw = localStorage.getItem(SUPER_CONTROL_LAYOUT_KEY);
    return normalizeSuperControlPanelLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSuperControlPanelLayout(null);
  }
}

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
  return { h, s, v: max * 100 };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function mapRoliPanTiltLedPoint(point: { x: number; y: number }) {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
  };
}

type RoliPanTiltFrameMode = 'live' | 'ghost' | 'health';

function buildRoliPanTiltFrame(
  cursor: { x: number; y: number },
  path: Array<{ x: number; y: number }>,
  mode: RoliPanTiltFrameMode = 'live',
): Uint8ClampedArray {
  const frame = new Uint8ClampedArray(ROLI_GRID_COLS * ROLI_GRID_ROWS * 4);
  const isGhost = mode === 'ghost';
  const isHealth = mode === 'health';

  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const idx = (y * ROLI_GRID_COLS + x) * 4;
      frame[idx] = isGhost ? 8 : 14;
      frame[idx + 1] = 0;
      frame[idx + 2] = 0;
      frame[idx + 3] = 255;
    }
  }

  const toCell = (point: { x: number; y: number }) => ({
    x: Math.round(clamp01(point.x) * (ROLI_GRID_COLS - 1)),
    y: Math.round(clamp01(point.y) * (ROLI_GRID_ROWS - 1)),
  });
  const put = (x: number, y: number, rgba: [number, number, number, number]) => {
    if (x < 0 || y < 0 || x >= ROLI_GRID_COLS || y >= ROLI_GRID_ROWS) return;
    const idx = (y * ROLI_GRID_COLS + x) * 4;
    frame[idx] = Math.max(frame[idx], rgba[0]);
    frame[idx + 1] = Math.max(frame[idx + 1], rgba[1]);
    frame[idx + 2] = Math.max(frame[idx + 2], rgba[2]);
    frame[idx + 3] = Math.max(frame[idx + 3], rgba[3]);
  };
  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }, color: [number, number, number, number]) => {
    let { x: x0, y: y0 } = toCell(from);
    const { x: x1, y: y1 } = toCell(to);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      put(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  const drawRing = (center: { x: number; y: number }, radius: number, color: [number, number, number, number]) => {
    for (let y = 0; y < ROLI_GRID_ROWS; y++) {
      for (let x = 0; x < ROLI_GRID_COLS; x++) {
        const distance = Math.hypot(x - center.x, y - center.y);
        if (Math.abs(distance - radius) <= 0.42) put(x, y, color);
      }
    }
  };

  const drawTargetReticle = (center: { x: number; y: number }) => {
    const mainRed: [number, number, number, number] = isGhost ? [160, 0, 0, 255] : [255, 0, 0, 255];
    const dimRed: [number, number, number, number] = isGhost ? [90, 0, 0, 255] : isHealth ? [190, 0, 0, 255] : [130, 0, 0, 255];
    const hotRed: [number, number, number, number] = isGhost ? [210, 20, 0, 255] : [255, 24, 0, 255];

    for (let x = 0; x < ROLI_GRID_COLS; x++) put(x, center.y, dimRed);
    for (let y = 0; y < ROLI_GRID_ROWS; y++) put(center.x, y, dimRed);

    drawRing(center, 2, mainRed);
    drawRing(center, 5, mainRed);
    drawRing(center, 7, dimRed);

    for (let offset = -1; offset <= 1; offset++) {
      put(center.x + offset, center.y, hotRed);
      put(center.x, center.y + offset, hotRed);
    }
    put(center.x, center.y, [255, 80, 50, 255]);
  };

  const trail = path.slice(-(isHealth ? 18 : isGhost ? 36 : 24)).map(mapRoliPanTiltLedPoint);
  const trailColor: [number, number, number, number] = isGhost ? [120, 0, 0, 255] : [180, 0, 0, 255];
  for (let i = 1; i < trail.length; i++) drawLine(trail[i - 1], trail[i], trailColor);
  if (trail.length === 1) {
    const only = toCell(trail[0]);
    put(only.x, only.y, trailColor);
  }

  const cell = toCell(mapRoliPanTiltLedPoint(cursor));
  drawTargetReticle(cell);

  return frame;
}

const SuperControl: React.FC<SuperControlProps> = ({ isDockable = false, preferTouchLayout = false, embeddedWorkbench = false }) => {
  const { isMobile, isTablet, isTouch } = useMobile();
  const { settings: superControlPrefs } = useSuperControlPreferences();
  const touchLayout =
    preferTouchLayout || isMobile || isTablet || isTouch || superControlPrefs.compactMode;
  const autopilotUiSyncIntervalMs = Math.max(
    50,
    Math.min(1000, Number(superControlPrefs.autoUpdateRate) || 50)
  );
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
    getChannelRange,
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
    superControlExternalUpdate,
    // Scene functions from global store
    scenes,
    deleteScene,
    loadScene: storeLoadScene,
    addNotification,
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
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('fixtures');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [panelLayout, setPanelLayout] = useState<SuperControlPanelLayoutState>(loadSuperControlPanelLayout);
  const [midiOscNavExpanded, setMidiOscNavExpanded] = useState(true);
  // Control values state
  const [dimmer, setDimmer] = useState(255);
  const [panValue, setPanValue] = useState(127);
  const [tiltValue, setTiltValue] = useState(127);
  const [red, setRed] = useState(255);
  const [green, setGreen] = useState(255);
  const [blue, setBlue] = useState(255);
  const [colorWheel, setColorWheel] = useState(0);
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

  useEffect(() => {
    try {
      localStorage.setItem(SUPER_CONTROL_LAYOUT_KEY, JSON.stringify(panelLayout));
    } catch {
      /* ignore layout persistence failures */
    }
  }, [panelLayout]);

  const panelContainerRef = useRef<HTMLDivElement>(null);

  const panelOrderIndex = useCallback(
    (panelId: SuperControlPanelId) => {
      const index = panelLayout.order.indexOf(panelId);
      return index === -1 ? DEFAULT_SUPER_CONTROL_PANEL_ORDER.indexOf(panelId) : index;
    },
    [panelLayout.order]
  );

  const panelStyle = useCallback(
    (panelId: SuperControlPanelId): React.CSSProperties => {
      const colCount = panelLayout.columns > 0 ? panelLayout.columns : SUPER_CONTROL_MAX_COLUMNS;
      const span = panelId === 'selection' ? colCount : panelLayout.spans[panelId] ?? 1;
      const effectiveSpan = Math.max(1, Math.min(span, colCount));
      return {
        order: panelOrderIndex(panelId),
        display: panelId !== 'selection' && panelLayout.hidden[panelId] ? 'none' : undefined,
        gridColumn: effectiveSpan > 1 ? `span ${effectiveSpan}` : undefined,
      };
    },
    [
      panelLayout.columns,
      panelLayout.hidden,
      panelLayout.spans,
      panelOrderIndex,
    ]
  );

  // Drag state lifted here so panelClass below can reflect dragging/drop-target.
  const dragIdRef = useRef<SuperControlPanelId | null>(null);
  const [draggingPanelId, setDraggingPanelId] = useState<SuperControlPanelId | null>(null);
  const [dragOverPanelId, setDragOverPanelId] = useState<SuperControlPanelId | null>(null);

  const panelClass = useCallback(
    (panelId: SuperControlPanelId) => {
      const classes = [styles.gridItem];
      if (panelId !== 'selection' && panelLayout.collapsed[panelId]) classes.push(styles.gridItemCollapsed);
      if (panelLayout.fullscreen === panelId) classes.push(styles.gridItemFullscreen);
      if (draggingPanelId === panelId) classes.push(styles.gridItemDragging);
      if (dragOverPanelId === panelId && draggingPanelId && draggingPanelId !== panelId) {
        classes.push(styles.gridItemDropTarget);
      }
      return classes.join(' ');
    },
    [panelLayout.collapsed, panelLayout.fullscreen, draggingPanelId, dragOverPanelId]
  );

  // Spread onto each panel root: className + style + data-panel-id (for the
  // resize observer above) all in one place so individual JSX sites stay terse.
  const panelProps = useCallback(
    (panelId: SuperControlPanelId) => ({
      className: panelClass(panelId),
      style: panelStyle(panelId),
      'data-panel-id': panelId,
    }),
    [panelClass, panelStyle]
  );

  const movePanel = useCallback((panelId: SuperControlPanelId, direction: -1 | 1) => {
    setPanelLayout((prev) => {
      const order = [...prev.order];
      const index = order.indexOf(panelId);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= order.length) return prev;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...prev, order };
    });
  }, []);

  const togglePanelCollapsed = useCallback((panelId: SuperControlPanelId) => {
    setPanelLayout((prev) => ({
      ...prev,
      collapsed: { ...prev.collapsed, [panelId]: !prev.collapsed[panelId] },
    }));
  }, []);

  const togglePanelHidden = useCallback((panelId: SuperControlPanelId) => {
    setPanelLayout((prev) => ({
      ...prev,
      hidden: { ...prev.hidden, [panelId]: !prev.hidden[panelId] },
    }));
  }, []);

  const showAllPanels = useCallback(() => {
    setPanelLayout((prev) => ({ ...prev, hidden: {} }));
  }, []);

  const togglePanelFullscreen = useCallback((panelId: SuperControlPanelId) => {
    setPanelLayout((prev) => ({
      ...prev,
      fullscreen: prev.fullscreen === panelId ? null : panelId,
    }));
  }, []);

  const adjustPanelSpan = useCallback((panelId: SuperControlPanelId, delta: 1 | -1) => {
    setPanelLayout((prev) => {
      const current = prev.spans[panelId] ?? 1;
      const cap = prev.columns > 0 ? prev.columns : SUPER_CONTROL_MAX_COLUMNS;
      const next = Math.max(1, Math.min(cap, current + delta));
      if (next === current) return prev;
      return { ...prev, spans: { ...prev.spans, [panelId]: next } };
    });
  }, []);

  const setPanelSpan = useCallback((panelId: SuperControlPanelId, span: number) => {
    setPanelLayout((prev) => {
      const cap = prev.columns > 0 ? prev.columns : SUPER_CONTROL_MAX_COLUMNS;
      const next = Math.max(1, Math.min(cap, Math.floor(span)));
      const current = prev.spans[panelId] ?? 1;
      if (next === current) return prev;
      return { ...prev, spans: { ...prev.spans, [panelId]: next } };
    });
  }, []);

  const setColumnCount = useCallback((columns: number) => {
    setPanelLayout((prev) => {
      const next = Math.max(0, Math.min(SUPER_CONTROL_MAX_COLUMNS, Math.floor(columns)));
      if (next === prev.columns) return prev;
      // Clamp any existing spans down to the new column cap.
      const cap = next > 0 ? next : SUPER_CONTROL_MAX_COLUMNS;
      const spans: Partial<Record<SuperControlPanelId, number>> = {};
      for (const [id, span] of Object.entries(prev.spans)) {
        if (typeof span === 'number') spans[id as SuperControlPanelId] = Math.min(span, cap);
      }
      return { ...prev, columns: next, spans };
    });
  }, []);

  // Drag-and-drop reordering: the header acts as the drag handle.
  const handlePanelDragStart = useCallback(
    (panelId: SuperControlPanelId, event: React.DragEvent<HTMLElement>) => {
      // Ignore drags initiated on header buttons (they have their own onClick).
      const target = event.target as HTMLElement;
      if (target.closest('button')) {
        event.preventDefault();
        return;
      }
      dragIdRef.current = panelId;
      setDraggingPanelId(panelId);
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/x-supercontrol-panel', panelId);
      } catch {
        /* some browsers reject custom mime types — ref-based fallback still works */
      }
    },
    []
  );

  const handlePanelDragOver = useCallback(
    (panelId: SuperControlPanelId, event: React.DragEvent<HTMLElement>) => {
      if (!dragIdRef.current) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (panelId !== dragOverPanelId) setDragOverPanelId(panelId);
    },
    [dragOverPanelId]
  );

  const handlePanelDragLeave = useCallback(
    (panelId: SuperControlPanelId) => {
      if (dragOverPanelId === panelId) setDragOverPanelId(null);
    },
    [dragOverPanelId]
  );

  const handlePanelDrop = useCallback(
    (targetId: SuperControlPanelId, event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sourceId = dragIdRef.current;
      dragIdRef.current = null;
      setDraggingPanelId(null);
      setDragOverPanelId(null);
      if (!sourceId || sourceId === targetId) return;
      setPanelLayout((prev) => {
        const order = [...prev.order];
        const from = order.indexOf(sourceId);
        const to = order.indexOf(targetId);
        if (from === -1 || to === -1) return prev;
        order.splice(from, 1);
        // After removing source, indices > from shift left by one. Insert at the
        // adjusted target index so the source visually takes the target's slot.
        const insertAt = from < to ? to - 1 : to;
        order.splice(insertAt, 0, sourceId);
        return { ...prev, order };
      });
    },
    []
  );

  const handlePanelDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDraggingPanelId(null);
    setDragOverPanelId(null);
  }, []);

  // ESC exits fullscreen when active.
  useEffect(() => {
    if (!panelLayout.fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelLayout((prev) => (prev.fullscreen ? { ...prev, fullscreen: null } : prev));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelLayout.fullscreen]);

  const resetPanelLayout = useCallback(() => {
    setPanelLayout(normalizeSuperControlPanelLayout(null));
  }, []);

  const hiddenPanelCount = useMemo(
    () => Object.values(panelLayout.hidden).filter(Boolean).length,
    [panelLayout.hidden]
  );
  const hiddenPanelIds = useMemo(
    () => DEFAULT_SUPER_CONTROL_PANEL_ORDER.filter((id) => id !== 'selection' && panelLayout.hidden[id]),
    [panelLayout.hidden]
  );
  const visibleSpanPanelIds = useMemo(
    () => DEFAULT_SUPER_CONTROL_PANEL_ORDER.filter((id) => id !== 'selection' && !panelLayout.hidden[id]),
    [panelLayout.hidden]
  );
  const columnCap = panelLayout.columns > 0 ? panelLayout.columns : SUPER_CONTROL_MAX_COLUMNS;

  const renderPanelHeader = useCallback((
    panelId: SuperControlPanelId,
    icon: React.ReactNode,
    label: React.ReactNode,
    status?: React.ReactNode
  ) => {
    const collapsed = Boolean(panelLayout.collapsed[panelId]);
    const index = panelOrderIndex(panelId);
    const title = SUPER_CONTROL_PANEL_LABELS[panelId];
    const span = panelLayout.spans[panelId] ?? 1;
    const colCap = panelLayout.columns > 0 ? panelLayout.columns : SUPER_CONTROL_MAX_COLUMNS;
    const isFullscreen = panelLayout.fullscreen === panelId;
    const locked = panelId === 'selection';

    return (
      <div
        className={styles.gridItemHeader}
        draggable={!isFullscreen}
        onDragStart={(e) => handlePanelDragStart(panelId, e)}
        onDragOver={(e) => handlePanelDragOver(panelId, e)}
        onDragLeave={() => handlePanelDragLeave(panelId)}
        onDrop={(e) => handlePanelDrop(panelId, e)}
        onDragEnd={handlePanelDragEnd}
        title={isFullscreen ? undefined : 'Drag to reorder'}
      >
        <span className={styles.gridItemHeaderTitle}>
          <LucideIcon name="GripVertical" />
          {icon}
          <span>{label}</span>
        </span>
        {status && <span className={styles.gridItemHeaderStatus}>{status}</span>}
        {!locked && <span className={styles.cardLayoutControls} aria-label={`${title} layout controls`}>
          <button
            type="button"
            onClick={() => adjustPanelSpan(panelId, -1)}
            disabled={span <= 1 || isFullscreen}
            title={`Shrink ${title} (span ${span})`}
            aria-label={`Shrink ${title}`}
          >
            <LucideIcon name="ChevronsLeftRight" />
          </button>
          <button
            type="button"
            onClick={() => adjustPanelSpan(panelId, 1)}
            disabled={span >= colCap || isFullscreen}
            title={`Widen ${title} (span ${span})`}
            aria-label={`Widen ${title}`}
          >
            <LucideIcon name="ChevronsRightLeft" />
          </button>
          <button
            type="button"
            onClick={() => togglePanelFullscreen(panelId)}
            title={isFullscreen ? `Exit fullscreen` : `Fullscreen ${title}`}
            aria-label={isFullscreen ? `Exit fullscreen` : `Fullscreen ${title}`}
          >
            <LucideIcon name={isFullscreen ? 'Shrink' : 'Expand'} />
          </button>
          <button
            type="button"
            onClick={() => togglePanelHidden(panelId)}
            title={`Hide ${title}`}
            aria-label={`Hide ${title}`}
          >
            <LucideIcon name="EyeOff" />
          </button>
          <button
            type="button"
            onClick={() => togglePanelCollapsed(panelId)}
            title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            <LucideIcon name={collapsed ? 'Maximize2' : 'Minimize2'} />
          </button>
          <button
            type="button"
            onClick={() => movePanel(panelId, -1)}
            disabled={index === 0 || isFullscreen}
            title={`Move ${title} earlier`}
            aria-label={`Move ${title} earlier`}
          >
            <LucideIcon name="ArrowLeft" />
          </button>
          <button
            type="button"
            onClick={() => movePanel(panelId, 1)}
            disabled={index === panelLayout.order.length - 1 || isFullscreen}
            title={`Move ${title} later`}
            aria-label={`Move ${title} later`}
          >
            <LucideIcon name="ArrowRight" />
          </button>
        </span>}
      </div>
    );
  }, [
    adjustPanelSpan,
    handlePanelDragEnd,
    handlePanelDragLeave,
    handlePanelDragOver,
    handlePanelDragStart,
    handlePanelDrop,
    movePanel,
    panelLayout.collapsed,
    panelLayout.columns,
    panelLayout.fullscreen,
    panelLayout.order.length,
    panelLayout.spans,
    panelOrderIndex,
    togglePanelCollapsed,
    togglePanelFullscreen,
    togglePanelHidden,
  ]);

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
        'color_wheel': (value: number) => {
          setColorWheel(value);
          applyControl('color_wheel', value);
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
  const [colorStripX, setColorStripX] = useState(0);
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
  const [midiMappings, setMidiMappings] = useState<Record<string, LocalMidiMapping>>(loadLocalMidiMappings);
  const midiLearnRangeRef = useRef<{ target: string; minValue: number; maxValue: number } | null>(null);
  const midiLearnTimeoutRef = useRef<number | null>(null);
  const lastLearnMidiSignatureRef = useRef<string | null>(null);
  const lastActionMidiSignatureRef = useRef<string | null>(null);

  // Fixture/Group navigation state
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

  useEffect(() => {
    if (!superControlExternalUpdate) return;
    const value = clampDmxValue(superControlExternalUpdate.value);
    const controlName = superControlExternalUpdate.controlName;

    switch (controlName) {
      case 'masterDimmer':
      case 'dimmer':
        setDimmer(value);
        break;
      case 'pan':
        setPanValue(value);
        setPanTiltXY((prev) => ({ ...prev, x: getControlNormalizedFromValue('pan', value) * 100 }));
        break;
      case 'tilt':
        setTiltValue(value);
        setPanTiltXY((prev) => ({ ...prev, y: (1 - getControlNormalizedFromValue('tilt', value)) * 100 }));
        break;
      case 'red':
        setRed(value);
        break;
      case 'green':
        setGreen(value);
        break;
      case 'blue':
        setBlue(value);
        break;
      case 'gobo':
        setGobo(value);
        break;
      case 'color_wheel':
      case 'colorWheel':
        setColorWheel(value);
        setColorHue((value / 255) * 360);
        setColorSaturation(100);
        break;
      case 'shutter':
        setShutter(value);
        break;
      case 'strobe':
        setStrobe(value);
        break;
      case 'lamp':
        setLamp(value);
        break;
      case 'reset':
        setReset(value);
        break;
      default:
        break;
    }
  }, [superControlExternalUpdate]);

  useEffect(() => {
    if (selectedFixtures.length === 0) return;

    const selectedSet = new Set(selectedFixtures);
    const fixtureIdsForGroup = (groupId: string) => {
      const group = groups.find((candidate) => candidate.id === groupId);
      return (group?.fixtureIndices ?? [])
        .map((fixtureIndex) => fixtures[fixtureIndex]?.id)
        .filter((id): id is string => Boolean(id));
    };

    const exactGroupIndex = groups.findIndex((group) => {
      const groupFixtureIds = fixtureIdsForGroup(group.id);

      return (
        groupFixtureIds.length === selectedFixtures.length &&
        groupFixtureIds.every((fixtureId) => selectedSet.has(fixtureId))
      );
    });

    if (exactGroupIndex >= 0) {
      const group = groups[exactGroupIndex];
      setSelectionMode('groups');
      setCurrentGroupIndex(exactGroupIndex);
      setSelectedGroups((previous) =>
        previous.length === 1 && previous[0] === group.id ? previous : [group.id]
      );
      setSelectedCapabilities([]);
      return;
    }

    const selectedGroupFixtureIds = Array.from(new Set(selectedGroups.flatMap(fixtureIdsForGroup)));
    const selectedGroupsReflectSelection =
      selectedGroups.length > 0 &&
      selectedGroupFixtureIds.length === selectedFixtures.length &&
      selectedGroupFixtureIds.every((fixtureId) => selectedSet.has(fixtureId));

    if (selectedGroupsReflectSelection) {
      setSelectionMode('groups');
      return;
    }

    const firstFixtureIndex = fixtures.findIndex((fixture) => fixture.id === selectedFixtures[0]);
    if (firstFixtureIndex >= 0) {
      setCurrentFixtureIndex(firstFixtureIndex);
    }
    setSelectedGroups((previous) => (previous.length > 0 ? [] : previous));
    setSelectionMode((previous) => (previous === 'groups' || previous === 'channels' ? 'fixtures' : previous));
  }, [fixtures, groups, selectedFixtures, selectedGroups]);

  // Scene management state (using global store for scenes)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  useEffect(() => {
    try {
      localStorage.setItem(SUPER_CONTROL_LOCAL_MIDI_MAPPINGS_KEY, JSON.stringify(midiMappings));
    } catch {
      /* ignore local MIDI persistence failures */
    }
  }, [midiMappings]);

  // Pan/Tilt path memory slots (A–H, localStorage-persisted)
  const [pathSlots, setPathSlots] = useState<PathSlotsState>(loadPathSlots);
  useEffect(() => {
    try {
      localStorage.setItem(SUPER_CONTROL_PATH_SLOTS_KEY, JSON.stringify(pathSlots));
    } catch {
      /* ignore slot persistence failures */
    }
  }, [pathSlots]);
  const slotSummaries = useMemo<PathSlotSummary[]>(
    () =>
      pathSlots.slots.map((s) => ({
        id: s.id,
        label: s.label,
        filled: s.path.length > 1,
      })),
    [pathSlots.slots]
  );
  const saveSlotPath = useCallback(
    (id: PathSlotId, points: { x: number; y: number }[]) => {
      setPathSlots((prev) => ({
        activeSlotId: id,
        slots: prev.slots.map((s) =>
          s.id === id ? { ...s, path: points, savedAt: Date.now() } : s
        ),
      }));
    },
    []
  );
  const loadSlotPath = useCallback(
    (id: PathSlotId) => {
      const slot = pathSlots.slots.find((s) => s.id === id);
      if (!slot || slot.path.length < 2) return;
      setPathSlots((prev) => ({ ...prev, activeSlotId: id }));
      setPanTiltAutopilot({ customPath: slot.path, pathType: 'custom' });
    },
    [pathSlots.slots, setPanTiltAutopilot]
  );
  const renameSlot = useCallback((id: PathSlotId, label: string) => {
    setPathSlots((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, label: label.slice(0, 24) } : s)),
    }));
  }, []);
  const clearSlot = useCallback((id: PathSlotId) => {
    setPathSlots((prev) => ({
      activeSlotId: prev.activeSlotId === id ? null : prev.activeSlotId,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, path: [], savedAt: 0 } : s)),
    }));
  }, []);

  // Roli Lightpad: touch -> pan/tilt, LED -> cursor + active-slot trail.
  const roli = useRoliLightpad();
  const xyPadHandleRef = useRef<ArtbastardXYPadHandle>(null);
  // Mirror the pad's internal path so the LED effect sees mouse-drawn paths too.
  const livePathRef = useRef<Array<{ x: number; y: number }>>([]);
  const [livePathVersion, setLivePathVersion] = useState(0);
  const handleXyPadPathChange = useCallback(
    (points: Array<{ x: number; y: number; timestamp?: number }>) => {
      livePathRef.current = points.map((p) => ({ x: p.x, y: p.y }));
      setLivePathVersion((v) => (v + 1) & 0xffff);
    },
    []
  );

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

    const effectiveSelectionMode =
      selectionMode === 'channels' && selectedChannels.length === 0 && selectedFixtures.length > 0
        ? 'fixtures'
        : selectionMode;

    switch (effectiveSelectionMode) {
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
              addFixtureChannelAliases(fixtureChannels, channel, dmxAddress);
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
          addFixtureChannelAliases(fixtureChannels, channel, dmxAddress);
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

    return affectedFixtures.some(({ channels }) => resolveControlChannel(controlType, channels) !== undefined);
  };

  // Apply control value to DMX channels
  const applyControl = (controlType: string, value: number) => {
    const affectedFixtures = getAffectedFixtures();

    affectedFixtures.forEach(({ channels }) => {
      const targetChannel = resolveControlChannel(controlType, channels);

      if (targetChannel !== undefined) {
        setDmxChannelValue(targetChannel, value);
      }
    });
  };

  const openEmissionGates = (force = false) => {
    let openedShutter = false;
    let openedStrobe = false;
    let openedLamp = false;

    getAffectedFixtures().forEach(({ channels }) => {
      const shutterChannel = resolveControlChannel('shutter', channels);
      if (shutterChannel !== undefined && (force || getDmxChannelValue(shutterChannel) <= 3)) {
        setDmxChannelValue(shutterChannel, 255);
        openedShutter = true;
      }

      const strobeChannel = resolveControlChannel('strobe', channels);
      if (strobeChannel !== undefined && (force || getDmxChannelValue(strobeChannel) <= 3)) {
        setDmxChannelValue(strobeChannel, 255);
        openedStrobe = true;
      }

      const lampChannel = resolveControlChannel('lamp', channels);
      if (lampChannel !== undefined && (force || getDmxChannelValue(lampChannel) <= 25)) {
        setDmxChannelValue(lampChannel, 255);
        openedLamp = true;
      }
    });

    if (openedShutter) setShutter(255);
    if (openedStrobe) setStrobe(255);
    if (openedLamp) setLamp(255);
  };

  const turnBeamOn = () => {
    setDimmer(255);
    applyControl('dimmer', 255);
    openEmissionGates(true);
  };

  const scaleNormalizedToChannelRange = (channel: number, normalized: number) => {
    const range = getChannelRange(channel);
    const min = Math.max(0, Math.min(255, Math.round(range.min)));
    const max = Math.max(min, Math.min(255, Math.round(range.max)));
    return Math.round(min + clamp01(normalized) * (max - min));
  };

  const normalizeValueFromChannelRange = (channel: number, value: number) => {
    const range = getChannelRange(channel);
    const min = Math.max(0, Math.min(255, Math.round(range.min)));
    const max = Math.max(min, Math.min(255, Math.round(range.max)));
    if (max <= min) return 0;
    return clamp01((value - min) / (max - min));
  };

  const getControlNormalizedFromValue = (controlType: string, value: number) => {
    const affectedFixtures = getAffectedFixtures();
    for (const { channels } of affectedFixtures) {
      const targetChannel = resolveControlChannel(controlType, channels);
      if (targetChannel !== undefined) return normalizeValueFromChannelRange(targetChannel, value);
    }
    return clamp01(value / 255);
  };

  const getNormalizedControlPreviewValue = (controlType: string, normalized: number) => {
    const affectedFixtures = getAffectedFixtures();
    for (const { channels } of affectedFixtures) {
      const targetChannel = resolveControlChannel(controlType, channels);
      if (targetChannel !== undefined) return scaleNormalizedToChannelRange(targetChannel, normalized);
    }
    return Math.round(clamp01(normalized) * 255);
  };

  const applyNormalizedControl = (controlType: string, normalized: number) => {
    const affectedFixtures = getAffectedFixtures();
    affectedFixtures.forEach(({ channels }) => {
      const targetChannel = resolveControlChannel(controlType, channels);
      if (targetChannel === undefined) return;
      setDmxChannelValue(targetChannel, scaleNormalizedToChannelRange(targetChannel, normalized));
    });
  };

  const applyPanTiltNormalized = (panNormalized: number, tiltNormalized: number) => {
    const panNorm = clamp01(panNormalized);
    const tiltNorm = clamp01(tiltNormalized);
    const panDmx = getNormalizedControlPreviewValue('pan', panNorm);
    const tiltDmx = getNormalizedControlPreviewValue('tilt', tiltNorm);

    setPanValue(panDmx);
    setTiltValue(tiltDmx);
    setPanTiltXY({ x: panNorm * 100, y: (1 - tiltNorm) * 100 });
    applyNormalizedControl('pan', panNorm);
    applyNormalizedControl('tilt', tiltNorm);
  };

  useEffect(() => {
    const handleRoliRgbStripChange = (event: Event) => {
      const detail = (event as CustomEvent<{
        r: number;
        g: number;
        b: number;
        colorWheelValue?: number;
        colorWheelLabel?: string;
      }>).detail;
      if (!detail) return;
      setRed(detail.r);
      setGreen(detail.g);
      setBlue(detail.b);
      if (detail.colorWheelValue !== undefined) {
        const value = clampDmxValue(detail.colorWheelValue);
        setColorWheel(value);
        setColorHue((value / 255) * 360);
        setColorSaturation(100);
        applyControl('color_wheel', value);
        if (dimmer > 0) openEmissionGates(false);
      }
      updateRGB(detail.r, detail.g, detail.b);
    };

    window.addEventListener(ROLI_RGB_STRIP_CHANGE_EVENT, handleRoliRgbStripChange);
    return () => window.removeEventListener(ROLI_RGB_STRIP_CHANGE_EVENT, handleRoliRgbStripChange);
  }, [applyControl, dimmer, openEmissionGates, updateRGB]);

  // --- Roli Lightpad: touch in + LED feedback ---
  // Use refs so the touch handler always sees the latest store values without
  // re-subscribing on every keystroke.
  const roliApplyRef = useRef<{
    applyPanTiltNormalized: (panNormalized: number, tiltNormalized: number) => void;
    togglePanTiltAutopilot: () => void;
    setPanTiltAutopilot: (cfg: Record<string, unknown>) => void;
    panTiltAutopilotEnabled: boolean;
    hasSelection: boolean;
    addNotification: (n: { message: string; type?: string; priority?: string }) => void;
    autoplayOnRelease: boolean;
  }>({
    applyPanTiltNormalized: () => {},
    togglePanTiltAutopilot: () => {},
    setPanTiltAutopilot: () => {},
    panTiltAutopilotEnabled: false,
    hasSelection: false,
    addNotification: () => {},
    autoplayOnRelease: false,
  });

  // User preference: when finger leaves the ROLI pad, should the path the
  // user just drew immediately start looping as a pan/tilt autopilot? Default
  // OFF — finger up = nothing happens. Toggle lives next to the XY pad.
  const ROLI_AUTOPLAY_KEY = 'roli-autoplay-on-release';
  const [roliAutoplayOnRelease, setRoliAutoplayOnRelease] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(ROLI_AUTOPLAY_KEY) === 'true';
  });
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ROLI_AUTOPLAY_KEY, roliAutoplayOnRelease ? 'true' : 'false');
  }, [roliAutoplayOnRelease]);
  // Mirrors the most recent Roli touch position so the LED effect always has
  // a cursor source even when no fixture is selected (touch feedback first,
  // DMX writes second).
  const liveTouchRef = useRef<{ x: number; y: number } | null>(null);
  // Accumulated points of the current touch stroke so the LED layer can
  // paint the *whole* path the user has sketched, not just the cursor. Reset
  // on touch-start, cleared on touch-end. Capped to bound memory on slow
  // strokes / dropped touch-end events.
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const [liveTouchVersion, setLiveTouchVersion] = useState(0);
  const paintRoliPanTiltFrame = useCallback(
    (
      cursor: { x: number; y: number },
      path: Array<{ x: number; y: number }>,
      mode: 'live' | 'ghost' | 'health' = 'live',
      deviceId?: string,
    ) => {
      return roli.sendRawFrame(buildRoliPanTiltFrame(cursor, path, mode), deviceId, true);
    },
    [roli.sendRawFrame]
  );

  useEffect(() => {
    if (!roli.handshakeDone) return;
    const paintHealth = () => {
      if (liveTouchRef.current) return;
      const cursor = {
        x: Math.max(0, Math.min(1, panTiltXY.x / 100)),
        y: Math.max(0, Math.min(1, panTiltXY.y / 100)),
      };
      const path = trailRef.current.length > 0 ? trailRef.current : [cursor];
      paintRoliPanTiltFrame(cursor, path, 'health');
    };
    paintHealth();
    const timer = window.setInterval(paintHealth, 2200);
    return () => window.clearInterval(timer);
  }, [roli.handshakeDone, panTiltXY.x, panTiltXY.y, paintRoliPanTiltFrame]);

  useEffect(() => {
    roli.onTouch((ev) => {
      // Always reflect the touch on the device + canvas, even without a
      // fixture selected. Pan/tilt writes are gated on selection further down.
      liveTouchRef.current =
        ev.phase === 'end' ? null : { x: ev.x, y: ev.y };
      setLiveTouchVersion((v) => (v + 1) & 0xffff);

      // Maintain the persistent trail for this stroke.
      if (ev.phase === 'start') {
        trailRef.current = [{ x: ev.x, y: ev.y }];
      } else if (ev.phase === 'move') {
        if (trailRef.current.length < 200) {
          trailRef.current.push({ x: ev.x, y: ev.y });
        }
      }

      // LED feedback: paint a readable crosshair + trail. On touch-end, leave
      // the completed stroke visible as a ghost trail instead of blanking.
      if (ev.phase === 'end') {
        paintRoliPanTiltFrame({ x: ev.x, y: ev.y }, trailRef.current, 'ghost', ev.deviceId);
      } else {
        paintRoliPanTiltFrame({ x: ev.x, y: ev.y }, trailRef.current, 'live', ev.deviceId);
      }

      // Route into the XY pad's path state so the canvas draws the touch
      // and onPathChange / onPathSaved fire just like a mouse pencil stroke.
      const pad = xyPadHandleRef.current;
      if (pad) {
        if (ev.phase === 'start') {
          // New draw — kill any running autopilot loop so the user isn't
          // fighting a previous recording while sketching a new one.
          if (roliApplyRef.current.panTiltAutopilotEnabled) {
            roliApplyRef.current.setPanTiltAutopilot({ enabled: false });
          }
          pad.beginExternalPath(ev.x, ev.y);
        } else if (ev.phase === 'move') {
          pad.extendExternalPath(ev.x, ev.y);
        } else if (ev.phase === 'end') {
          // endExternalPath() synchronously fires onPathSaved which writes
          // customPath into panTiltAutopilot. Right after, enable autopilot
          // so the loop the user just drew starts playing on the selected
          // fixture's pan/tilt.
          pad.endExternalPath();
          if (
            roliApplyRef.current.autoplayOnRelease &&
            roliApplyRef.current.hasSelection &&
            livePathRef.current.length >= 2
          ) {
            roliApplyRef.current.setPanTiltAutopilot({
              enabled: true,
              pathType: 'custom',
            });
            roliApplyRef.current.addNotification({
              message: 'Roli loop playing — touch the pad again to redraw',
              type: 'info',
              priority: 'low',
            });
          }
        }
      }

      if (!roliApplyRef.current.hasSelection) return;
      if (ev.phase !== 'move' && ev.phase !== 'start') return;
      // Ignore decay frames after release. Real touches sit well above 0.05.
      if (ev.z < 0.05) return;
      const panNorm = clamp01(ev.x);
      const tiltNorm = clamp01(1 - ev.y);
      roliApplyRef.current.applyPanTiltNormalized(panNorm, tiltNorm);
      paintApc40Crosshair({ x: panNorm, y: 1 - tiltNorm, source: 'roli' });
    });
  }, [roli.onTouch, paintRoliPanTiltFrame]);

  // Ensure the pad is blanked on unmount / route-away so it doesn't keep
  // showing the last touch trail when the user navigates elsewhere.
  useEffect(() => {
    return () => {
      try { roli.clearFrame(); } catch { /* engine may be torn down already */ }
    };
  }, [roli]);

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

    applyPanTiltNormalized(x / 100, (100 - y) / 100);
  };

  // Reset Pan/Tilt to center position
  const resetPanTiltToCenter = () => {
    // If Pan/Tilt autopilot is active, disable it when user manually resets
    if (panTiltAutopilot.enabled) {
      debugLog.log('Manual Pan/Tilt reset detected - disabling autopilot');
      togglePanTiltAutopilot();
    }

    applyPanTiltNormalized(0.5, 0.5);
  };

  const updateColorPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!colorWheelRef.current) return;

      const rect = colorWheelRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const colour = colourFromTouch(x, y, 1);

      setColorHue(colour.h);
      setColorSaturation(colour.v * 100);
      setColorStripX(x * 100);

      const { r, g, b } = colour;
      const wheelValue = Math.round(colour.h / 360 * 127);
      setRed(r);
      setGreen(g);
      setBlue(b);
      setColorWheel(wheelValue);
      applyControl('red', r);
      applyControl('green', g);
      applyControl('blue', b);
      applyControl('color_wheel', wheelValue);
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
    const { h, s, v } = rgbToHsv(red, green, blue);
    setColorHue(h);
    setColorSaturation(v);
    setColorStripX(s < 5 && v > 0 ? 92 : Math.max(0, Math.min(80, (h / 360) * 80)));
  }, [red, green, blue, isDraggingColor]);

  const stopMidiLearn = useCallback(() => {
    if (midiLearnTimeoutRef.current) {
      window.clearTimeout(midiLearnTimeoutRef.current);
      midiLearnTimeoutRef.current = null;
    }
    midiLearnRangeRef.current = null;
    setMidiLearnTarget(null);
    addNotification({
      message: 'MIDI learn cancelled',
      type: 'info',
      priority: 'low',
    });
  }, [addNotification]);

  // Enhanced MIDI Learn with range support, backed by the shared app MIDI stream.
  const startMidiLearn = useCallback((controlType: string, minValue: number = 0, maxValue: number = 255) => {
    if (midiLearnTimeoutRef.current) {
      window.clearTimeout(midiLearnTimeoutRef.current);
    }

    midiLearnRangeRef.current = { target: controlType, minValue, maxValue };
    lastLearnMidiSignatureRef.current = midiMessages.length > 0
      ? JSON.stringify(midiMessages[midiMessages.length - 1])
      : null;
    setMidiLearnTarget(controlType);
    debugLog.log(`Starting MIDI learn for ${controlType} (range: ${minValue}-${maxValue})`);
    addNotification({
      message: `MIDI learn: move a control for ${controlType.replace(/[_-]/g, ' ')}`,
      type: 'info',
      priority: 'normal',
    });

    midiLearnTimeoutRef.current = window.setTimeout(() => {
      setMidiLearnTarget((current) => {
        if (current !== controlType) return current;
        midiLearnRangeRef.current = null;
        addNotification({
          message: `MIDI learn timed out for ${controlType.replace(/[_-]/g, ' ')}`,
          type: 'warning',
          priority: 'normal',
        });
        return null;
      });
      midiLearnTimeoutRef.current = null;
    }, 30000);
  }, [addNotification, midiMessages]);

  useEffect(() => () => {
    if (midiLearnTimeoutRef.current) {
      window.clearTimeout(midiLearnTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!midiLearnTarget || midiMessages.length === 0) return;

    const latestMessage = midiMessages[midiMessages.length - 1];
    const signature = JSON.stringify(latestMessage);
    if (signature === lastLearnMidiSignatureRef.current) return;
    lastLearnMidiSignatureRef.current = signature;

    const normalized = normalizeMidiMessage(latestMessage);
    if (!normalized || normalized.type === 'noteoff') return;

    const learnRange = midiLearnRangeRef.current ?? {
      target: midiLearnTarget,
      minValue: 0,
      maxValue: 255,
    };
    const mapping: LocalMidiMapping = {
      channel: normalized.channel,
      minValue: learnRange.minValue,
      maxValue: learnRange.maxValue,
    };

    if (normalized.type === 'cc') mapping.cc = normalized.cc;
    if (normalized.type === 'noteon') mapping.note = normalized.note;
    if (normalized.type === 'pitch') mapping.pitch = true;

    setMidiMappings(prev => ({
      ...prev,
      [learnRange.target]: mapping,
    }));

    if (midiLearnTimeoutRef.current) {
      window.clearTimeout(midiLearnTimeoutRef.current);
      midiLearnTimeoutRef.current = null;
    }
    midiLearnRangeRef.current = null;
    setMidiLearnTarget(null);
    addNotification({
      message: `${learnRange.target.replace(/[_-]/g, ' ')} mapped to ${midiMappingLabel(mapping)}`,
      type: 'success',
      priority: 'normal',
    });
    debugLog.log(`MIDI learned for ${learnRange.target}:`, mapping);
  }, [addNotification, midiLearnTarget, midiMessages]);

  const setMidiMapping = (controlType: string, midiData: LocalMidiMapping) => {
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
    addNotification({
      message: `MIDI mapping removed for ${controlType.replace(/[_-]/g, ' ')}`,
      type: 'info',
      priority: 'low',
    });
  };

  const midiButtonLabel = (controlType: string, fallback: string) => {
    if (midiLearnTarget === controlType) return 'Listening';
    return midiMappingLabel(midiMappings[controlType]) || fallback;
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

  // Handle MIDI-triggered local SuperControl actions from the shared app MIDI stream.
  useEffect(() => {
    if (midiLearnTarget || midiMessages.length === 0) return;

    const latestMessage = midiMessages[midiMessages.length - 1];
    const signature = JSON.stringify(latestMessage);
    if (signature === lastActionMidiSignatureRef.current) return;
    lastActionMidiSignatureRef.current = signature;

    const normalized = normalizeMidiMessage(latestMessage);
    if (!normalized) return;

    Object.entries(midiMappings).forEach(([action, mapping]) => {
      if (mapping.channel !== normalized.channel) return;

      let midiValue = 0;
      let triggered = false;

      if (mapping.note !== undefined && (normalized.type === 'noteon' || normalized.type === 'noteoff')) {
        triggered = mapping.note === normalized.note;
        midiValue = normalized.value;
      } else if (mapping.cc !== undefined && normalized.type === 'cc') {
        triggered = mapping.cc === normalized.cc;
        midiValue = normalized.value;
      } else if (mapping.pitch && normalized.type === 'pitch') {
        triggered = true;
        midiValue = normalized.value;
      }

      if (!triggered) return;

      const scaledValue = Math.round(
        mapping.minValue + (midiValue / 127) * (mapping.maxValue - mapping.minValue)
      );

      debugLog.log(`MIDI triggered for ${action}: value=${midiValue}, scaled=${scaledValue}`);

      switch (action) {
        case 'dimmer':
          setDimmer(scaledValue);
          applyControl('dimmer', scaledValue);
          break;
        case 'pan':
          setPanValue(scaledValue);
          setPanTiltXY(prev => ({ ...prev, x: getControlNormalizedFromValue('pan', scaledValue) * 100 }));
          applyControl('pan', scaledValue);
          break;
        case 'tilt':
          setTiltValue(scaledValue);
          setPanTiltXY(prev => ({ ...prev, y: (1 - getControlNormalizedFromValue('tilt', scaledValue)) * 100 }));
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
        case 'color_wheel':
        case 'colorWheel':
          setColorWheel(scaledValue);
          applyControl('color_wheel', scaledValue);
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
          break;
        case 'fixture_next':
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
          if (action.startsWith('scene-') && midiValue > 63) {
            const sceneName = action.replace('scene-', '');
            const sceneIndex = scenes.findIndex(s => s.name === sceneName);
            if (sceneIndex !== -1) {
              loadSceneByIndex(sceneIndex);
            }
          }
          break;
      }
    });
  }, [midiLearnTarget, midiMessages, midiMappings, currentSceneIndex, scenes]);

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
        sceneAutoSave: false,
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
          if (settings.currentSceneIndex !== undefined) setCurrentSceneIndex(settings.currentSceneIndex);
          if (settings.selectionMode) {
            setSelectionMode(settings.selectionMode === 'channels' && selectedChannels.length === 0 ? 'fixtures' : settings.selectionMode);
          }
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
        sceneAutoSave: false,
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
    setSelectionMode('fixtures');
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
          ? 'Select fixtures to control'
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
  const hasChannelSelection = selectedChannels.length > 0;
  const hasColorWheelControl = hasControlType('color_wheel');
  const colorWheelSlots = getFirstFixtureColorWheelSlots(getAffectedFixtures().map(({ fixture }) => fixture));

  useEffect(() => {
    if (selectionMode === 'channels' && !hasChannelSelection) {
      setSelectionMode('fixtures');
    }
  }, [hasChannelSelection, selectionMode]);

  const availableControls = useMemo(
    () => CONTROL_AVAILABILITY.map((control) => ({
      ...control,
      available: control.types.some((type) => hasControlType(type)),
    })),
    [fixtures, groups, selectedCapabilities, selectedChannels, selectedFixtures, selectedGroups, selectionMode]
  );

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
      resolveControlChannel('pan', channels) !== undefined && resolveControlChannel('tilt', channels) !== undefined
    );

    if (panTiltFixtures.length === 0) return;

    // Use the first fixture's pan/tilt values for UI synchronization
    const firstFixture = panTiltFixtures[0];
    const panChannel = resolveControlChannel('pan', firstFixture.channels)!;
    const tiltChannel = resolveControlChannel('tilt', firstFixture.channels)!;
    const currentPanValue = getDmxChannelValue(panChannel);
    const currentTiltValue = getDmxChannelValue(tiltChannel);

    // Update UI states to reflect autopilot position
    if (currentPanValue !== panValue) {
      setPanValue(currentPanValue);
      setPanTiltXY(prev => ({ ...prev, x: getControlNormalizedFromValue('pan', currentPanValue) * 100 }));
    }

    if (currentTiltValue !== tiltValue) {
      setTiltValue(currentTiltValue);
      setPanTiltXY(prev => ({ ...prev, y: (1 - getControlNormalizedFromValue('tilt', currentTiltValue)) * 100 }));
    }

    // Sync the UI readout while autopilot is active; the interval is user-configurable.
    const interval = setInterval(() => {
      const newPanValue = getDmxChannelValue(panChannel);
      const newTiltValue = getDmxChannelValue(tiltChannel);

      if (newPanValue !== panValue) {
        setPanValue(newPanValue);
        setPanTiltXY(prev => ({ ...prev, x: getControlNormalizedFromValue('pan', newPanValue) * 100 }));
      }

      if (newTiltValue !== tiltValue) {
        setTiltValue(newTiltValue);
        setPanTiltXY(prev => ({ ...prev, y: (1 - getControlNormalizedFromValue('tilt', newTiltValue)) * 100 }));
      }
    }, autopilotUiSyncIntervalMs);

    return () => clearInterval(interval);
  }, [panTiltAutopilot.enabled, panValue, tiltValue, getDmxChannelValue, autopilotUiSyncIntervalMs]);

  const getQuickTip = () => {
    if (fixtures.length === 0) {
      return 'Add fixtures in Fixture Setup tab to get started';
    }
    if (!hasSelection) {
      if (selectionMode === 'fixtures') return 'Click fixtures below or use Select All';
      if (selectionMode === 'groups' && groups.length > 0) return 'Click a group to select it';
      return 'Select fixtures, groups, or channels to control';
    }
    return null;
  };

  const showMidiOscPanel = fixtures.length > 0 || groups.length > 0 || scenes.length > 0;
  const showBasicPanel = hasControlType('dimmer');
  const hasEmissionGate = hasControlType('shutter') || hasControlType('strobe') || hasControlType('lamp');
  const spanControlPanelIds = visibleSpanPanelIds.filter((panelId) => {
    switch (panelId) {
      case 'midiOsc': return showMidiOscPanel;
      case 'basic': return showBasicPanel;
      case 'panTilt': return hasControlType('pan') || hasControlType('tilt');
      case 'rgb': return hasControlType('red') || hasControlType('green') || hasControlType('blue') || hasControlType('color_wheel');
      case 'effects': return hasControlType('gobo') || hasControlType('shutter') || hasControlType('strobe') || hasControlType('lamp') || hasControlType('reset');
      case 'envelopes': return selectionMode === 'channels' && selectedChannels.length > 0;
      case 'directDmx': return selectionMode === 'channels' && selectedChannels.length > 0 && !touchLayout;
      default: return false;
    }
  });

  return (
    <div
      className={[
        'ab-rack-module',
        styles.superControl,
        touchLayout ? styles.touchLayout : '',
        superControlPrefs.enableAnimations ? '' : styles.animationsDisabled,
      ].filter(Boolean).join(' ')}
      data-embedded-workbench={embeddedWorkbench ? 'true' : undefined}
    >
      {touchLayout && selectionMode === 'channels' && hasChannelSelection && (
        <SelectedChannelsFaderStrip maxVisible={10} />
      )}

      <div className={styles.layoutTray} aria-label="SuperControl card layout controls">
        <div className={styles.layoutTraySection}>
          <span className={styles.layoutTrayLabel}>Grid</span>
          <div className={styles.layoutTrayButtons}>
            {[0, 1, 2, 3, 4].map((columns) => (
              <button
                key={columns}
                type="button"
                className={panelLayout.columns === columns ? styles.layoutTrayButtonActive : ''}
                onClick={() => setColumnCount(columns)}
                title={columns === 0 ? 'Auto-fit card columns' : `Use ${columns} card column${columns === 1 ? '' : 's'}`}
              >
                {columns === 0 ? 'Auto' : columns}
              </button>
            ))}
          </div>
        </div>

        {spanControlPanelIds.length > 0 && (
          <div className={styles.layoutTraySection}>
            <span className={styles.layoutTrayLabel}>Card widths</span>
            <div className={styles.cardWidthGrid}>
              {spanControlPanelIds.map((panelId) => {
                const currentSpan = panelLayout.spans[panelId] ?? 1;
                return (
                  <div key={panelId} className={styles.cardWidthControl}>
                    <span>{SUPER_CONTROL_PANEL_LABELS[panelId]}</span>
                    <div className={styles.layoutTrayButtons}>
                      {Array.from({ length: columnCap }, (_, index) => index + 1).map((span) => (
                        <button
                          key={span}
                          type="button"
                          className={currentSpan === span ? styles.layoutTrayButtonActive : ''}
                          onClick={() => setPanelSpan(panelId, span)}
                          title={`${SUPER_CONTROL_PANEL_LABELS[panelId]} spans ${span} column${span === 1 ? '' : 's'}`}
                        >
                          {span}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.layoutTraySection}>
          <span className={styles.layoutTrayLabel}>Hidden</span>
          <div className={styles.layoutTrayButtons}>
            {hiddenPanelIds.length === 0 ? (
              <span className={styles.layoutTrayEmpty}>None</span>
            ) : (
              hiddenPanelIds.map((panelId) => (
                <button key={panelId} type="button" onClick={() => togglePanelHidden(panelId)}>
                  Show {SUPER_CONTROL_PANEL_LABELS[panelId]}
                </button>
              ))
            )}
            {hiddenPanelCount > 1 && (
              <button type="button" onClick={showAllPanels}>Show all</button>
            )}
            <button type="button" onClick={resetPanelLayout} title="Reset order, hidden cards, columns, widths, and heights">
              Reset layout
            </button>
          </div>
        </div>
      </div>

      <div
        ref={panelContainerRef}
        className={styles.autoLayoutContainer}
        data-fullscreen={panelLayout.fullscreen ?? undefined}
        style={
          panelLayout.columns > 0
            ? ({ ['--sc-column-count' as any]: panelLayout.columns } as React.CSSProperties)
            : undefined
        }
      >
        <div {...panelProps('selection')}>
          {renderPanelHeader('selection', <LucideIcon name="ListChecks" />, 'Selection')}
          <div className={`${styles.gridItemContent} ${styles.selectionDashboardContent}`}>
            {/* Selection Mode */}
            <div className={styles.fixtureSelection}>
              <div className={`${styles.selectionTabs} ab-view-tabs`}>
                {hasChannelSelection && (
                  <SkeuoButton
                    compact
                    active={selectionMode === 'channels'}
                    onClick={() => setSelectionMode('channels')}
                  >
                    <LucideIcon name="Radio" />
                    Channels
                  </SkeuoButton>
                )}
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
                        const nextGroups = selectedGroups.includes(group.id)
                          ? selectedGroups.filter(id => id !== group.id)
                          : [...selectedGroups, group.id];
                        setSelectedGroups(nextGroups);
                        const nextFixtureIds = Array.from(new Set(
                          nextGroups.flatMap((groupId) => {
                            const matchedGroup = groups.find(candidate => candidate.id === groupId);
                            return (matchedGroup?.fixtureIndices ?? [])
                              .map((fixtureIndex) => fixtures[fixtureIndex]?.id)
                              .filter((id): id is string => Boolean(id));
                          })
                        ));
                        setSelectedFixtures(nextFixtureIds);
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
                      const nextCapabilities = selectedCapabilities.includes(capability.type)
                        ? selectedCapabilities.filter(type => type !== capability.type)
                        : [...selectedCapabilities, capability.type];
                      setSelectedCapabilities(nextCapabilities);
                      const nextFixtureIds = Array.from(new Set(
                        capabilities
                          .filter(candidate => nextCapabilities.includes(candidate.type))
                          .flatMap(candidate => candidate.fixtures)
                      ));
                      setSelectedFixtures(nextFixtureIds);
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
              <div className={styles.availableControls} aria-label="Available Super Control sliders">
                <div className={styles.availableControlsHeader}>
                  <strong>Available sliders</strong>
                  <span>{hasSelection ? `${availableControls.filter((control) => control.available).length} active` : 'select target'}</span>
                </div>
                <div className={styles.availableControlGrid}>
                  {availableControls.map((control) => (
                    <span
                      key={control.key}
                      className={`${styles.availableControlPill} ${control.available ? styles.availableControlOn : ''}`}
                    >
                      {control.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.selectionStageMapPane}>
              <StageMapDashboard
                title="Stage Map"
                subtitle={selectedFixtures.length
                  ? `${selectedFixtures.length} selected`
                  : `${fixtures.length} fixtures · ${groups.length} groups`}
                showGroupPicker={false}
                maxGroupChips={6}
              />
            </div>
            <div className={styles.selectionMonitorPane}>
              <div className={styles.selectionPaneHeader}>
                <strong>Monitor</strong>
                <span>live channels for the selected target</span>
              </div>
              {hasSelection ? (
                <div className={styles.monitoringSection}>
                  <div className={styles.sectionHeader}>
                    <h4>
                      <LucideIcon name="Activity" />
                      Monitor
                    </h4>
                    <span className={styles.totalFixtures}>
                      {getAffectedFixtures().length} fixture(s)
                    </span>
                  </div>

                  <div className={styles.monitoringSurface}>
                    <div className={styles.monitorStream}>
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
                    </div>

                    <aside className={styles.controlIndicators} aria-label="Real-time control indicators">
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
                        </div>
                        <div className={`${styles.indicator} ${strobe > 0 ? styles.active : ''}`}>
                          <LucideIcon name="Zap" />
                          <span>Strobe: {strobe}</span>
                        </div>
                        <div className={`${styles.indicator} ${lamp > 0 ? styles.active : ''}`}>
                          <LucideIcon name="Power" />
                          <span>Lamp: {lamp}</span>
                        </div>
                        <div className={`${styles.indicator} ${reset > 0 ? styles.active : ''}`}>
                          <LucideIcon name="RotateCcw" />
                          <span>Reset: {reset}</span>
                        </div>
                      </div>
                    </aside>
                  </div>
                </div>
              ) : (
                <div className={styles.placeholder}>Select fixtures, groups, or channels to monitor.</div>
              )}
            </div>
          </div>
        </div>

        {showMidiOscPanel && (
        <div {...panelProps('midiOsc')}>
          {renderPanelHeader(
            'midiOsc',
            <LucideIcon name="Music" />,
            'MIDI/OSC & Navigation',
            <button
              type="button"
              className={styles.gridItemHeaderDisclosure}
              onClick={() => setMidiOscNavExpanded((v) => !v)}
              aria-expanded={midiOscNavExpanded}
              title={midiOscNavExpanded ? 'Hide MIDI/OSC navigation' : 'Show MIDI/OSC navigation'}
            >
              <LucideIcon name={midiOscNavExpanded ? 'ChevronUp' : 'ChevronDown'} />
            </button>
          )}
          {midiOscNavExpanded && (
          <div className={styles.gridItemContent}>
            {/* MIDI/OSC Learning and Navigation Controls */}
            <div className={styles.midiOscSection}>
              <div className={styles.navigationGrid}>
                {fixtures.length > 0 && (
                  <>
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
                  </>
                )}

                {groups.length > 0 && (
                  <>
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
                  </>
                )}
              </div>
              <div className={styles.sceneControlsDock}>
                <h5>Scene Controls</h5>
                <div className={styles.sceneControls}>
                  <div className={styles.sceneButtonRow}>
                    <SkeuoButton compact accent="purple" className={styles.sceneBtn} onClick={() => captureCurrentScene()}>
                      <LucideIcon name="Camera" />
                      Save Scene
                    </SkeuoButton>
                    <SkeuoButton compact accent="purple" className={styles.sceneBtn} onClick={selectPreviousScene} disabled={scenes.length === 0}>
                      <LucideIcon name="ChevronLeft" />
                      Previous
                    </SkeuoButton>
                    <SkeuoButton compact accent="purple" className={styles.sceneBtn} onClick={selectNextScene} disabled={scenes.length === 0}>
                      Next
                      <LucideIcon name="ChevronRight" />
                    </SkeuoButton>
                  </div>
                  <div className={styles.sceneInfo}>
                    <span className={styles.currentScene}>{scenes.length > 0 ? scenes[currentSceneIndex]?.name || 'No scene' : 'No scenes'}</span>
                    <span className={styles.sceneCount}>({scenes.length} saved)</span>
                  </div>
                  <div className={styles.sceneOptions}>
                    <label className={styles.checkboxLabel} title={SCENE_AUTO_SAVE_TOOLTIP}>
                      <input type="checkbox" checked={false} disabled readOnly title={SCENE_AUTO_SAVE_TOOLTIP} />
                      Auto-save scenes (inactive)
                    </label>
                  </div>
                </div>
                <div className={styles.midiLearnRow}>
                  <button
                    type="button"
                    className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_save' ? styles.learning : ''} ${midiMappings.scene_save ? styles.mapped : ''}`}
                    onClick={() => midiLearnTarget === 'scene_save' ? stopMidiLearn() : startMidiLearn('scene_save')}
                    title={midiMappings.scene_save ? `Remap ${midiMappingLabel(midiMappings.scene_save)}` : 'Learn MIDI for Save Scene'}
                    aria-pressed={midiLearnTarget === 'scene_save'}
                  >
                    <LucideIcon name={midiLearnTarget === 'scene_save' ? 'Radio' : 'Music'} />
                    {midiButtonLabel('scene_save', 'MIDI Save')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_previous' ? styles.learning : ''} ${midiMappings.scene_previous ? styles.mapped : ''}`}
                    onClick={() => midiLearnTarget === 'scene_previous' ? stopMidiLearn() : startMidiLearn('scene_previous')}
                    title={midiMappings.scene_previous ? `Remap ${midiMappingLabel(midiMappings.scene_previous)}` : 'Learn MIDI for Previous Scene'}
                    aria-pressed={midiLearnTarget === 'scene_previous'}
                  >
                    <LucideIcon name={midiLearnTarget === 'scene_previous' ? 'Radio' : 'Music'} />
                    {midiButtonLabel('scene_previous', 'MIDI Prev')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.midiLearnBtn} ${midiLearnTarget === 'scene_next' ? styles.learning : ''} ${midiMappings.scene_next ? styles.mapped : ''}`}
                    onClick={() => midiLearnTarget === 'scene_next' ? stopMidiLearn() : startMidiLearn('scene_next')}
                    title={midiMappings.scene_next ? `Remap ${midiMappingLabel(midiMappings.scene_next)}` : 'Learn MIDI for Next Scene'}
                    aria-pressed={midiLearnTarget === 'scene_next'}
                  >
                    <LucideIcon name={midiLearnTarget === 'scene_next' ? 'Radio' : 'Music'} />
                    {midiButtonLabel('scene_next', 'MIDI Next')}
                  </button>
                  <input type="text" placeholder="OSC: /scene/control" className={styles.oscInput} defaultValue="/scene/control" />
                </div>
                {scenes.length > 0 && (
                  <div className={styles.scenesList}>
                    <h5>Saved Scenes ({scenes.length})</h5>
                    <div className={styles.scenesGrid}>
                      {scenes.map((scene, index) => (
                        <div key={scene.name} className={`${styles.sceneItem} ${index === currentSceneIndex ? styles.active : ''}`}>
                          <div className={styles.sceneHeader}>
                            <span className={styles.sceneName}>{scene.name}</span>
                            <button className={styles.deleteBtn} onClick={() => deleteSceneByIndex(index)}>
                              <LucideIcon name="X" />
                            </button>
                          </div>
                          <div className={styles.sceneDetails}>
                            <span className={styles.sceneChannels}>{scene.channelValues.filter(v => v > 0).length} channels</span>
                            <span className={styles.sceneTime}>{scene.oscAddress || `/scene/${index + 1}`}</span>
                          </div>
                          <div className={styles.sceneConnectionControls}>
                            <div className={styles.sceneMidiSection}>
                              <button
                                type="button"
                                className={`${styles.midiLearnBtn} ${styles.small} ${midiLearnTarget === `scene-${scene.name}` ? styles.learning : ''} ${midiMappings[`scene-${scene.name}`] ? styles.mapped : ''}`}
                                onClick={() => midiLearnTarget === `scene-${scene.name}` ? stopMidiLearn() : startMidiLearn(`scene-${scene.name}`)}
                                title={midiMappings[`scene-${scene.name}`] ? `Remap ${midiMappingLabel(midiMappings[`scene-${scene.name}`])}` : `Learn MIDI for ${scene.name}`}
                                aria-pressed={midiLearnTarget === `scene-${scene.name}`}
                              >
                                <LucideIcon name={midiLearnTarget === `scene-${scene.name}` ? 'Radio' : 'Music'} />
                                {midiButtonLabel(`scene-${scene.name}`, 'MIDI')}
                              </button>
                              {midiMappings[`scene-${scene.name}`] && (
                                <div className={styles.midiInfo}>
                                  <span>{midiMappingLabel(midiMappings[`scene-${scene.name}`])}</span>
                                  <button
                                    type="button"
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
                          <SkeuoButton variant="wide" accent="green" compact className={styles.loadSceneBtn} onClick={() => storeLoadScene(scene.name)}>
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
          </div>
          )}
        </div>
        )}

        {showBasicPanel && (
        <div {...panelProps('basic')}>
          {renderPanelHeader('basic', <LucideIcon name="SlidersHorizontal" />, 'Basic Controls')}
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
                  if (val > 0) openEmissionGates(false);
                }}
                {...midiPropsFor('dimmer')}
              />
              {hasEmissionGate && (
                <SkeuoButton
                  variant="wide"
                  accent="green"
                  compact
                  disabled={!hasSelection}
                  onClick={turnBeamOn}
                  title="Set dimmer full and open shutter/strobe/lamp channels"
                >
                  <LucideIcon name="Lightbulb" />
                  Beam On
                </SkeuoButton>
              )}
              </div>
            </div>
          </div>
        </div>
        )}

        {(hasControlType('pan') || hasControlType('tilt')) && (
          <div {...panelProps('panTilt')}>
            {renderPanelHeader(
              'panTilt',
              <LucideIcon name="Move" />,
              'Pan/Tilt',
              panTiltAutopilot.enabled ? (
                <span
                  className={styles.autopilotIndicator}
                  style={{
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
              ) : null
            )}
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
                    setPanTiltXY(prev => ({ ...prev, x: getControlNormalizedFromValue('pan', val) * 100 }));
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
                    setPanTiltXY(prev => ({ ...prev, y: (1 - getControlNormalizedFromValue('tilt', val)) * 100 }));
                  }}
                  {...midiPropsFor('tilt')}
                />
              </div>

              <h5 className={styles.xyPadHeading}>XY Pad</h5>
              <ArtbastardXYPad
                ref={xyPadHandleRef}
                className={styles.panTiltPad}
                pan={Math.round(clamp01(panTiltXY.x / 100) * 255)}
                tilt={Math.round(clamp01((100 - panTiltXY.y) / 100) * 255)}
                disabled={!hasSelection}
                onPanTiltChange={(p, t) => {
                  if (panTiltAutopilot.enabled) {
                    togglePanTiltAutopilot();
                  }
                  const panNorm = clamp01(p / 255);
                  const tiltNorm = clamp01(t / 255);
                  applyPanTiltNormalized(panNorm, tiltNorm);
                  paintApc40Crosshair({ x: panNorm, y: 1 - tiltNorm, source: 'supercontrol' });
                }}
                onPathSaved={(points) => {
                  setPanTiltAutopilot({ customPath: points, pathType: 'custom' });
                }}
                onPathChange={handleXyPadPathChange}
                onOpenPathEditor={() => setShowPanTiltPathEditor(true)}
                slots={slotSummaries}
                activeSlotId={pathSlots.activeSlotId}
                onSaveToSlot={saveSlotPath}
                onLoadSlot={loadSlotPath}
                onRenameSlot={renameSlot}
                onClearSlot={clearSlot}
                roliConnected={roli.connected}
                roliDeviceName={roli.deviceName}
              />
              {(() => {
                // Keep the Roli touch handler ref in sync with the latest closures.
                roliApplyRef.current = {
                  applyPanTiltNormalized,
                  togglePanTiltAutopilot,
                  setPanTiltAutopilot,
                  panTiltAutopilotEnabled: panTiltAutopilot.enabled,
                  hasSelection,
                  addNotification,
                  autoplayOnRelease: roliAutoplayOnRelease,
                };
                return null;
              })()}
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
                <button
                  className={styles.centerResetBtn}
                  onClick={() => {
                    const cursor = {
                      x: Math.max(0, Math.min(1, panTiltXY.x / 100)),
                      y: Math.max(0, Math.min(1, panTiltXY.y / 100)),
                    };
                    paintRoliPanTiltFrame(cursor, trailRef.current.length > 0 ? trailRef.current : [cursor], 'health');
                  }}
                  disabled={!roli.handshakeDone}
                  title="Force repaint the PAN/TILT ROLI crosshair and ghost trail"
                >
                  <LucideIcon name="RefreshCw" />
                  Repaint ROLI
                </button>
                <button
                  className={styles.centerResetBtn}
                  onClick={() => setRoliAutoplayOnRelease((v) => !v)}
                  title={
                    roliAutoplayOnRelease
                      ? 'Lifting your finger from the ROLI starts the drawn path looping on pan/tilt. Click to disable.'
                      : 'Lifting your finger from the ROLI does nothing extra (current behaviour). Click to enable autoplay on release.'
                  }
                  style={{
                    background: roliAutoplayOnRelease
                      ? 'linear-gradient(135deg, rgba(82, 196, 26, 0.35), rgba(56, 158, 13, 0.25))'
                      : undefined,
                  }}
                >
                  <LucideIcon name={roliAutoplayOnRelease ? 'Play' : 'Pause'} />
                  Auto-play on release: {roliAutoplayOnRelease ? 'ON' : 'OFF'}
                </button>
              </div>
              <RoliColourWheel />
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
          <div {...panelProps('rgb')}>
            {renderPanelHeader('rgb', <LucideIcon name="Palette" />, 'RGB Color')}
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
                      left: `${Math.max(0, Math.min(100, colorStripX))}%`,
                      top: `${Math.max(0, Math.min(100, 100 - colorSaturation))}%`
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
                  label="Color Wheel"
                  fullWidth
                  value={colorWheel}
                  disabled={!hasSelection || !hasColorWheelControl}
                  controlName="color_wheel"
                  oscAddress="/color/wheel"
                  labelColor="#f472b6"
                  accentColor="#f472b6"
                  subtitle="Fixture wheel / split-colour channel"
                  meta={hasColorWheelControl ? 'wheel' : 'no wheel'}
                  presetValues={colorWheelSlots.length > 0 ? colorWheelSlots.map((slot) => slot.value) : undefined}
                  onChange={(val) => {
                    setColorWheel(val);
                    setColorHue((val / 255) * 360);
                    setColorSaturation(100);
                    applyControl('color_wheel', val);
                  }}
                  {...midiPropsFor('color_wheel')}
                />
                {colorWheelSlots.length > 0 && (
                  <div className={styles.colorWheelSlotGrid} aria-label="Fixed color wheel slots">
                    {colorWheelSlots.map((slot) => (
                      <button
                        key={`${slot.label}-${slot.value}`}
                        type="button"
                        className={`${styles.colorWheelSlotButton} ${colorWheel >= slot.min && colorWheel <= slot.max ? styles.active : ''}`}
                        disabled={!hasSelection || !hasColorWheelControl}
                        onClick={() => {
                          setColorWheel(slot.value);
                          setColorHue(slot.hue);
                          setColorSaturation(slot.label.toLowerCase().includes('white') ? 0 : 100);
                          applyControl('color_wheel', slot.value);
                          if (dimmer > 0) openEmissionGates(false);
                        }}
                        title={`${slot.label}: DMX ${slot.value} (${slot.min}-${slot.max})`}
                      >
                        <span className={styles.colorWheelSlotSwatch} style={{ backgroundColor: slot.hex }} />
                        <span>{slot.label.replace(/^Wheel\s+/, '')}</span>
                        <small>{slot.value}</small>
                      </button>
                    ))}
                  </div>
                )}
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
              <div className={styles.colorAutoDock}>
                <div className={styles.colorAutoHeader}>
                  <SkeuoButton
                    variant="wide"
                    active={colorSliderAutopilot.enabled}
                    accent="green"
                    onClick={toggleColorSliderAutopilot}
                  >
                    <LucideIcon name={colorSliderAutopilot.enabled ? 'Palette' : 'PaintBucket'} />
                    {colorSliderAutopilot.enabled ? 'Disable Auto Color' : 'Enable Auto Color'}
                  </SkeuoButton>
                  <span>
                    {colorSliderAutopilot.enabled
                      ? `${colorSliderAutopilot.type}${colorSliderAutopilot.syncToBPM ? ` · ${bpm} BPM` : ''}`
                      : 'RGB fixtures only'}
                  </span>
                </div>
                <div className={styles.colorAutoControls}>
                  <label>
                    Pattern
                    <select
                      value={colorSliderAutopilot.type}
                      onChange={(e) => setColorSliderAutopilot({
                        type: e.target.value as 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth'
                      })}
                      disabled={!colorSliderAutopilot.enabled}
                    >
                      <option value="sine">Rainbow Sine</option>
                      <option value="cycle">Rainbow Cycle</option>
                      <option value="triangle">Triangle Wave</option>
                      <option value="sawtooth">Sawtooth Ramp</option>
                      <option value="ping-pong">Ping Pong</option>
                      <option value="random">Random Colors</option>
                    </select>
                  </label>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={colorSliderAutopilot.syncToBPM}
                      onChange={(e) => setColorSliderAutopilot({ syncToBPM: e.target.checked })}
                      disabled={!colorSliderAutopilot.enabled}
                    />
                    Sync BPM
                  </label>
                  <SkeuoKnobSlider
                    label="Auto speed"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={colorSliderAutopilot.speed}
                    disabled={!colorSliderAutopilot.enabled}
                    onChange={(v) => setColorSliderAutopilot({ speed: v })}
                  />
                  <div className={styles.colorAutoRange}>
                    <span>Hue {colorSliderAutopilot.range.min}-{colorSliderAutopilot.range.max}</span>
                    <RangeWindowControl
                      min={0}
                      max={360}
                      minValue={colorSliderAutopilot.range.min}
                      maxValue={colorSliderAutopilot.range.max}
                      disabled={!colorSliderAutopilot.enabled}
                      onChange={(minV, maxV) => setColorSliderAutopilot({ range: { min: minV, max: maxV } })}
                    />
                  </div>
                </div>
                <EnvelopePlaybackControls
                  repeatMode={colorSliderAutopilot.repeatMode ?? 'loop'}
                  loopDirection={colorSliderAutopilot.loopDirection ?? 'forward'}
                  onRepeatModeChange={(repeatMode) => setColorSliderAutopilot({ repeatMode })}
                  onLoopDirectionChange={(loopDirection) => setColorSliderAutopilot({ loopDirection })}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {(hasControlType('gobo') || hasControlType('shutter') || hasControlType('strobe') || hasControlType('lamp') || hasControlType('reset')) && (
          <div {...panelProps('effects')}>
            {renderPanelHeader('effects', <LucideIcon name="Zap" />, 'Effects')}
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
          <div {...panelProps('envelopes')}>
            {renderPanelHeader('envelopes', <LucideIcon name="Activity" />, 'Channel envelopes')}
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
          <div {...panelProps('directDmx')}>
            {renderPanelHeader('directDmx', <LucideIcon name="Sliders" />, 'Direct DMX')}
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
