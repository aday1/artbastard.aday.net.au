import React, { useEffect, useRef } from 'react';
import { useRangeTouchGuard } from './useRangeTouchGuard';
import { useVerticalFaderLength } from './useVerticalFaderLength';
import styles from './DmxVerticalFader.module.scss';

export type DmxFaderSize = 'default' | 'touch' | 'channel' | 'pinned' | 'strip';

export interface DmxVerticalFaderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onInput?: (value: number) => void;
  className?: string;
  showReadout?: boolean;
  readoutLabel?: string;
  size?: DmxFaderSize;
}

export const DmxVerticalFader: React.FC<DmxVerticalFaderProps> = ({
  value,
  min = 0,
  max = 255,
  step = 1,
  disabled = false,
  onChange,
  onInput,
  className = '',
  showReadout = false,
  readoutLabel,
  size = 'default',
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const trackHostRef = useVerticalFaderLength<HTMLDivElement>();
  const touchGuard = useRangeTouchGuard(disabled);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    el.style.setProperty('--val', String(value));
    el.style.setProperty('--min', String(min));
    el.style.setProperty('--max', String(max));
  }, [value, min, max]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    formRef.current?.style.setProperty('--val', String(v));
    onInput?.(v);
    onChange(v);
  };

  return (
    <div
      className={`${styles.wrap} ${size === 'touch' ? styles.sizeTouch : ''} ${size === 'channel' ? styles.sizeChannel : ''} ${size === 'pinned' ? styles.sizePinned : ''} ${size === 'strip' ? styles.sizeStrip : ''} ${className} ${disabled ? styles.disabled : ''}`}
    >
      <form
        ref={formRef}
        className={styles.form}
        onSubmit={(e) => e.preventDefault()}
        aria-label={readoutLabel ?? `DMX ${min} to ${max}`}
      >
        <div ref={trackHostRef} className={styles.trackHost}>
          <input
            ref={touchGuard.inputRef}
            type="range"
            className={`${styles.input} ab-styled-fader`}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={handle}
            onInput={handle}
            onPointerDown={touchGuard.onPointerDown}
            onPointerUp={touchGuard.onPointerUp}
            onPointerCancel={touchGuard.onPointerUp}
            onTouchStart={touchGuard.onTouchStart}
            onTouchEnd={touchGuard.onTouchEnd}
          />
        </div>
      </form>
      {showReadout && (
        <div className={styles.readout}>
          {readoutLabel ?? `${value}`}
        </div>
      )}
    </div>
  );
};
