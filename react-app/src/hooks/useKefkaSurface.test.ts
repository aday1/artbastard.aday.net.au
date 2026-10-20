import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'react-toastify'
import { useKefkaSurface } from './useKefkaSurface'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }))
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.mocked(toast.error).mockClear()
})
afterEach(() => vi.unstubAllGlobals())

async function setup(enabled: boolean) {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ enabled }) })
  const hook = renderHook(() => useKefkaSurface('deck'))
  await act(async () => { await Promise.resolve() })
  expect(fetchMock).toHaveBeenCalledWith('/api/kefka/surfaces', expect.objectContaining({
    cache: 'no-store', signal: expect.any(AbortSignal),
  }))
  return hook.result
}

function click(options: MouseEventInit = {}) {
  return new MouseEvent('click', { button: 0, cancelable: true, ...options })
}
function dispatch(handler: ReturnType<typeof useKefkaSurface>, event: MouseEvent) {
  handler(event as unknown as ReactMouseEvent<HTMLAnchorElement>)
}

describe('useKefkaSurface', () => {
  it('uses the fixed Deck launcher endpoint and prevents navigation when enabled', async () => {
    const result = await setup(true)
    fetchMock.mockResolvedValueOnce({ ok: true })
    const event = click()
    await act(async () => dispatch(result.current, event))
    expect(event.defaultPrevented).toBe(true)
    expect(fetchMock.mock.calls.slice(1)).toEqual([
      ['/api/kefka/surfaces/deck', { method: 'POST' }],
    ])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('preserves the link’s normal named-target navigation when unavailable', async () => {
    const result = await setup(false)
    const link = document.createElement('a')
    link.href = '/deck-control.html'
    link.target = 'artbastard-deck'
    const event = click()
    Object.defineProperty(event, 'currentTarget', { value: link })
    dispatch(result.current, event)
    expect(event.defaultPrevented).toBe(false)
    expect(link.getAttribute('href')).toBe('/deck-control.html')
    expect(link.target).toBe('artbastard-deck')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['HTTP error', 'network error'])('shows a toast after a failed launch: %s', async failure => {
    const result = await setup(true)
    if (failure === 'HTTP error') fetchMock.mockResolvedValueOnce({ ok: false })
    else fetchMock.mockRejectedValueOnce(new Error('Connection lost'))
    const event = click()
    await act(async () => dispatch(result.current, event))
    expect(event.defaultPrevented).toBe(true)
    expect(toast.error).toHaveBeenCalledWith(
      'Could not open Deck Controls. Try the ArtBastard Deck launcher.',
    )
  })

  it('preserves modified-click navigation even when the launcher is enabled', async () => {
    const result = await setup(true)
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const event = click(options)
      dispatch(result.current, event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
