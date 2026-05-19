import React, { useEffect, useRef } from 'react';
import type { ChannelEnvelope } from '../../store';
import { computeEnvelopeProgress, sampleWaveformValue } from '../../utils/envelopeEngine';
import { outExpo } from '../../utils/artbastardEasing';
import styles from './EnvelopeWaveformCanvas.module.scss';

export interface EnvelopeWaveformCanvasProps {
  envelope: Pick<
    ChannelEnvelope,
    'waveform' | 'customPoints' | 'amplitude' | 'offset' | 'phase' | 'tempoSync' | 'tempoMultiplier' | 'speed'
  >;
  bpm: number;
  globalSpeed?: number;
  animatePlayhead?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export const EnvelopeWaveformCanvas: React.FC<EnvelopeWaveformCanvasProps> = ({
  envelope,
  bpm,
  globalSpeed = 1,
  animatePlayhead = false,
  width = 400,
  height = 160,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  const draw = (playheadLinear: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const y = (h / 8) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(214, 135, 6, 0.15)');
    gradient.addColorStop(1, 'rgba(248, 221, 54, 0.85)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const linearProgress = x / w;
      const value = sampleWaveformValue(envelope as ChannelEnvelope, linearProgress);
      const y = h - value * h;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const easedX = outExpo(playheadLinear) * w;
    const playheadValue = sampleWaveformValue(envelope as ChannelEnvelope, playheadLinear);
    const playheadY = h - playheadValue * h;

    ctx.fillStyle = 'rgba(248, 221, 54, 0.12)';
    ctx.fillRect(0, 0, easedX, h);

    ctx.strokeStyle = 'rgba(248, 221, 54, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(easedX, 0);
    ctx.lineTo(easedX, h);
    ctx.stroke();

    ctx.fillStyle = '#f8dd36';
    ctx.shadowColor = 'rgba(248, 221, 54, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(easedX, playheadY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  useEffect(() => {
    draw(0);
  }, [envelope.waveform, envelope.customPoints, envelope.amplitude, envelope.offset, envelope.phase]);

  useEffect(() => {
    if (!animatePlayhead) {
      draw(0);
      return;
    }

    startRef.current = Date.now();
    const tick = () => {
      const progress = computeEnvelopeProgress({
        envelope: envelope as ChannelEnvelope,
        bpm,
        globalSpeed,
        startTimeMs: startRef.current,
        nowMs: Date.now(),
      });
      draw(progress);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [animatePlayhead, envelope, bpm, globalSpeed]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`${styles.canvas} ${className}`}
      aria-hidden
    />
  );
};
