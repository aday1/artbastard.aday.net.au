export interface DmxActivityMessage {
  id: string;
  timestamp: number;
  firstTimestamp: number;
  channel: number;
  channelLabel?: string;
  kind?: 'dmx' | 'event';
  value: number;
  previousValue: number;
  summary: string;
  detail: string;
  roleLabel: string;
  fixtureName?: string;
  repeatCount: number;
}

const REPEATED_CHANGE_WINDOW_MS = 5000;

function messageKey(message: DmxActivityMessage): string {
  return [
    message.kind || 'dmx',
    message.channel,
    message.channelLabel || '',
    message.fixtureName || '',
    message.roleLabel,
  ].join(':');
}

export function mergeDmxActivityMessages(
  existingMessages: DmxActivityMessage[],
  incomingMessages: DmxActivityMessage[],
  maxMessages = 1000
): DmxActivityMessage[] {
  if (incomingMessages.length === 0) return existingMessages;

  const nextMessages = [...existingMessages];

  incomingMessages.forEach(incoming => {
    const incomingKey = messageKey(incoming);
    let existingIndex = -1;
    for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
      const candidate = nextMessages[index];
      if (
        messageKey(candidate) === incomingKey &&
        incoming.timestamp - candidate.timestamp <= REPEATED_CHANGE_WINDOW_MS
      ) {
        existingIndex = index;
        break;
      }
    }

    if (existingIndex === -1) {
      nextMessages.push(incoming);
      return;
    }

    const existing = nextMessages[existingIndex];
    nextMessages[existingIndex] = {
      ...existing,
      timestamp: incoming.timestamp,
      value: incoming.value,
      summary: incoming.summary,
      detail: incoming.detail,
      repeatCount: existing.repeatCount + 1,
    };
  });

  return nextMessages.slice(-maxMessages);
}
