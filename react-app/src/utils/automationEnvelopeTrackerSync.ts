import type { ChannelEnvelope, TransitionPattern, TransitionPatternLine } from '../store/types';
import { sampleWaveformValue } from './envelopeEngine';

/** Sample envelope curve into pattern lines for one channel (one value per line). */
export function bakeEnvelopeToPatternLines(
  envelope: ChannelEnvelope,
  pattern: TransitionPattern,
  channelIndex: number,
  lineStart = 0,
  lineCount?: number
): TransitionPatternLine[] {
  const count = lineCount ?? pattern.length - lineStart;
  const lines = pattern.lines.map((l) => ({ ...l, channelValues: { ...l.channelValues } }));

  for (let i = 0; i < count; i++) {
    const lineIdx = lineStart + i;
    if (lineIdx < 0 || lineIdx >= lines.length) break;
    const t = count <= 1 ? 0 : i / (count - 1);
    const wave = sampleWaveformValue(envelope, t);
    const range = envelope.max - envelope.min;
    const dmx = Math.round(envelope.min + wave * range);
    lines[lineIdx].channelValues[channelIndex] = Math.max(0, Math.min(255, dmx));
  }

  return lines;
}

/** Build envelope custom points from non-empty hex cells on one channel across lines. */
export function patternTrackToEnvelopePoints(
  pattern: TransitionPattern,
  channelIndex: number
): { x: number; y: number }[] {
  const samples: { line: number; value: number }[] = [];
  for (const line of pattern.lines) {
    const v = line.channelValues[channelIndex];
    if (v !== null && v !== undefined) {
      samples.push({ line: line.index, value: v });
    }
  }
  if (samples.length === 0) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
  }
  const maxLine = Math.max(1, pattern.length - 1);
  return samples.map((s) => ({
    x: s.line / maxLine,
    y: s.value / 255,
  }));
}

/** Map pattern line values to envelope min/max for import. */
export function envelopeDraftFromPatternTrack(
  channelIndex: number,
  pattern: TransitionPattern
): Omit<ChannelEnvelope, 'id'> {
  const points = patternTrackToEnvelopePoints(pattern, channelIndex);
  const values = pattern.lines
    .map((l) => l.channelValues[channelIndex])
    .filter((v): v is number => v !== null && v !== undefined);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 255;

  return {
    channel: channelIndex,
    enabled: false,
    waveform: 'custom',
    customPoints: points,
    amplitude: 100,
    offset: 127,
    phase: 0,
    tempoSync: true,
    tempoMultiplier: 4,
    repeatMode: 'loop',
    loopDirection: 'forward',
    min,
    max: Math.max(min + 1, max),
    speed: 1,
  };
}
