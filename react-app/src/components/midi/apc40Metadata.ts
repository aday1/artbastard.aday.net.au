import type { SuperControlBinding } from './midiControllerTemplates';

export type Apc40Category = 'selection' | 'scene' | 'transport' | 'superControl' | 'utility' | 'nav';

export interface Apc40HardwiredSpec {
  key:
    | 'clipGrid'
    | 'sceneLaunch'
    | 'trackSelect'
    | 'trackStop'
    | 'recordArm'
    | 'activator'
    | 'soloCue'
    | 'stopAll'
    | 'masterButton'
    | 'transport'
    | 'trackFader'
    | 'masterFader'
    | 'crossfader'
    | 'cueLevel'
    | 'deviceKnob'
    | 'navFixture'
    | 'navScene'
    | 'selectAll'
    | 'shift'
    | 'clear';
  label: string;
  description: string;
  category: Exclude<Apc40Category, 'superControl'>;
}

export const APC40_CATEGORY_COLORS: Record<Apc40Category, string> = {
  selection: '#22c55e',
  scene: '#f59e0b',
  transport: '#ec4899',
  utility: '#64748b',
  superControl: '#3b82f6',
  nav: '#a855f7',
};

export const APC40_HARDWIRED_SPECS: Apc40HardwiredSpec[] = [
  { key: 'clipGrid', label: 'Clip Grid / Session View (8x5)', description: 'Launch 40 Deck A scene slots. Hold SHIFT to launch/save the matching 40 Deck B scene slots.', category: 'scene' },
  { key: 'sceneLaunch', label: 'Scene Launch (1-5)', description: 'Launch ACT 1-5. Stop All Clips stops any currently playing ACT.', category: 'scene' },
  { key: 'recordArm', label: 'Record Arm (1-8)', description: 'Arm that grid column. The next grid pad in the current deck saves current DMX into that Deck A/B scene slot.', category: 'transport' },
  { key: 'trackSelect', label: 'Track Select (1-8)', description: 'Select fixture group by index; falls back to single fixture in that column.', category: 'selection' },
  { key: 'activator', label: 'Activator (1-8)', description: 'Toggle APC40 auto control for fixture group 1-8.', category: 'transport' },
  { key: 'soloCue', label: 'Solo/Cue (1-8)', description: 'Solo a fixture inside the currently selected group; press the same solo again to restore selection.', category: 'selection' },
  { key: 'trackStop', label: 'Clip Stop row', description: 'Stop/unselect the active scene in that column for the current deck.', category: 'utility' },
  { key: 'stopAll', label: 'Stop All Clips', description: 'Stop all Deck A/B scenes and ACT playback.', category: 'utility' },
  { key: 'masterButton', label: 'Master Select', description: 'FULL ON latch: sends 255 to fixture output channels, press again to restore previous DMX values.', category: 'utility' },
  { key: 'transport', label: 'Transport REC/STOP', description: 'REC arms/clears all record columns; STOP mirrors Stop All Clips.', category: 'scene' },
  { key: 'navFixture', label: 'Up / Down arrows', description: 'Cycle through fixtures: Up = previous, Down = next.', category: 'nav' },
  { key: 'navScene', label: 'Left / Right arrows', description: 'Cycle through scenes: Left = previous, Right = next.', category: 'nav' },
  { key: 'selectAll', label: 'Pan button', description: 'Select all fixtures at once.', category: 'selection' },
  { key: 'clear', label: 'Clear Selection', description: 'Deselects all fixtures.', category: 'selection' },
  { key: 'shift', label: 'Shift', description: 'Modifier reserved for shift-combos.', category: 'utility' },
];

export const APC40_DEVICE_KNOB_ASSIGNMENTS: Array<{
  slot: number;
  cc: number;
  controlName: SuperControlBinding['controlName'];
  roleLabel: string;
}> = [
  { slot: 0, cc: 16, controlName: 'gobo', roleLabel: 'Gobo' },
  { slot: 1, cc: 17, controlName: 'gobo_rotation', roleLabel: 'Gobo Rotate' },
  { slot: 2, cc: 18, controlName: 'color_wheel', roleLabel: 'Color Wheel' },
  { slot: 3, cc: 19, controlName: 'prism', roleLabel: 'Prism' },
  { slot: 4, cc: 20, controlName: 'iris', roleLabel: 'Iris' },
  { slot: 5, cc: 21, controlName: 'focus', roleLabel: 'Focus' },
  { slot: 6, cc: 22, controlName: 'zoom', roleLabel: 'Zoom' },
  { slot: 7, cc: 23, controlName: 'strobe', roleLabel: 'Strobe/Shutter' },
];

export const APC40_QUICK_MAP_BASE = {
  sceneLaunch: 'Launch ACT 1-5',
  clipGrid: 'Launch Deck clip scenes',
  crossfader: 'Blend Deck A and Deck B',
  transport: 'Play/Stop/Record + fixture/scene nav',
};

export const stripDeviceKnobPrefix = (label?: string): string | undefined => {
  if (!label) return label;
  return label.replace(/^Device Knob \d+\s*(?:->|→)\s*/, '');
};
