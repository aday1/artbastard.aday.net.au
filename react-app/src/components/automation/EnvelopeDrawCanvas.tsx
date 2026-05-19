import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelEnvelope, EnvelopePoint } from '../../store/types';
import {
  computeEnvelopeProgress,
  sampleWaveformValue,
} from '../../utils/envelopeEngine';
import { bakeWaveformToPoints } from '../../utils/envelopeDefaults';
import styles from './EnvelopeDrawCanvas.module.scss';

export interface EnvelopeDrawCanvasProps {
  envelope: Pick<
    ChannelEnvelope,
    | 'waveform'
    | 'customPoints'
    | 'amplitude'
    | 'offset'
    | 'phase'
    | 'tempoSync'
    | 'tempoMultiplier'
    | 'speed'
    | 'repeatMode'
    | 'loopDirection'
  >;
  bpm: number;
  globalSpeed?: number;
  editable?: boolean;
  animatePlayhead?: boolean;
  onPointsChange?: (points: EnvelopePoint[]) => void;
  onWaveformChange?: (waveform: ChannelEnvelope['waveform']) => void;
  className?: string;
}

const MAX_POINTS = 96;
/** Fixed layout height — do not derive from canvas bitmap or ResizeObserver loops grow the page. */
const CANVAS_LAYOUT_HEIGHT = 220;

function simplifyPoints(points: EnvelopePoint[], minDist = 0.012): EnvelopePoint[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const out: EnvelopePoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    const last = out[out.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist || i === sorted.length - 1) {
      out.push({ x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) });
    }
  }
  if (out[out.length - 1].x < 1) out.push({ x: 1, y: out[out.length - 1].y });
  if (out[0].x > 0) out.unshift({ x: 0, y: out[0].y });
  return out.slice(0, MAX_POINTS);
}

export const EnvelopeDrawCanvas: React.FC<EnvelopeDrawCanvasProps> = ({
  envelope,
  bpm,
  globalSpeed = 1,
  editable = false,
  animatePlayhead = false,
  onPointsChange,
  onWaveformChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);
  const drawingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const [size, setSize] = useState({ w: 640, h: CANVAS_LAYOUT_HEIGHT });

  const points =
    envelope.waveform === 'custom'
      ? envelope.customPoints
      : bakeWaveformToPoints(envelope.waveform, 64);

  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = 1 - (clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }, []);

  const draw = useCallback(
    (playheadT: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const y = (h / 8) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let i = 0; i <= 16; i++) {
        const x = (w / 16) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const sorted = [...points].sort((a, b) => a.x - b.x);
      const sampleAt = (t: number) => {
        if (envelope.waveform === 'custom') {
          return sampleWaveformValue({ ...envelope, customPoints: sorted } as ChannelEnvelope, t);
        }
        return sampleWaveformValue(envelope as ChannelEnvelope, t);
      };

      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = px / w;
        const val = sampleAt(t);
        const py = h - val * h;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(248, 221, 54, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, 'rgba(248, 221, 54, 0.35)');
      fill.addColorStop(1, 'rgba(214, 135, 6, 0.05)');
      ctx.fillStyle = fill;
      ctx.fill();

      if (envelope.loopDirection === 'pingpong') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '11px system-ui,sans-serif';
        ctx.fillText('ping-pong', 8, 14);
      } else if (envelope.repeatMode === 'once') {
        ctx.fillText('play once', 8, 14);
      }

      const phX = playheadT * w;
      const phVal = sampleAt(playheadT);
      const phY = h - phVal * h;
      ctx.fillStyle = 'rgba(248, 221, 54, 0.15)';
      ctx.fillRect(0, 0, phX, h);
      ctx.strokeStyle = 'rgba(248, 221, 54, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, h);
      ctx.stroke();
      ctx.fillStyle = '#f8dd36';
      ctx.beginPath();
      ctx.arc(phX, phY, 7, 0, Math.PI * 2);
      ctx.fill();

      if (editable && envelope.waveform === 'custom') {
        sorted.forEach((p, i) => {
          const px = p.x * w;
          const py = h - p.y * h;
          ctx.fillStyle = dragIndexRef.current === i ? '#fff' : '#d68706';
          ctx.strokeStyle = '#f8dd36';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    },
    [envelope, points]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const syncWidth = () => {
      const w = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setSize((prev) => {
        if (prev.w === w && prev.h === CANVAS_LAYOUT_HEIGHT) return prev;
        return { w, h: CANVAS_LAYOUT_HEIGHT };
      });
    };

    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    draw(0);
  }, [draw, size]);

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
  }, [animatePlayhead, envelope, bpm, globalSpeed, draw]);

  const pickPointIndex = (x: number, y: number, w: number, h: number) => {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    let best = -1;
    let bestD = 0.06;
    sorted.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = clientToNorm(e.clientX, e.clientY);

    if (envelope.waveform !== 'custom') {
      onWaveformChange?.('custom');
      const baked = bakeWaveformToPoints(envelope.waveform, 48);
      onPointsChange?.(baked);
      return;
    }

    const idx = pickPointIndex(x, y, size.w, size.h);
    if (idx >= 0) {
      dragIndexRef.current = idx;
    } else {
      drawingRef.current = true;
      const next = simplifyPoints([...envelope.customPoints, { x, y }]);
      onPointsChange?.(next);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editable || envelope.waveform !== 'custom') return;
    const { x, y } = clientToNorm(e.clientX, e.clientY);

    if (dragIndexRef.current != null) {
      const sorted = [...envelope.customPoints].sort((a, b) => a.x - b.x);
      const idx = dragIndexRef.current;
      sorted[idx] = {
        x: idx === 0 ? 0 : idx === sorted.length - 1 ? 1 : Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
      onPointsChange?.(simplifyPoints(sorted));
      return;
    }

    if (drawingRef.current) {
      const next = simplifyPoints([...envelope.customPoints, { x, y }]);
      onPointsChange?.(next);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    drawingRef.current = false;
    dragIndexRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`${styles.root} ${className}`}>
      <div
        ref={wrapRef}
        className={`${styles.wrap} ${editable ? styles.editable : ''}`}
      >
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      {editable && (
        <p className={styles.hint}>
          Draw with pointer drag. Drag points to edit. First/last points lock to start/end of cycle.
        </p>
      )}
    </div>
  );
};
