type MidiTransportMessage = {
  type?: string
  _type?: string
  channel?: number
  controller?: number
  note?: number
  value?: number
  velocity?: number
}

const DUPLICATE_WINDOW_MS = 80
const recentBrowserMessages = new Map<string, number>()

const pruneOldBrowserMessages = (now: number) => {
  for (const [signature, timestamp] of recentBrowserMessages.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentBrowserMessages.delete(signature)
    }
  }
}

const midiSignature = (message: MidiTransportMessage): string | null => {
  const type = message.type || message._type
  if (!type || typeof message.channel !== 'number') return null

  if (type === 'cc' && typeof message.controller === 'number' && typeof message.value === 'number') {
    return `cc:${message.channel}:${message.controller}:${message.value}`
  }

  if ((type === 'noteon' || type === 'noteoff') && typeof message.note === 'number') {
    const velocity = typeof message.velocity === 'number' ? message.velocity : 0
    return `${type}:${message.channel}:${message.note}:${velocity}`
  }

  if (type === 'pitch' && typeof message.value === 'number') {
    return `pitch:${message.channel}:${message.value}`
  }

  return null
}

export const recordBrowserMidiMessage = (message: MidiTransportMessage, now = Date.now()) => {
  const signature = midiSignature(message)
  if (!signature) return

  pruneOldBrowserMessages(now)
  recentBrowserMessages.set(signature, now)
}

export const isLikelyDuplicateServerMidiMessage = (
  message: MidiTransportMessage,
  now = Date.now()
): boolean => {
  const signature = midiSignature(message)
  if (!signature) return false

  pruneOldBrowserMessages(now)
  const browserTimestamp = recentBrowserMessages.get(signature)
  return browserTimestamp !== undefined && now - browserTimestamp <= DUPLICATE_WINDOW_MS
}

export const resetMidiTransportDedupeForTests = () => {
  recentBrowserMessages.clear()
}
