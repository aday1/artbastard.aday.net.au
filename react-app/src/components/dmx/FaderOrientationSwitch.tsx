import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';

export type FaderOrientation = 'horizontal' | 'vertical';

interface FaderOrientationSwitchProps {
  value: FaderOrientation;
  onChange: (orientation: FaderOrientation) => void;
  className?: string;
}

export const FaderOrientationSwitch: React.FC<FaderOrientationSwitchProps> = ({
  value,
  onChange,
  className,
}) => (
  <div className={className || 'ab-view-tabs'} role="group" aria-label="Fader orientation">
    <button
      type="button"
      className={`ab-wire-btn ab-view-tab ${value === 'horizontal' ? 'ab-wire-btn--active' : ''}`}
      onClick={() => onChange('horizontal')}
      title="Horizontal sliders"
    >
      <LucideIcon name="AlignJustify" />
      Horizontal
    </button>
    <button
      type="button"
      className={`ab-wire-btn ab-view-tab ${value === 'vertical' ? 'ab-wire-btn--active' : ''}`}
      onClick={() => onChange('vertical')}
      title="Vertical channel strip sliders"
    >
      <LucideIcon name="GripVertical" />
      Vertical
    </button>
  </div>
);
