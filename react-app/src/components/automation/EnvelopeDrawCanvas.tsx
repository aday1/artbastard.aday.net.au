import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelEnvelope, EnvelopePoint } from '../../store/types';
import {
  computeEnvelopeProgress,
  sampleWaveformValue,
} from '../../utils/envelopeEngine';
import { bakeWaveformToPoints } from '../../utils/envelopeDefaults';
import { SkeuoButton } from '../ui/SkeuoButton';
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

export type EnvelopeDrawTool = 'draw' | 'line' | 'erase';

const MAX_POINTS = 96;
const CANVAS_LAYOUT_HEIGHT = 220;
const PICK_RADIUS = 0.055;
const DRAW_MIN_DIST = 0.018;
const COMMIT_MS = 32;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function simplifyPoints(points: EnvelopePoint[], minDist = 0.012): EnvelopePoint[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const out: EnvelopePoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    const last = out[out.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist || i === sorted.length - 1) {
      out.push({ x: clamp01(p.x), y: clamp01(p.y) });
    }
  }
  if (out[out.length - 1].x < 1) out.push({ x: 1, y: out[out.length - 1].y });
  if (out[0].x > 0) out.unshift({ x: 0, y: out[0].y });
  return out.slice(0, MAX_POINTS);
}

/** Chaikin corner-cutting — one pass softens jagged freehand strokes. */
function smoothPoints(points: EnvelopePoint[], passes = 1): EnvelopePoint[] {
  if (points.length < 3) return points;
  let cur = simplifyPoints(points, 0.008);
  for (let pass = 0; pass < passes; pass++) {
    const next: EnvelopePoint[] = [{ ...cur[0] }];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i];
      const b = cur[i + 1];
      next.push(
        { x: clamp01(a.x * 0.75 + b.x * 0.25), y: clamp01(a.y * 0.75 + b.y * 0.25) },
        { x: clamp01(a.x * 0.25 + b.x * 0.75), y: clamp01(a.y * 0.25 + b.y * 0.75) }
      );
    }
    next.push({ ...cur[cur.length - 1] });
    cur = simplifyPoints(next, 0.006);
  }
  return cur.slice(0, MAX_POINTS);
}

function interpolateLine(a: EnvelopePoint, b: EnvelopePoint, steps = 24): EnvelopePoint[] {
  const pts: EnvelopePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: clamp01(a.x + (b.x - a.x) * t),
      y: clamp01(a.y + (b.y - a.y) * t),
    });
  }
  return pts;
}

