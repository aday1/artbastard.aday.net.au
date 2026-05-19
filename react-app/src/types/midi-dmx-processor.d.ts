// midi-dmx-processor.d.ts
interface MidiRangeMapping {
  inputMin?: number;
  inputMax?: number;
  outputMin?: number;
  outputMax?: number;
  curve?: number;  // 1 = linear, >1 = exponential, <1 = logarithmic
}

interface MidiDmxProcessor {
  setChannelRangeMapping(dmxChannel: number, mapping: MidiRangeMapping): void;
  getChannelRangeMappings(): Record<number, MidiRangeMapping>;
}

interface Window {
  midiDmxProcessor?: MidiDmxProcessor;
}
