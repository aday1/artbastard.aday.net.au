import React from 'react';
import { DmxFaderRow } from '../ui/controls';

interface EnhancedSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  midiMapping?: {
    channel?: number;
    note?: number;
    cc?: number;
    controller?: number;
    minValue?: number;
    maxValue?: number;
  };
  oscAddress?: string;
  onMidiLearn?: () => void;
  onMidiForget?: () => void;
  onOscAddressChange?: (address: string) => void;
  isMidiLearning?: boolean;
  disabled?: boolean;
  icon?: string;
  dmxChannels?: number[];
}

const controlSlug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const EnhancedSlider: React.FC<EnhancedSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 255,
  step = 1,
  midiMapping,
  oscAddress = '',
  onMidiLearn,
  onMidiForget,
  onOscAddressChange,
  isMidiLearning = false,
  disabled = false,
  icon,
  dmxChannels = [],
}) => {
  const controlName = controlSlug(label);

  let midiMappingLabel: string | undefined;
  if (midiMapping?.cc !== undefined || midiMapping?.controller !== undefined) {
    const cc = midiMapping.cc ?? midiMapping.controller;
    midiMappingLabel = `CH${midiMapping.channel} CC${cc}`;
  } else if (midiMapping?.note !== undefined) {
    midiMappingLabel = `CH${midiMapping.channel} Note ${midiMapping.note}`;
  }

  const metaParts: string[] = [];
  if (icon) metaParts.push(icon);
  if (dmxChannels.length === 1) metaParts.push(`DMX ${dmxChannels[0]}`);
  else if (dmxChannels.length > 1) {
    if (dmxChannels.length <= 3) metaParts.push(`DMX ${dmxChannels.join(', ')}`);
    else metaParts.push(`DMX ${dmxChannels[0]}-${dmxChannels[dmxChannels.length - 1]} (${dmxChannels.length})`);
  }

  return (
    <DmxFaderRow
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      controlName={controlName}
      meta={metaParts.length > 0 ? metaParts.join(' · ') : undefined}
      oscAddress={oscAddress || `/${controlName}`}
      onOscAddressChange={onOscAddressChange}
      isMidiLearning={isMidiLearning}
      isMidiMapped={!!midiMapping}
      midiMappingLabel={midiMappingLabel}
      onMidiLearn={onMidiLearn}
      onMidiForget={midiMapping ? onMidiForget : undefined}
      onChange={onChange}
    />
  );
};

export default EnhancedSlider;
