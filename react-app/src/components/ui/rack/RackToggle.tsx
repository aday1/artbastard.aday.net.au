import React from 'react';
import { SkeuoButton } from '../SkeuoButton';

export interface RackToggleProps {
  pressed: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export const RackToggle: React.FC<RackToggleProps> = ({
  pressed,
  onToggle,
  label,
  disabled,
  title,
}) => (
  <SkeuoButton
    type="button"
    active={pressed}
    compact
    variant="pill"
    accent={pressed ? 'green' : 'neutral'}
    disabled={disabled}
    title={title}
    onClick={onToggle}
  >
    {label}
  </SkeuoButton>
);
