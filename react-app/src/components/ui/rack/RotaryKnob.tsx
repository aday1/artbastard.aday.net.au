import React, { useCallback, useRef, useState } from 'react';

export interface RotaryKnobProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  formatValue,
  disabled = false,
  className = '',
  id,
}) => {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const [focused, setFocused] = useState(false);

  const range = max - min || 1;
  const norm = (value - min) / range;
  const angle = -135 + norm * 270;

  const applyDelta = useCallback(
    (deltaY: number, startValue: number) => {
      const sensitivity = range / 150;
      const next = clamp(
        Math.round((startValue - deltaY * sensitivity) / step) * step,
        min,
        max
      );
      onChange(next);
    },
    [max, min, onChange, range, step]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || disabled) return;
    applyDelta(e.clientY - dragRef.current.startY, dragRef.current.startValue);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const delta = e.shiftKey ? step * 10 : step;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(value + delta, min, max));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(value - delta, min, max));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  const display = formatValue ? formatValue(value) : String(value);

  return (
    <div
      className={`ab-rack-knob ${className}`.trim()}
      style={{ '--knob-angle': `${angle}deg` } as React.CSSProperties}
    >
      <button
        type="button"
        id={id}
        className="ab-rack-knob__cap"
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ? `${label}: ${display}` : display}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDoubleClick={() => !disabled && onChange(min)}
        style={{ position: 'relative' }}
      />
      {label ? <span className="ab-rack-knob__label">{label}</span> : null}
      <span className="ab-rack-knob__value" aria-hidden={focused}>
        {display}
      </span>
    </div>
  );
};
