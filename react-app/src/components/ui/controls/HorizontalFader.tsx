import React from 'react';
import { MasterStyledSlider, MasterStyledSliderProps } from './MasterStyledSlider';

export type HorizontalFaderProps = Omit<MasterStyledSliderProps, 'vertical'>;

export const HorizontalFader: React.FC<HorizontalFaderProps> = (props) => (
  <MasterStyledSlider vertical={false} {...props} />
);
