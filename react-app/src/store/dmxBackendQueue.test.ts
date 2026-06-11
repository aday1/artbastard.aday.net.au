import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  enqueueDmxBackendChannel,
  enqueueDmxBackendUpdates,
  resetDmxBackendQueueForTests,
} from './dmxBackendQueue'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ status: 200 })),
  },
}))

describe('dmxBackendQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetDmxBackendQueueForTests()
  })

  afterEach(() => {
    resetDmxBackendQueueForTests()
    vi.useRealTimers()
  })

  it('coalesces rapid DMX writes into a last-write-wins batch', async () => {
    const post = vi.mocked(axios.post)

    enqueueDmxBackendChannel(1, 10)
    enqueueDmxBackendChannel(1, 50)
    enqueueDmxBackendUpdates({ 2: 300, 3: -10 })

    expect(post).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(33)

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/dmx/batch', {
      1: 50,
      2: 255,
      3: 0,
    })
  })

  it('sends only the latest pending values after a slow backend response', async () => {
    const post = vi.mocked(axios.post)
    let resolveFirstRequest: (value: { status: number }) => void = () => {}
    post
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveFirstRequest = resolve
      }))
      .mockResolvedValue({ status: 200 })

    enqueueDmxBackendChannel(4, 10)
    await vi.advanceTimersByTimeAsync(33)

    expect(post).toHaveBeenCalledTimes(1)

    enqueueDmxBackendChannel(4, 64)
    enqueueDmxBackendChannel(4, 127)
    await vi.advanceTimersByTimeAsync(33)

    expect(post).toHaveBeenCalledTimes(1)

    resolveFirstRequest({ status: 200 })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenLastCalledWith('/api/dmx/batch', { 4: 127 })
  })
})
