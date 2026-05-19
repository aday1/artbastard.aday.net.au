import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnifiedSettings } from './UnifiedSettings'
import { useStore } from '../../store'

// Mock the store
vi.mock('../../store', () => ({
  useStore: vi.fn()
}))

// Mock other dependencies
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'standard',
    setTheme: vi.fn(),
    darkMode: true,
    toggleDarkMode: vi.fn()
  })
}))

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    connected: false
  })
}))

vi.mock('../../context/ChromaticEnergyManipulatorContext', () => ({
  useChromaticEnergyManipulatorSettings: () => ({
    settings: {},
    updateSettings: vi.fn()
  })
}))

describe('UnifiedSettings', () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue({
      artNetConfig: {},
      fixtures: [],
      masterSliders: [],
      midiMappings: [],
      navVisibility: {},
      debugTools: {},
      themeColors: {
        primaryHue: 220,
        primarySaturation: 70,
        primaryBrightness: 50,
        secondaryHue: 280,
        secondarySaturation: 60,
        secondaryBrightness: 45,
        accentHue: 340,
        accentSaturation: 80,
        accentBrightness: 60,
        backgroundBrightness: 25,
        backgroundHue: 220,
        backgroundSaturation: 20,
        hueRotation: 0
      },
      updateThemeColors: vi.fn(),
      uiSettings: {},
      updateUiSettings: vi.fn(),
      setDmxVisualEffects: vi.fn(),
      addNotification: vi.fn()
    } as any)
  })

  it('should render settings panel', () => {
    render(<UnifiedSettings />)
    // Check for main settings container
    expect(screen.getByText(/Configuration|Settings/i)).toBeDefined()
  })
})

