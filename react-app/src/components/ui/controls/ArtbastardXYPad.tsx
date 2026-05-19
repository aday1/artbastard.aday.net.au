import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LucideIcon } from '../LucideIcon';
import styles from './ArtbastardXYPad.module.scss';
import {
  PathPoint,
  buildShapePath,
  dmxToPadPercent,
  interpolatePath,
  pathToDmxPoints,
  smoothUserPath,
} from './xyPadPathUtils';

export interface ArtbastardXYPadProps {
  pan: number;
  tilt: number;
  disabled?: boolean;
  size?: number;
  /** Shape radius 10-100 (autopilot track size) */
  shapeSize?: number;
  showShapeSize?: boolean;
  onShapeSizeChange?: (size: number) => void;
  onPanTiltChange: (pan: number, tilt: number) => void;
  onPathSaved?: (points: { x: number; y: number }[]) => void;
  onOpenPathEditor?: () => void;
  className?: string;
}

type ToolMode = 'live' | 'pencil';

const SHAPES = ['circle', 'triangle', 'square', 'star'] as const;
type ShapeName = (typeof SHAPES)[number];

const PAD_TOOLS = [
  { id: 'pencil', icon: 'Pencil', title: 'Draw custom path' },
  { id: 'play', icon: 'Play', title: 'Play path' },
  { id: 'stop', icon: 'Square', title: 'Stop playback' },
  { id: 'eraser', icon: 'Eraser', title: 'Clear path' },
  { id: 'shapes', icon: 'Shapes', title: 'Insert shape path (tap to cycle)' },
] as const;