function mergePointSets(base: EnvelopePoint[], extra: EnvelopePoint[]): EnvelopePoint[] {
  return simplifyPoints([...base, ...extra], 0.01);
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
  const pendingRef = useRef<EnvelopePoint[] | null>(null);
  const lastDrawPtRef = useRef<EnvelopePoint | null>(null);
  const lineStartRef = useRef<EnvelopePoint | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolRef = useRef<EnvelopeDrawTool>('draw');
  const [tool, setTool] = useState<EnvelopeDrawTool>('draw');
  const [linePending, setLinePending] = useState(false);
  const [size, setSize] = useState({ w: 640, h: CANVAS_LAYOUT_HEIGHT });

  toolRef.current = tool;

  const points =
    envelope.waveform === 'custom'
      ? envelope.customPoints
      : bakeWaveformToPoints(envelope.waveform, 64);

  const ensureCustom = useCallback(() => {
    if (envelope.waveform !== 'custom') {
      onWaveformChange?.('custom');
      const baked = bakeWaveformToPoints(envelope.waveform, 48);
      onPointsChange?.(baked);
      return baked;
    }
    return envelope.customPoints;
  }, [envelope, onPointsChange, onWaveformChange]);

  const commitPoints = useCallback(
    (next: EnvelopePoint[], smooth = false) => {
      const sorted = simplifyPoints(next);
      onPointsChange?.(smooth ? smoothPoints(sorted) : sorted);
      pendingRef.current = null;
      lastDrawPtRef.current = null;
    },
    [onPointsChange]
  );

  const scheduleCommit = useCallback(
    (next: EnvelopePoint[], smooth = false) => {
      pendingRef.current = next;
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        if (pendingRef.current) commitPoints(pendingRef.current, smooth);
      }, COMMIT_MS);
    },
    [commitPoints]
  );

  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01(1 - (clientY - rect.top) / rect.height),
    };
  }, []);

  const pickPointIndex = useCallback(
    (x: number, y: number, list: EnvelopePoint[]) => {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      let best = -1;
      let bestD = PICK_RADIUS;
      sorted.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    },
    []
  );

  const eraseNear = useCallback(
    (x: number, y: number, list: EnvelopePoint[]) => {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      const filtered = sorted.filter((p, i) => {
        if (i === 0 || i === sorted.length - 1) return true;
        return Math.hypot(p.x - x, p.y - y) > PICK_RADIUS * 0.85;
      });
      if (filtered.length < 2) return sorted;
      return simplifyPoints(filtered);
    },
    []
  );

  const draw = useCallback(
    (playheadT: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#14102a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(90, 72, 160, 0.45)';
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

      const livePts = pendingRef.current ?? points;
      const sorted = [...livePts].sort((a, b) => a.x - b.x);
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
      ctx.strokeStyle = 'rgba(255, 160, 68, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, 'rgba(255, 160, 68, 0.28)');
      fill.addColorStop(1, 'rgba(17, 10, 37, 0.2)');
      ctx.fillStyle = fill;
      ctx.fill();

      if (lineStartRef.current && linePending) {
        const p = lineStartRef.current;
        ctx.fillStyle = 'rgba(106, 166, 230, 0.9)';
        ctx.beginPath();
        ctx.arc(p.x * w, h - p.y * h, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const phX = playheadT * w;
      const phVal = sampleAt(playheadT);
      const phY = h - phVal * h;
      ctx.fillStyle = 'rgba(255, 160, 68, 0.12)';
      ctx.fillRect(0, 0, phX, h);
      ctx.strokeStyle = 'rgba(106, 166, 230, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, h);
      ctx.stroke();
      ctx.fillStyle = '#ffa044';
      ctx.beginPath();
      ctx.arc(phX, phY, 6, 0, Math.PI * 2);
      ctx.fill();

      if (editable && envelope.waveform === 'custom') {
        sorted.forEach((p, i) => {
          const px = p.x * w;
          const py = h - p.y * h;
          const isEnd = i === 0 || i === sorted.length - 1;
          ctx.fillStyle = dragIndexRef.current === i ? '#ece4f8' : isEnd ? '#6aa6e6' : '#ffa044';
          ctx.strokeStyle = '#5a48a0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, isEnd ? 5 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    },
    [envelope, points, linePending, editable]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const syncWidth = () => {
      const w = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setSize((prev) => (prev.w === w && prev.h === CANVAS_LAYOUT_HEIGHT ? prev : { w, h: CANVAS_LAYOUT_HEIGHT }));
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

  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    const current = ensureCustom();

    if (e.button === 2) {
      const idx = pickPointIndex(x, y, current);
      if (idx > 0 && idx < current.length - 1) {
        const sorted = [...current].sort((a, b) => a.x - b.x);
        sorted.splice(idx, 1);
        commitPoints(simplifyPoints(sorted));
      }
      return;
    }

    const activeTool = toolRef.current;

    if (activeTool === 'line') {
      if (!lineStartRef.current) {
        lineStartRef.current = { x, y };
        setLinePending(true);
        draw(0);
        return;
      }
      const start = lineStartRef.current;
      const segment = interpolateLine(start, { x, y });
      commitPoints(mergePointSets(current, segment));
      lineStartRef.current = null;
      setLinePending(false);
      return;
    }

    if (activeTool === 'erase') {
      drawingRef.current = true;
      scheduleCommit(eraseNear(x, y, current));
      return;
    }

    const idx = pickPointIndex(x, y, current);
    if (idx >= 0) {
      dragIndexRef.current = idx;
      return;
    }

    drawingRef.current = true;
    lastDrawPtRef.current = { x, y };
    scheduleCommit(simplifyPoints([...current, { x, y }], DRAW_MIN_DIST));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editable || envelope.waveform !== 'custom') return;
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    const base = pendingRef.current ?? envelope.customPoints;

    if (dragIndexRef.current != null) {
      const sorted = [...base].sort((a, b) => a.x - b.x);
      const idx = dragIndexRef.current;
      sorted[idx] = {
        x: idx === 0 ? 0 : idx === sorted.length - 1 ? 1 : clamp01(x),
        y: clamp01(y),
      };
      pendingRef.current = sorted;
      draw(0);
      scheduleCommit(sorted);
      return;
    }

    if (!drawingRef.current) return;

    if (toolRef.current === 'erase') {
      scheduleCommit(eraseNear(x, y, base));
      return;
    }

    const last = lastDrawPtRef.current;
    if (!last || Math.hypot(x - last.x, y - last.y) < DRAW_MIN_DIST) return;
    lastDrawPtRef.current = { x, y };
    scheduleCommit(simplifyPoints([...base, { x, y }], DRAW_MIN_DIST));
    draw(0);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDrawing = drawingRef.current;
    drawingRef.current = false;
    dragIndexRef.current = null;

    if (pendingRef.current) {
      const smooth = toolRef.current === 'draw' && wasDrawing;
      commitPoints(pendingRef.current, smooth);
    }

    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSmoothAll = () => {
    if (envelope.waveform !== 'custom') return;
    commitPoints(smoothPoints(envelope.customPoints, 2), false);
  };

  const handleClearCustom = () => {
    onWaveformChange?.('sine');
    lineStartRef.current = null;
    setLinePending(false);
  };

  return (
    <div className={`${styles.root} ab-workbench-panel ${className}`}>
      {editable && (
        <div className="ab-workbench-panel__head">
          <span>Envelope editor</span>
          <div className={`${styles.tools} ab-envelope-tools`}>
            {(['draw', 'line', 'erase'] as const).map((t) => (
              <SkeuoButton
                key={t}
                compact
                active={tool === t}
                className="ab-view-tab"
                onClick={() => {
                  setTool(t);
                  lineStartRef.current = null;
                  setLinePending(false);
                }}
              >
                {t === 'draw' ? 'Draw' : t === 'line' ? 'Line' : 'Erase'}
              </SkeuoButton>
            ))}
            <SkeuoButton compact onClick={handleSmoothAll}>
              Smooth
            </SkeuoButton>
            <SkeuoButton compact accent="purple" onClick={handleClearCustom}>
              Preset
            </SkeuoButton>
          </div>
        </div>
      )}
      <div className={`ab-workbench-panel__body ${styles.bodyPad}`}>
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
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        {editable && (
          <p className={styles.hint}>
            Draw: drag freehand (auto-smooth on release). Line: click start, click end. Erase: drag over points.
            Right-click removes a point. Endpoints stay locked to cycle start/end.
          </p>
        )}
      </div>
    </div>
  );
};
