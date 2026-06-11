# ArtBastard Architecture Documentation

## Overview

ArtBastard is a professional DMX512 lighting control application built with React, TypeScript, and Node.js. This document outlines the system architecture, design patterns, and key components.

## System Architecture

### Frontend (React App)

**Location:** `react-app/src/`

**Technology Stack:**
- React 18+ with TypeScript
- Zustand for state management
- SCSS Modules for styling
- React Router for navigation
- Socket.io for real-time communication

**Key Directories:**
- `components/` - React components
- `store/` - Zustand state management
- `hooks/` - Custom React hooks
- `utils/` - Utility functions
- `context/` - React context providers

### Backend (Node.js/Express)

**Location:** `src/`

**Technology Stack:**
- Node.js with TypeScript
- Express.js for HTTP server
- Socket.io for WebSocket communication
- dmxnet for Art-Net protocol
- osc for OSC protocol
- easymidi for MIDI support

## State Management

### Zustand Store Architecture

The application uses Zustand for state management, organized into modular slices:

#### Store Slices

1. **dmxSlice** (`store/slices/dmxSlice.ts`)
   - DMX channel values (512 channels)
   - Channel configuration (names, ranges, colors)
   - Scene transitions
   - Channel selection and pinning

2. **fixtureSlice** (`store/slices/fixtureSlice.ts`)
   - Fixture definitions and templates
   - Fixture groups
   - Placed fixtures on canvas
   - Fixture flagging system

3. **sceneSlice** (`store/slices/sceneSlice.ts`)
   - Scene management (save, load, delete)
   - Act management
   - Timeline playback state
   - Scene transitions

4. **midiSlice** (`store/slices/midiSlice.ts`)
   - MIDI interface management
   - MIDI mappings
   - MIDI learn functionality
   - MIDI message processing

5. **oscSlice** (`store/slices/oscSlice.ts`)
   - OSC configuration
   - OSC message handling
   - OSC activity tracking

6. **uiSlice** (`store/slices/uiSlice.ts`)
   - UI state (navigation, themes, notifications)
   - UI settings and preferences
   - Theme customization

7. **automationSlice** (`store/slices/automationSlice.ts`)
   - Autopilot configurations
   - Modular automation (color, dimmer, pan/tilt, effects)
   - Envelope automation
   - Animation control

8. **universeSlice** (`store/slices/universeSlice.ts`)
   - Multi-universe support
   - Universe configuration
   - DMX data per universe

#### Store Integration

All slices are combined in the main store (`store/store.ts`) using Zustand's `combine` pattern:

```typescript
export const useStore = create<State>()(
  devtools(
    combine(
      createDmxSlice,
      createFixtureSlice,
      createSceneSlice,
      // ... other slices
    )
  )
);
```

## Component Architecture

### Component Organization

Components are organized by feature/domain:

- `components/dmx/` - DMX channel controls
- `components/scenes/` - Scene management
- `components/fixtures/` - Fixture setup and control
- `components/midi/` - MIDI configuration
- `components/osc/` - OSC configuration
- `components/timeline/` - Timeline components
- `components/ui/` - Reusable UI components

### Performance Optimization

- **React.memo** for frequently rendered components
- **useMemo/useCallback** for expensive computations
- **Lazy loading** for large components
- **Code splitting** at route level

## Data Flow

### DMX Update Flow

1. User interaction (slider, button, etc.)
2. Component calls `setDmxChannel()` from store
3. Store updates local state
4. Store sends HTTP POST to `/api/dmx` or `/api/dmx/batch`
5. Backend receives update and sends via Art-Net
6. Socket.io broadcasts update to all clients
7. All clients update their local state

### Scene Management Flow

1. User creates/modifies scene
2. Scene data saved to Zustand store
3. Store persists to localStorage
4. Store sends to backend via `/api/scenes`
5. Backend saves to `data/scenes.json`
6. Scene available across all sessions

## API Endpoints

### DMX Endpoints
- `POST /api/dmx` - Update single DMX channel
- `POST /api/dmx/batch` - Update multiple DMX channels
- `GET /api/dmx` - Get current DMX state

