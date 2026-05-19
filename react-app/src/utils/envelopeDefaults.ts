import type { ChannelEnvelope, EnvelopeLoopDirection, EnvelopePoint, EnvelopeRepeatMode, WaveformType } from '../store/types';

export const DEFAULT_ENVELOPE_POINTS: EnvelopePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export function defaultEnvelopeDraft(channel = 0): Omit<ChannelEnvelope, 'id'> {
  return {
    channel,
    enabled: true,
    waveform: 'sine',
    customPoints: [...DEFAULT_ENVELOPE_POINTS],
    amplitude: 100,
    offset: 127,
    phase: 0,
    tempoSync: true,
    tempoMultiplier: 4,
    repeatMode: 'loop',
    loopDirection: 'forward',
    min: 0,
    max: 255,
    speed: 1,
  };
}

/** Backward-compatible normalization for localStorage / older saves. */
export function normalizeChannelEnvelope(raw: Partial<ChannelEnvelope> & { loop?: boolean }): ChannelEnvelope {
  let repeatMode: EnvelopeRepeatMode = raw.repeatMode ?? 'loop';
  if (raw.loop === false) repeatMode = 'once';
  if (raw.loop === true && !raw.repeatMode) repeatMode = 'loop';

  return {
    id: raw.id ?? `envelope-${Date.now()}`,
    channel: raw.channel ?? 0,
    enabled: raw.enabled ?? true,
    waveform: (raw.waveform as WaveformType) ?? 'sine',
    customPoints:
      raw.customPoints && raw.customPoints.length >= 2
        ? [...raw.customPoints].sort((a, b) => a.x - b.x)
        : [...DEFAULT_ENVELOPE_POINTS],
    amplitude: raw.amplitude ?? 100,
    offset: raw.offset ?? 127,
    phase: raw.phase ?? 0,
    tempoSync: raw.tempoSync ?? true,
    tempoMultiplier: raw.tempoMultiplier ?? 4,
    repeatMode,
    loopDirection: raw.loopDirection ?? 'forward',
    min: raw.min ?? 0,
    max: raw.max ?? 255,
    speed: raw.speed ?? 1,
  };
}

/** Sample a built-in waveform into drawable points. */
export function bakeWaveformToPoints(
  waveform: WaveformType,
  sampleCount = 48
): EnvelopePoint[] {
  if (waveform === 'custom') return [...DEFAULT_ENVELOPE_POINTS];
  const points: EnvelopePoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const x = i / sampleCount;
    let y = 0;
    switch (waveform) {
      case 'sine':
        y = Math.sin(x * Math.PI * 2) * 0.5 + 0.5;
        break;
      case 'saw':
        y = x;
        break;
      case 'square':
        y = x < 0.5 ? 1 : 0;
        break;
      case 'triangle':
        y = x < 0.5 ? x * 2 : 2 - x * 2;
        break;
      default:
        y = x;
    }
    points.push({ x, y: Math.max(0, Math.min(1, y)) });
  }
  return points;
}
