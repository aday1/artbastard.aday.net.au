import React, { useCallback, useEffect, useState } from 'react';
import { LucideIcon } from '../LucideIcon';
import { HorizontalFader } from './HorizontalFader';
import { VerticalFader } from './VerticalFader';
import styles from './DmxFaderRow.module.scss';

const DEFAULT_PRESETS = [0, 64, 128, 255];

export interface DmxFaderRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  controlName: string;
  labelColor?: string;
  accentColor?: string;
  subtitle?: string;
  meta?: string;
  oscAddress?: string;
  showOsc?: boolean;
  showPresets?: boolean;
  showScale?: boolean;
  showMidi?: boolean;
  compact?: boolean;
  /** Stretch horizontal slider to full row width (pan/tilt, etc.) */
  fullWidth?: boolean;
  /** Channel-strip style vertical fader instead of horizontal row */
  layout?: 'horizontal' | 'vertical';
  presetValues?: number[];
  valueDecimals?: number;
  onOscAddressChange?: (address: string) => void;
  isMidiLearning?: boolean;
  isMidiMapped?: boolean;
  midiMappingLabel?: string;
  onMidiLearn?: () => void;
  onMidiForget?: () => void;
  className?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const DmxFaderRow: React.FC<DmxFaderRowProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 255,
  step = 1,
  disabled = false,
  controlName,
  labelColor,
  accentColor,
  subtitle,
  meta,
  oscAddress = '',
  showOsc = true,
  showPresets = true,
  showScale = true,
  showMidi,
  compact = false,
  fullWidth = false,
  layout = 'horizontal',
  presetValues = DEFAULT_PRESETS,
  valueDecimals,
  onOscAddressChange,
  isMidiLearning = false,
  isMidiMapped = false,
  midiMappingLabel,
  onMidiLearn,
  onMidiForget,
  className = '',
}) => {
  const [draftValue, setDraftValue] = useState(String(value));
  const [draftOsc, setDraftOsc] = useState(oscAddress || `/${controlName}`);
  const midiEnabled = showMidi ?? Boolean(onMidiLearn || onMidiForget);
  const displayDecimals = valueDecimals ?? (step < 1 ? 1 : 0);

  useEffect(() => {
    setDraftValue(
      displayDecimals > 0 ? value.toFixed(displayDecimals) : String(Math.round(value))
    );
  }, [value, displayDecimals]);

  useEffect(() => {
    if (oscAddress) setDraftOsc(oscAddress);
  }, [oscAddress]);

  const commitValue = useCallback(
    (raw: string) => {
      const parsed = step % 1 !== 0 ? parseFloat(raw) : parseInt(raw, 10);
      if (Number.isNaN(parsed)) {
        setDraftValue(displayDecimals > 0 ? value.toFixed(displayDecimals) : String(Math.round(value)));
        return;
      }
      const next = clamp(parsed, min, max);
      const rounded = step % 1 !== 0 ? Math.round(next / step) * step : Math.round(next);
      setDraftValue(displayDecimals > 0 ? rounded.toFixed(displayDecimals) : String(rounded));
      onChange(rounded);
    },
    [min, max, onChange, value, step, displayDecimals]
  );

  const handleMidiClick = () => {
    if (disabled) return;
    if (isMidiLearning && onMidiLearn) {
      onMidiLearn();
      return;
    }
    if (isMidiMapped && onMidiForget) {
      onMidiForget();
      return;
    }
    onMidiLearn?.();
  };

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const presets = presetValues.filter((n) => n >= min && n <= max);

  if (layout === 'vertical') {
    return (
      <div
        className={`${styles.row} ${styles.rowVertical} ${compact ? styles.compact : ''} ${disabled ? styles.disabled : ''} ${className}`.trim()}
        style={
          accentColor
            ? ({ ['--fader-accent' as string]: accentColor } as React.CSSProperties)
            : undefined
        }
        data-control={controlName}
      >
        <div className={styles.verticalTop}>
          <span className={styles.label} style={labelColor ? { color: labelColor } : undefined}>
            {label}
          </span>
          <input
            type="number"
            className={styles.valueInput}
            min={min}
            max={max}
            step={step}
            value={draftValue}
            disabled={disabled}
            aria-label={`${label} value`}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={(e) => commitValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitValue((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
        <div className={styles.verticalFaderWrap}>
          <VerticalFader
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.row} ${compact ? styles.compact : ''} ${fullWidth ? styles.fullWidth : ''} ${disabled ? styles.disabled : ''} ${className}`.trim()}
      style={
        accentColor
          ? ({ ['--fader-accent' as string]: accentColor } as React.CSSProperties)
          : undefined
      }
      data-control={controlName}
    >
      <div className={styles.top}>
        <div className={styles.labelBlock}>
          <span className={styles.label} style={labelColor ? { color: labelColor } : undefined}>
            {label}
          </span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </div>
        <div className={styles.topRight}>
          {midiEnabled ? (
            <button
              type="button"
              className={`${styles.midiBtn} ${isMidiLearning ? styles.midiLearning : ''} ${isMidiMapped ? styles.midiMapped : ''}`}
              onClick={handleMidiClick}
              disabled={disabled}
              title={
                isMidiLearning
                  ? 'Cancel MIDI learn'
                  : isMidiMapped
                    ? `MIDI mapped${midiMappingLabel ? `: ${midiMappingLabel}` : ''} — click to forget`
                    : 'MIDI learn'
              }
              aria-pressed={isMidiLearning}
            >
              <LucideIcon name={isMidiLearning ? 'Radio' : isMidiMapped ? 'Link' : 'Music2'} />
              <span>{isMidiLearning ? 'Listening' : isMidiMapped ? 'Mapped' : 'MIDI'}</span>
            </button>
          ) : null}
          <input
            type="number"
            className={styles.valueInput}
            min={min}
            max={max}
            step={step}
            value={draftValue}
            disabled={disabled}
            aria-label={`${label} value`}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={(e) => commitValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitValue((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
      </div>

      <div className={styles.faderWrap}>
        <HorizontalFader
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          className={styles.fader}
          onChange={onChange}
        />
        {showScale ? (
          <div className={styles.scale} aria-hidden="true">
            <span>{min}</span>
            <span className={styles.scaleMid} style={{ left: `${pct}%` }}>
              {displayDecimals > 0 ? value.toFixed(displayDecimals) : value}
            </span>
            <span>{max}</span>
          </div>
        ) : null}
      </div>

      {showPresets && presets.length > 0 ? (
        <div className={styles.presets}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`${styles.presetBtn} ${value === preset ? styles.presetActive : ''}`}
              disabled={disabled}
              onClick={() => onChange(preset)}
            >
              {displayDecimals > 0 ? preset.toFixed(displayDecimals) : preset}
            </button>
          ))}
        </div>
      ) : null}

      {showOsc ? (
        <div className={styles.oscRow}>
          <LucideIcon name="Activity" />
          <input
            type="text"
            className={styles.oscInput}
            value={draftOsc}
            disabled={disabled}
            spellCheck={false}
            aria-label={`OSC address for ${label}`}
            onChange={(e) => setDraftOsc(e.target.value)}
            onBlur={() => onOscAddressChange?.(draftOsc.trim())}
          />
        </div>
      ) : null}
    </div>
  );
};
