# Changelog

All notable changes to ArtBastard DMX512 will be documented in this file.

## [5.12.0] - 2024-01-XX

### Added
- **🎬 DAW-Style Timeline System Refactor** - Complete overhaul of the timeline experience
  - Keyframes now display actual DMX values (0-255) and percentages instead of meaningless "X ch" labels
  - Timeline ruler with time markers and scrubbing support (click/drag to jump/scrub)
  - Visual playhead indicator during playback
  - Timeline grid background for better alignment
  - Drag preview showing exact time position while dragging keyframes
  - Improved keyframe tooltips with actual DMX values and channel information
  - Modular timeline components: TimelineRuler, TimelinePlayhead, TimelineGrid, TimelineKeyframe, TimelineCurve, TimelineTrack
  - Timeline utilities and hooks: timelineHelpers, useTimelineZoom, useTimelineInteraction
- **🎹 Clip Launcher** - Session-style scene management for live performance
  - Grid-based clip launcher interface inspired by Ableton Live's Session View
  - Launch, stop, loop, and queue scenes with professional workflow
  - Customizable grid size (rows × columns)
  - Visual feedback for playing, queued, and recording clips
  - Integrated with existing scene system for DMX output
  - Clip launcher store (clipLauncherStore.ts) for state management
- **⌨️ Comprehensive Keyboard Shortcuts System**
  - DAW-style keyboard shortcuts for timeline control
  - Space: Play/Pause timeline
  - Home/End: Jump to start/end of timeline
  - Shift+Arrow: Nudge playhead/keyframes
  - Ctrl+C/V: Copy/Paste keyframes
  - Delete: Delete selected keyframes
  - Ctrl+Z/Y: Undo/Redo timeline changes
  - Keyboard shortcuts documentation utility (keyboardShortcuts.ts)
  - Keyboard shortcuts help component (KeyboardShortcutsHelp.tsx) - press `?` to view
- **🧪 Testing Infrastructure**
  - Complete test suite setup with Vitest and React Testing Library
  - Comprehensive tests for timeline helpers (34 tests, all passing)
  - Test setup file with mocks for localStorage and window.matchMedia
  - CI/CD ready test infrastructure
- **Complete Theme System Overhaul**: Full color and appearance control
  - Background brightness control (5% - 50%) - Fixes "too dark" issue
  - Background color customization (hue, saturation, brightness)
  - Hue rotation feature (-180° to +180°) - Rotate entire color palette
  - 5 preset themes: Ocean Blue, Warm Orange, Forest Green, Purple Dream, Brighter Default
  - Real-time preview with Save/Reset buttons
  - Typography controls: font size, line height, letter spacing
  - Spacing controls: border radius, general spacing, animation speed
- **Individual Fixture Files**: Each fixture now saves to its own JSON file (`data/fixtures/{id}.json`)
  - Better version control support
  - Easier fixture management
  - Automatic migration from old format
- **Fixture Template Persistence**: Custom fixture templates now save to `data/fixture-templates.json` for Git commits
- **Delete Fixture Functionality**: Added proper fixture deletion with server sync
- **Official Website**: New website with ArtBastard aesthetic, auto-deployed via GitHub Actions
- **Testing Infrastructure**: Complete test setup with Vitest
  - Store tests for DMX channels, fixtures, theme colors
  - Version utility tests
  - Component test examples
  - CI/CD integration with GitHub Actions
  - Coverage reporting
- **Enhanced Node Editor**: Improved fixture node editor experience
  - Solid dark background for better visibility
  - Smooth node dragging with global mouse events
  - Better visual feedback during drag operations
- **Network Interface Detection**: Smart DMX interface detection
  - Automatic detection of network interfaces
  - Ping test for 192.168.1.199 connectivity
  - USB Ethernet adapter identification
- **Face Tracking Warning**: Clear "Under Construction" labeling for broken Linux face tracking

### Fixed
- Fixed undefined `channels` error in FixtureTemplateManager
- Added defensive checks for template validation
- Improved error handling for fixture template loading
- Removed defunct Web Port setting (doesn't reflect actual port)
- Removed unnecessary settings: Compact Mode, Hardware Acceleration, FPS Counter
- Removed localStorage export/import (now fully global via server)
- Removed Auto-Save toggle (always auto-saves globally)
- Removed sACN protocol option (Art-Net only)

### Changed
- Fixture storage format: Individual files instead of single `fixtures.json`
- Template storage: Server-side file persistence in addition to localStorage
- Theme system: Complete rework with background controls and hue rotation
- State management: Fully global - all state synced via server, no local browser storage
- Default background brightness: Increased from 15% to 25% (less dark)
- TouchOSC: Clearly labeled as broken/non-functional
- DMX Interface: Now shows actual detected interfaces with ping testing

### Technical
- Updated API endpoints for individual fixture operations
- Added migration system for old fixture format
- Improved store initialization with better error handling
- Added network interface detection API endpoint
- Enhanced theme color system with CSS custom properties
- Added test infrastructure with Vitest and testing-library
- Improved node editor dragging performance

---

## Previous Versions

See [DOCS/HISTORY.md](DOCS/HISTORY.md) for earlier version history.

