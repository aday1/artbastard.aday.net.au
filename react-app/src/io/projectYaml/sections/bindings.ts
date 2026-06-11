import type { MidiMapping } from '../../../store/types';
import { emitYaml, parseYaml } from '../yamlSerializer';

export interface BindingsSectionPayload {
  midiMappings: Record<string, MidiMapping>;
}

export function exportBindings(midiMappings: Record<number, MidiMapping | undefined>): string {
  const cleaned: Record<string, MidiMapping> = {};
  Object.entries(midiMappings).forEach(([dmxChannel, mapping]) => {
    if (mapping) cleaned[String(dmxChannel)] = mapping;
  });
  return emitYaml({ midiMappings: cleaned });
}

export function parseBindings(
  yamlText: string
): { midiMappings: Record<number, MidiMapping>; warnings: string[] } {
  const warnings: string[] = [];
  const raw = parseYaml<BindingsSectionPayload>(yamlText);
  if (!raw || typeof raw.midiMappings !== 'object') {
    throw new Error('bindings.yaml must have a top-level "midiMappings" map.');
  }
  const out: Record<number, MidiMapping> = {};
  Object.entries(raw.midiMappings).forEach(([key, mapping]) => {
    const channel = Number(key);
    if (!Number.isFinite(channel)) {
      warnings.push(`bindings: skipped non-numeric DMX channel key "${key}"`);
      return;
    }
    if (!mapping || typeof mapping !== 'object') {
      warnings.push(`bindings: skipped empty mapping for DMX channel ${channel}`);
      return;
    }
    out[channel] = {
      channel: Number((mapping as any).channel) || 0,
      note: (mapping as any).note !== undefined ? Number((mapping as any).note) : undefined,
      controller:
        (mapping as any).controller !== undefined ? Number((mapping as any).controller) : undefined,
    };
  });
  return { midiMappings: out, warnings };
}
