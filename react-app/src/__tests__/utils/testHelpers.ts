/**
 * Test Utilities and Helpers
 * Provides common utilities for testing React components, hooks, and store slices
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi, expect } from 'vitest';

/**
 * Custom render function with providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add any global providers here (ThemeProvider, StoreProvider, etc.)
  return render(ui, { ...options });
}

/**
 * Mock store state helper
 */
export function createMockStoreState(overrides: Record<string, any> = {}) {
  return {
    dmxChannels: new Array(512).fill(0),
    fixtures: [],
    groups: [],
    scenes: [],
    bpm: 120,
    isPlaying: false,
    ...overrides
  };
}

/**
 * Wait for async updates
 */
export async function waitForAsync() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Mock DMX channel update
 */
export function createMockDmxUpdate(channel: number, value: number) {
  return {
    channel,
    value,
    timestamp: Date.now()
  };
}

/**
 * Mock fixture
 */
export function createMockFixture(overrides: Partial<any> = {}) {
  return {
    id: `fixture-${Date.now()}`,
    name: 'Test Fixture',
    type: 'RGB Wash',
    startAddress: 1,
    channels: [
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
      { name: 'Blue', type: 'blue' }
    ],
    ...overrides
  };
}

/**
 * Mock scene
 */
export function createMockScene(overrides: Partial<any> = {}) {
  return {
    name: 'Test Scene',
    channelValues: new Array(512).fill(0),
    oscAddress: '/scene/test',
    ...overrides
  };
}

/**
 * Mock MIDI message
 */
export function createMockMidiMessage(overrides: Partial<any> = {}) {
  return {
    channel: 1,
    note: 60,
    velocity: 127,
    ...overrides
  };
}

/**
 * Mock OSC message
 */
export function createMockOscMessage(overrides: Partial<any> = {}) {
  return {
    address: '/test',
    args: [{ type: 'f', value: 0.5 }],
    timestamp: Date.now(),
    ...overrides
  };
}

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };
  global.localStorage = localStorageMock as any;

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });

  // Mock performance API
  if (typeof performance === 'undefined') {
    (global as any).performance = {
      now: () => Date.now(),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => [])
    };
  }
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment() {
  vi.clearAllMocks();
}

/**
 * Assert DMX value is valid
 */
export function assertValidDmxValue(value: number) {
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThanOrEqual(255);
  expect(Number.isInteger(value)).toBe(true);
}

/**
 * Assert channel index is valid
 */
export function assertValidChannelIndex(index: number) {
  expect(index).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThanOrEqual(511);
  expect(Number.isInteger(index)).toBe(true);
}

/**
 * Create test timer helpers
 */
export function createTestTimers() {
  return {
    advanceTime: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
    useFakeTimers: () => {
      vi.useFakeTimers();
    },
    useRealTimers: () => {
      vi.useRealTimers();
    }
  };
}

