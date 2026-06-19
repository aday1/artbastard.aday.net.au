import type { SuperControlBinding } from './midiControllerTemplates';
import { APC40_DEVICE_KNOB_ASSIGNMENTS as GENERATED_APC40_DEVICE_KNOB_ASSIGNMENTS } from '../../midi/generated';

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
    | 'footSwitch'
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
  { key: 'recordArm', label: 'Record Arm (1-8)', description: 'Solo Group latch for fixture group 1-8. REC transport enters clip-grid save mode.', category: 'selection' },
  { key: 'trackSelect', label: 'Track Select (1-8)', description: 'Unmapped because of APC40 hardware CC bleed.', category: 'selection' },
  { key: 'activator', label: 'Activator (1-8)', description: 'Select fixture group 1-8.', category: 'selection' },
  { key: 'soloCue', label: 'Solo/Cue (1-8)', description: 'Select fixture 1-8.', category: 'selection' },
  { key: 'trackStop', label: 'Clip Stop row', description: 'Stop/unselect the active scene in that column for the current deck.', category: 'utility' },
  { key: 'stopAll', label: 'Stop All Clips', description: 'Stop all Deck A/B scenes and ACT playback.', category: 'utility' },
  { key: 'masterButton', label: 'Master Select', description: 'DMX FREEZE latch: LED on means output is frozen; press again to unfreeze and flush current state.', category: 'utility' },
  { key: 'footSwitch', label: 'Footswitch jack', description: 'Momentary DMX FREEZE: pedal down holds the rig in place, pedal up resumes and flushes the current state.', category: 'utility' },
  { key: 'transport', label: 'Transport REC/STOP', description: 'REC enters/exits clip-grid save mode; SHIFT+REC rolls random DMX for preview.', category: 'scene' },
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
}> = GENERATED_APC40_DEVICE_KNOB_ASSIGNMENTS.map((entry) => ({
  slot: entry.slot,
  cc: entry.cc,
  controlName: entry.controlName as SuperControlBinding['controlName'],
  roleLabel: entry.roleLabel,
}));

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
