/**
 * Keyboard Shortcuts Registry
 * Centralized registry of all keyboard shortcuts in the application
 */

import { KeyboardShortcut } from '../components/ui/KeyboardShortcutsOverlay';

export const keyboardShortcuts: KeyboardShortcut[] = [
  // Timeline Shortcuts
  {
    id: 'timeline-play-pause',
    keys: ['Space'],
    description: 'Play/Pause timeline',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-stop',
    keys: ['Escape'],
    description: 'Stop timeline playback',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-add-keyframe',
    keys: ['K'],
    description: 'Add keyframe at playhead',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-fullscreen',
    keys: ['F11'],
    description: 'Toggle fullscreen',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-zoom-in',
    keys: ['Control', '+'],
    description: 'Zoom in',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-zoom-out',
    keys: ['Control', '-'],
    description: 'Zoom out',
    category: 'Timeline',
    context: 'Timeline Editor'
  },
  {
    id: 'timeline-zoom-reset',
    keys: ['Control', '0'],
    description: 'Reset zoom',
    category: 'Timeline',
    context: 'Timeline Editor'
  },

  // DMX Control Shortcuts
  {
    id: 'dmx-blackout',
    keys: ['B'],
    description: 'Toggle blackout',
    category: 'DMX Control'
  },
  {
    id: 'dmx-select-all',
    keys: ['Control', 'A'],
    description: 'Select all channels',
    category: 'DMX Control',
    context: 'DMX Grid'
  },
  {
    id: 'dmx-deselect-all',
    keys: ['Escape'],
    description: 'Deselect all channels',
    category: 'DMX Control',
    context: 'DMX Grid'
  },

  // Scene Shortcuts
  {
    id: 'scene-save',
    keys: ['Control', 'S'],
    description: 'Save current scene',
    category: 'Scenes'
  },
  {
    id: 'scene-load',
    keys: ['Control', 'O'],
    description: 'Load scene',
    category: 'Scenes'
  },
  {
    id: 'scene-new',
    keys: ['Control', 'N'],
    description: 'Create new scene',
    category: 'Scenes'
  },

  // Navigation Shortcuts
  {
    id: 'nav-dmx',
    keys: ['1'],
    description: 'Navigate to DMX Control',
    category: 'Navigation'
  },
  {
    id: 'nav-scenes',
    keys: ['2'],
    description: 'Navigate to Scenes',
    category: 'Navigation'
  },
  {
    id: 'nav-fixtures',
    keys: ['3'],
    description: 'Navigate to Fixtures',
    category: 'Navigation'
  },
  {
    id: 'nav-midi-osc',
    keys: ['4'],
    description: 'Navigate to MIDI/OSC',
    category: 'Navigation'
  },

  // General Shortcuts
  {
    id: 'shortcuts-overlay',
    keys: ['?'],
    description: 'Show keyboard shortcuts',
    category: 'General'
  },
  {
    id: 'undo',
    keys: ['Control', 'Z'],
    description: 'Undo',
    category: 'General'
  },
  {
    id: 'redo',
    keys: ['Control', 'Shift', 'Z'],
    description: 'Redo',
    category: 'General'
  },
  {
    id: 'copy',
    keys: ['Control', 'C'],
    description: 'Copy',
    category: 'General'
  },
  {
    id: 'paste',
    keys: ['Control', 'V'],
    description: 'Paste',
    category: 'General'
  },
  {
    id: 'cut',
    keys: ['Control', 'X'],
    description: 'Cut',
    category: 'General'
  },

  // Automation Shortcuts
  {
    id: 'automation-toggle',
    keys: ['A'],
    description: 'Toggle automation',
    category: 'Automation'
  },
  {
    id: 'autopilot-toggle',
    keys: ['P'],
    description: 'Toggle autopilot',
    category: 'Automation'
  }
];

// Convenience export of all shortcuts for consumers that expect ALL_SHORTCUTS
export const ALL_SHORTCUTS = keyboardShortcuts;

// Re-export the KeyboardShortcut type so other modules can import it from here
export type { KeyboardShortcut };

// Format a shortcut's keys as a human-readable string, e.g. "Ctrl + S"
export function formatShortcut(shortcut: KeyboardShortcut): string {
  return shortcut.keys.join(' + ');
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(category: string): KeyboardShortcut[] {
  return keyboardShortcuts.filter(s => s.category === category);
}

/**
 * Get shortcuts by context
 */
export function getShortcutsByContext(context: string): KeyboardShortcut[] {
  return keyboardShortcuts.filter(s => s.context === context);
}

/**
 * Search shortcuts
 */
export function searchShortcuts(query: string): KeyboardShortcut[] {
  const lowerQuery = query.toLowerCase();
  return keyboardShortcuts.filter(s =>
    s.description.toLowerCase().includes(lowerQuery) ||
    s.keys.some(k => k.toLowerCase().includes(lowerQuery)) ||
    s.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  return Array.from(new Set(keyboardShortcuts.map(s => s.category))).sort();
}
