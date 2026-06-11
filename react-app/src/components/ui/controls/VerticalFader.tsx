import React from 'react';
import { DmxVerticalFader, DmxVerticalFaderProps } from './DmxVerticalFader';

export type VerticalFaderProps = Omit<DmxVerticalFaderProps, 'showReadout'>;

export const VerticalFader: React.FC<VerticalFaderProps> = (props) => (
  <DmxVerticalFader {...props} />
);