### Scene Endpoints
- `GET /api/scenes` - List all scenes
- `POST /api/scenes` - Create/update scene
- `DELETE /api/scenes/:name` - Delete scene

### Fixture Endpoints
- `GET /api/fixtures` - List all fixtures
- `POST /api/fixtures/:id` - Create/update fixture
- `DELETE /api/fixtures/:id` - Delete fixture

## Real-Time Communication

### Socket.io Events

**Client → Server:**
- `dmx:update` - DMX channel update
- `scene:load` - Load scene
- `midi:message` - MIDI message received

**Server → Client:**
- `dmx:update` - DMX channel update broadcast
- `artnetStatus` - Art-Net connection status
- `osc:message` - OSC message received

## Timeline System

The timeline system provides DAW-like functionality for scene and act automation:

### Key Components

- `SceneTimelineEditor` - Main timeline editor for scenes
- `TimelineActEditor` - Timeline editor for acts
- `TimelineRuler` - Time ruler with scrubbing
- `TimelinePlayhead` - Playback indicator
- `TimelineGrid` - Grid overlay
- `TimelineKeyframe` - Keyframe markers
- `TimelineCurve` - Value curve visualization

### Timeline Features

- Keyframe-based animation
- Multiple easing types (linear, smooth, step, bezier)
- Waveform generation (sine, saw, triangle, square)
- BPM synchronization
- Multi-channel editing
- Fullscreen mode
- Zoom and pan
- Track height adjustment

## Automation Systems

### Autopilot System

Automated channel value generation:
- Sine, triangle, sawtooth, ping-pong patterns
- BPM synchronization
- Per-channel configuration
- Pan/tilt path automation

### Modular Automation

Type-specific automation:
- **Color**: Rainbow, pulse, strobe, cycle
- **Dimmer**: Pulse, breathe, strobe, ramp
- **Pan/Tilt**: Circle, figure-8, square, triangle paths
- **Effects**: Gobo cycle, prism rotate, iris breathe

### Envelope Automation

Channel-specific envelope generators:
- Waveform types: sine, saw, square, triangle, custom
- Tempo synchronization
- Individual speed control
- Amplitude and offset

## Error Handling

### Error Boundaries

- `ErrorBoundary` - Basic error boundary
- `ErrorBoundaryWithRetry` - Enhanced with retry logic

### Error Utilities

- `errorHandler.ts` - Centralized error handling
- User-friendly error messages
- Retry with exponential backoff
- Error logging and tracking

## Performance Optimization

### DMX Update Optimization

- `dmxOptimizer.ts` - RequestAnimationFrame throttling
- Change detection (only send significant changes)
- Batch updates
- Configurable update rates

### Rendering Optimization

- `performanceOptimizer.ts` - React optimization utilities
- Component memoization
- Debounce/throttle hooks
- Performance monitoring

## Security

### Input Validation

- `inputValidation.ts` - Comprehensive validation
- DMX value validation (0-255)
- OSC address validation
- IP address validation
- File upload validation
- Rate limiting

## Monitoring & Analytics

### Monitoring Service

- `monitoring.ts` - Performance and error tracking
- DMX traffic analytics
- Usage analytics
- Performance metrics

## Multi-Universe Support

### Universe Management

- Universe configuration (universe, subnet, net)
- Per-universe DMX data (512 channels each)
- Universe selection UI
- Art-Net multi-universe support

## Accessibility

### Accessibility Utilities

- `accessibility.ts` - ARIA label generation
- Keyboard navigation helpers
- Focus management
- Screen reader announcements
- High contrast and reduced motion detection

## Testing

### Test Infrastructure

- Vitest for unit testing
- React Testing Library for component testing
- Test utilities in `__tests__/` directories

## Build & Deployment

### Build Process

1. TypeScript compilation
2. React app build (Vite)
3. Backend compilation
4. Asset optimization

### CI/CD

GitHub Actions workflow:
- Automated testing
- Linting and type checking
- Build verification
- Code quality checks

## Future Improvements

See the plan file for comprehensive list of planned improvements and features.

