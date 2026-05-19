import type { ContextMenuItem } from '../ui/ContextMenu';
import type { ViewType } from '../../context/RouterContext';

export interface DmxChannelMenuHandlers {
  channelIndex: number;
  value: number;
  isSelected: boolean;
  isPinned: boolean;
  hasMidiMapping: boolean;
  isChannelLearning: boolean;
  setDmxChannel: (i: number, v: number) => void;
  setChannelRange: (i: number, min: number, max: number) => void;
  toggleChannelSelection: (i: number) => void;
  togglePinChannel: (i: number) => void;
  setRandomChannelColor: (i: number) => void;
  onRename: () => void;
  handleMidiLearn: (i: number) => void;
  handleMidiForget: (i: number) => void;
  handleSetOscAddress: (i: number) => void;
  selectAllChannels: () => void;
  deselectAllChannels: () => void;
  dmxChannels: number[];
  onAddToTracker?: () => void;
}

export function buildDmxChannelContextMenu(h: DmxChannelMenuHandlers): ContextMenuItem[] {
  const i = h.channelIndex;
  const items: ContextMenuItem[] = [
    {
      id: 'rename',
      label: 'Rename channel',
      icon: 'Pencil',
      onClick: () => h.onRename(),
    },
    {
      id: 'reset',
      label: 'Reset to default (0)',
      icon: 'RotateCcw',
      onClick: () => {
        h.setDmxChannel(i, 0);
        h.setChannelRange(i, 0, 255);
      },
    },
    {
      id: 'full',
      label: 'Set to full (255)',
      icon: 'Sun',
      onClick: () => h.setDmxChannel(i, 255),
    },
    { id: 'sep1', type: 'separator' },
    {
      id: 'mute',
      label: 'Mute (set to 0)',
      icon: 'VolumeX',
      onClick: () => h.setDmxChannel(i, 0),
    },
    {
      id: 'solo',
      label: 'Solo channel',
      icon: 'Focus',
      onClick: () => {
        const keep = h.dmxChannels[i] ?? 0;
        for (let c = 0; c < 512; c++) {
          h.setDmxChannel(c, c === i ? keep : 0);
        }
      },
    },
    { id: 'sep2', type: 'separator' },
    {
      id: 'select',
      label: h.isSelected ? 'Deselect channel' : 'Select channel',
      icon: h.isSelected ? 'Square' : 'CheckSquare',
      onClick: () => h.toggleChannelSelection(i),
    },
    {
      id: 'pin',
      label: h.isPinned ? 'Unpin channel' : 'Pin channel',
      icon: h.isPinned ? 'PinOff' : 'Pin',
      onClick: () => h.togglePinChannel(i),
    },
    {
      id: 'tracker',
      label: 'Add to DMX Tracker',
      icon: 'Table',
      disabled: !h.onAddToTracker,
      onClick: () => h.onAddToTracker?.(),
    },
    {
      id: 'color',
      label: 'Random label color',
      icon: 'Palette',
      onClick: () => h.setRandomChannelColor(i),
    },
    { id: 'sep3', type: 'separator' },
    {
      id: 'midi-learn',
      label: h.isChannelLearning ? 'Cancel MIDI learn' : 'MIDI learn',
      icon: 'Radio',
      onClick: () => h.handleMidiLearn(i),
    },
    {
      id: 'midi-forget',
      label: 'MIDI forget',
      icon: 'Unplug',
      disabled: !h.hasMidiMapping,
      onClick: () => h.handleMidiForget(i),
    },
    {
      id: 'osc',
      label: 'Edit OSC address',
      icon: 'Activity',
      onClick: () => h.handleSetOscAddress(i),
    },
  ];
  return items;
}

export interface AppSurfaceMenuOptions {
  theme: 'artsnob' | 'standard' | 'minimal';
  darkMode: boolean;
  sparklesEnabled: boolean;
  setTheme: (t: 'artsnob' | 'standard' | 'minimal') => void;
  toggleDarkMode: () => void;
  toggleSparkles: () => void;
  setCurrentView?: (v: ViewType) => void;
}

export function buildAppContextMenu(o: AppSurfaceMenuOptions): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      id: 'sparkles',
      label: o.sparklesEnabled ? 'Disable sparkles' : 'Enable sparkles',
      icon: 'Sparkles',
      checked: o.sparklesEnabled,
      onClick: () => o.toggleSparkles(),
    },
    {
      id: 'dark',
      label: o.darkMode ? 'Light mode' : 'Dark mode',
      icon: o.darkMode ? 'Sun' : 'Moon',
      checked: o.darkMode,
      onClick: () => o.toggleDarkMode(),
    },
    {
      id: 'theme',
      label: `Theme: ${o.theme} (click to cycle)`,
      icon: 'Paintbrush',
      onClick: () => {
        const next =
          o.theme === 'artsnob' ? 'standard' : o.theme === 'standard' ? 'minimal' : 'artsnob';
        o.setTheme(next);
      },
    },
    { id: 'sep', type: 'separator' },
    {
      id: 'settings',
      label: 'Open settings',
      icon: 'Settings',
      onClick: () => o.setCurrentView?.('misc'),
    },
    {
      id: 'dmx',
      label: 'DMX control page',
      icon: 'SlidersHorizontal',
      onClick: () => o.setCurrentView?.('dmxControl'),
    },
    {
      id: 'fixtures',
      label: 'Fixture setup',
      icon: 'LampDesk',
      onClick: () => o.setCurrentView?.('fixture'),
    },
  ];
  return items;
}

export function buildFixtureContextMenu(
  fixture: { id: string; name: string },
  onRenameFixture: (fixtureId: string, newName: string) => void,
  toggleFixtureSelection: (id: string) => void,
  selectedFixtures: string[],
  setCurrentView?: (v: ViewType) => void
): ContextMenuItem[] {
  const isSelected = selectedFixtures.includes(fixture.id);
  return [
    {
      id: 'rename',
      label: 'Rename fixture',
      icon: 'Pencil',
      onClick: () => {
        const next = window.prompt('Fixture name', fixture.name);
        if (!next || !next.trim()) return;
        onRenameFixture(fixture.id, next.trim());
      },
    },
    {
      id: 'select',
      label: isSelected ? 'Deselect fixture' : 'Select fixture',
      icon: isSelected ? 'Square' : 'CheckSquare',
      onClick: () => toggleFixtureSelection(fixture.id),
    },
    {
      id: 'setup',
      label: 'Open fixture setup',
      icon: 'Wrench',
      onClick: () => setCurrentView?.('fixture'),
    },
  ];
}
