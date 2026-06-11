import axios from 'axios'
import { debugLog } from '../utils/debugLog'

export type DmxBackendBatch = Record<number, number>

type DmxBackendErrorHandler = (error: unknown, batch: DmxBackendBatch) => void

const DMX_BACKEND_FLUSH_MS = 33
const MAX_DMX_CHANNELS = 512

let pendingUpdates: DmxBackendBatch = {}
let flushTimer: ReturnType<typeof setTimeout> | null = null
let requestInFlight = false
let pendingErrorHandler: DmxBackendErrorHandler | undefined

const normalizeDmxBatch = (updates: DmxBackendBatch): DmxBackendBatch => {
  const normalized: DmxBackendBatch = {}

  for (const [channelKey, rawValue] of Object.entries(updates)) {
    const channel = Number(channelKey)
    const value = Number(rawValue)

    if (!Number.isInteger(channel) || channel < 0 || channel >= MAX_DMX_CHANNELS || !Number.isFinite(value)) {
      continue
    }

    normalized[channel] = Math.max(0, Math.min(255, Math.round(value)))
  }

  return normalized
}

const scheduleFlush = (delay = DMX_BACKEND_FLUSH_MS) => {
  if (flushTimer !== null) return
  flushTimer = setTimeout(flushDmxBackendQueue, delay)
}

const flushDmxBackendQueue = () => {
  flushTimer = null

  if (requestInFlight) return
  if (Object.keys(pendingUpdates).length === 0) return

  const batch = pendingUpdates
  const onError = pendingErrorHandler
  pendingUpdates = {}
  pendingErrorHandler = undefined
  requestInFlight = true

  debugLog.log('[DMX Queue] Sending coalesced DMX batch to backend:', batch)

  axios.post('/api/dmx/batch', batch)
    .then(response => {
      debugLog.log('[DMX Queue] DMX batch API call successful. Response status:', response.status)
    })
    .catch(error => {
      console.error('[DMX Queue] Failed to update DMX backend batch:', error)
      onError?.(error, batch)
    })
    .finally(() => {
      requestInFlight = false
      if (Object.keys(pendingUpdates).length > 0) {
        scheduleFlush(0)
      }
    })
}

export const enqueueDmxBackendUpdates = (
  updates: DmxBackendBatch,
  onError?: DmxBackendErrorHandler
) => {
  const normalizedUpdates = normalizeDmxBatch(updates)
  if (Object.keys(normalizedUpdates).length === 0) return

  pendingUpdates = {
    ...pendingUpdates,
    ...normalizedUpdates,
  }

  if (onError) {
    pendingErrorHandler = onError
  }

  scheduleFlush()
}

export const enqueueDmxBackendChannel = (
  channel: number,
  value: number,
  onError?: DmxBackendErrorHandler
) => {
  enqueueDmxBackendUpdates({ [channel]: value }, onError)
}

export const resetDmxBackendQueueForTests = () => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
  }
  pendingUpdates = {}
  flushTimer = null
  requestInFlight = false
  pendingErrorHandler = undefined
}
