import { isApc40Source, type MidiLikeMessage } from './apc40';

// Generic Mode sends the whole Device bank on Track Select, with no button
// event. The captured MK1 frame took 4 ms. Only the complete ordered 16..23
// signature within 20 ms is discarded; ordinary/incomplete gestures pass.
const SNAPSHOT_WINDOW_MS = 20;

export function createApc40InputGate(deliver: (message: MidiLikeMessage) => void) {
  let pending: MidiLikeMessage[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startedAt = 0;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const messages = pending;
    pending = [];
    return messages;
  };
  const flush = () => clear().forEach(deliver);
  const isDeviceCc = (message: MidiLikeMessage) => {
    const type = message.type || message._type;
    return isApc40Source(message.source)
      && !/\b(mk2|mkii|mk\s?ii|apc40ii)\b/i.test(message.source || '')
      && (type === 'cc' || type === 'controlchange')
      && typeof message.controller === 'number'
      && message.controller >= 16 && message.controller <= 23;
  };

  return {
    push(message: MidiLikeMessage) {
      const now = Date.now();
      const deviceCc = isDeviceCc(message);
      if (pending.length > 0) {
        const first = pending[0];
        const expected = deviceCc
          && message.source === first.source
          && (message.channel ?? 0) === (first.channel ?? 0)
          && message.controller === 16 + pending.length
          && now - startedAt <= SNAPSHOT_WINDOW_MS;
        if (expected) {
          pending.push(message);
          if (pending.length === 8) clear();
          return;
        }
        // In particular, faders and button events are never delayed.
        flush();
      }
      if (deviceCc && message.controller === 16) {
        pending = [message];
        startedAt = now;
        timer = setTimeout(flush, SNAPSHOT_WINDOW_MS);
      } else {
        deliver(message);
      }
    },
    dispose() { clear(); },
  };
}
