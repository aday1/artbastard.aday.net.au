import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useStore } from './store'
import { resetDmxBackendQueueForTests } from './dmxBackendQueue'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ status: 200 })),
  },
}))

describe('OSC activity from the server', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetDmxBackendQueueForTests()
    useStore.setState({
      dmxChannels: new Array(512).fill(0),
      oscActivity: {},
    })
  })

  afterEach(() => {
    resetDmxBackendQueueForTests()
    vi.useRealTimers()
  })

  it('records activity without resending or replacing the authoritative DMX update', async () => {
    // The normal dmxUpdate listener passes false to suppress backend writes.
    // A channel range can make this authoritative value differ from value*255.
    useStore.getState().setDmxChannel(0, 64, false)
    useStore.getState().reportOscActivity(0, 0.5)
    // Both SocketContext and OscDmxProcessor may observe the same activity.
    useStore.getState().reportOscActivity(0, 0.5)
    await vi.advanceTimersByTimeAsync(100)

    expect(useStore.getState().oscActivity[0].value).toBe(0.5)
    expect(useStore.getState().dmxChannels[0]).toBe(64)
    expect(axios.post).not.toHaveBeenCalled()
  })
})
