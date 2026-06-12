import React, { useCallback, useId, useRef, useState } from 'react';
import styles from './RangeWindowControl.module.scss';

export interface RangeWindowControlProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  /** Editable MIN/MAX fields below the summary (channel cards, etc.) */
  showNumericInputs?: boolean;
  /** Tighter layout for narrow channel strips / compact grid columns */
  dense?: boolean;
  onChange: (minValue: number, maxValue: number) => void;
  className?: string;
  /** Optional 3rd handle representing the current channel value (clamped to [minValue,maxValue]). */
  value?: number;
  onValueChange?: (value: number) => void;
}

type DragMode = 'min' | 'max' | 'window' | 'value' | null;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function snap(n: number, step: number) {
  if (step <= 0) return n;
  return Math.round(n / step) * step;
}

export const RangeWindowControl: React.FC<RangeWindowControlProps> = ({
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  disabled = false,
  label,
  showNumericInputs = false,
  dense = false,
  onChange,
  className = '',
  value,
  onValueChange,
}) => {
  const inputId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef({ x: 0, minV: 0, maxV: 0, valV: 0 });

  const span = max - min || 1;
  const lo = clamp(Math.min(minValue, maxValue), min, max);
  const hi = clamp(Math.max(minValue, maxValue), min, max);
  const leftPct = ((lo - min) / span) * 100;
  const widthPct = ((hi - lo) / span) * 100;
  const showValueHandle = typeof value === 'number' && typeof onValueChange === 'function';
  const clampedValue = showValueHandle ? clamp(value as number, lo, hi) : 0;
  const valuePct = showValueHandle ? ((clampedValue - min) / span) * 100 : 0;

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      return snap(min + t * span, step);
    },
    [min, span, step]
  );

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragMode(mode);
    dragStartRef.current = { x: e.clientX, minV: lo, maxV: hi, valV: clampedValue };
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode || disabled) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const deltaVal = ((e.clientX - dragStartRef.current.x) / rect.width) * span;

      if (dragMode === 'min') {
        onChange(clamp(snap(dragStartRef.current.minV + deltaVal, step), min, hi), hi);
      } else if (dragMode === 'max') {
        onChange(lo, clamp(snap(dragStartRef.current.maxV + deltaVal, step), lo, max));
      } else if (dragMode === 'window') {
        const windowSize = dragStartRef.current.maxV - dragStartRef.current.minV;
        let nextMin = snap(dragStartRef.current.minV + deltaVal, step);
        nextMin = clamp(nextMin, min, max - windowSize);
        onChange(nextMin, nextMin + windowSize);
      } else if (dragMode === 'value' && onValueChange) {
        const next = clamp(snap(dragStartRef.current.valV + deltaVal, step), lo, hi);
        onValueChange(next);
      }
    },
    [dragMode, disabled, span, step, min, max, lo, hi, onChange, onValueChange]
  );

  const endDrag = (e: React.PointerEvent) => {
    if (dragMode) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    setDragMode(null);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled || dragMode) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    const v = valueFromClientX(e.clientX);
    // If value handle is enabled and click is inside the current window, move value
    if (showValueHandle && onValueChange && v >= lo && v <= hi) {
      onValueChange(clamp(v, lo, hi));
      return;
    }
    if (Math.abs(v - lo) <= Math.abs(v - hi)) {
      onChange(clamp(v, min, hi), hi);
    } else {
      onChange(lo, clamp(v, lo, max));
    }
  };

  const commitMinInput = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const nextMin = clamp(Number.isFinite(parsed) ? parsed : lo, min, max);
    onChange(nextMin, Math.max(hi, nextMin));
  };

  const commitMaxInput = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const nextMax = clamp(Number.isFinite(parsed) ? parsed : hi, min, max);
    onChange(Math.min(lo, nextMax), nextMax);
  };

  const onKeyDown = (handle: 'min' | 'max' | 'value') => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const delta = (e.shiftKey ? 10 : 1) * step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (handle === 'min') onChange(clamp(lo - delta, min, hi), hi);
      else if (handle === 'max') onChange(lo, clamp(hi - delta, lo, max));
      else if (handle === 'value' && onValueChange) onValueChange(clamp(clampedValue - delta, lo, hi));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (handle === 'min') onChange(clamp(lo + delta, min, hi), hi);
      else if (handle === 'max') onChange(lo, clamp(hi + delta, lo, max));
      else if (handle === 'value' && onValueChange) onValueChange(clamp(clampedValue + delta, lo, hi));
    }
  };

  return (
    <div
      className={`${styles.root} ${dense ? styles.dense : ''} ${className} ${disabled ? styles.disabled : ''}`}
    >
      {label ? <div className={styles.label}>{label}</div> : null}
      <div className={styles.values}>
        <span className={styles.valueMin}>{lo}</span>
        <span className={styles.valueSep}>-</span>
        <span className={styles.valueMax}>{hi}</span>
        <span className={styles.valueSpan}>({hi - lo})</span>
        {showValueHandle ? (
          <span className={styles.valueCurrent} title="Current value">
            = {clampedValue}
          </span>
        ) : null}
      </div>
      {showNumericInputs ? (
        <div className={styles.numericRow}>
          <div className={styles.numericField}>
            <label className={styles.numericLabel} htmlFor={`${inputId}-min`}>
              MIN
            </label>
            <input
              id={`${inputId}-min`}
              type="number"
              className={styles.numericInput}
              min={min}
              max={max}
              step={step}
              value={lo}
              disabled={disabled}
              onChange={(e) => commitMinInput(e.target.value)}
            />
          </div>
          <div className={styles.numericField}>
            <label className={styles.numericLabel} htmlFor={`${inputId}-max`}>
              MAX
            </label>
            <input
              id={`${inputId}-max`}
              type="number"
              className={styles.numericInput}
              min={min}
              max={max}
              step={step}
              value={hi}
              disabled={disabled}
              onChange={(e) => commitMaxInput(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <div
        ref={trackRef}
        className={styles.track}
        onClick={onTrackClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.trackBg} />
        <div
          className={styles.window}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          data-handle="window"
          onPointerDown={onPointerDown('window')}
        >
          <div className={styles.windowGlow} />
        </div>
        <button
          type="button"
          className={styles.handle}
          style={{ left: `${leftPct}%` }}
          data-handle="min"
          disabled={disabled}
          aria-label="Minimum"
          onPointerDown={onPointerDown('min')}
          onKeyDown={onKeyDown('min')}
        />
        <button
          type="button"
          className={styles.handle}
          style={{ left: `${((hi - min) / span) * 100}%` }}
          data-handle="max"
          disabled={disabled}
          aria-label="Maximum"
          onPointerDown={onPointerDown('max')}
          onKeyDown={onKeyDown('max')}
        />
        {showValueHandle ? (
          <button
            type="button"
            className={`${styles.handle} ${styles.valueHandle}`}
            style={{ left: `${valuePct}%` }}
            data-handle="value"
            disabled={disabled}
            aria-label="Value"
            title={`Value ${clampedValue}`}
            onPointerDown={onPointerDown('value')}
            onKeyDown={onKeyDown('value')}
          />
        ) : null}
      </div>
    </div>
  );
};
