import type { ChannelEnvelope } from '../store/types';
import { lerpWithOutExpo, outExpo } from './artbastardEasing';

export interface EnvelopeProgressInput {
  envelope: ChannelEnvelope;
  bpm: number;
  globalSpeed: number;
  startTimeMs: number;
  nowMs: number;
}

export interface EnvelopeProgressResult {
  /** Position along curve 0..1 */
  linearProgress: number;
  /** False when repeatMode is once and the cycle has finished */
  active: boolean;
}

function cycleDurationMs(envelope: ChannelEnvelope, bpm: number, combinedSpeed: number): number {
  if (envelope.tempoSync) {
    const beatDuration = (60 / Math.max(1, bpm)) * 1000;
    return (beatDuration * envelope.tempoMultiplier) / Math.max(0.01, combinedSpeed);
  }
  return 1000 / Math.max(0.01, combinedSpeed);
}

/** Map elapsed time to 0..1 curve position with repeat / ping-pong / once. */
export function resolveEnvelopeProgress(
  envelope: ChannelEnvelope,
  elapsedMs: number,
  cycleMs: number
): EnvelopeProgressResult {
  if (cycleMs <= 0) return { linearProgress: 0, active: true };

  const cycles = elapsedMs / cycleMs;

  if (envelope.repeatMode === 'once') {
    if (cycles >= 1) {
      const dir = envelope.loopDirection === 'reverse' ? 0 : 1;
      return { linearProgress: dir, active: false };
    }
    const t = envelope.loopDirection === 'reverse' ? 1 - cycles : cycles;
    return { linearProgress: Math.max(0, Math.min(1, t)), active: true };
  }

  let t: number;
  switch (envelope.loopDirection) {
    case 'reverse':
      t = 1 - (cycles % 1);
      break;
    case 'pingpong': {
      const p = cycles % 2;
      t = p <= 1 ? p : 2 - p;
      break;
    }
    case 'forward':
    default:
      t = cycles % 1;
      break;
  }

  return { linearProgress: Math.max(0, Math.min(1, t)), active: true };
}

/** Cycle position 0..1 for one envelope (linear time along curve). */
export function computeEnvelopeProgress({
  envelope,
  bpm,
  globalSpeed,
  startTimeMs,
  nowMs,
}: EnvelopeProgressInput): number {
  const envelopeSpeed = envelope.speed ?? 1;
  const combinedSpeed = (globalSpeed || 1) * envelopeSpeed;
  const adjustedStart = startTimeMs;
  const elapsed = (nowMs - adjustedStart) * (globalSpeed || 1);
  const cycleMs = cycleDurationMs(envelope, bpm, combinedSpeed);
  const phaseShift = ((envelope.phase / 360) % 1 + 1) % 1;
  const { linearProgress } = resolveEnvelopeProgress(envelope, elapsed, cycleMs);
  return (linearProgress + phaseShift) % 1;
}

export function computeEnvelopeProgressDetailed(input: EnvelopeProgressInput): EnvelopeProgressResult {
  const envelope = input.envelope;
  const envelopeSpeed = envelope.speed ?? 1;
  const combinedSpeed = (input.globalSpeed || 1) * envelopeSpeed;
  const elapsed = (input.nowMs - input.startTimeMs) * (input.globalSpeed || 1);
  const cycleMs = cycleDurationMs(envelope, input.bpm, combinedSpeed);
  const phaseShift = ((envelope.phase / 360) % 1 + 1) % 1;
  const result = resolveEnvelopeProgress(envelope, elapsed, cycleMs);
  return {
    ...result,
    linearProgress: (result.linearProgress + phaseShift) % 1,
  };
}

/** Waveform sample 0..1 at linear progress; segment blends use outExpo. */
export function sampleWaveformValue(envelope: ChannelEnvelope, linearProgress: number): number {
  const t = Math.max(0, Math.min(1, linearProgress));

  if (envelope.waveform === 'custom') {
    if (envelope.customPoints.length === 0) return 0;
    const sortedPoints = [...envelope.customPoints].sort((a, b) => a.x - b.x);
    let point1 = sortedPoints[0];
    let point2 = sortedPoints[sortedPoints.length - 1];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      if (t >= sortedPoints[i].x && t <= sortedPoints[i + 1].x) {
        point1 = sortedPoints[i];
        point2 = sortedPoints[i + 1];
        break;
      }
    }

    const span = point2.x - point1.x || 0.001;
    const segmentT = (t - point1.x) / span;
    const easedT = outExpo(Math.max(0, Math.min(1, segmentT)));
    return point1.y + (point2.y - point1.y) * easedT;
  }

  const progress = outExpo(t);
  switch (envelope.waveform) {
    case 'sine':
      return Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
    case 'saw':
      return progress;
    case 'square':
      return progress < 0.5 ? 1 : 0;
    case 'triangle':
      return progress < 0.5 ? progress * 2 : 2 - progress * 2;
    default:
      return 0;
  }
}

export function envelopeModulationToDmx(
  envelope: ChannelEnvelope,
  waveformValue: number,
  currentDmxValue: number
): number {
  const modulationRange = (envelope.amplitude / 100) * 255;
  const modulationValue = (waveformValue - 0.5) * 2;
  const modulationAmount = modulationValue * modulationRange;
  const relativeOffset = (envelope.offset - 127) / 2;
  const finalValue = Math.round(currentDmxValue + relativeOffset + modulationAmount);
  const minValue = envelope.min ?? 0;
  const maxValue = envelope.max ?? 255;
  return Math.max(minValue, Math.min(maxValue, finalValue));
}

const smoothState = new Map<number, number>();

export function smoothEnvelopeDmxValue(channel: number, target: number, frameBlend = 0.22): number {
  const prev = smoothState.get(channel) ?? target;
  const next = lerpWithOutExpo(prev, target, frameBlend);
  smoothState.set(channel, next);
  return Math.round(next);
}

export function resetEnvelopeSmoothing(): void {
  smoothState.clear();
}