export const ArtbastardXYPad: React.FC<ArtbastardXYPadProps> = ({
  pan,
  tilt,
  disabled = false,
  size,
  shapeSize = 50,
  showShapeSize = false,
  onShapeSizeChange,
  onPanTiltChange,
  onPathSaved,
  onOpenPathEditor,
  className = '',
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tool, setTool] = useState<ToolMode>('live');
  const [isDrawing, setIsDrawing] = useState(false);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [isPredefinedShape, setIsPredefinedShape] = useState(false);
  const [activeIcon, setActiveIcon] = useState<string | null>(null);
  const playbackRef = useRef<number | null>(null);
  const shapeIndexRef = useRef(0);
  const lastShapeRef = useRef<ShapeName | null>(null);

  const xy = dmxToPadPercent(pan, tilt);
  const emitPanTilt = useCallback(
    (px: number, py: number) => {
      const el = padRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const p = Math.round(Math.max(0, Math.min(255, (px / w) * 255)));
      const t = Math.round(Math.max(0, Math.min(255, (1 - py / h) * 255)));
      onPanTiltChange(p, t);
    },
    [onPanTiltChange]
  );

  const drawPath = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const w = pad.clientWidth;
    const h = pad.clientHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx || path.length < 2) {
      if (ctx) ctx.clearRect(0, 0, w, h);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    const processed = isPredefinedShape ? interpolatePath(path) : smoothUserPath(path);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, 'rgba(207, 62, 223, 0.8)');
    gradient.addColorStop(1, 'rgba(207, 62, 223, 0.2)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(207, 62, 223, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    processed.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [path, isPredefinedShape]);

  useEffect(() => {
    drawPath();
  }, [drawPath]);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current != null) {
      cancelAnimationFrame(playbackRef.current);
      playbackRef.current = null;
    }
  }, []);

  const playPath = useCallback(() => {
    if (path.length === 0) return;
    stopPlayback();
    let index = 0;
    let startTime = performance.now();

    const tick = () => {
      if (index >= path.length - 1) {
        index = 0;
        startTime = performance.now();
      }
      const current = path[index];
      const next = path[index + 1] || path[0];
      const segmentDuration = Math.max(16, (next.timestamp ?? 0) - (current.timestamp ?? 0) || 32);
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / segmentDuration);
      const x = current.x + (next.x - current.x) * t;
      const y = current.y + (next.y - current.y) * t;
      emitPanTilt(x, y);
      if (t >= 1) {
        index++;
        startTime = performance.now();
      }
      playbackRef.current = requestAnimationFrame(tick);
    };
    playbackRef.current = requestAnimationFrame(tick);
  }, [path, emitPanTilt, stopPlayback]);

  const updateFromEvent = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad || disabled) return;
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    emitPanTilt(x, y);
    if (tool === 'pencil' || isDrawing) {
      setPath((prev) => [...prev, { x, y, timestamp: performance.now() }]);
      setIsPredefinedShape(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    if (tool === 'pencil' || isDrawing) {
      const pad = padRef.current;
      if (pad) {
        const rect = pad.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        setPath([{ x, y, timestamp: performance.now() }]);
        setIsPredefinedShape(false);
      }
    }
    updateFromEvent(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    setIsDragging(false);
    if (isDrawing && path.length > 1) {
      onPathSaved?.(
        pathToDmxPoints(
          path,
          padRef.current?.clientWidth ?? 320,
          padRef.current?.clientHeight ?? 320
        )
      );
    }
  };

  const erasePath = () => {
    stopPlayback();
    setPath([]);
    setIsPredefinedShape(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const shapeRadiusPx = useCallback(() => {
    const padW = padRef.current?.clientWidth ?? 320;
    const padH = padRef.current?.clientHeight ?? 320;
    return (shapeSize / 100) * Math.min(padW, padH) * 0.45;
  }, [shapeSize]);

  const applyShapeByName = useCallback(
    (shape: ShapeName) => {
      stopPlayback();
      const padW = padRef.current?.clientWidth ?? 320;
      const padH = padRef.current?.clientHeight ?? 320;
      const centerX = padW / 2;
      const centerY = padH / 2;
      const radius = shapeRadiusPx();
      const newPath = buildShapePath(shape, centerX, centerY, radius);
      lastShapeRef.current = shape;
      setIsPredefinedShape(true);
      setPath(newPath);
      onPathSaved?.(pathToDmxPoints(newPath, padW, padH));
    },
    [onPathSaved, shapeRadiusPx, stopPlayback]
  );

  const applyShape = () => {
    const shape = SHAPES[shapeIndexRef.current % SHAPES.length];
    shapeIndexRef.current++;
    applyShapeByName(shape);
  };

  useEffect(() => {
    if (!isPredefinedShape || !lastShapeRef.current) return;
    applyShapeByName(lastShapeRef.current);
  }, [shapeSize, isPredefinedShape, applyShapeByName]);

  const handleIcon = (icon: string) => {
    setActiveIcon(icon);
    if (icon === 'pencil') {
      setTool('pencil');
      setIsDrawing(true);
      stopPlayback();
    } else if (icon === 'play') {
      setIsDrawing(false);
      playPath();
    } else if (icon === 'stop') {
      setIsDrawing(false);
      stopPlayback();
    } else if (icon === 'eraser') {
      setIsDrawing(false);
      stopPlayback();
      erasePath();
    } else if (icon === 'shapes') {
      setIsDrawing(false);
      stopPlayback();
      applyShape();
    }
  };

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const xFill = xy.x;
  const yFill = xy.y;

  return (
    <div className={`${styles.card} ${className} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.mainContent}>
        <div
          ref={padRef}
          className={`${styles.xyPad} ${size == null ? styles.xyPadFluid : ''}`}
          style={size != null ? { width: size, height: size } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.gridOverlay} />
          <div
            className={`${styles.thumb} ${isDragging ? styles.dragging : ''}`}
            style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
          />
        </div>
        <div className={styles.icons}>
          {PAD_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`${styles.icon} ${activeIcon === tool.id ? styles.iconActive : ''}`}
              title={tool.title}
              disabled={disabled}
              onClick={() => handleIcon(tool.id)}
              aria-label={tool.title}
            >
              <LucideIcon name={tool.icon} size={20} />
            </button>
          ))}
          {onOpenPathEditor ? (
            <button
              type="button"
              className={styles.icon}
              title="Open path editor"
              disabled={disabled}
              onClick={onOpenPathEditor}
              aria-label="Open path editor"
            >
              <LucideIcon name="Waypoints" size={20} />
            </button>
          ) : null}
          {showShapeSize ? (
            <div className={styles.shapeSizeControl}>
              <label className={styles.shapeSizeLabel} htmlFor="xy-pad-shape-size">
                Size
              </label>
              <input
                id="xy-pad-shape-size"
                type="range"
                className={styles.shapeSizeSlider}
                min={10}
                max={100}
                step={1}
                value={shapeSize}
                disabled={disabled}
                onChange={(e) => onShapeSizeChange?.(Number(e.target.value))}
              />
              <span className={styles.shapeSizeValue}>{shapeSize}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.axisIndicators}>
        <div className={styles.xIndicator}>
          <span>X</span>
          <div className={styles.xBar}>
            <div className={styles.xFill} style={{ width: `${xFill}%` }} />
          </div>
        </div>
        <div className={styles.yIndicator}>
          <span>Y</span>
          <div className={styles.yBar}>
            <div className={styles.yFill} style={{ width: `${yFill}%` }} />
          </div>
        </div>
      </div>
      <div className={styles.readout}>
        Pan {pan} / Tilt {tilt}
      </div>
    </div>
  );
};
