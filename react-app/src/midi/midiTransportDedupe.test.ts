import { beforeEach, describe, expect, it } from 'vitest'
import {
  isLikelyDuplicateServerMidiMessage,
  recordBrowserMidiMessage,
  resetMidiTransportDedupeForTests,
} from './midiTransportDedupe'

describe('midiTransportDedupe', () => {
  beforeEach(() => {
    resetMidiTransportDedupeForTests()
  })

  it('detects matching backend echoes shortly after browser MIDI input', () => {
    recordBrowserMidiMessage({ _type: 'cc', channel: 0, controller: 48, value: 96 }, 1000)

    expect(
      isLikelyDuplicateServerMidiMessage({ type: 'cc', channel: 0, controller: 48, value: 96 }, 1060)
    ).toBe(true)
  })

  it('does not suppress changed values or older server messages', () => {
    recordBrowserMidiMessage({ _type: 'noteon', channel: 0, note: 53, velocity: 127 }, 1000)

    expect(
      isLikelyDuplicateServerMidiMessage({ type: 'noteon', channel: 0, note: 53, velocity: 64 }, 1030)
    ).toBe(false)
    expect(
      isLikelyDuplicateServerMidiMessage({ type: 'noteon', channel: 0, note: 53, velocity: 127 }, 1100)
    ).toBe(false)
  })
})
