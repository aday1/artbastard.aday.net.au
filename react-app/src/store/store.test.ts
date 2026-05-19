import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'

describe('Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStore.setState({
      dmxChannels: new Array(512).fill(0),
      fixtures: [],
      masterSliders: [],
      midiMappings: [],
      groups: [],
      scenes: [],
      acts: []
    })
  })

  describe('DMX Channels', () => {
    it('should initialize with 512 channels at 0', () => {
      const state = useStore.getState()
      expect(state.dmxChannels).toHaveLength(512)
      expect(state.dmxChannels.every(ch => ch === 0)).toBe(true)
    })

    it('should set a DMX channel value', () => {
      useStore.getState().setDmxChannel(1, 255)
      const state = useStore.getState()
      expect(state.dmxChannels[0]).toBe(255)
    })

    it('should clamp DMX values to 0-255', () => {
      useStore.getState().setDmxChannel(1, 300)
      expect(useStore.getState().dmxChannels[0]).toBe(255)
      
      useStore.getState().setDmxChannel(1, -10)
      expect(useStore.getState().dmxChannels[0]).toBe(0)
    })
  })

  describe('Fixtures', () => {
    it('should add a fixture', () => {
      const fixture = {
        id: 'test-fixture-1',
        name: 'Test Fixture',
        startAddress: 1,
        channels: [
          { name: 'Dimmer', type: 'dimmer', dmxAddress: 1 }
        ]
      }

      useStore.getState().addFixture(fixture)
      const state = useStore.getState()
      expect(state.fixtures).toHaveLength(1)
      expect(state.fixtures[0].name).toBe('Test Fixture')
    })

    it('should delete a fixture', () => {
      const fixture = {
        id: 'test-fixture-1',
        name: 'Test Fixture',
        startAddress: 1,
        channels: []
      }

      useStore.getState().addFixture(fixture)
      expect(useStore.getState().fixtures).toHaveLength(1)
      
      useStore.getState().deleteFixture('test-fixture-1')
      expect(useStore.getState().fixtures).toHaveLength(0)
    })
  })

  describe('Theme Colors', () => {
    it('should initialize with default theme colors', () => {
      const state = useStore.getState()
      expect(state.themeColors.primaryHue).toBe(220)
      expect(state.themeColors.backgroundBrightness).toBe(25)
    })

    it('should update theme colors', () => {
      useStore.getState().updateThemeColors({
        primaryHue: 120,
        backgroundBrightness: 40
      })
      
      const state = useStore.getState()
      expect(state.themeColors.primaryHue).toBe(120)
      expect(state.themeColors.backgroundBrightness).toBe(40)
    })
  })
})

