import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from '../pages/DmxChannelControlPage.module.scss';

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
  <div className={className || styles.viewModeButtons} role="group" aria-label="Fader orientation">
    <button
      type="button"
      className={`${styles.viewModeButton} ${value === 'horizontal' ? styles.active : ''}`}
      onClick={() => onChange('horizontal')}
      title="Horizontal sliders"
    >
      <LucideIcon name="AlignJustify" />
      Horizontal Sliders
    </button>
    <button
      type="button"
      className={`${styles.viewModeButton} ${value === 'vertical' ? styles.active : ''}`}
      onClick={() => onChange('vertical')}
      title="Vertical channel strip sliders"
    >
      <LucideIcon name="GripVertical" />
      Vertical Sliders
    </button>
  </div>
);
